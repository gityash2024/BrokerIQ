import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { inventoryNavigation } from '@brokeriq/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

/** Real database/API regression; fixtures are restricted to the isolated test database. */
describe('Inventory lifecycle and role boundaries', () => {
  let app: INestApplication;
  let db: PrismaService;
  let orgId: string;
  let agentId: string;
  const actors: Record<string, string> = {};
  const stamp = Date.now().toString(36);
  const route = 'https://www.google.com/maps/dir/?api=1&destination=28.45%2C77.07';
  const h = (actor: string) => ({ Authorization: 'Bearer ' + actors[actor] });
  const api = () => request(app.getHttpServer());
  const complete = {
    sector: 'Sector 45',
    houseNo: '384',
    category: 'RESIDENTIAL',
    propertyType: 'APARTMENT',
    purpose: 'RENT',
    monthlyRent: 32000,
    area: 1000,
    areaUnit: 'SQ_FT',
    roomKind: 'BHK',
    bhk: 2,
    furnishing: 'SEMI_FURNISHED',
    directionsUrl: route,
    notes: 'Preserve recorded source details',
    photoUrls: ['https://example.test/preserved.jpg'],
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    orgId = (await db.organization.create({ data: { name: 'Lifecycle isolation', slug: 'lifecycle-' + stamp, onboarded: true } })).id;
    const otherId = (await db.organization.create({ data: { name: 'Other lifecycle firm', slug: 'lifecycle-other-' + stamp } })).id;
    const specifications: [string, Role, string | null, string[]][] = [
      ['super', 'SUPER_ADMIN', null, []],
      ['admin', 'BROKER_ADMIN', orgId, []],
      ['agent', 'BROKER_AGENT', orgId, []],
      ['delegate', 'SUB_BROKER_ADMIN', orgId, ['inventory:view', 'inventory:create', 'inventory:edit']],
      ['readOnly', 'SUB_BROKER_ADMIN', orgId, ['inventory:view']],
      ['noAccess', 'SUB_BROKER_ADMIN', orgId, ['leads:view']],
      ['user', 'USER', null, []],
      ['outside', 'BROKER_ADMIN', otherId, []],
    ];
    for (const [key, role, organizationId, delegatedPermissions] of specifications) {
      const user = await db.user.create({
        data: { name: key, email: key + '.lifecycle.' + stamp + '@e2e.test', role, organizationId, delegatedPermissions },
        include: { organization: true },
      });
      actors[key] = (await app.get(AuthService).issue(user)).accessToken;
      if (key === 'agent') agentId = user.id;
    }
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(['super', 'admin', 'agent', 'delegate'])('%s moves All Data → Available → Rented → Available without losing fields', async (actor) => {
    const draft = (
      await api()
        .post('/api/inventory')
        .set(h(actor))
        .send({ organizationId: orgId, sector: complete.sector, houseNo: actor + stamp })
        .expect(201)
    ).body;
    const path = '/api/inventory/' + draft.id;
    for (const change of [{ directoryMonth: '2026-12' }, { status: 'RENTED', availability: 'RENTED' }])
      await api()
        .patch(path)
        .set(h(actor))
        .send({ ...change, expectedRevision: draft.revision })
        .expect(400);
    expect((await api().get(path).set(h(actor)).expect(200)).body.revision).toBe(draft.revision);
    const available = (
      await api()
        .patch(path)
        .set(h(actor))
        .send({ ...complete, directoryMonth: '2026-12', expectedRevision: draft.revision })
        .expect(200)
    ).body;
    expect(available).toMatchObject({ availability: 'AVAILABLE', status: 'ACTIVE', verificationStatus: 'VERIFIED', directoryMonth: '2026-12' });
    const scope = { organizationId: orgId, houseNo: complete.houseNo, folderMode: 'AVAILABLE', folderMonth: '2026-12' };
    expect((await api().get('/api/inventory').query(scope).set(h(actor)).expect(200)).body.items.some((r: { id: string }) => r.id === draft.id)).toBe(true);
    expect(inventoryNavigation(available)).toMatchObject({ route, exact: true, sectorMap: 'https://www.abcbuildcon.in/maps/sector-45' });
    const rented = (await api().patch(path).set(h(actor)).send({ availability: 'RENTED', status: 'RENTED', expectedRevision: available.revision }).expect(200))
      .body;
    expect(rented).toMatchObject({
      directoryMonth: null,
      photoUrls: complete.photoUrls,
      notes: complete.notes,
      directionsUrl: route,
      assignedToId: available.assignedToId,
    });
    expect((await api().get('/api/inventory').query(scope).set(h(actor)).expect(200)).body.items.some((r: { id: string }) => r.id === draft.id)).toBe(false);
    expect(
      (
        await api()
          .get('/api/inventory')
          .query({ ...scope, folderMode: 'RENTED', folderSector: complete.sector })
          .set(h(actor))
          .expect(200)
      ).body.items.some((r: { id: string }) => r.id === draft.id),
    ).toBe(true);
    const restored = (await api().patch(path).set(h(actor)).send({ directoryMonth: '2027-01', expectedRevision: rented.revision }).expect(200)).body;
    expect(restored).toMatchObject({
      status: 'ACTIVE',
      availability: 'AVAILABLE',
      directoryMonth: '2027-01',
      photoUrls: complete.photoUrls,
      notes: complete.notes,
    });
    await api().patch(path).set(h(actor)).send({ notes: 'stale overwrite', expectedRevision: rented.revision }).expect(409);
    expect((await api().get(path).set(h(actor)).expect(200)).body.notes).toBe(complete.notes);
    expect((await api().get('/api/inventory').set(h(actor)).expect(200)).body.items.some((r: { id: string }) => r.id === draft.id)).toBe(true);
  });

  it('keeps read-only, absent grants, consumer and other-firm users inside their scopes', async () => {
    const item = await db.inventoryItem.create({
      data: {
        organizationId: orgId,
        assignedToId: agentId,
        createdById: agentId,
        ...complete,
        directoryMonth: '2026-12',
        availability: 'AVAILABLE',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    });
    const path = '/api/inventory/' + item.id;
    await api().get(path).set(h('readOnly')).expect(200);
    await api().get('/api/inventory/folders?folderMode=AVAILABLE').set(h('readOnly')).expect(200);
    await api().patch(path).set(h('readOnly')).send({ status: 'RENTED', availability: 'RENTED' }).expect(403);
    await api().post('/api/inventory').set(h('readOnly')).send(complete).expect(403);
    for (const actor of ['noAccess', 'user']) {
      await api().get(path).set(h(actor)).expect(403);
      await api().get('/api/inventory/folders?folderMode=AVAILABLE').set(h(actor)).expect(403);
      await api().patch(path).set(h(actor)).send({ directoryMonth: '2027-01' }).expect(403);
    }
    await api().get(path).set(h('outside')).expect(404);
    await api().patch(path).set(h('outside')).send({ availability: 'RENTED' }).expect(404);
    const other = await db.inventoryItem.create({ data: { organizationId: orgId, ...complete } });
    await api()
      .get('/api/inventory/' + other.id)
      .set(h('agent'))
      .expect(404);
    await api()
      .patch('/api/inventory/' + other.id)
      .set(h('agent'))
      .send({ directoryMonth: '2027-01' })
      .expect(404);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })).availability).toBe('AVAILABLE');
  });

  it('returns safe address directions and sector maps without inventing a property pin', () => {
    const address = inventoryNavigation({ sector: complete.sector, houseNo: complete.houseNo });
    expect(new URL(address.route!).searchParams.get('destination')).toBe('384, Sector 45, Gurugram');
    expect(address.exact).toBe(false);
    expect(inventoryNavigation({ sector: complete.sector, directionsUrl: 'javascript:alert(1)' })).toMatchObject({ route: null, exact: false });
  });
  it.each(['admin', 'agent', 'delegate'])('%s creates, edits and reloads the reported dates and complete details', async (actor) => {
    const body = {
      ...complete,
      organizationId: orgId,
      houseNo: 'dates-' + actor + stamp,
      details: {
        possessionDate: '2026/12/1',
        availableFrom: '2026/12/01',
        petFriendly: false,
        maintenanceMonthly: 0,
        sourceLayout: 'Two Bedroom Study Room Hall Kitchen',
        additionalRooms: 1,
      },
      videoUrls: ['https://example.test/preserved.mp4'],
      amenities: ['GYM', 'PARK'],
    };
    const created = (await api().post('/api/inventory').set(h(actor)).send(body).expect(201)).body;
    const path = '/api/inventory/' + created.id;
    const first = (await api().get(path).set(h(actor)).expect(200)).body;
    expect(first.details).toMatchObject({ ...body.details, possessionDate: '2026-12-01', availableFrom: '2026-12-01' });
    await api()
      .patch(path)
      .set(h(actor))
      .send({ details: { ...first.details, availableFrom: '2027/1/2' }, notes: 'Updated without losing photos, videos or contacts' })
      .expect(200);
    const saved = (await api().get(path).set(h(actor)).expect(200)).body;
    expect(saved.details.availableFrom).toBe('2027-01-02');
    expect(saved.details.petFriendly).toBe(false);
    expect(saved.details.maintenanceMonthly).toBe(0);
    expect(saved.photoUrls).toEqual(body.photoUrls);
    expect(saved.videoUrls).toEqual(body.videoUrls);
    await api()
      .patch(path)
      .set(h(actor))
      .send({ details: { possessionDate: '2026/2/30' } })
      .expect(400);
    expect((await api().get(path).set(h(actor)).expect(200)).body.details.availableFrom).toBe('2027-01-02');
  });
  it('lets create-only delegated users upload property media without granting record-edit permission', async () => {
    const member = await db.user.create({
      data: {
        name: 'Create only',
        email: 'create-only.' + stamp + '@e2e.test',
        role: 'SUB_BROKER_ADMIN',
        organizationId: orgId,
        delegatedPermissions: ['inventory:view', 'inventory:create'],
      },
      include: { organization: true },
    });
    const token = (await app.get(AuthService).issue(member)).accessToken;
    const { MediaService } = await import('../src/core/media/media.service');
    const sign = jest.spyOn(app.get(MediaService), 'sign').mockResolvedValueOnce({
      provider: 'local',
      method: 'PUT',
      uploadUrl: 'https://test.invalid/upload',
      publicUrl: 'https://test.invalid/file',
      key: 'listing/test',
      maxBytes: 1024,
    } as any);
    try {
      await api().post('/api/me/uploads/sign').auth(token, { type: 'bearer' }).send({ kind: 'listing', contentType: 'image/jpeg' }).expect(201);
      expect(sign).toHaveBeenCalledWith('listing', 'image/jpeg', orgId);
      const item = await api().post('/api/inventory').auth(token, { type: 'bearer' }).send({ sector: 'Sector 45' }).expect(201);
      await api()
        .patch('/api/inventory/' + item.body.id)
        .auth(token, { type: 'bearer' })
        .send({ notes: 'Not permitted' })
        .expect(403);
      await api().post('/api/me/uploads/sign').set(h('readOnly')).send({ kind: 'listing', contentType: 'image/jpeg' }).expect(403);
    } finally {
      sign.mockRestore();
    }
  });
});
