import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { defaultModulePolicies } from '@brokeriq/shared';
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
(process.env.BROKER_FIRST === 'true' ? describe : describe.skip)('Enterprise consumer, publication and dashboard boundaries', () => {
  let app: INestApplication,
    db: PrismaService,
    admin: string,
    broker: string,
    customer: string,
    customerId: string,
    orgId: string,
    item: any,
    localityId: string,
    listingId: string;
  const uid = Date.now().toString(36);
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    await db.systemSetting.upsert({
      where: { key: 'platform.modules' },
      create: { key: 'platform.modules', value: defaultModulePolicies() as any },
      update: { value: defaultModulePolicies() as any },
    });
    await app.get(SettingsService).updateAppConfig({ auth: { allowPasswordLogin: true } } as any);
    admin = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD })
        .expect(200)
    ).body.accessToken;
    const created = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set(headers(admin))
      .send({ name: 'Enterprise fixture', firmName: 'Enterprise ' + uid, email: `enterprise.broker.${uid}@e2e.test`, password: 'Fixture@12345' })
      .expect(201);
    orgId = created.body.id;
    broker = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `enterprise.broker.${uid}@e2e.test`, password: 'Fixture@12345' })
        .expect(200)
    ).body.accessToken;
    const c = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Enterprise customer', email: `enterprise.user.${uid}@e2e.test`, password: 'Fixture@12345', accountType: 'USER' })
      .expect(201);
    customer = c.body.accessToken;
    customerId = c.body.user.id;
    localityId = (await db.locality.findFirstOrThrow({ where: { isActive: true } })).id;
  });
  afterAll(async () => {
    if (db) await db.systemSetting.deleteMany({ where: { key: 'platform.modules' } });
    if (app) await app.close();
  });
  it('permits discovery but rejects private data, cross-role dashboards and future modules', async () => {
    await request(app.getHttpServer()).get('/api/listings').expect(200);
    const homepage = (await request(app.getHttpServer()).get('/api/public/homepage').expect(200)).body;
    expect(homepage.some((section: any) => ['TOOLS', 'CTA_BANNER', 'FEATURED_PROJECTS'].includes(section.type))).toBe(false);
    await request(app.getHttpServer()).get('/api/inventory').set(headers(customer)).expect(403);
    await request(app.getHttpServer()).get('/api/admin/dashboard/metrics').set(headers(broker)).expect(403);
    await request(app.getHttpServer()).get('/api/broker/dashboard/metrics').set(headers(customer)).expect(403);
    await request(app.getHttpServer()).get('/api/me/dashboard').expect(401);
    await request(app.getHttpServer()).get('/api/billing/plans').set(headers(customer)).expect(403);
    await request(app.getHttpServer()).post('/api/enquiries').send({}).expect(401);
  });
  it('requires confirmed availability and explicit public preview; excludes source/private contacts', async () => {
    item = (
      await request(app.getHttpServer())
        .post('/api/inventory')
        .set(headers(broker))
        .send({
          sector: 'Enterprise fixture',
          houseNo: 'E-' + uid,
          purpose: 'RENT',
          status: 'ACTIVE',
          monthlyRent: 23000,
          ownerPhone: '+919876543210',
          notes: 'PRIVATE REGISTER DO NOT PUBLISH',
        })
        .expect(201)
    ).body;
    const body = {
      title: 'Enterprise rental ' + uid,
      propertyType: 'APARTMENT',
      localityId,
      price: 23000,
      contactPhone: '+919876543211',
      confirmedAvailable: true,
      publicPreviewAccepted: true,
      expectedRevision: item.revision,
    };
    await request(app.getHttpServer()).post(`/api/inventory/${item.id}/publish`).set(headers(customer)).send(body).expect(403);
    await request(app.getHttpServer()).post(`/api/inventory/${item.id}/publish`).set(headers(broker)).send(body).expect(400);
    item = (
      await request(app.getHttpServer())
        .patch(`/api/inventory/${item.id}`)
        .set(headers(broker))
        .send({ availability: 'AVAILABLE', expectedRevision: item.revision })
        .expect(200)
    ).body;
    body.expectedRevision = item.revision;
    await request(app.getHttpServer())
      .post(`/api/inventory/${item.id}/publish`)
      .set(headers(broker))
      .send({ ...body, notes: 'private' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/inventory/${item.id}/publish`)
      .set(headers(broker))
      .send({ ...body, publicPreviewAccepted: false })
      .expect(400);
    const first = (await request(app.getHttpServer()).post(`/api/inventory/${item.id}/publish`).set(headers(broker)).send(body).expect(201)).body;
    listingId = first.id;
    expect(first.status).toBe('PENDING_REVIEW');
    const again = (await request(app.getHttpServer()).post(`/api/inventory/${item.id}/publish`).set(headers(broker)).send(body).expect(201)).body;
    expect(again.id).toBe(first.id);
    await request(app.getHttpServer()).get(`/api/listings/${first.slug}`).expect(404);
    await request(app.getHttpServer()).post(`/api/admin/moderation/listings/${listingId}`).set(headers(admin)).send({ action: 'approve' }).expect(201);
    const detail = (await request(app.getHttpServer()).get(`/api/listings/${first.slug}`).expect(200)).body;
    expect(JSON.stringify(detail)).not.toContain('PRIVATE REGISTER');
    expect(JSON.stringify(detail)).not.toContain('+919876543210');
    expect(JSON.stringify(detail)).not.toContain('sourceEntry');
    await request(app.getHttpServer()).post(`/api/listings/${listingId}/contact`).expect(403);
  });
  it('serves slots publicly and keeps enquiries, chat and bookings scoped to the customer', async () => {
    const slots = (await request(app.getHttpServer()).get(`/api/listings/${listingId}/slots?days=7`).expect(200)).body;
    expect(slots.bookable).toBe(true);
    await request(app.getHttpServer())
      .post('/api/enquiries')
      .set(headers(customer))
      .send({ listingId, name: 'Enterprise customer', phone: '+919876543212', message: 'Please arrange a visit' })
      .expect(201);
    const at = slots.days.flatMap((d: any) => d.slots).find((slot: any) => slot.available > 0).at;
    await request(app.getHttpServer())
      .post(`/api/listings/${listingId}/book-visit`)
      .set(headers(customer))
      .send({ at, phone: '+919876543212', name: 'Enterprise customer' })
      .expect(201);
    const mine = (await request(app.getHttpServer()).get('/api/me/visits').set(headers(customer)).expect(200)).body;
    expect(mine.some((v: any) => v.listingId === listingId)).toBe(true);
    const chat = await request(app.getHttpServer())
      .post('/api/chat/start')
      .set(headers(customer))
      .send({ organizationId: orgId, listingId, message: 'Can we discuss this rental?' })
      .expect(201);
    await request(app.getHttpServer()).get(`/api/chat/threads/${chat.body.id}`).set(headers(broker)).expect(200);
  });
  it('retains extension-only evidence without sending a product error notification', async () => {
    const stack = 'TypeError: M_ID\n    at Y (chrome-extension://enterprise/executors/200.js:1:761)';
    await request(app.getHttpServer())
      .post('/api/public/client-errors')
      .send({ source: 'WEB', message: 'Enterprise extension M_ID ' + uid, stack, route: '/' })
      .expect(204);
    const row = await db.errorLog.findFirstOrThrow({ where: { message: 'Enterprise extension M_ID ' + uid } });
    expect(row.classification).toBe('BROWSER_EXTENSION');
    expect(row.alertedAt).toBeNull();
  });
  it('withdraws public listing when availability is removed, and review cannot revive it', async () => {
    await request(app.getHttpServer())
      .patch(`/api/inventory/${item.id}`)
      .set(headers(broker))
      .send({ availability: 'UNKNOWN', expectedRevision: item.revision })
      .expect(200);
    expect((await db.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe('ARCHIVED');
    // Defense in depth: even a stale ACTIVE record cannot bypass the source availability.
    await db.listing.update({ where: { id: listingId }, data: { status: 'ACTIVE' } });
    await request(app.getHttpServer()).get(`/api/listings/${listingId}`).expect(404);
    const publicResults = (await request(app.getHttpServer()).get('/api/listings').expect(200)).body;
    expect(JSON.stringify(publicResults)).not.toContain(listingId);
    await db.listing.update({ where: { id: listingId }, data: { status: 'ARCHIVED' } });

    await request(app.getHttpServer()).post(`/api/admin/moderation/listings/${listingId}`).set(headers(admin)).send({ action: 'approve' }).expect(400);
  });
  it('matches scoped dashboard totals and IST ranges without invented history', async () => {
    const b = (await request(app.getHttpServer()).get('/api/broker/dashboard/metrics?from=2026-10-01&to=2026-10-16').set(headers(broker)).expect(200)).body;
    expect(b.period.timezone).toBe('Asia/Kolkata');
    const brokerAsConsumer = (await request(app.getHttpServer()).get('/api/me/dashboard').set(headers(broker)).expect(200)).body;
    expect(brokerAsConsumer.metrics.find((x: any) => x.key === 'enquiries').value).toBe(0);
    expect(b.charts.find((x: any) => x.key === 'leads').points).toHaveLength(16);
    expect(b.metrics.find((x: any) => x.key === 'inventory').value).toBe(await db.inventoryItem.count({ where: { organizationId: orgId, deletedAt: null } }));
    const u = (await request(app.getHttpServer()).get('/api/me/dashboard').set(headers(customer)).expect(200)).body;
    expect(u.metrics.find((x: any) => x.key === 'enquiries').value).toBe(await db.enquiry.count({ where: { userId: customerId } }));
    const records = (await request(app.getHttpServer()).get('/api/me/dashboard/records?chart=enquiries').set(headers(customer)).expect(200)).body;
    expect(records.total).toBe(await db.enquiry.count({ where: { userId: customerId } }));
    await request(app.getHttpServer()).get('/api/broker/dashboard/records?chart=leads').set(headers(customer)).expect(403);
    await request(app.getHttpServer()).get('/api/me/dashboard?from=2026-02-30&to=2026-03-02').set(headers(customer)).expect(400);
    await request(app.getHttpServer()).get('/api/admin/dashboard/metrics').set(headers(admin)).expect(200);
  });
});
