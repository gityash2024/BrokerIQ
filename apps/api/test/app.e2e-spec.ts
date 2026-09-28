import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end suite against a real PostgreSQL database.
 * Run: DATABASE_URL=postgresql://.../brokeriq_test bash test/setup-db.sh && pnpm test:e2e
 */
jest.setTimeout(60000);

const uniq = process.env.E2E_UNIQ!;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('BrokerIQ API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let brokerA: { token: string; refresh: string; orgId: string };
  let brokerB: { token: string };
  let user: { token: string; id: string };
  let localityId: string;
  let listingId: string;
  let listingSlug: string;
  let webhookKey: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json({ verify: (req: any, _res, buf) => (req.rawBody = buf) }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    const a = await http.post('/api/auth/login').send({ email: email('admin'), password: 'Admin@12345' }).expect(200);
    admin = a.body.accessToken;
    const loc = await prisma.locality.findFirstOrThrow({ where: { name: 'Sector 65' } });
    localityId = loc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('health is public, protected routes need auth', async () => {
    await http.get('/api/health').expect(200);
    const r = await http.get('/api/auth/me').expect(401);
    expect(r.body.code).toBe('UNAUTHORIZED');
  });

  it('registers a user and two broker firms', async () => {
    const u = await http.post('/api/auth/register').send({ name: 'Neha Buyer', email: email('user'), password: 'Passw0rd!', phone: '9811100001' }).expect(201);
    user = { token: u.body.accessToken, id: u.body.user.id };
    expect(u.body.user.role).toBe('USER');

    const b = await http.post('/api/auth/register').send({ name: 'Arjun', email: email('brokera'), password: 'Passw0rd!', accountType: 'BROKER', firmName: 'Arjun Estates' }).expect(201);
    expect(b.body.user.role).toBe('BROKER_ADMIN');
    const onb = await http.post('/api/broker/onboarding').set(auth(b.body.accessToken)).send({ firmName: 'Arjun Estates', phone: '9876500011', localityIds: [localityId] }).expect(201);
    brokerA = { token: onb.body.accessToken, refresh: onb.body.refreshToken, orgId: onb.body.user.organizationId };
    webhookKey = (await prisma.organization.findUniqueOrThrow({ where: { id: brokerA.orgId } })).webhookKey;

    const b2 = await http.post('/api/auth/register').send({ name: 'Other', email: email('brokerb'), password: 'Passw0rd!', accountType: 'BROKER', firmName: 'Other Realty' }).expect(201);
    brokerB = { token: b2.body.accessToken };
  });

  it('enforces RBAC: users cannot reach broker or admin APIs', async () => {
    await http.get('/api/leads').set(auth(user.token)).expect(403);
    await http.get('/api/admin/dashboard').set(auth(user.token)).expect(403);
    await http.get('/api/admin/dashboard').set(auth(brokerA.token)).expect(403);
    await http.get('/api/admin/dashboard').set(auth(admin)).expect(200);
  });

  it('broker posts a listing → moderation → admin approves → public search', async () => {
    const l = await http
      .post('/api/listings')
      .set(auth(brokerA.token))
      .send({ purpose: 'RENT', propertyType: 'APARTMENT', localityId, price: 45000, securityDeposit: 90000, brokerageType: 'MONTH_1', bedrooms: 3, bathrooms: 3, superArea: 2100, photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }], amenities: ['lift', 'gym'] })
      .expect(201);
    expect(l.body.status).toBe('PENDING_REVIEW');
    expect(l.body.title).toBe('3 BHK Apartment for Rent in Sector 65, Gurgaon');
    expect(l.body.brokerageType).toBe('MONTH_1');
    listingId = l.body.id;
    listingSlug = l.body.slug;

    let s = await http.get('/api/listings?localities=sector-65-gurgaon').expect(200);
    expect(s.body.items.find((x: any) => x.id === listingId)).toBeUndefined();

    await http.post(`/api/admin/moderation/listings/${listingId}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
    s = await http.get('/api/listings?localities=sector-65-gurgaon&bedrooms=3&minPrice=40000').expect(200);
    expect(s.body.items.map((x: any) => x.id)).toContain(listingId);

    const d = await http.get(`/api/listings/${listingSlug}`).expect(200);
    expect(d.body.contactPhone).not.toContain('9876500011'); // masked for public
    await http.post(`/api/listings/${listingId}/contact`).expect(403); // login required
    const c = await http.post(`/api/listings/${listingId}/contact`).set(auth(user.token)).expect(201);
    expect(c.body.phone).toBe('+919876500011');
  });

  it('rental marketplace: sale listings and plots are rejected, legacy sale listings stay hidden', async () => {
    const sale = await http.post('/api/listings').set(auth(brokerA.token)).send({ purpose: 'SALE', propertyType: 'APARTMENT', localityId, price: 9000000, photos: [] }).expect(400);
    expect(sale.body.code).toBe('VALIDATION_FAILED');
    await http.post('/api/listings').set(auth(brokerA.token)).send({ propertyType: 'RESIDENTIAL_PLOT', localityId, price: 20000, photos: [] }).expect(400);
    // purpose defaults to RENT
    const r = await http.post('/api/listings').set(auth(brokerA.token)).send({ propertyType: 'PG', localityId, price: 12000, submit: false, photos: [] }).expect(201);
    expect(r.body.purpose).toBe('RENT');
    // a legacy sale listing (created before the pivot) never shows in public search or detail
    const legacy = await prisma.listing.create({ data: { slug: `legacy-sale-${Date.now()}`, purpose: 'SALE', propertyType: 'APARTMENT', category: 'RESIDENTIAL', status: 'ACTIVE', title: 'Legacy sale flat', localityId, price: 9000000, postedByType: 'BROKER', postedById: (await prisma.user.findFirstOrThrow({ where: { organizationId: brokerA.orgId } })).id, organizationId: brokerA.orgId } });
    const s = await http.get('/api/listings?localities=sector-65-gurgaon&purpose=SALE').expect(200);
    expect(s.body.items.find((x: any) => x.id === legacy.id)).toBeUndefined();
    await http.get(`/api/listings/${legacy.slug}`).expect(404);
    // partial PATCH must not wipe photos / amenities (no schema defaults on update)
    const before = await prisma.listingMedia.count({ where: { listingId } });
    await http.patch(`/api/listings/${listingId}`).set(auth(brokerA.token)).send({ priceNegotiable: true }).expect(200);
    expect(await prisma.listingMedia.count({ where: { listingId } })).toBe(before);
  });

  it('scanner import creates rent listings with deposit/brokerage, drafts or straight to approval', async () => {
    const row = { propertyType: 'APARTMENT', localityId, price: 40000, securityDeposit: 80000, brokerageType: 'DAYS_15', bedrooms: 2, societyName: 'Test Society', contactPhone: '9811122233' };
    const d = await http.post('/api/ai/scan/import').set(auth(brokerA.token)).send({ rows: [row] }).expect(201);
    expect(d.body.status).toBe('DRAFT');
    const s = await http.post('/api/ai/scan/import').set(auth(brokerA.token)).send({ rows: [{ ...row, unit: 'B-1204' }], submit: true }).expect(201);
    expect(s.body.status).toBe('PENDING_REVIEW');
    const l = await prisma.listing.findUniqueOrThrow({ where: { id: s.body.ids[0] } });
    expect(l).toMatchObject({ purpose: 'RENT', status: 'PENDING_REVIEW', securityDeposit: 80000, brokerageType: 'DAYS_15' });
    expect(l.title).toContain('for Rent');
    await http.post('/api/ai/scan/import').set(auth(brokerA.token)).send({ rows: [{ ...row, propertyType: 'RESIDENTIAL_PLOT' }] }).expect(400);
    await http.post('/api/ai/scan/import').set(auth(user.token)).send({ rows: [row] }).expect(403);
  });

  it('location & contacts need explicit consent, only Super Admin can read them, withdrawal deletes', async () => {
    // nothing is accepted before consent
    await http.post('/api/me/location').set(auth(user.token)).send({ latitude: 28.45, longitude: 77.03 }).expect(403);
    await http.post('/api/me/contacts/sync').set(auth(user.token)).send({ contacts: [{ name: 'Ravi', phones: ['9811100077'] }] }).expect(403);
    await http.post('/api/me/consent').set(auth(user.token)).send({ kind: 'LOCATION', granted: true, platform: 'android' }).expect(201);
    await http.post('/api/me/consent').set(auth(user.token)).send({ kind: 'CONTACTS', granted: true, platform: 'android' }).expect(201);
    await http.post('/api/me/location').set(auth(user.token)).send({ latitude: 28.45, longitude: 77.03, platform: 'android' }).expect(201);
    const sync = await http.post('/api/me/contacts/sync').set(auth(user.token)).send({ contacts: [{ name: 'Ravi', phones: ['9811100077', '+91 98111 00077'] }, { name: 'Sita', phones: ['9811100088'], emails: ['Sita@x.in'] }] }).expect(201);
    expect(sync.body.total).toBe(2); // same number twice → one contact
    // stored encrypted
    const raw = await prisma.userContact.findFirstOrThrow({ where: { userId: user.id } });
    expect(raw.phoneEnc).not.toContain('98111');
    // nobody but Super Admin can read it
    await http.get('/api/admin/user-data').set(auth(brokerA.token)).expect(403);
    await http.get(`/api/admin/user-data/${user.id}`).set(auth(user.token)).expect(403);
    const d = await http.get(`/api/admin/user-data/${user.id}`).set(auth(admin)).expect(200);
    expect(d.body.contacts.map((c: any) => c.phone).sort()).toEqual(['+919811100077', '+919811100088']);
    expect(d.body.locations).toHaveLength(1);
    const csv = await http.get(`/api/admin/user-data/${user.id}/contacts.csv`).set(auth(admin)).expect(200);
    expect(csv.text).toContain('Sita');
    expect(await prisma.auditLog.count({ where: { action: 'privacy.admin.view', entityId: user.id } })).toBe(1);
    // withdrawing consent deletes the data
    await http.delete('/api/me/data/CONTACTS').set(auth(user.token)).expect(200);
    expect(await prisma.userContact.count({ where: { userId: user.id } })).toBe(0);
    const st = await http.get('/api/me/privacy').set(auth(user.token)).expect(200);
    expect(st.body.contacts.granted).toBe(false);
    expect(st.body.location.granted).toBe(true);
  });

  it('every listing needs admin approval: edits and re-activation go back to review', async () => {
    // content edit on an approved listing → back to review, hidden from public
    const e = await http.patch(`/api/listings/${listingId}`).set(auth(brokerA.token)).send({ description: 'Updated description with more details' }).expect(200);
    expect(e.body.status).toBe('PENDING_REVIEW');
    // trying to force it live via status change is not allowed for non-admins
    const f = await http.patch(`/api/listings/${listingId}/status`).set(auth(brokerA.token)).send({ status: 'ACTIVE' }).expect(200);
    expect(f.body.status).toBe('PENDING_REVIEW');
    // owners (plain users) go through review too
    const o = await http.post('/api/listings').set(auth(user.token)).send({ purpose: 'RENT', propertyType: 'APARTMENT', localityId, price: 45000, bedrooms: 2, superArea: 1200, photos: [] }).expect(201);
    expect(o.body.status).toBe('PENDING_REVIEW');
    // admins are notified
    const n = await prisma.notification.count({ where: { kind: 'MODERATION', data: { path: ['listingId'], equals: o.body.id } } });
    expect(n).toBeGreaterThan(0);
    // approve again so later tests see it live
    await http.post(`/api/admin/moderation/listings/${listingId}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
  });

  it('enquiry becomes a CRM lead and repeat enquiries merge by phone', async () => {
    await http.post('/api/enquiries').set(auth(user.token)).send({ listingId, name: 'Neha', phone: '98111 00001', message: 'Visit on Sunday?' }).expect(201);
    await http.post('/api/enquiries').send({ listingId, name: 'Neha B', phone: '+91-9811100001' }).expect(201);
    const leads = await http.get('/api/leads').set(auth(brokerA.token)).expect(200);
    const mine = leads.body.items.filter((x: any) => x.phone === '+919811100001');
    expect(mine).toHaveLength(1);
    const detail = await prisma.lead.findFirstOrThrow({ where: { id: mine[0].id } });
    expect(detail.repeatCount).toBe(1);
    expect(detail.source).toBe('WEBSITE');
  });

  it('isolates organizations', async () => {
    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId: brokerA.orgId } });
    await http.get(`/api/leads/${lead.id}`).set(auth(brokerB.token)).expect(404);
    const other = await http.get('/api/leads').set(auth(brokerB.token)).expect(200);
    expect(other.body.total).toBe(0);
  });

  it('ingests leads from the public webhook with source mapping', async () => {
    const r = await http.post(`/api/webhooks/leads/${webhookKey}`).send({ full_name: 'Karan Mehta', mobile: '9900112233', source: '99acres', project: 'DLF Privana' }).expect(200);
    expect(r.body.ok).toBe(true);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.body.leadId } });
    expect(lead.source).toBe('ACRES99');
    expect(lead.sourceDetail).toBe('DLF Privana');
    await http.post('/api/webhooks/leads/wrong-key').send({ phone: '9900112233' }).expect(404);
    const bad = await http.post(`/api/webhooks/leads/${webhookKey}`).send({ name: 'no phone' }).expect(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
  });

  it('returns INTEGRATION_NOT_CONFIGURED with a settings link when credentials are missing', async () => {
    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId: brokerA.orgId } });
    const wa = await http.post('/api/whatsapp/send').set(auth(brokerA.token)).send({ leadId: lead.id, text: 'hi' }).expect(424);
    expect(wa.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    expect(wa.body.integration.settingsPath).toBe('/broker/connectors?key=whatsapp');
    const ai = await http.post('/api/ai/scan').set(auth(brokerA.token)).send({ image: 'data:image/png;base64,iVBORw0KGgo=' }).expect(424);
    expect(ai.body.integration.fixBy).toBe('SUPER_ADMIN');
    const up = await http.post('/api/me/uploads/sign').set(auth(user.token)).send({ kind: 'listing' }).expect(424);
    expect(up.body.integration.key).toBe('cloudinary');
  });

  it('credentials center encrypts and masks secrets', async () => {
    await http.patch('/api/admin/integrations/groq').set(auth(admin)).send({ fields: { apiKey: 'gsk_test_secret_value_1234' } }).expect(200);
    const v = await http.get('/api/admin/integrations/groq').set(auth(admin)).expect(200);
    expect(v.body.state.configured).toBe(true);
    expect(v.body.state.fields.apiKey).toMatch(/^•+1234$/);
    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: 'integration.groq' } });
    expect(JSON.stringify(row.value)).not.toContain('gsk_test_secret_value_1234');
    // Saving the masked value keeps the secret
    await http.patch('/api/admin/integrations/groq').set(auth(admin)).send({ fields: { apiKey: v.body.state.fields.apiKey, textModel: 'x' } }).expect(200);
    expect((await http.get('/api/admin/integrations/groq').set(auth(admin))).body.state.fields.apiKey).toMatch(/1234$/);
    await http.delete('/api/admin/integrations/groq').set(auth(admin)).expect(200);
    const pub = await http.get('/api/public/config').expect(200);
    expect(JSON.stringify(pub.body)).not.toContain('gsk_');
  });

  it('runs automation rules on new leads', async () => {
    await http
      .post('/api/automations')
      .set(auth(brokerA.token))
      .send({ name: 'Tag + follow-up', trigger: 'LEAD_CREATED', respectBusinessHours: false, actions: [{ type: 'ADD_TAG', params: { tag: 'auto' } }, { type: 'CREATE_FOLLOW_UP', params: { inMinutes: 15, note: 'Call' } }] })
      .expect(201);
    const r = await http.post(`/api/webhooks/leads/${webhookKey}`).send({ name: 'Auto Test', phone: '9123456780' }).expect(200);
    let lead;
    for (let i = 0; i < 20; i++) {
      lead = await prisma.lead.findUniqueOrThrow({ where: { id: r.body.leadId }, include: { followUps: true } });
      if (lead.tags.includes('auto') && lead.followUps.length) break;
      await sleep(150);
    }
    expect(lead!.tags).toContain('auto');
    expect(lead!.followUps).toHaveLength(1);
  });

  it('pipeline stage changes are logged', async () => {
    const lead = await prisma.lead.findFirstOrThrow({ where: { organizationId: brokerA.orgId, phone: '+919811100001' } });
    await http.patch(`/api/leads/${lead.id}/stage`).set(auth(brokerA.token)).send({ stage: 'INTERESTED' }).expect(200);
    const d = await http.get(`/api/leads/${lead.id}`).set(auth(brokerA.token)).expect(200);
    expect(d.body.stage).toBe('INTERESTED');
    expect(d.body.activities.some((a: any) => a.type === 'STAGE_CHANGE')).toBe(true);
    const k = await http.get('/api/leads/kanban').set(auth(brokerA.token)).expect(200);
    expect(k.body.find((c: any) => c.stage === 'INTERESTED').count).toBeGreaterThanOrEqual(1);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const r1 = await http.post('/api/auth/refresh').send({ refreshToken: brokerA.refresh }).expect(200);
    await http.post('/api/auth/refresh').send({ refreshToken: brokerA.refresh }).expect(401); // reuse
    await http.post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401); // family revoked
  });

  it('OTP login works (dev mode returns code when SMTP missing)', async () => {
    const r = await http.post('/api/auth/otp/request').send({ email: email('otp') }).expect(200);
    expect(r.body.devCode).toMatch(/^\d{6}$/);
    await http.post('/api/auth/otp/verify').send({ email: email('otp'), code: '000000' === r.body.devCode ? '111111' : '000000' }).expect(401);
    const v = await http.post('/api/auth/otp/verify').send({ email: email('otp'), code: r.body.devCode, name: 'OTP User' }).expect(200);
    expect(v.body.user.emailVerified).toBe(true);
  });

  it('serves public homepage, localities and taxonomies', async () => {
    const h = await http.get('/api/public/homepage').expect(200);
    expect(h.body.find((s: any) => s.type === 'HERO')).toBeTruthy();
    const loc = await http.get('/api/public/localities/sector-65-gurgaon').expect(200);
    expect(loc.body.listingsRent).toBeGreaterThanOrEqual(1);
    expect(loc.body.listingsSale).toBe(0); // rental marketplace
    const t = await http.get('/api/public/taxonomies').expect(200);
    expect(t.body.amenities.length).toBeGreaterThan(10);
  });

  it('feedback: submit → admin publishes on roadmap → votes → status notifications', async () => {
    const f = await http.post('/api/feedback').set(auth(user.token)).send({ type: 'FEATURE', title: 'Metro distance filter', description: 'Search में metro से distance का filter चाहिए', rating: 5 }).expect(201);
    await http.post('/api/feedback').send({ type: 'BUG', title: 'Anon bug', description: 'Without email should fail' }).expect(400);
    let board = await http.get('/api/feedback/board').expect(200);
    expect(board.body.items.find((x: any) => x.id === f.body.id)).toBeUndefined(); // private until admin publishes
    await http.patch(`/api/feedback/${f.body.id}`).set(auth(user.token)).send({ status: 'PLANNED' }).expect(403);
    await http.patch(`/api/feedback/${f.body.id}`).set(auth(admin)).send({ isPublic: true, status: 'PLANNED', adminReply: 'अगले release में' }).expect(200);
    const v = await http.post(`/api/feedback/${f.body.id}/vote`).set(auth(brokerA.token)).expect(201);
    expect(v.body).toMatchObject({ voted: true, voteCount: 2 });
    board = await http.get('/api/feedback/board').set(auth(brokerA.token)).expect(200);
    const item = board.body.items.find((x: any) => x.id === f.body.id);
    expect(item).toMatchObject({ status: 'PLANNED', voted: true, voteCount: 2 });
    const notes = await http.get('/api/me/notifications').set(auth(user.token)).expect(200);
    expect(notes.body.items.some((n: any) => n.title.includes('Metro distance filter'))).toBe(true);
  });
});
