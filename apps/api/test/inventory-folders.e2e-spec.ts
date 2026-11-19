import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inventoryDate, inventoryMonth, inventoryMonthLabel } from '@brokeriq/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Inventory directories, reviewed capture and visit directions', () => {
  let app: INestApplication;
  let db: PrismaService;
  let firmId: string;
  let agentId: string;
  let admin: string;
  let agent: string;
  let delegate: string;
  let outsider: string;
  const stamp = Date.now().toString(36);
  const headers = (token = admin) => ({ Authorization: 'Bearer ' + token });
  const api = () => request(app.getHttpServer());
  const unit = {
    sector: 'Sector 45',
    houseNo: '384',
    purpose: 'RENT',
    category: 'RESIDENTIAL',
    propertyType: 'APARTMENT',
    bhk: 2,
    roomKind: 'BHK',
    furnishing: 'SEMI_FURNISHED',
    area: 1000,
    areaUnit: 'SQ_FT',
    monthlyRent: 32000,
  };
  const directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=28.45%2C77.07';

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    firmId = (await db.organization.create({ data: { name: 'Inventory e2e firm', slug: 'inventory-folders-' + stamp } })).id;
    const secondFirm = await db.organization.create({ data: { name: 'External e2e firm', slug: 'outside-folders-' + stamp } });
    const actors = [
      { name: 'admin', role: 'BROKER_ADMIN', organizationId: firmId },
      { name: 'agent', role: 'BROKER_AGENT', organizationId: firmId },
      {
        name: 'delegate',
        role: 'SUB_BROKER_ADMIN',
        organizationId: firmId,
        delegatedPermissions: ['inventory:view', 'inventory:edit', 'inventory:create', 'inbox:view', 'inbox:approve', 'leads:view'],
      },
      { name: 'outside', role: 'BROKER_ADMIN', organizationId: secondFirm.id },
    ] as const;
    for (const { name, ...actor } of actors) {
      const user = await db.user.create({
        data: {
          ...actor,
          name,
          email: `${name}.folders.${stamp}@e2e.test`,
          delegatedPermissions: 'delegatedPermissions' in actor ? [...actor.delegatedPermissions] : [],
        },
        include: { organization: true },
      });
      const token = (await app.get(AuthService).issue(user)).accessToken;
      if (name === 'admin') admin = token;
      else if (name === 'agent') {
        agent = token;
        agentId = user.id;
      } else if (name === 'delegate') delegate = token;
      else outsider = token;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps Survey private, then promotes and rents the same property without losing possession or photos', async () => {
    const sparse = { survey: true, sector: 'Sector 57', houseNo: 'S-552', contacts: [{ phone: '9701188901', role: 'OWNER' }] };
    await api().post('/api/inventory').set(headers(agent)).send(sparse).expect(400);
    const details = { possessionDate: '2027-01-05', petFriendly: false, foodPreference: 'VEGETARIAN_ONLY' };
    const photoUrls = ['https://inventory.example/property.jpg'];
    const create = await api()
      .post('/api/inventory')
      .set(headers(agent))
      .send({ ...sparse, details, photoUrls, clientMutationId: stamp + '-survey' })
      .expect(201);
    const id = create.body.id;
    expect(create.body).toMatchObject({ sourceType: 'SURVEY', status: 'DRAFT', availability: 'UNKNOWN', details });
    const list = (suffix: string, token = agent) =>
      api()
        .get('/api/inventory?houseNo=S-552' + suffix)
        .set(headers(token))
        .expect(200);
    expect((await list('&folderMode=SURVEY')).body.items.map((row: { id: string }) => row.id)).toEqual([id]);
    expect((await list('')).body.total).toBe(0);
    expect((await list('&folderMode=SURVEY', outsider)).body.total).toBe(0);
    await api()
      .patch('/api/inventory/' + id)
      .set(headers(agent))
      .send({ directoryMonth: '2027-01' })
      .expect(400);
    const placed = await api()
      .patch('/api/inventory/' + id)
      .set(headers(agent))
      .send({ ...unit, ...{ sector: sparse.sector, houseNo: sparse.houseNo }, directoryMonth: '2027-01' })
      .expect(200);
    expect(placed.body).toMatchObject({ id, availability: 'AVAILABLE', details, photoUrls });
    expect((await list('&folderMode=SURVEY')).body.total).toBe(0);
    expect((await list('&folderMode=AVAILABLE&folderMonth=2027-01')).body.total).toBe(1);
    const rented = await api()
      .patch('/api/inventory/' + id)
      .set(headers(agent))
      .send({ status: 'RENTED', availability: 'RENTED', expectedRevision: placed.body.revision })
      .expect(200);
    expect(rented.body).toMatchObject({ id, availability: 'RENTED', details, photoUrls, sector: sparse.sector, directoryMonth: null });
    expect((await list('&folderMode=RENTED&folderSector=Sector%2057')).body.total).toBe(1);
    expect((await list('&folderMode=AVAILABLE')).body.total).toBe(0);
    expect((await list('&sector=Sector%2057')).body.items.map((row: { id: string }) => row.id)).toEqual([id]);
    await api()
      .delete('/api/inventory/' + id)
      .set(headers())
      .expect(200);
  });

  it('keeps unknowns in verification and moves complete property records between folders and sectors', async () => {
    const draft = await api().post('/api/inventory').set(headers(agent)).send({ sector: unit.sector }).expect(201);
    const path = '/api/inventory/' + draft.body.id;
    const review = await api().get('/api/inventory?folderMode=REVIEW').set(headers(agent)).expect(200);
    expect(review.body.items.map((item: { id: string }) => item.id)).toContain(draft.body.id);
    await api().patch(path).set(headers(agent)).send({ directoryMonth: '2026-12', expectedRevision: draft.body.revision }).expect(400);
    await api().patch(path).set(headers(agent)).send({ status: 'RENTED', availability: 'RENTED', expectedRevision: draft.body.revision }).expect(400);
    const legacy = await db.inventoryItem.create({
      data: { organizationId: firmId, sector: unit.sector, verificationStatus: 'VERIFIED', status: 'RENTED', availability: 'RENTED' },
    });
    const allData = await api().get('/api/inventory').set(headers()).expect(200);
    expect(allData.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: legacy.id })]));

    const available = await api()
      .patch(path)
      .set(headers(agent))
      .send({ ...unit, directoryMonth: '2026-12', expectedRevision: draft.body.revision })
      .expect(200);
    expect(available.body).toMatchObject({ directoryMonth: '2026-12', availability: 'AVAILABLE', status: 'ACTIVE', verificationStatus: 'VERIFIED' });

    for (const token of [admin, agent, delegate]) {
      const months = await api().get('/api/inventory/folders?folderMode=AVAILABLE&folderYear=2026').set(headers(token)).expect(200);
      expect(months.body.folders).toHaveLength(12);
      expect(months.body.folders.at(-1)).toMatchObject({ key: '2026-12', count: 1 });
      const room = await api().get('/api/inventory/folders?folderMode=AVAILABLE&folderMonth=2026-12').set(headers(token)).expect(200);
      expect(room.body.folders).toEqual([{ key: 'TYPE:APARTMENT', label: 'Flat / apartment', count: 1 }]);
      const leaf = await api()
        .get('/api/inventory?folderMode=AVAILABLE&folderMonth=2026-12&folderRoom=BHK%3A2&folderFurnishing=SEMI_FURNISHED&minBudget=31000')
        .set(headers(token))
        .expect(200);
      expect(leaf.body.total).toBe(1);
      expect(leaf.body.items[0].id).toBe(draft.body.id);
    }
    const forbidden = await api().get('/api/inventory?folderMode=AVAILABLE').set(headers(outsider)).expect(200);
    expect(forbidden.body.total).toBe(0);
    await api().patch(path).set(headers(delegate)).send({ monthlyRent: null, expectedRevision: available.body.revision }).expect(400);
    const rented = await api()
      .patch(path)
      .set(headers(delegate))
      .send({ availability: 'RENTED', status: 'RENTED', expectedRevision: available.body.revision })
      .expect(200);
    expect(rented.body.directoryMonth).toBeNull();
    const sectors = await api().get('/api/inventory/folders?folderMode=RENTED').set(headers()).expect(200);
    expect(sectors.body.folders).toEqual([{ key: unit.sector, label: unit.sector, count: 1 }]);
  });

  it('rejects partial capture approval atomically and saves one inventory record per reviewed unit across retries', async () => {
    const batch = await db.importBatch.create({
      data: {
        organizationId: firmId,
        createdById: agentId,
        sourceType: 'WHATSAPP',
        sourceHash: stamp,
        status: 'NEEDS_REVIEW',
        metadata: { requestedTarget: 'INVENTORY', directoryMonth: '2027-01' },
      },
    });
    const entry = await db.sourceEntry.create({
      data: { organizationId: firmId, batchId: batch.id, entryKey: 'one', rawText: 'Two source units', extracted: [] },
    });
    const path = '/api/imports/entries/' + entry.id + '/approve';
    const entities = [unit, { ...unit, houseNo: '385', floor: '2', propertyType: 'BUILDER_FLOOR' }].map((inventory) => ({
      kind: 'INVENTORY',
      inventory,
      warnings: [],
    }));
    const submission = { destination: 'INVENTORY', expectedUpdatedAt: entry.updatedAt.toISOString(), entities };
    await api()
      .post(path)
      .set(headers(delegate))
      .send({ ...submission, entities: [entities[0], { ...entities[1], inventory: { sector: unit.sector } }] })
      .expect(400);
    expect(await db.inventoryItem.count({ where: { sourceEntryId: entry.id } })).toBe(0);
    const results = await Promise.all([1, 2].map(() => api().post(path).set(headers(delegate)).send(submission).expect(201)));
    expect(results.map(({ body }) => body.duplicate).sort()).toEqual([false, true]);
    const records = await db.inventoryItem.findMany({ where: { sourceEntryId: entry.id }, orderBy: { sourceUnitKey: 'asc' } });
    expect(records.map((record) => [record.houseNo, record.directoryMonth, record.sourceType])).toEqual([
      ['384', '2027-01', 'WHATSAPP'],
      ['385', '2027-01', 'WHATSAPP'],
    ]);
    expect(await db.brokerRequirement.count({ where: { sourceEntryId: entry.id } })).toBe(0);
  });

  it('makes exact directions available for an already scheduled visit without crossing firm boundaries', async () => {
    const item = await db.inventoryItem.create({ data: { organizationId: firmId, createdById: agentId, assignedToId: agentId, directionsUrl } });
    const lead = await db.lead.create({ data: { name: 'Visit route e2e', phone: '+919700000111', organizationId: firmId, assignedToId: agentId } });
    const visit = await db.siteVisit.create({
      data: {
        organizationId: firmId,
        leadId: lead.id,
        assignedToId: agentId,
        scheduledAt: new Date(Date.now() + 3600000),
        propertySnapshot: { kind: 'INVENTORY', id: item.id, title: 'Property entrance' },
      },
    });
    for (const token of [admin, agent, delegate]) {
      const results = await api().get('/api/visits?paginated=true&upcoming=true&directions=true').set(headers(token)).expect(200);
      expect(results.body.items.find(({ id }: { id: string }) => id === visit.id).propertySnapshot.directionsUrl).toBe(directionsUrl);
    }
    const denied = await api().get('/api/visits?paginated=true&upcoming=true&directions=true').set(headers(outsider)).expect(200);
    expect(denied.body.items.find(({ id }: { id: string }) => id === visit.id)).toBeUndefined();
  });

  it('shows only the current month and carries complete active stock forward without changing its original availability date', async () => {
    const now = new Date();
    const current = inventoryMonth(now);
    const past = inventoryMonth(new Date(now.getTime() - 45 * 86400_000));
    const future = inventoryMonth(new Date(now.getTime() + 45 * 86400_000));
    const houseNo = 'carry-forward-' + stamp;
    const date = `${past}-01`;
    const available = (
      await api()
        .post('/api/inventory')
        .set(headers(agent))
        .send({ ...unit, houseNo, directoryMonth: past, availableSince: date })
        .expect(201)
    ).body;
    const upcoming = (
      await api()
        .post('/api/inventory')
        .set(headers(agent))
        .send({ ...unit, houseNo: houseNo + '-future', directoryMonth: future })
        .expect(201)
    ).body;
    expect(upcoming.availableSince).toBe(`${future}-01`);
    const query = { folderMode: 'AVAILABLE', currentInventory: 'true', search: houseNo };
    for (const token of [admin, agent, delegate]) {
      const folders = (await api().get('/api/inventory/folders').query(query).set(headers(token)).expect(200)).body;
      expect(folders.folders).toEqual([{ key: current, label: inventoryMonthLabel(current), count: 1 }]);
      const nested = (
        await api()
          .get('/api/inventory/folders')
          .query({ ...query, folderMonth: current })
          .set(headers(token))
          .expect(200)
      ).body;
      expect(nested.folders).toEqual([{ key: 'TYPE:APARTMENT', label: 'Flat / apartment', count: 1 }]);
      const leaf = (
        await api()
          .get('/api/inventory')
          .query({ ...query, folderMonth: current, folderRoom: 'BHK:2', folderFurnishing: 'SEMI_FURNISHED' })
          .set(headers(token))
          .expect(200)
      ).body;
      expect(leaf.items).toEqual([expect.objectContaining({ id: available.id, directoryMonth: past, availableSince: date, revision: available.revision })]);
    }
    await api()
      .patch('/api/inventory/' + available.id)
      .set(headers(delegate))
      .send({ availability: 'AVAILABLE', expectedRevision: available.revision })
      .expect(200)
      .expect(({ body }) => expect(body.availableSince).toBe(date));
    const original = await db.inventoryItem.findUniqueOrThrow({ where: { id: available.id } });
    for (const availableSince of [null, `${current}-01`]) {
      await api()
        .patch('/api/inventory/' + available.id)
        .set(headers(delegate))
        .send({ availableSince, expectedRevision: original.revision })
        .expect(400);
    }
    await api()
      .patch('/api/inventory/' + available.id)
      .set(headers(delegate))
      .send({ availability: 'RENTED', status: 'RENTED', expectedRevision: original.revision })
      .expect(200)
      .expect(({ body }) => expect(body.availableSince).toBe(date));
    const empty = (await api().get('/api/inventory/folders').query(query).set(headers(agent)).expect(200)).body;
    expect(empty.folders).toEqual([{ key: current, label: inventoryMonthLabel(current), count: 0 }]);
    const reactivated = (
      await api()
        .patch('/api/inventory/' + available.id)
        .set(headers(agent))
        .send({ directoryMonth: current })
        .expect(200)
    ).body;
    expect(reactivated.availableSince).toBe(inventoryDate());
    await api()
      .patch('/api/inventory/' + available.id)
      .set(headers(delegate))
      .send({ availability: 'RENTED', status: 'RENTED', expectedRevision: reactivated.revision })
      .expect(200);
    await api()
      .patch('/api/inventory/' + available.id)
      .set(headers(delegate))
      .send({ directoryMonth: current, availableSince: `${current}-01`, monthlyRent: 33000 })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ availableSince: `${current}-01`, monthlyRent: 33000 }));
  });
});
