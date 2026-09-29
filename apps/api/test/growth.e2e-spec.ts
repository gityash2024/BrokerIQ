import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';

/** Growth features: invite-only broker signup, referrals, Housing lead API connector. */
jest.setTimeout(60000);

const uniq = `${process.env.E2E_UNIQ!}g`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Growth features (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settings: SettingsService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let broker: { token: string; orgId: string };
  let referred: { token: string; orgId: string };
  let tenant: { token: string; id: string };
  const realFetch = global.fetch;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json({ verify: (req: any, _res, buf) => (req.rawBody = buf) }));
    app.use(urlencoded({ extended: true })); // as in main.ts (Exotel posts form data)
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    settings = app.get(SettingsService);
    http = request(app.getHttpServer());
    admin = (await http.post('/api/auth/login').send({ email: `admin.${process.env.E2E_UNIQ}@e2e.test`, password: 'Admin@12345' }).expect(200)).body.accessToken;
    await settings.updateAppConfig({ auth: { allowBrokerSignup: false } } as any);
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await settings.updateAppConfig({ auth: { allowBrokerSignup: true } } as any);
    await app.close();
  });

  const registerBroker = (p: string, inviteCode?: string) =>
    http.post('/api/auth/register').send({ name: `Broker ${p}`, email: email(p), password: 'Passw0rd!', accountType: 'BROKER', firmName: `${p} Realty ${uniq}`, inviteCode });

  it('blocks broker signup without an invite while open signup is off', async () => {
    const r = await registerBroker('noinvite').expect(403);
    expect(r.body.message).toContain('invite');
    expect((await http.get('/api/broker-invites/status').expect(200)).body.openSignup).toBe(false);
    // Tenants can still sign up normally.
    const t = await http.post('/api/auth/register').send({ name: 'Tenant', email: email('tenant'), password: 'Passw0rd!', phone: '9811100077' }).expect(201);
    tenant = { token: t.body.accessToken, id: t.body.user.id };
  });

  it('admin invite lets a broker join with a free plan; single-use codes are exhausted', async () => {
    const inv = await http.post('/api/admin/broker-invites').set(auth(admin)).send({ note: 'e2e', grantPlanCode: 'BUSINESS', grantMonths: 6, maxUses: 1 }).expect(201);
    expect(inv.body.code).toMatch(/^BIQ/);
    expect(inv.body.link).toContain(`invite=${inv.body.code}`);
    const check = await http.get(`/api/broker-invites/check/${inv.body.code.toLowerCase()}`).expect(200);
    expect(check.body).toMatchObject({ valid: true, months: 6, plan: { code: 'BUSINESS' } });

    const r = await registerBroker('invited', inv.body.code).expect(201);
    broker = { token: r.body.accessToken, orgId: r.body.user.organizationId };
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { organizationId: broker.orgId }, include: { plan: true } });
    expect(sub.plan.code).toBe('BUSINESS');
    expect(sub.status).toBe('ACTIVE');
    expect(sub.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 150 * 86400_000);

    const again = await registerBroker('invited2', inv.body.code).expect(400);
    expect(again.body.message).toContain('पूरा इस्तेमाल');
    expect((await http.get(`/api/broker-invites/check/${inv.body.code}`).expect(200)).body.valid).toBe(false);
  });

  it('brokers refer other brokers with a personal code (tracked as referral)', async () => {
    const ref = await http.get('/api/broker/referrals').set(auth(broker.token)).expect(200);
    expect(ref.body.enabled).toBe(true);
    expect(ref.body.code).toBeTruthy();
    const joined = await registerBroker('referred', ref.body.code).expect(201);
    referred = { token: joined.body.accessToken, orgId: joined.body.user.organizationId };
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: joined.body.user.organizationId } });
    expect(org.referredByOrgId).toBe(broker.orgId);
    const after = await http.get('/api/broker/referrals').set(auth(broker.token)).expect(200);
    expect(after.body.joined.map((o: any) => o.id)).toContain(org.id);
    // Only super admin manages invites.
    await http.get('/api/admin/broker-invites').set(auth(broker.token)).expect(403);
  });

  it('pulls Housing leads via the API, skips duplicates, and builds requirements', async () => {
    const leadsFromHousing = [
      { lead_name: 'Housing One', lead_phone: '9876501111', flat_id: 501, project_name: 'Sunrise Towers 2 BHK', locality: 'Sector 65', lead_date: Math.floor(Date.now() / 1000) - 3600, service_type: 'rent' },
      { lead_name: 'Housing Two', lead_phone: '9876502222', pg_name: 'Green PG', locality: 'Sector 65', lead_date: Math.floor(Date.now() / 1000) - 1800, service_type: 'rent' },
    ];
    const calls: string[] = [];
    global.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.startsWith('https://pahal.housing.com/')) {
        calls.push(url);
        return new Response(JSON.stringify({ data: leadsFromHousing }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch;

    await http.patch('/api/broker/connectors/housing_api').set(auth(broker.token)).send({ enabled: true, fields: { profileId: '424242', encryptionKey: 'e2e-secret', accountType: 'broker' } }).expect(200);
    const first = await http.post('/api/broker/connectors/housing_api/sync').set(auth(broker.token)).expect(201);
    expect(first.body).toMatchObject({ imported: 2, fetched: 2 });
    const u = new URL(calls[0]);
    expect(u.pathname).toBe('/api/v0/get-broker-leads');
    expect(u.searchParams.get('id')).toBe('424242');
    expect(u.searchParams.get('hash')).toMatch(/^[a-f0-9]{64}$/);
    expect(calls.join(' ')).not.toContain('e2e-secret');

    const second = await http.post('/api/broker/connectors/housing_api/sync').set(auth(broker.token)).expect(201);
    expect(second.body).toMatchObject({ imported: 0, skipped: 2 });

    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId: broker.orgId, phone: { contains: '9876501111' } }, include: { requirement: true } });
    expect(lead.source).toBe('HOUSING');
    expect(lead.sourceDetail).toContain('Sunrise Towers');
    expect(lead.requirement?.bedrooms).toEqual([2]);
    expect(lead.requirement?.localityIds.length).toBe(1);

    const overview = await http.get('/api/broker/connectors').set(auth(broker.token)).expect(200);
    const housing = overview.body.connectors.find((c: any) => c.key === 'housing_api');
    expect(housing.state).toMatchObject({ status: 'ACTIVE', leadsImported: 2 });
    expect(overview.body.portalStats.find((p: any) => p.source === 'HOUSING')).toMatchObject({ week: 2 });
    // The saved key never comes back in plain text.
    expect(JSON.stringify(housing.config)).not.toContain('e2e-secret');
  });

  it('shows a clear error when Housing rejects the key', async () => {
    global.fetch = (async (input: any, init?: any) =>
      String(input).startsWith('https://pahal.housing.com/') ? new Response(JSON.stringify({ apiErrors: { hash: 'invalid' } }), { status: 401 }) : realFetch(input, init)) as typeof fetch;
    const t = await http.post('/api/broker/connectors/housing_api/test').set(auth(broker.token)).expect(201);
    expect(t.body.ok).toBe(false);
    expect(t.body.message).toContain('401');
  });

  it('builds a portal pack for a listing', async () => {
    const localityId = (await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } })).id;
    const l = await http
      .post('/api/listings')
      .set(auth(broker.token))
      .send({ purpose: 'RENT', propertyType: 'APARTMENT', localityId, price: 55000, securityDeposit: 110000, bedrooms: 3, bathrooms: 3, superArea: 1850, furnishing: 'FULLY_FURNISHED', brokerageType: 'MONTH_1', photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }] });
    expect(l.status).toBe(201);
    const pack = await http.get(`/api/broker/portal-pack/${l.body.id}`).set(auth(broker.token)).expect(200);
    expect(pack.body.text).toContain('Monthly rent');
    expect(pack.body.portals.map((p: any) => p.key)).toEqual(['HOUSING', 'ACRES99', 'MAGICBRICKS']);
    // Other firms can't read it.
    const other = await http.post('/api/auth/register').send({ name: 'Other Tenant', email: email('otherfirm'), password: 'Passw0rd!' }).expect(201);
    await http.get(`/api/broker/portal-pack/${l.body.id}`).set(auth(other.body.accessToken)).expect(403);
  });

  // ------------------------------------------------------------------ Phase B
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let localityId: string;
  let coListing: { id: string; slug: string };

  const createAndApprove = async (token: string, extra: object = {}) => {
    const l = await http
      .post('/api/listings')
      .set(auth(token))
      .send({ purpose: 'RENT', propertyType: 'APARTMENT', localityId, price: 58000, securityDeposit: 116000, bedrooms: 3, bathrooms: 3, superArea: 1900, furnishing: 'FULLY_FURNISHED', brokerageType: 'MONTH_1', contactName: 'Mr Owner', contactPhone: '9898989898', photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }], ...extra })
      .expect(201);
    await http.post(`/api/admin/moderation/listings/${l.body.id}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
    return { id: l.body.id as string, slug: l.body.slug as string };
  };

  it('tenant requirement returns matches and gets alerted when a matching listing goes live', async () => {
    localityId = (await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } })).id;
    const r = await http.post('/api/requirements').set(auth(tenant.token)).send({ name: 'Tenant', phone: '9811100077', bedrooms: [3], maxBudget: 60000, localityIds: [localityId], shareWithBrokers: false }).expect(201);
    expect(r.body.requirement.id).toBeTruthy();
    coListing = await createAndApprove(broker.token, { coBroking: true, coBrokingSharePct: 40 });
    await sleep(600);
    const n = await prisma.notification.findFirst({ where: { userId: tenant.id, kind: 'REQUIREMENT_MATCH' } });
    expect(n?.link).toBe(`/property/${coListing.slug}`);
    const m = await http.get(`/api/requirements/${r.body.requirement.id}/matches`).set(auth(tenant.token)).expect(200);
    expect(m.body.map((x: any) => x.id)).toContain(coListing.id);
    // Too-expensive listings are not matches.
    const pricey = await createAndApprove(broker.token, { price: 95000 });
    const m2 = await http.get(`/api/requirements/${r.body.requirement.id}/matches`).set(auth(tenant.token)).expect(200);
    expect(m2.body.map((x: any) => x.id)).not.toContain(pricey.id);
  });

  it('shares a requirement with top brokers only when the tenant agrees', async () => {
    await prisma.organization.update({ where: { id: referred.orgId }, data: { onboarded: true, rankScore: 99, localities: { connect: { id: localityId } } } });
    await http.post('/api/requirements').set(auth(tenant.token)).send({ name: 'Tenant', phone: '9811100077', bedrooms: [2], maxBudget: 40000, localityIds: [localityId], shareWithBrokers: true }).expect(201);
    const lead = await prisma.lead.findFirst({ where: { organizationId: referred.orgId, phone: { contains: '9811100077' } }, include: { requirement: true } });
    expect(lead?.sourceDetail).toContain('ज़रूरत');
    expect(lead?.requirement?.bedrooms).toEqual([2]);
  });

  it('co-broking: network shows other firms’ open listings; contacts only after accept', async () => {
    const net = await http.get('/api/cobroking/network').set(auth(referred.token)).expect(200);
    expect(net.body.items.map((i: any) => i.id)).toContain(coListing.id);
    const own = await http.get('/api/cobroking/network').set(auth(broker.token)).expect(200);
    expect(own.body.items.map((i: any) => i.id)).not.toContain(coListing.id);
    const req = await http.post('/api/cobroking/requests').set(auth(referred.token)).send({ listingId: coListing.id, message: 'Client ready' }).expect(201);
    expect(req.body.sharePct).toBe(40);
    await http.post('/api/cobroking/requests').set(auth(broker.token)).send({ listingId: coListing.id }).expect(400);
    let out = await http.get('/api/cobroking/requests?box=outgoing').set(auth(referred.token)).expect(200);
    expect(out.body[0].ownerOrg.phone).toBeUndefined();
    await http.patch(`/api/cobroking/requests/${req.body.id}`).set(auth(referred.token)).send({ action: 'accept' }).expect(403);
    await http.patch(`/api/cobroking/requests/${req.body.id}`).set(auth(broker.token)).send({ action: 'accept' }).expect(200);
    out = await http.get('/api/cobroking/requests?box=outgoing').set(auth(referred.token)).expect(200);
    expect(out.body[0].status).toBe('ACCEPTED');
    expect('phone' in out.body[0].ownerOrg).toBe(true);
  });

  it('share kit renders post + story PNGs with a tracked link', async () => {
    const k = await http.post(`/api/broker/share-kit/${coListing.id}`).set(auth(broker.token)).send({}).expect(201);
    expect(k.body.link).toContain(`/s/${k.body.code}`);
    expect(k.body.caption).toContain('/month');
    for (const format of ['post', 'story']) {
      const img = await http.get(`/api/public/share-kit/${k.body.code}?format=${format}`).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      expect((img.body as Buffer).subarray(1, 4).toString()).toBe('PNG');
      if (process.env.SHARE_KIT_OUT) require('fs').writeFileSync(`${process.env.SHARE_KIT_OUT}/share-${format}.png`, img.body);
    }
    await http.post(`/api/broker/share-kit/${coListing.id}`).set(auth(referred.token)).send({}).expect(404);
  });

  it('owner CRM syncs from listings; closed rent deals become leases with renewal follow-ups', async () => {
    const owners = await http.get('/api/broker/owners').set(auth(broker.token)).expect(200);
    const owner = owners.body.find((o: any) => o.phone.includes('9898989898'));
    expect(owner?.name).toBe('Mr Owner');
    const lead = await http.post('/api/leads').set(auth(broker.token)).send({ name: 'Lease Tenant', phone: '9876543299', source: 'MANUAL' }).expect(201);
    const deal = await http.post('/api/deals').set(auth(broker.token)).send({ leadId: lead.body.id, listingId: coListing.id, title: 'Lease', dealValue: 58000, commissionAmount: 58000, closedAt: new Date().toISOString() }).expect(201);
    await sleep(500);
    const t = await prisma.tenancy.findFirstOrThrow({ where: { dealId: deal.body.id } });
    expect(t.ownerId).toBe(owner.id);
    expect(Math.round((t.endDate.getTime() - t.startDate.getTime()) / 86400_000)).toBeGreaterThan(330);
    const svc = app.get(require('../src/modules/owners/owners.service').OwnersService);
    await svc.runRenewalReminders(new Date(t.endDate.getTime() - 29 * 86400_000));
    const fu = await prisma.followUp.findFirst({ where: { leadId: lead.body.id, note: { contains: 'Lease' } } });
    expect(fu).toBeTruthy();
    const again = await svc.runRenewalReminders(new Date(t.endDate.getTime() - 29 * 86400_000));
    expect(again).toBe(0);
    const renewed = await http.patch(`/api/broker/tenancies/${t.id}`).set(auth(broker.token)).send({ renewMonths: 11 }).expect(200);
    expect(new Date(renewed.body.startDate).getTime()).toBe(t.endDate.getTime());
  });

  it('invoices: UPI link + PDF for the client, then marked paid', async () => {
    await http.patch('/api/broker/payment-settings').set(auth(broker.token)).send({ upiId: 'bad upi' }).expect(400);
    await http.patch('/api/broker/payment-settings').set(auth(broker.token)).send({ upiId: 'arjun@okicici', invoicePrefix: 'ar' }).expect(200);
    const inv = await http.post('/api/broker/invoices').set(auth(broker.token)).send({ clientName: 'Client A', clientPhone: '9876543288', items: [{ description: 'Brokerage — 1 month rent', amount: 58000 }], gstPct: 18 }).expect(201);
    expect(inv.body.number).toBe('AR-0001');
    expect(inv.body.total).toBe(68440);
    const token = inv.body.link.split('/pay/')[1];
    const pub = await http.get(`/api/public/invoices/${token}`).expect(200);
    expect(pub.body.upi).toContain('pa=arjun%40okicici');
    expect(pub.body.upi).toContain('am=68440.00');
    expect(pub.body.publicToken).toBeUndefined();
    const pdf = await http.get(`/api/public/invoices/${token}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    await http.patch(`/api/broker/invoices/${inv.body.id}`).set(auth(broker.token)).send({ status: 'PAID', paidMode: 'UPI', paidRef: 'UTR123' }).expect(200);
    expect((await http.get(`/api/public/invoices/${token}`).expect(200)).body.upi).toBeNull();
    await http.get(`/api/broker/invoices/${inv.body.id}`).set(auth(referred.token)).expect(404);
  });

  it('Exotel click-to-call, status callback and incoming-call leads', async () => {
    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId: broker.orgId, phone: { contains: '9876543299' } } });
    const r0 = await http.post(`/api/leads/${lead.id}/call`).set(auth(broker.token)).expect((res) => expect([400, 424]).toContain(res.status));
    expect(r0.body.code === 'INTEGRATION_NOT_CONFIGURED' || String(r0.body.message).includes('mobile')).toBe(true);
    const brokerUser = await prisma.user.findFirstOrThrow({ where: { organizationId: broker.orgId, role: 'BROKER_ADMIN' } });
    await prisma.user.update({ where: { id: brokerUser.id }, data: { phone: '+919811155555' } });
    await http.patch('/api/broker/connectors/exotel').set(auth(broker.token)).send({ enabled: true, fields: { accountSid: 'acme', apiKey: 'k', apiToken: 't', exoPhone: '08047112345', sourceMap: '08047112345=HOUSING' } }).expect(200);
    const sent: { url: string; body: string }[] = [];
    global.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes('exotel.com')) {
        sent.push({ url, body: String(init?.body ?? '') });
        return new Response(JSON.stringify({ Call: { Sid: `CA${uniq}`, Status: 'in-progress' } }), { status: 200 });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    const c = await http.post(`/api/leads/${lead.id}/call`).set(auth(broker.token)).expect(201);
    expect(sent[0].url).toBe('https://api.exotel.com/v1/Accounts/acme/Calls/connect.json');
    expect(sent[0].body).toContain('CallerId=08047112345');
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: broker.orgId } });
    await http.post(`/api/webhooks/exotel/${org.webhookKey}/status`).type('form').send({ CallSid: `CA${uniq}`, Status: 'completed', ConversationDuration: '95', CustomField: c.body.id }).expect(200);
    const act = await prisma.activity.findFirst({ where: { leadId: lead.id, type: 'CALL', callOutcome: 'CONNECTED' } });
    expect(act?.durationSec).toBe(95);
    const inc = await http.get(`/api/webhooks/exotel/${org.webhookKey}/connect?CallSid=CI${uniq}&CallFrom=09876500123&CallTo=08047112345`).expect(200);
    expect(inc.text).toMatch(/^0?\d{10}$/);
    const newLead = await prisma.lead.findFirstOrThrow({ where: { organizationId: broker.orgId, phone: { contains: '9876500123' } } });
    expect(newLead.source).toBe('HOUSING');
    global.fetch = realFetch;
  });

  it('ranking: response speed + rating → rankScore, copied to listings for search order', async () => {
    await prisma.organization.update({ where: { id: broker.orgId }, data: { verification: 'VERIFIED', rating: 4.8, reviewCount: 10 } });
    await http.post('/api/admin/ranking/recompute').set(auth(admin)).expect(201);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: broker.orgId } });
    expect(org.rankScore).toBeGreaterThanOrEqual(60);
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: coListing.id } });
    expect(l.rankBoost).toBe(org.rankScore);
    const wr = await http.get('/api/broker/weekly-report').set(auth(broker.token)).expect(200);
    expect(wr.body.summary.leads).toBeGreaterThan(0);
  });
});
