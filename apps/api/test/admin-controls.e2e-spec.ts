import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { AccessService } from '../src/core/access/access.service';

/** Super Admin / staff controls: block & unblock listings, users and firms, restrictions, blocklist, staff roles. */
jest.setTimeout(90000);

const uniq = `${process.env.E2E_UNIQ!}c`;
const email = (p: string) => `${p}.${uniq}@e2e.test`;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('Admin controls (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let admin: string;
  let broker: { token: string; orgId: string };
  let tenant: { token: string; id: string };
  let localityId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.use(json());
    app.use(urlencoded({ extended: true }));
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await app.get(SettingsService).updateAppConfig({ auth: { allowBrokerSignup: true } } as any);
    // A run that stopped mid-way may have left test bans behind.
    await prisma.blocklist.deleteMany({ where: { OR: [{ value: '+919811100055' }, { value: { startsWith: 'spam-' } }] } });
    app.get(AccessService).invalidate();
    admin = (
      await http
        .post('/api/auth/login')
        .send({ email: `admin.${process.env.E2E_UNIQ}@e2e.test`, password: 'Admin@12345' })
        .expect(200)
    ).body.accessToken;
    localityId = (await prisma.locality.findFirstOrThrow({ where: { slug: 'sector-65-gurgaon' } })).id;
    const b = await http
      .post('/api/auth/register')
      .send({ name: 'Control Broker', email: email('broker'), password: 'Passw0rd!', accountType: 'BROKER', firmName: `Control Realty ${uniq}` })
      .expect(201);
    broker = { token: b.body.accessToken, orgId: b.body.user.organizationId };
    const t = await http
      .post('/api/auth/register')
      .send({ name: 'Control Tenant', email: email('tenant'), password: 'Passw0rd!', phone: '9811100055' })
      .expect(201);
    tenant = { token: t.body.accessToken, id: t.body.user.id };
  });

  afterAll(async () => {
    await app.close();
  });

  const createAndApprove = async (token: string) => {
    const l = await http
      .post('/api/listings')
      .set(auth(token))
      .send({
        purpose: 'RENT',
        propertyType: 'APARTMENT',
        localityId,
        price: 41000,
        securityDeposit: 82000,
        bedrooms: 2,
        bathrooms: 2,
        superArea: 1300,
        furnishing: 'SEMI_FURNISHED',
        contactName: 'Owner',
        contactPhone: '9898989898',
        photos: [{ url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg' }],
        submit: true,
      })
      .expect(201);
    await http.post(`/api/admin/moderation/listings/${l.body.id}`).set(auth(admin)).send({ action: 'approve' }).expect(201);
    return { id: l.body.id as string, slug: l.body.slug as string };
  };
  const inSearch = async (id: string) =>
    (await http.get('/api/listings?localities=sector-65-gurgaon&sort=newest&pageSize=50').expect(200)).body.items.some((x: any) => x.id === id);

  it('blocks a live listing (gone from search/detail, owner told) and unblocks it back to live', async () => {
    const l = await createAndApprove(broker.token);
    expect(await inSearch(l.id)).toBe(true);
    await http.post(`/api/admin/listings/${l.id}/block`).set(auth(admin)).send({ reason: 'x' }).expect(400);
    await http.post(`/api/admin/listings/${l.id}/block`).set(auth(admin)).send({ reason: 'Fake photos' }).expect(200);
    expect(await inSearch(l.id)).toBe(false);
    await http.get(`/api/listings/${l.slug}`).expect(404);
    const n = await prisma.notification.findFirst({
      where: { kind: 'LISTING_MODERATION', title: { contains: 'हटाई' }, data: { path: ['listingId'], equals: l.id } },
    });
    expect(n?.body).toBe('Fake photos');
    await http.post(`/api/admin/listings/${l.id}/unblock`).set(auth(admin)).expect(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('ACTIVE');
    expect(await inSearch(l.id)).toBe(true);
    // Only staff can do it.
    await http.post(`/api/admin/listings/${l.id}/block`).set(auth(broker.token)).send({ reason: 'Not allowed' }).expect(403);
  });

  it('bulk actions report done/failed counts; delete & restore', async () => {
    const a = await createAndApprove(broker.token);
    const b = await createAndApprove(broker.token);
    const r = await http
      .post('/api/admin/listings/bulk')
      .set(auth(admin))
      .send({ ids: [a.id, b.id, 'missing-id'], action: 'block', reason: 'Duplicate' })
      .expect(200);
    expect(r.body.done).toBe(2);
    expect(r.body.failed).toHaveLength(1);
    await http
      .post('/api/admin/listings/bulk')
      .set(auth(admin))
      .send({ ids: [a.id, b.id], action: 'unblock' })
      .expect(200);
    await http.delete(`/api/admin/listings/${a.id}`).set(auth(admin)).expect(200);
    expect(await inSearch(a.id)).toBe(false);
    await http.post(`/api/admin/listings/${a.id}/restore`).set(auth(admin)).expect(200);
    expect(await inSearch(a.id)).toBe(true);
    await http.post(`/api/admin/listings/${b.id}/status`).set(auth(admin)).send({ status: 'RENTED' }).expect(200);
    expect(await inSearch(b.id)).toBe(false);
  });

  it('blocking a user stops login and hides their own listings; unblocking restores both', async () => {
    const owned = await createAndApprove(tenant.token);
    await http.post(`/api/admin/users/${tenant.id}/block`).set(auth(admin)).send({ reason: 'Spam listings' }).expect(200);
    const login = await http
      .post('/api/auth/login')
      .send({ email: email('tenant'), password: 'Passw0rd!' })
      .expect(403);
    expect(login.body.message).toContain('suspend');
    const hidden = await prisma.listing.findUniqueOrThrow({ where: { id: owned.id } });
    expect(hidden.status).toBe('BLOCKED');
    expect(hidden.blockedReason).toBe('ACCOUNT: Spam listings');
    // A listing blocked separately stays blocked after the account is restored.
    await http.post(`/api/admin/users/${tenant.id}/unblock`).set(auth(admin)).expect(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: owned.id } })).status).toBe('ACTIVE');
    const again = await http
      .post('/api/auth/login')
      .send({ email: email('tenant'), password: 'Passw0rd!' })
      .expect(200);
    tenant.token = again.body.accessToken;
    // Staff can't block Super Admins or themselves.
    const me = await prisma.user.findFirstOrThrow({ where: { email: `admin.${process.env.E2E_UNIQ}@e2e.test` } });
    await http.post(`/api/admin/users/${me.id}/block`).set(auth(admin)).send({ reason: 'Self block' }).expect(403);
  });

  it('restrictions switch off single abilities for a user or a firm', async () => {
    const l = await createAndApprove(broker.token);
    await http
      .patch(`/api/admin/users/${tenant.id}/restrictions`)
      .set(auth(admin))
      .send({ restrictions: ['enquire', 'bogus'] })
      .expect(200);
    const denied = await http.post('/api/enquiries').set(auth(tenant.token)).send({ listingId: l.id, name: 'Tenant', phone: '9811100055' }).expect(403);
    expect(denied.body.message).toContain('Enquiry');
    await http.patch(`/api/admin/users/${tenant.id}/restrictions`).set(auth(admin)).send({ restrictions: [] }).expect(200);
    await http.post('/api/enquiries').set(auth(tenant.token)).send({ listingId: l.id, name: 'Tenant', phone: '9811100055' }).expect(201);

    await http
      .patch(`/api/admin/organizations/${broker.orgId}/restrictions`)
      .set(auth(admin))
      .send({ restrictions: ['post'] })
      .expect(200);
    const firmDenied = await http
      .post('/api/listings')
      .set(auth(broker.token))
      .send({ propertyType: 'PG', localityId, price: 12000, submit: false, photos: [] })
      .expect(403);
    expect(firmDenied.body.message).toContain('आपकी firm');
    await http.patch(`/api/admin/organizations/${broker.orgId}/restrictions`).set(auth(admin)).send({ restrictions: [] }).expect(200);
  });

  it('blocking a firm logs members out and hides all its listings; unblock restores them', async () => {
    const l = await createAndApprove(broker.token);
    const r = await http.post(`/api/admin/organizations/${broker.orgId}/block`).set(auth(admin)).send({ reason: 'Fraud complaints' }).expect(200);
    expect(r.body.listingsHidden).toBeGreaterThan(0);
    expect(await inSearch(l.id)).toBe(false);
    await http
      .post('/api/auth/login')
      .send({ email: email('broker'), password: 'Passw0rd!' })
      .expect(403);
    await http.post(`/api/admin/organizations/${broker.orgId}/unblock`).set(auth(admin)).expect(200);
    expect(await inSearch(l.id)).toBe(true);
    broker.token = (
      await http
        .post('/api/auth/login')
        .send({ email: email('broker'), password: 'Passw0rd!' })
        .expect(200)
    ).body.accessToken;
  });

  it('blocklist stops signup and OTP for banned emails / domains / phones', async () => {
    const b = await http
      .post('/api/admin/blocklist')
      .set(auth(admin))
      .send({ kind: 'DOMAIN', value: `@spam-${uniq}.test`, reason: 'Bot signups' })
      .expect(201);
    await http
      .post('/api/auth/register')
      .send({ name: 'Bot', email: `bot@spam-${uniq}.test`, password: 'Passw0rd!' })
      .expect(403);
    await http
      .post('/api/auth/otp/request')
      .send({ email: `bot2@spam-${uniq}.test` })
      .expect(403);
    const p = await http.post('/api/admin/blocklist').set(auth(admin)).send({ kind: 'PHONE', value: '+91 98111 00055', reason: 'Harassment' }).expect(201);
    expect(p.body.value).toBe('+919811100055');
    expect(p.body.matchingUsers.some((u: any) => u.id === tenant.id)).toBe(true);
    await http.delete(`/api/admin/blocklist/${p.body.id}`).set(auth(admin)).expect(200);
    await http.delete(`/api/admin/blocklist/${b.body.id}`).set(auth(admin)).expect(200);
    await http
      .post('/api/auth/register')
      .send({ name: 'Ok', email: `ok@spam-${uniq}.test`, password: 'Passw0rd!' })
      .expect(201);
  });

  it('moderator role: can moderate listings and users, cannot delete users or touch settings', async () => {
    const m = await http
      .post('/api/auth/register')
      .send({ name: 'Mod', email: email('mod'), password: 'Passw0rd!' })
      .expect(201);
    await http.patch(`/api/admin/users/${m.body.user.id}`).set(auth(admin)).send({ role: 'MODERATOR' }).expect(200);
    const mod = (
      await http
        .post('/api/auth/login')
        .send({ email: email('mod'), password: 'Passw0rd!' })
        .expect(200)
    ).body.accessToken;
    await http.get('/api/admin/moderation/listings').set(auth(mod)).expect(200);
    await http.get('/api/admin/pending').set(auth(mod)).expect(200);
    const l = await createAndApprove(broker.token);
    await http.post(`/api/admin/listings/${l.id}/block`).set(auth(mod)).send({ reason: 'Wrong price' }).expect(200);
    await http.delete(`/api/admin/users/${tenant.id}`).set(auth(mod)).expect(403);
    await http.get('/api/admin/integrations').set(auth(mod)).expect(403);
    await http.patch('/api/admin/flags/flatmates').set(auth(mod)).send({ enabled: false }).expect(403);
    await http.post(`/api/admin/organizations/${broker.orgId}/block`).set(auth(mod)).send({ reason: 'Not allowed' }).expect(403);
  });

  it('hiding a broker review updates the firm rating', async () => {
    await http.post(`/api/brokers/${broker.orgId}/reviews`).set(auth(tenant.token)).send({ rating: 2, comment: 'Did not show up for the visit' }).expect(201);
    const review = await prisma.review.findFirstOrThrow({ where: { organizationId: broker.orgId, userId: tenant.id } });
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: broker.orgId } });
    await http.patch(`/api/admin/reviews/${review.id}`).set(auth(admin)).send({ status: 'HIDDEN' }).expect(200);
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: broker.orgId } });
    expect(after.reviewCount).toBe(before.reviewCount - 1);
  });
  it('reported chat: staff see the messages, can close the chat for both sides; service requests get a status', async () => {
    const conv = await http
      .post('/api/chat/start')
      .set(auth(tenant.token))
      .send({ organizationId: broker.orgId, message: 'Hello, is the flat available?' })
      .expect(201);
    await http.post(`/api/chat/threads/${conv.body.id}/report`).set(auth(tenant.token)).send({ reason: 'NOPE' }).expect(400);
    await http.post(`/api/chat/threads/${conv.body.id}/report`).set(auth(tenant.token)).send({ reason: 'ABUSE', details: 'rude replies' }).expect(201);
    // Reporting twice keeps one open report.
    await http.post(`/api/chat/threads/${conv.body.id}/report`).set(auth(tenant.token)).send({ reason: 'SPAM' }).expect(201);
    expect(await prisma.contentReport.count({ where: { targetId: conv.body.id, status: 'OPEN' } })).toBe(1);
    // Tenant is not staff.
    await http.get('/api/admin/chat-reports').set(auth(tenant.token)).expect(403);
    const list = await http.get('/api/admin/chat-reports').set(auth(admin)).expect(200);
    const rep = list.body.find((r: any) => r.targetId === conv.body.id);
    expect(rep).toMatchObject({ reason: 'SPAM', reporterSide: 'USER' });
    expect(rep.conversation.messages[0].body).toBe('Hello, is the flat available?');
    expect((await http.get('/api/admin/pending').set(auth(admin)).expect(200)).body.chatReports).toBeGreaterThan(0);

    await http
      .patch(`/api/admin/chat-reports/${rep.id}`)
      .set(auth(admin))
      .send({ status: 'RESOLVED', resolution: 'Abusive messages', blockChat: true })
      .expect(200);
    await http.post(`/api/chat/threads/${conv.body.id}`).set(auth(tenant.token)).send({ text: 'hello?' }).expect(403);
    await http.post(`/api/chat/threads/${conv.body.id}`).set(auth(broker.token)).send({ text: 'hi' }).expect(403);
    await http.patch(`/api/admin/chats/${conv.body.id}/block`).set(auth(admin)).send({ blocked: false }).expect(200);
    await http.post(`/api/chat/threads/${conv.body.id}`).set(auth(tenant.token)).send({ text: 'hello again' }).expect(201);

    const partner = await prisma.servicePartner.create({ data: { name: `Packers ${uniq}`, category: 'PACKERS' } });
    const sr = await prisma.serviceRequest.create({ data: { partnerId: partner.id, userId: tenant.id, name: 'Control Tenant', phone: '9811100055' } });
    await http.patch(`/api/admin/service-requests/${sr.id}`).set(auth(admin)).send({ status: 'BOGUS' }).expect(400);
    await http.patch(`/api/admin/service-requests/${sr.id}`).set(auth(admin)).send({ status: 'SPAM' }).expect(200);
    await http.delete(`/api/admin/service-requests/${sr.id}`).set(auth(admin)).expect(200);
    await prisma.servicePartner.delete({ where: { id: partner.id } });
  });
});
