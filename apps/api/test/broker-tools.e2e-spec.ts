import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeaturesService } from '../src/core/features/features.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { MailService } from '../src/core/mail/mail.service';
import { LeadScoringService } from '../src/modules/leads/lead-scoring.service';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';

/** Broker growth tools: lead scoring, campaigns, visiting card, branding, social post, comparison PDF, reports, owner report. */
jest.setTimeout(90000);

const uniq = `${process.env.E2E_UNIQ!}t`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const binary = (res: any, cb: (e: Error | null, b: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
const phone = (n: number) => `98${String(Date.now() + n).slice(-8)}`;

describe('Broker growth tools (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let broker: { token: string; orgId: string; slug: string; userId: string };
  let other: { token: string; orgId: string };
  let localityId: string;
  const realFetch = global.fetch;
  const graphCalls: { url: string; body: any }[] = [];

  const newListing = async (extra: object = {}) => {
    const l = await http
      .post('/api/listings')
      .set(auth(broker.token))
      .send({
        purpose: 'RENT',
        propertyType: 'APARTMENT',
        localityId,
        price: 42000,
        securityDeposit: 84000,
        bedrooms: 2,
        bathrooms: 2,
        superArea: 1300,
        furnishing: 'SEMI_FURNISHED',
        brokerageType: 'MONTH_1',
        contactName: 'Tools Owner',
        contactPhone: '9812345601',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }],
        ...extra,
      })
      .expect(201);
    await http.post(`/api/admin/moderation/listings/${l.body.id}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
    return l.body as { id: string; slug: string };
  };

  beforeAll(async () => {
    // Meta Graph API and remote photos are faked; everything else goes to the real network stack.
    global.fetch = (async (input: any, init?: any) => {
      const url = String(input?.url ?? input);
      if (url.startsWith('https://graph.facebook.com/')) {
        graphCalls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
        const id = url.includes('/media_publish') ? 'ig_post_1' : url.endsWith('/media') ? 'ig_container_1' : 'fb_post_1';
        return new Response(JSON.stringify({ id, post_id: url.includes('/photos') ? 'fb_post_1' : undefined }), { status: 200 });
      }
      if (url.startsWith('https://res.cloudinary.com/')) return new Response('nope', { status: 404 });
      return realFetch(input, init);
    }) as typeof fetch;

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json());
    app.use(urlencoded({ extended: true }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    admin = (
      await http
        .post('/api/auth/login')
        .send({ email: `admin.${process.env.E2E_UNIQ}@e2e.test`, password: 'Admin@12345' })
        .expect(200)
    ).body.accessToken;
    await app.get(SettingsService).updateAppConfig({ auth: { allowBrokerSignup: true } } as any);
    await prisma.featureFlag.deleteMany({
      where: { key: { in: ['campaigns', 'photo_branding', 'visiting_card', 'social_autopost', 'comparison_pdf', 'broker_reports', 'owner_reports'] } },
    });
    app.get(FeaturesService).invalidate();
    const b = await http
      .post('/api/auth/register')
      .send({ name: 'Tools Broker', email: email('broker'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Tools Realty ${uniq}` })
      .expect(201);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: b.body.user.organizationId } });
    broker = { token: b.body.accessToken, orgId: org.id, slug: org.slug, userId: b.body.user.id };
    const o = await http
      .post('/api/auth/register')
      .send({ name: 'Other Broker', email: email('other'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Other Tools ${uniq}` })
      .expect(201);
    other = { token: o.body.accessToken, orgId: o.body.user.organizationId };
    localityId = (await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } })).id;
  });

  afterAll(async () => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
    await app.close();
  });

  it('lead scoring explains the score and respects a manual temperature', async () => {
    const lead = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Score Lead', phone: phone(1), source: 'WEBSITE', requirement: { localityIds: [localityId], bedrooms: [2], maxBudget: 50000 } })
      .expect(201);
    await newListing();
    const scoring = app.get(LeadScoringService);
    const r = await scoring.rescore(lead.body.id);
    expect(r!.score).toBeGreaterThan(20);
    expect(r!.reasons).toEqual(expect.arrayContaining(['सीधी enquiry (high intent source)', 'Requirement पूरी है']));
    let row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.body.id } });
    expect(row.scoreReasons.length).toBeGreaterThan(0);
    expect(row.temperature).toBe(r!.temperature);

    await http.patch(`/api/leads/${lead.body.id}`).set(auth(broker.token)).send({ temperature: 'COLD' }).expect(200);
    await prisma.lead.update({ where: { id: lead.body.id }, data: { stage: 'NEGOTIATION' } });
    await scoring.rescore(lead.body.id);
    row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.body.id } });
    expect(row.temperature).toBe('COLD');
    expect(row.temperatureManual).toBe(true);
    const list = await http.get('/api/leads?sort=score').set(auth(broker.token)).expect(200);
    expect(list.body.items[0]).toHaveProperty('score');
  });

  it('campaigns: segment preview, own-number rule, email send with unsubscribe, STOP opt-out', async () => {
    const tag = `camp${Date.now()}`;
    const a = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Amit Camp', phone: phone(2), email: email('amit'), source: 'MANUAL', tags: [tag] })
      .expect(201);
    const b = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Bina Camp', phone: phone(3), email: email('bina'), source: 'MANUAL', tags: [tag] })
      .expect(201);
    const c = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Chetan Camp', phone: phone(4), source: 'MANUAL', tags: [tag] })
      .expect(201);
    await prisma.lead.update({ where: { id: c.body.id }, data: { optedOutAt: new Date() } });

    const prev = await http
      .post('/api/broker/campaigns/preview')
      .set(auth(broker.token))
      .send({ segment: { tags: [tag] } })
      .expect(201);
    expect(prev.body).toMatchObject({ total: 2, withEmail: 2, whatsappConnected: false });

    // WhatsApp campaigns need the firm's own number (never the platform's).
    const wa = await http
      .post('/api/broker/campaigns')
      .set(auth(broker.token))
      .send({ name: 'WA offer', channel: 'WHATSAPP', segment: { tags: [tag] }, templateName: 'new_listing' })
      .expect(201);
    const waStart = await http.post(`/api/broker/campaigns/${wa.body.id}/start`).set(auth(broker.token)).expect(424);
    expect(waStart.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    await http.post('/api/broker/campaigns').set(auth(broker.token)).send({ name: 'Bad', channel: 'EMAIL', segment: {} }).expect(400);

    const settings = app.get(SettingsService);
    const realResolve = settings.resolve.bind(settings);
    jest
      .spyOn(settings, 'resolve')
      .mockImplementation(async (key: string, orgId?: string | null) => (key === 'smtp' ? { host: 'x' } : realResolve(key, orgId)));
    const sent: any[] = [];
    // Only campaign mails (they carry an unsubscribe link); new-listing alerts to other users' saved requirements are ignored.
    jest.spyOn(app.get(MailService), 'send').mockImplementation(async (m: any) => void (String(m.html).includes('/public/unsubscribe/') && sent.push(m)));

    const em = await http
      .post('/api/broker/campaigns')
      .set(auth(broker.token))
      .send({ name: 'Diwali offer', channel: 'EMAIL', segment: { tags: [tag] }, emailSubject: 'Hi {name}', emailBody: 'Nayi listings, {name}!' })
      .expect(201);
    const started = await http.post(`/api/broker/campaigns/${em.body.id}/start`).set(auth(broker.token)).expect(201);
    expect(started.body).toMatchObject({ status: 'RUNNING', total: 2 });
    await http
      .patch(`/api/broker/campaigns/${em.body.id}`)
      .set(auth(broker.token))
      .send({ name: 'x', channel: 'EMAIL', segment: {}, emailSubject: 'a', emailBody: 'b' })
      .expect(400);

    const svc = app.get(CampaignsService);
    await svc.runBatch(em.body.id);
    await svc.runBatch(em.body.id);
    const done = await http.get(`/api/broker/campaigns/${em.body.id}`).set(auth(broker.token)).expect(200);
    expect(done.body).toMatchObject({ status: 'DONE', sent: 2, failed: 0 });
    expect(sent.map((m) => m.subject).sort()).toEqual(['Hi Amit', 'Hi Bina']);
    // Another firm can't see it.
    await http.get(`/api/broker/campaigns/${em.body.id}`).set(auth(other.token)).expect(404);

    const link = /href="([^"]+\/api\/public\/unsubscribe\/[^"]+)"/.exec(sent[0].html)![1];
    const path = link.slice(link.indexOf('/api/'));
    await http.get(path).expect(200);
    await http.get(`${path}x`).expect(404);
    const leadId = sent[0].subject === 'Hi Amit' ? a.body.id : b.body.id;
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).optedOutAt).not.toBeNull();

    // WhatsApp "STOP" / "START".
    const wa2 = app.get(WhatsAppService) as any;
    const other2 = sent[0].subject === 'Hi Amit' ? b.body : a.body;
    await wa2.handleOptOut(broker.orgId, other2.id, other2.phone, 'STOP');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: other2.id } })).optedOutAt).not.toBeNull();
    await wa2.handleOptOut(broker.orgId, other2.id, other2.phone, 'start');
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: other2.id } })).optedOutAt).toBeNull();

    // BrokerIQ team can see and stop campaigns.
    const all = await http.get('/api/admin/campaigns').set(auth(admin)).expect(200);
    expect(all.body.some((x: any) => x.id === em.body.id)).toBe(true);
    await http.get('/api/admin/campaigns').set(auth(broker.token)).expect(403);
    jest.restoreAllMocks();
  });

  it('digital visiting card: page data, contact file, QR; switch turns it off', async () => {
    const card = await http.get(`/api/public/card/${broker.slug}?a=${broker.userId}`).expect(200);
    expect(card.body.org.name).toContain('Tools Realty');
    expect(card.body.agent.name).toBe('Tools Broker');
    expect(card.body.url).toContain(`/card/${broker.slug}`);
    const vcf = await http.get(`/api/public/card/${broker.slug}/vcf?a=${broker.userId}`).expect(200);
    expect(vcf.headers['content-type']).toContain('text/vcard');
    expect(vcf.text).toContain('BEGIN:VCARD');
    expect(vcf.text).toContain('FN:Tools Broker');
    const qr = await http.get(`/api/public/card/${broker.slug}/qr`).buffer(true).parse(binary).expect(200);
    expect((qr.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
    // An id from another firm is not shown as this firm's agent.
    const stranger = await http.get(`/api/public/card/${broker.slug}?a=${other.orgId}`).expect(200);
    expect(stranger.body.agent).toBeNull();
    await prisma.featureFlag.upsert({ where: { key: 'visiting_card' }, create: { key: 'visiting_card', enabled: false }, update: { enabled: false } });
    app.get(FeaturesService).invalidate();
    await http.get(`/api/public/card/${broker.slug}`).expect(403);
    await prisma.featureFlag.update({ where: { key: 'visiting_card' }, data: { enabled: true } });
    app.get(FeaturesService).invalidate();
  });

  it('photo branding settings are validated and saved', async () => {
    const get = await http.get('/api/broker/branding').set(auth(broker.token)).expect(200);
    expect(get.body.photoBranding).toMatchObject({ watermark: false, enhance: false, position: 'br' });
    await http
      .put('/api/broker/branding')
      .set(auth(broker.token))
      .send({ photoBranding: { watermark: true, opacity: 3 } })
      .expect(400);
    const put = await http
      .put('/api/broker/branding')
      .set(auth(broker.token))
      .send({ photoBranding: { watermark: true, enhance: true, position: 'tl', opacity: 0.5, text: 'Tools Realty' } })
      .expect(200);
    expect(put.body.photoBranding).toMatchObject({ watermark: true, enhance: true, position: 'tl' });
  });

  it('social auto-post: needs the firm’s Meta Page; posts to Facebook + Instagram', async () => {
    const listing = await newListing();
    const miss = await http.post(`/api/broker/listings/${listing.id}/social-post`).set(auth(broker.token)).expect(424);
    expect(miss.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    await http
      .patch('/api/broker/connectors/meta_pages')
      .set(auth(broker.token))
      .send({ enabled: true, fields: { pageId: '111', accessToken: 'tok', igUserId: '222' } })
      .expect(200);
    const r = await http.post(`/api/broker/listings/${listing.id}/social-post`).set(auth(broker.token)).expect(201);
    expect(r.body).toEqual([
      { platform: 'FACEBOOK', ok: true },
      { platform: 'INSTAGRAM', ok: true },
    ]);
    expect(graphCalls.find((c) => c.url.endsWith('/111/photos'))?.body.caption).toContain('/month');
    expect(graphCalls.find((c) => c.url.endsWith('/222/media'))?.body.image_url).toContain('type=jpg');
    const posts = await http.get('/api/broker/social-posts').set(auth(broker.token)).expect(200);
    expect(posts.body.filter((p: any) => p.listingId === listing.id && p.status === 'POSTED')).toHaveLength(2);
    // Other firms can't post someone else's listing.
    await http.post(`/api/broker/listings/${listing.id}/social-post`).set(auth(other.token)).expect(404);
  });

  it('comparison PDF for a client (public link, open count)', async () => {
    const [l1, l2] = [await newListing({ price: 40000 }), await newListing({ price: 47000, bedrooms: 3 })];
    const lead = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Compare Client', phone: phone(5), source: 'MANUAL' })
      .expect(201);
    await http
      .post('/api/broker/comparisons')
      .set(auth(broker.token))
      .send({ listingIds: [l1.id] })
      .expect(400);
    await http
      .post('/api/broker/comparisons')
      .set(auth(other.token))
      .send({ listingIds: [l1.id, l2.id], leadId: lead.body.id })
      .expect(404);
    const c = await http
      .post('/api/broker/comparisons')
      .set(auth(broker.token))
      .send({ listingIds: [l1.id, l2.id], leadId: lead.body.id })
      .expect(201);
    const path = c.body.pdfUrl.slice(c.body.pdfUrl.indexOf('/api/'));
    const pdf = await http.get(path).buffer(true).parse(binary).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    expect((await prisma.comparison.findUniqueOrThrow({ where: { token: c.body.token } })).opens).toBe(1);
    const acts = await prisma.activity.findMany({ where: { leadId: lead.body.id, type: 'PROPERTY_SHARED' } });
    expect(acts.length).toBe(1);
  });

  it('reports: summary, CSV (Excel/Tally) and PDF for firm admins', async () => {
    const lead = await http
      .post('/api/leads')
      .set(auth(broker.token))
      .send({ name: 'Report Client', phone: phone(6), source: 'MANUAL' })
      .expect(201);
    await http
      .post('/api/deals')
      .set(auth(broker.token))
      .send({
        leadId: lead.body.id,
        title: 'Report deal',
        dealValue: 60000,
        commissionAmount: 60000,
        commissionReceived: 20000,
        closedAt: new Date().toISOString(),
      })
      .expect(201);
    const s = await http.get('/api/broker/reports').set(auth(broker.token)).expect(200);
    expect(s.body.totals).toMatchObject({ deals: 1, commission: 60000, received: 20000, pending: 40000 });
    expect(s.body.months).toHaveLength(1);
    const csv = await http.get('/api/broker/reports/export.csv?type=deals').set(auth(broker.token)).expect(200);
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('Report deal');
    const gst = await http.get('/api/broker/reports/export.csv?type=gst').set(auth(broker.token)).expect(200);
    expect(gst.text).toContain('Taxable value');
    const pdf = await http.get('/api/broker/reports/export.pdf').set(auth(broker.token)).buffer(true).parse(binary).expect(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    // Mobile: signed 10-minute link opened in the browser (no auth header).
    const link = await http.post('/api/broker/reports/download-link').set(auth(broker.token)).send({ format: 'csv', type: 'deals' }).expect(201);
    const path = link.body.url.slice(link.body.url.indexOf('/api/'));
    expect((await http.get(path).expect(200)).text).toContain('Report deal');
    await http.get(`${path.slice(0, -3)}xyz`).expect(404);
    const pdfLink = await http.post('/api/broker/reports/download-link').set(auth(broker.token)).send({ format: 'pdf' }).expect(201);
    const pdf2 = await http
      .get(pdfLink.body.url.slice(pdfLink.body.url.indexOf('/api/')))
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect((pdf2.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    await http.get('/api/broker/reports?from=2026-13-01').set(auth(broker.token)).expect(400);
    await http.get('/api/broker/reports?from=2026-09-30&to=2026-01-01').set(auth(broker.token)).expect(400);
  });

  it('owner report link: masked enquiries, revocable', async () => {
    const owners = await http.get('/api/broker/owners').set(auth(broker.token)).expect(200);
    const owner = owners.body.find((o: any) => o.phone.includes('9812345601'));
    expect(owner).toBeTruthy();
    const listing = await prisma.listing.findFirstOrThrow({ where: { ownerId: owner.id, status: 'ACTIVE' } });
    await prisma.enquiry.create({ data: { listingId: listing.id, organizationId: broker.orgId, name: 'Rahul Sharma', phone: '9811111111' } });
    const link = await http.post(`/api/broker/owners/${owner.id}/report-link`).set(auth(broker.token)).expect(201);
    const token = link.body.url.split('/o/')[1];
    const view = await http.get(`/api/public/owner-report/${token}`).expect(200);
    expect(view.body.owner.name).toBe('Tools Owner');
    expect(view.body.listings.length).toBeGreaterThan(0);
    expect(view.body.recentEnquiries[0].name).toBe('Rahul S.');
    expect(JSON.stringify(view.body)).not.toContain('9811111111');
    await http.put(`/api/broker/owners/${owner.id}/weekly-report`).set(auth(broker.token)).send({ on: true }).expect(400); // no email
    await http.post(`/api/broker/owners/${owner.id}/report-link`).set(auth(other.token)).expect(404);
    await http.delete(`/api/broker/owners/${owner.id}/report-link`).set(auth(broker.token)).expect(200);
    await http.get(`/api/public/owner-report/${token}`).expect(404);
  });
});
