import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { FeaturesService } from '../src/core/features/features.service';
import { UsageService } from '../src/core/usage/usage.service';
import { MonitoringService } from '../src/core/monitoring/monitoring.service';

/** Launch readiness: free mode, sale switch, error monitoring, account deletion. */
jest.setTimeout(60000);

const uniq = `${process.env.E2E_UNIQ!}l`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Launch readiness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let settings: SettingsService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let broker: { token: string; orgId: string };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json());
    app.use(urlencoded({ extended: true }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    settings = app.get(SettingsService);
    http = request(app.getHttpServer());
    admin = (await http.post('/api/auth/login').send({ email: `admin.${process.env.E2E_UNIQ}@e2e.test`, password: 'Admin@12345' }).expect(200)).body.accessToken;
    await settings.updateAppConfig({ auth: { allowBrokerSignup: true }, monetization: { freeMode: true }, ai: { dailyCap: 200 } } as any);
    await prisma.featureFlag.updateMany({ where: { key: 'sale_listings' }, data: { enabled: false } });
    app.get(FeaturesService).invalidate();
    const b = await http.post('/api/auth/register').send({ name: 'Launch Broker', email: email('broker'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Launch Realty ${uniq}` }).expect(201);
    broker = { token: b.body.accessToken, orgId: b.body.user.organizationId };
  });

  afterAll(async () => {
    await settings.updateAppConfig({ monetization: { freeMode: true }, ai: { dailyCap: 200 } } as any);
    await app.close();
  });

  it('free mode: no prices, no checkout/boost, no plan limits', async () => {
    const cfg = await http.get('/api/public/config').expect(200);
    expect(cfg.body.app.monetization.freeMode).toBe(true);
    expect(cfg.body.flags.sale_listings).toBe(false);
    expect((await http.get('/api/billing/plans').expect(200)).body).toEqual([]);
    const co = await http.post('/api/broker/billing/checkout').set(auth(broker.token)).send({ planCode: 'PRO' }).expect(403);
    expect(co.body.code).toBe('FEATURE_DISABLED');
    await http.post('/api/billing/boost').set(auth(broker.token)).send({ listingId: 'x', weeks: 1 }).expect(403);

    const usage = app.get(UsageService);
    await expect(usage.assert(broker.orgId, 'activeListings', 500)).resolves.toBeUndefined();
    await settings.updateAppConfig({ monetization: { freeMode: false } } as any);
    await expect(usage.assert(broker.orgId, 'activeListings', 500)).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT_REACHED' } });
    expect((await http.get('/api/billing/plans').expect(200)).body.length).toBeGreaterThan(0);
    await settings.updateAppConfig({ monetization: { freeMode: true } } as any);
  });

  it('free mode keeps a daily AI fair-use cap per firm', async () => {
    await settings.updateAppConfig({ ai: { dailyCap: 2 } } as any);
    const usage = app.get(UsageService);
    await usage.assertAiCredit(broker.orgId);
    await usage.assertAiCredit(broker.orgId);
    await expect(usage.assertAiCredit(broker.orgId)).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    await settings.updateAppConfig({ ai: { dailyCap: 200 } } as any);
  });

  it('sale switch: off by default, Super Admin can turn it on', async () => {
    await http.get('/api/public/projects').expect(403);
    const localityId = (await prisma.locality.findFirstOrThrow({ where: { slug: 'sector-65-gurgaon' } })).id;
    const sale = { purpose: 'SALE', propertyType: 'APARTMENT', localityId, price: 9000000, photos: [], submit: false };
    await http.post('/api/listings').set(auth(broker.token)).send(sale).expect(403);

    await http.patch('/api/admin/flags/sale_listings').set(auth(admin)).send({ enabled: true }).expect(200);
    expect((await http.get('/api/public/config').expect(200)).body.flags.sale_listings).toBe(true);
    await http.get('/api/public/projects').expect(200);
    const created = await http.post('/api/listings').set(auth(broker.token)).send(sale).expect(201);
    expect(created.body.purpose).toBe('SALE');

    await http.patch('/api/admin/flags/sale_listings').set(auth(admin)).send({ enabled: false }).expect(200);
    await http.get('/api/public/projects').expect(403);
  });

  it('client errors are grouped, listed for Super Admin and alert once', async () => {
    const message = `Cannot read properties of undefined (reading 'price') ${uniq}`;
    const report = { source: 'WEB', message, stack: `TypeError: ${message}\n    at Card (app.js:10:5)`, route: '/rent', appVersion: '2.0.0' };
    await http.post('/api/public/client-errors').send(report).expect(204);
    await http.post('/api/public/client-errors').send(report).expect(204);
    await http.post('/api/public/client-errors').send({ source: 'SERVER', message: 'x' }).expect(400);
    await new Promise((r) => setTimeout(r, 300));

    await http.get('/api/admin/errors').set(auth(broker.token)).expect(403);
    const list = await http.get('/api/admin/errors').set(auth(admin)).expect(200);
    const row = list.body.find((e: any) => e.message === message);
    expect(row).toMatchObject({ source: 'WEB', count: 2, route: '/rent' });
    const adminUser = await prisma.user.findFirstOrThrow({ where: { email: `admin.${process.env.E2E_UNIQ}@e2e.test` } });
    const alerts = await prisma.notification.count({ where: { userId: adminUser.id, kind: 'SYSTEM_ALERT', title: { contains: uniq } } });
    expect(alerts).toBe(1);

    await http.patch(`/api/admin/errors/${row.id}`).set(auth(admin)).send({ resolved: true }).expect(200);
    const resolved = await http.get('/api/admin/errors?status=resolved').set(auth(admin)).expect(200);
    expect(resolved.body.some((e: any) => e.id === row.id)).toBe(true);
  });

  it('error fingerprint ignores ids and numbers', () => {
    const a = MonitoringService.fingerprint({ source: 'API', message: 'Listing 123 not found', stack: '', route: '/api/listings/cm1abcdefghijklmnopqrstu' });
    const b = MonitoringService.fingerprint({ source: 'API', message: 'Listing 987 not found', stack: '', route: '/api/listings/cm9zyxwvutsrqponmlkjihg' });
    expect(a).toBe(b);
  });

  it('account deletion removes personal data and blocks login', async () => {
    const u = await http.post('/api/auth/register').send({ name: 'Delete Me', email: email('del'), password: 'Passw0rd!', phone: '9811100066' }).expect(201);
    const token = u.body.accessToken;
    const id = u.body.user.id;
    await http.post('/api/me/saved-searches').set(auth(token)).send({ name: 'Rent 2BHK', filters: { bedrooms: '2' } });
    await prisma.userLocation.create({ data: { userId: id, lat: 28.4, lng: 77.0, source: 'APP' } as any }).catch(() => undefined);
    await http.delete('/api/me').set(auth(token)).expect(200);
    const row = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'DELETED', name: 'Deleted user', phone: null });
    expect(row.email).toContain('@brokeriq.invalid');
    expect(await prisma.savedSearch.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.userLocation.count({ where: { userId: id } })).toBe(0);
    await http.post('/api/auth/login').send({ email: email('del'), password: 'Passw0rd!' }).expect(401);
  });
});
