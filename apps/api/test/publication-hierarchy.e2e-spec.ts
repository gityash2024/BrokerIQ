import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { FeaturesService } from '../src/core/features/features.service';

describe('Publication hierarchy and ordinary Rent/Sale (real PostgreSQL)', () => {
  let app: INestApplication,
    db: PrismaService,
    verified: string,
    unverified: string,
    admin: string,
    agent: string,
    unverifiedAdmin: string,
    outsider: string,
    superAdmin: string,
    locality: string;
  const stamp = Date.now().toString(36);
  const req = () => request(app.getHttpServer());
  const h = (token = admin) => ({ Authorization: `Bearer ${token}` });
  const create = async (token: string, purpose = 'RENT', propertyType = 'APARTMENT') =>
    (
      await req()
        .post('/api/inventory')
        .set(h(token))
        .send({
          sector: 'Sector 43',
          purpose,
          propertyType,
          status: 'ACTIVE',
          availability: 'AVAILABLE',
          ...(purpose === 'SALE' ? { totalSalePrice: 12000000 } : { monthlyRent: 35000 }),
        })
        .expect(201)
    ).body;
  const fields = (revision: number, purpose = 'RENT', propertyType = 'APARTMENT') => ({
    purpose,
    title: 'Reviewed property ' + stamp,
    localityId: locality,
    propertyType,
    price: purpose === 'SALE' ? 12000000 : 35000,
    contactPhone: '+919700000801',
    contactName: 'Authorized public contact',
    expectedRevision: revision,
    confirmedAvailable: true,
    publicPreviewAccepted: true,
    photos: [],
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    verified = (
      await db.organization.create({ data: { name: 'Verified publication fixture', slug: 'pub-verified-' + stamp, verification: 'VERIFIED', onboarded: true } })
    ).id;
    unverified = (await db.organization.create({ data: { name: 'Unverified publication fixture', slug: 'pub-unverified-' + stamp } })).id;
    const actor = async (name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT' | 'SUPER_ADMIN', organizationId: string | null) => {
      const user = await db.user.create({ data: { name, email: name + '.pub.' + stamp + '@e2e.test', role, organizationId }, include: { organization: true } });
      return (await app.get(AuthService).issue(user)).accessToken;
    };
    admin = await actor('admin', 'BROKER_ADMIN', verified);
    agent = await actor('agent', 'BROKER_AGENT', verified);
    unverifiedAdmin = await actor('unverified', 'BROKER_ADMIN', unverified);
    outsider = await actor('outsider', 'BROKER_AGENT', verified);
    superAdmin = await actor('platform', 'SUPER_ADMIN', null);
    locality = (await db.locality.findFirstOrThrow({ where: { isActive: true } })).id;
  });
  afterAll(async () => {
    await app?.close();
  });
  it('publishes verified-admin Rent/Sale directly and exact retries do not duplicate listings or requirements', async () => {
    for (const purpose of ['RENT', 'SALE']) {
      const item = await create(admin, purpose);
      const before = await db.brokerRequirement.count({ where: { organizationId: verified } });
      const body = fields(item.revision, purpose);
      const submitted = await Promise.all([1, 2].map(() => req().post(`/api/inventory/${item.id}/publish`).set(h()).send(body).expect(201)));
      expect(submitted[0].body.status).toBe('ACTIVE');
      expect(submitted[0].body.id).toBe(submitted[1].body.id);
      expect(submitted[0].body.reviewRequiredRole).toBeNull();
      expect(await db.brokerRequirement.count({ where: { organizationId: verified } })).toBe(before);
      const publicDetail = await req()
        .get('/api/listings/' + submitted[0].body.id)
        .expect(200);
      expect(publicDetail.body.purpose).toBe(purpose);
      const found = await req().get('/api/listings').query({ purpose, orgId: verified }).expect(200);
      expect(found.body.items.some((r: any) => r.id === submitted[0].body.id)).toBe(true);
      await req()
        .patch(`/api/inventory/${item.id}`)
        .set(h())
        .send({ availability: purpose === 'SALE' ? 'SOLD' : 'RENTED' })
        .expect(200);
      await req()
        .get('/api/listings/' + submitted[0].body.id)
        .expect(404);
    }
    expect(await app.get(FeaturesService).isEnabled('sale_listings')).toBe(false);
  });
  it('routes Agent submission to verified firm Admin and denies another Agent review/edit', async () => {
    const item = await create(agent);
    const submitted = (await req().post(`/api/inventory/${item.id}/publish`).set(h(agent)).send(fields(item.revision)).expect(201)).body;
    expect(submitted.status).toBe('PENDING_REVIEW');
    expect(submitted.reviewRequiredRole).toBe('BROKER_ADMIN');
    await req()
      .get('/api/listings/' + submitted.id)
      .expect(404);
    await req()
      .get('/api/listings/' + submitted.id)
      .set(h(outsider))
      .expect(404);
    const listing = await db.listing.findUniqueOrThrow({ where: { id: submitted.id } });
    const review = { action: 'approve', expectedUpdatedAt: listing.updatedAt.toISOString() };
    await req().post(`/api/inventory/${item.id}/publication/review`).set(h(agent)).send(review).expect(403);
    await req().patch(`/api/listings/${submitted.id}`).set(h(outsider)).send({ title: 'Unauthorized change' }).expect(403);
    await req().post(`/api/inventory/${item.id}/publication/review`).set(h(unverifiedAdmin)).send(review).expect(404);
    await req().post(`/api/inventory/${item.id}/publication/review`).set(h()).send(review).expect(201);
    await req()
      .get('/api/listings/' + submitted.id)
      .expect(200);
  });
  it('keeps unverified Admin submission Super Admin-only and supports rejection/resubmission/withdrawal', async () => {
    const item = await create(unverifiedAdmin, 'SALE', 'RESIDENTIAL_PLOT');
    let listing = (
      await req()
        .post(`/api/inventory/${item.id}/publish`)
        .set(h(unverifiedAdmin))
        .send(fields(item.revision, 'SALE', 'RESIDENTIAL_PLOT'))
        .expect(201)
    ).body;
    expect(listing.reviewRequiredRole).toBe('SUPER_ADMIN');
    let row = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    await req()
      .post(`/api/inventory/${item.id}/publication/review`)
      .set(h(unverifiedAdmin))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt.toISOString() })
      .expect(403);
    await req()
      .post(`/api/inventory/${item.id}/publication/review`)
      .set(h(superAdmin))
      .send({ action: 'reject', reason: 'Confirm public details', expectedUpdatedAt: row.updatedAt.toISOString() })
      .expect(201);
    const updated = (await req().get(`/api/inventory/${item.id}`).set(h(unverifiedAdmin)).expect(200)).body;
    listing = (
      await req()
        .post(`/api/inventory/${item.id}/publish`)
        .set(h(unverifiedAdmin))
        .send(fields(updated.revision, 'SALE', 'RESIDENTIAL_PLOT'))
        .expect(201)
    ).body;
    row = await db.listing.findUniqueOrThrow({ where: { id: listing.id } });
    await req()
      .post(`/api/inventory/${item.id}/publication/review`)
      .set(h(superAdmin))
      .send({ action: 'approve', expectedUpdatedAt: row.updatedAt.toISOString() })
      .expect(201);
    await req()
      .get('/api/listings/' + listing.id)
      .expect(200);
    await req().post(`/api/inventory/${item.id}/publication/withdraw`).set(h(unverifiedAdmin)).send({}).expect(201);
    await req()
      .get('/api/listings/' + listing.id)
      .expect(404);
  });
  it('rejects stale public previews, purpose mismatch and private evidence photos', async () => {
    const item = await create(admin);
    await req().post(`/api/inventory/${item.id}/publish`).set(h()).send(fields(item.revision, 'SALE')).expect(400);
    await req()
      .post(`/api/inventory/${item.id}/publish`)
      .set(h())
      .send({ ...fields(item.revision), photos: [{ url: 'https://company.test/api/media/f/kyc/member/document' }] })
      .expect(400);
    await req().patch(`/api/inventory/${item.id}`).set(h()).send({ notes: 'Private edit' }).expect(200);
    await req().post(`/api/inventory/${item.id}/publish`).set(h()).send(fields(item.revision)).expect(409);
  });
  it('uses the same hierarchy for legacy submissions, edits, reactivation and firm review queues', async () => {
    const payload = { purpose: 'SALE', propertyType: 'APARTMENT', localityId: locality, price: 12000000, photos: [], submit: true };
    const listing = (await req().post('/api/listings').set(h(agent)).send(payload).expect(201)).body;
    expect(listing.reviewRequiredRole).toBe('BROKER_ADMIN');
    await req().get('/api/inventory/publications/queue').set(h(agent)).expect(403);
    const queue = (await req().get('/api/inventory/publications/queue').set(h()).expect(200)).body;
    expect(queue.items.some((r: any) => r.id === listing.id)).toBe(true);
    const otherQueue = (await req().get('/api/inventory/publications/queue').set(h(unverifiedAdmin)).expect(200)).body;
    expect(otherQueue.items.some((r: any) => r.id === listing.id)).toBe(false);
    const review = { action: 'approve', expectedUpdatedAt: listing.updatedAt };
    await req().post(`/api/inventory/publications/${listing.id}/review`).set(h(unverifiedAdmin)).send(review).expect(404);
    await req().post(`/api/inventory/publications/${listing.id}/review`).set(h()).send(review).expect(201);
    // An Agent's subsequent public-content edit must be reviewed again.
    const edited = (await req().patch(`/api/listings/${listing.id}`).set(h(agent)).send({ price: 13000000 }).expect(200)).body;
    expect(edited.status).toBe('PENDING_REVIEW');
    expect(edited.reviewRequiredRole).toBe('BROKER_ADMIN');
    await req().get(`/api/listings/${listing.id}`).expect(404);
    await req().post(`/api/inventory/publications/${listing.id}/review`).set(h()).send(review).expect(409);
    // Verified Admin edits publish directly, including ordinary Sale.
    const direct = (await req().patch(`/api/listings/${listing.id}`).set(h()).send({ price: 12500000 }).expect(200)).body;
    expect(direct.status).toBe('ACTIVE');
    expect(direct.reviewRequiredRole).toBeNull();
    await req().patch(`/api/listings/${listing.id}/status`).set(h()).send({ status: 'RENTED' }).expect(400);
    await req().patch(`/api/listings/${listing.id}/status`).set(h()).send({ status: 'ARCHIVED' }).expect(200);
    const reactivated = (await req().patch(`/api/listings/${listing.id}/status`).set(h(agent)).send({ status: 'ACTIVE' }).expect(200)).body;
    expect(reactivated.status).toBe('PENDING_REVIEW');
    expect(reactivated.reviewRequiredRole).toBe('BROKER_ADMIN');
    // A verification change after submission cannot leave the old firm review authority usable.
    await db.organization.update({ where: { id: verified }, data: { verification: 'UNVERIFIED' } });
    await req()
      .post(`/api/inventory/publications/${listing.id}/review`)
      .set(h())
      .send({ action: 'approve', expectedUpdatedAt: reactivated.updatedAt })
      .expect(403);
    await req()
      .post(`/api/inventory/publications/${listing.id}/review`)
      .set(h(superAdmin))
      .send({ action: 'approve', expectedUpdatedAt: reactivated.updatedAt })
      .expect(201);
    await db.organization.update({ where: { id: verified }, data: { verification: 'VERIFIED' } });
  });
});
