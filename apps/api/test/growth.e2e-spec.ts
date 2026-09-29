import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json } from 'express';
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
  const realFetch = global.fetch;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json({ verify: (req: any, _res, buf) => (req.rawBody = buf) }));
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
    await http.post('/api/auth/register').send({ name: 'Tenant', email: email('tenant'), password: 'Passw0rd!' }).expect(201);
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
});
