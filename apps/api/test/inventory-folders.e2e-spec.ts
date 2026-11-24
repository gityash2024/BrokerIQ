import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
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
  let otherAgent: string;
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
      { name: 'other-agent', role: 'BROKER_AGENT', organizationId: firmId },
      {
        name: 'delegate',
        role: 'SUB_BROKER_ADMIN',
        organizationId: firmId,
        delegatedPermissions: ['today:view', 'inventory:view', 'inventory:edit', 'inventory:create', 'inbox:view', 'inbox:approve', 'leads:view'],
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
      } else if (name === 'other-agent') otherAgent = token;
      else if (name === 'delegate') delegate = token;
      else outsider = token;
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('separates PDF property access from private contact and source text access', async () => {
    const batch = await db.importBatch.create({ data: { organizationId: firmId, sourceType: 'PDF', sourceHash: randomUUID(), status: 'COMPLETE' } });
    const row = await db.pdfInventoryRow.create({ data: { organizationId: firmId, batchId: batch.id, pageNo: 4, rowNo: 1,
      address: 'Sample property', rawText: 'Sample private contact text', ownerName: 'Private owner', contacts: ['+919700000112'],
      notes: 'Private remarks', monthlyRent: 24000 } });
    const scoped = '/api/inventory-pdf?batchId=' + batch.id;
    await api().get(scoped).set(headers()).expect(200).expect(({ body }) => expect(body.items[0]).toMatchObject({
      id: row.id, ownerName: row.ownerName, rawText: row.rawText, contacts: row.contacts,
    }));
    await api().get(scoped).set(headers(delegate)).expect(200).expect(({ body }) => expect(body.items[0]).toMatchObject({
      id: row.id, ownerName: null, rawText: '', contacts: [], notes: null, monthlyRent: 24000,
    }));
    await api().get(scoped + '&search=9700000112').set(headers(delegate)).expect(200).expect(({ body }) => expect(body.total).toBe(0));
    const patch = '/api/inventory-pdf/' + row.id;
    await api().patch(patch).set(headers(delegate)).send({ ownerName: 'Changed owner', expectedUpdatedAt: row.updatedAt }).expect(403);
    await api().patch(patch).set(headers(delegate)).send({ monthlyRent: 25000, expectedUpdatedAt: row.updatedAt }).expect(200);
    await api().get(scoped).set(headers(outsider)).expect(200).expect(({ body }) => expect(body.total).toBe(0));
  });

  it('opens a new sector before any property exists and scopes custom folders to their firm', async () => {
    const create = (kind: 'SECTOR' | 'CUSTOM', label: string, token = admin) =>
      api().post('/api/inventory/folder-definitions').set(headers(token)).send({ kind, label }).expect(201);
    const first = (await create('SECTOR', 'Sec-30', delegate)).body;
    expect((await create('SECTOR', 'Sector 30')).body).toEqual(first);
    const empty = (await api().get('/api/inventory/folders?folderMode=SURVEY').set(headers()).expect(200)).body;
    expect(empty.folders).toEqual(expect.arrayContaining([{ key: 'Sector 30', label: 'Sector 30', count: 0 }]));

    const folder = (await create('CUSTOM', 'Site captures')).body;
    const draft = { sector: 'Sec-30', photoUrl: 'https://inventory.example/survey-photo.jpg', customFolderId: folder.id };
    await api().post('/api/inventory/survey-photo').set(headers(outsider)).send({ ...draft, clientMutationId: randomUUID() }).expect(400);
    const saved = (await api().post('/api/inventory/survey-photo').set(headers(agent)).send({ ...draft, clientMutationId: randomUUID() }).expect(201)).body;
    expect(saved).toMatchObject({ sector: 'Sector 30', customFolderId: folder.id });
    const query = '/api/inventory?folderMode=SURVEY&customFolderId=' + folder.id;
    expect((await api().get(query).set(headers()).expect(200)).body.items.map(({ id }: { id: string }) => id)).toEqual([saved.id]);
    expect((await api().get(query).set(headers(outsider)).expect(200)).body.items).toEqual([]);
    await api().delete('/api/inventory/' + saved.id).set(headers(delegate)).expect(403);
    await api().delete('/api/inventory/' + saved.id).set(headers()).expect(200);
  });

  it('captures a photo-only Survey draft for office review and treats a retry as the same record', async () => {
    const photoUrl = 'https://inventory.example/office-review.jpg';
    const capture = { clientMutationId: randomUUID(), photoUrl };
    const create = () => api().post('/api/inventory/survey-photo').set(headers(agent)).send(capture).expect(201);
    const created = (await create()).body;
    expect((await create()).body.id).toBe(created.id);
    expect(created).toMatchObject({
      sourceType: 'SURVEY',
      status: 'DRAFT',
      availability: 'UNKNOWN',
      verificationStatus: 'NEEDS_REVIEW',
      sector: null,
      houseNo: null,
      assignedToId: agentId,
      photoUrls: [photoUrl],
    });
    const draftUrl = '/api/inventory/' + created.id;
    const office = await api().get('/api/inventory?folderMode=SURVEY&folderSector=__unset__').set(headers(admin)).expect(200);
    expect(office.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    const available = await api().get('/api/inventory?folderMode=AVAILABLE').set(headers(admin)).expect(200);
    expect(available.body.items).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    await api().get(draftUrl).set(headers(outsider)).expect(404);
    await api().patch(draftUrl).set(headers(admin)).send({ directoryMonth: '2027-01' }).expect(400);
    const reviewed = await api()
      .patch(draftUrl)
      .set(headers(admin))
      .send({ sector: 'Sector 57', houseNo: 'Photo review', details: { possessionDate: '2027-01-05' } })
      .expect(200);
    expect(reviewed.body).toMatchObject({ id: created.id, sector: 'Sector 57', photoUrls: [photoUrl] });
  });

  it('counts a phone-only survey for the creator and office until the same record is made available', async () => {
    const pending = async (token: string) => (await api().get('/api/broker/today').set(headers(token)).expect(200)).body.surveyPending;
    const [officeBefore, agentBefore, delegateBefore, otherBefore] = await Promise.all([admin, agent, delegate, otherAgent].map(pending));
    const endpoint = '/api/inventory/survey-phone';
    const payload = { phone: '9701188902', directionsUrl, clientMutationId: randomUUID() };
    await api()
      .post(endpoint)
      .set(headers(agent))
      .send({ ...payload, phone: '97011' })
      .expect(400);
    const post = () => api().post(endpoint).set(headers(agent)).send(payload).expect(201);
    const { body: draft } = await post();
    expect(draft).toMatchObject({ status: 'DRAFT', sourceType: 'SURVEY', sector: null, assignedToId: agentId });
    expect(draft.contacts).toEqual([expect.objectContaining({ phone: '+919701188902', role: 'OWNER' })]);
    expect((await post()).body.id).toBe(draft.id);
    expect(await Promise.all([admin, agent, delegate, otherAgent].map(pending))).toEqual([officeBefore + 1, agentBefore + 1, delegateBefore + 1, otherBefore]);
    const path = '/api/inventory/' + draft.id;
    await api().get(path).set(headers(otherAgent)).expect(404);
    const { body: available } = await api()
      .patch(path)
      .set(headers(admin))
      .send({
        ...unit,
        houseNo: 'Phone review ' + stamp,
        directoryMonth: inventoryMonth(),
        details: { possessionDate: inventoryDate() },
      })
      .expect(200);
    expect(available).toMatchObject({ id: draft.id, availability: 'AVAILABLE', directionsUrl });
    expect(available.contacts).toEqual(draft.contacts);
    expect(await Promise.all([admin, agent, delegate, otherAgent].map(pending))).toEqual([officeBefore, agentBefore, delegateBefore, otherBefore]);
    await api().delete(path).set(headers(admin)).expect(200);
  });

  it('saves each named owner and phone together in a quick Survey draft', async () => {
    const endpoint = '/api/inventory/survey-phone';
    const payload = {
      clientMutationId: randomUUID(),
      sector: 'Sector 46',
      directionsUrl,
      contacts: [
        { name: 'First owner', phone: '9701188964', role: 'OWNER' },
        { name: 'Second owner', phone: '+91 9701188965', role: 'OWNER' },
        { phone: '9701188966', role: 'OWNER' },
      ],
    };
    await api()
      .post(endpoint)
      .set(headers(agent))
      .send({ ...payload, directionsUrl: 'https://example.com/invalid' })
      .expect(400);
    const { body } = await api().post(endpoint).set(headers(agent)).send(payload).expect(201);
    expect(body.directionsUrl).toBe(directionsUrl);
    const reloaded = await api()
      .get('/api/inventory/' + body.id)
      .set(headers(admin))
      .expect(200);
    expect(reloaded.body.directionsUrl).toBe(directionsUrl);
    expect(body.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'First owner', phone: '+919701188964', role: 'OWNER' }),
        expect.objectContaining({ name: 'Second owner', phone: '+919701188965', role: 'OWNER' }),
        expect.objectContaining({ name: null, phone: '+919701188966', role: 'OWNER' }),
      ]),
    );
    expect((await api().post(endpoint).set(headers(agent)).send(payload).expect(201)).body.id).toBe(body.id);
    await api()
      .get('/api/inventory/' + body.id)
      .set(headers(otherAgent))
      .expect(404);
    await api()
      .delete('/api/inventory/' + body.id)
      .set(headers(admin))
      .expect(200);
  });

  it('saves each quick Survey unit once and moves a no-answer call to the end of the pending Survey queue', async () => {
    const url = '/api/inventory/survey-units';
    const payload = {
      houseNo: 'Units ' + stamp,
      sector: 'Sector 27',
      directionsUrl,
      contacts: [{ phone: '9701188933', role: 'OWNER' }],
      units: [
        { configuration: '1_RK', furnishing: 'SEMI_FURNISHED', photoUrls: ['https://inventory.example/survey-rk.jpg'] },
        { configuration: '2_BHK', furnishing: 'FULLY_FURNISHED', photoUrls: ['https://inventory.example/survey-2bhk.jpg'] },
      ],
      clientMutationId: randomUUID(),
    };
    await api()
      .post(url)
      .set(headers(agent))
      .send({ ...payload, units: [payload.units[0], payload.units[0]] })
      .expect(400);
    expect(await db.inventoryItem.count({ where: { organizationId: firmId, houseNo: payload.houseNo } })).toBe(0);
    const saved = await api().post(url).set(headers(agent)).send(payload).expect(201);
    const [rk, bhk] = saved.body.items;
    expect(rk).toMatchObject({ houseNo: payload.houseNo, sector: 'Sector 27', directionsUrl, bhk: 1, roomKind: 'RK', status: 'DRAFT' });
    expect(bhk).toMatchObject({ bhk: 2, roomKind: 'BHK', furnishing: 'FULLY_FURNISHED', availability: 'UNKNOWN' });
    expect([rk.photoUrls, bhk.photoUrls]).toEqual(payload.units.map((row) => row.photoUrls));
    expect((await api().post(url).set(headers(agent)).send(payload).expect(201)).body.items.map((item: { id: string }) => item.id)).toEqual([rk.id, bhk.id]);
    const noAnswer = '/api/inventory/' + rk.id + '/survey-call';
    const call = { expectedRevision: rk.revision, note: 'Try in the evening' };
    await api().patch(noAnswer).set(headers(otherAgent)).send(call).expect(404);
    const logged = await api().patch(noAnswer).set(headers(delegate)).send(call).expect(200);
    expect(logged.body).toMatchObject({ id: rk.id, status: 'DRAFT', availability: 'UNKNOWN', sector: 'Sector 27' });
    expect(logged.body.notes).toMatch(/Survey call: No answer.*Try in the evening/);
    await api().patch(noAnswer).set(headers(agent)).send(call).expect(409);
    const listing = '/api/inventory?folderMode=SURVEY&folderSector=Sector%2027&search=' + encodeURIComponent(payload.houseNo);
    const page1 = await api()
      .get(listing + '&page=1&pageSize=1')
      .set(headers(agent))
      .expect(200);
    const page2 = await api()
      .get(listing + '&page=2&pageSize=1')
      .set(headers(agent))
      .expect(200);
    expect(page1.body.items.map(({ id }: { id: string }) => id)).toEqual([bhk.id]);
    expect(page2.body.items.map(({ id }: { id: string }) => id)).toEqual([rk.id]);
    await api()
      .patch('/api/inventory/' + bhk.id + '/survey-call')
      .set(headers(agent))
      .send({ expectedRevision: bhk.revision })
      .expect(200);
    expect((await api().get(listing).set(headers(agent)).expect(200)).body.items.map(({ id }: { id: string }) => id)).toEqual([rk.id, bhk.id]);
    const folders = (await api().get('/api/inventory/folders?folderMode=SURVEY').set(headers()).expect(200)).body.folders;
    expect(folders).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'Sector 27', count: 2 })]));
    for (const id of [rk.id, bhk.id])
      await api()
        .delete('/api/inventory/' + id)
        .set(headers(admin))
        .expect(200);
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

  it('creates and shares separate same-address units, with role-scoped photo counts across pages', async () => {
    const houseNo = 'separate-units-' + stamp;
    const directoryMonth = inventoryMonth();
    const rkPhoto = 'https://inventory.example/rk.jpg';
    const bhkPhoto = 'https://inventory.example/3bhk.jpg';
    const payload = {
      clientMutationId: randomUUID(),
      property: { ...unit, propertyType: 'BUILDER_FLOOR', floor: '1st Floor', houseNo, directoryMonth, bhk: 1, roomKind: 'RK', photoUrls: [rkPhoto] },
      units: [
        { configuration: '3_BHK', floor: '2nd Floor', monthlyRent: 55000, furnishing: 'SEMI_FURNISHED', area: 1400, areaUnit: 'SQ_FT', photoUrls: [bhkPhoto] },
        { configuration: '2_BHK', floor: '3rd Floor', monthlyRent: 43000, furnishing: 'FULLY_FURNISHED', area: 1200, areaUnit: 'SQ_FT' },
      ],
    };
    const create = (body: unknown = payload) =>
      api()
        .post('/api/inventory/units')
        .set(headers(delegate))
        .send(body as object);
    await create({ ...payload, units: [payload.units[0], { ...payload.units[1], area: null }] }).expect(400);
    expect(await db.inventoryItem.count({ where: { organizationId: firmId, houseNo } })).toBe(0);
    const [rk, bhk, noPhoto] = (await create().expect(201)).body.items;
    expect([rk.photoUrls, bhk.photoUrls, noPhoto.photoUrls]).toEqual([[rkPhoto], [bhkPhoto], []]);
    expect((await create().expect(201)).body.items.map((row: { id: string }) => row.id)).toEqual([rk.id, bhk.id, noPhoto.id]);
    for (const [record, photo, configuration] of [
      [rk, rkPhoto, '1 RK'],
      [bhk, bhkPhoto, '3 BHK'],
    ]) {
      const share = await api().post(`/api/inventory/${record.id}/photo-gallery`).set(headers()).expect(201);
      const token = share.body.url.split('/').pop();
      const gallery = await api()
        .get('/api/public/photo-galleries/' + token)
        .expect(200);
      expect(gallery.body.photos).toEqual([photo]);
      expect(gallery.body.caption).toContain('Config: ' + configuration);
    }
    const filters = { folderMode: 'AVAILABLE', currentInventory: 'true', search: houseNo };
    for (const path of ['/api/inventory', '/api/inventory/folders']) {
      expect(
        (
          await api()
            .get(path)
            .query({ ...filters, pageSize: 1 })
            .set(headers())
            .expect(200)
        ).body.photoCounts,
      ).toEqual({ withPhotos: 2, withoutPhotos: 1 });
      expect((await api().get(path).query(filters).set(headers(agent)).expect(200)).body.photoCounts).toBeUndefined();
      expect((await api().get(path).query(filters).set(headers(outsider)).expect(200)).body.photoCounts).toEqual({ withPhotos: 0, withoutPhotos: 0 });
    }
  });
});
