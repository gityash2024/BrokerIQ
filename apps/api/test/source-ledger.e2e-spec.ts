import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobsService } from '../src/core/jobs/jobs.service';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { zipSync, strToU8 } from 'fflate';
import { createHmac } from 'crypto';
import { ImportsService } from '../src/modules/imports/imports.service';
import { inventoryEditorPatch, inventoryInputSchema, prepareInventoryEditorInput, IMPORT_CHUNK_BYTES, IMPORT_MAX_BYTES } from '@brokeriq/shared';

(process.env.BROKER_FIRST === 'true' ? describe : describe.skip)('Source-backed inventory and requirements', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;
  let a: string;
  let b: string;
  let orgA: string;
  const uid = Date.now().toString(36);
  const header = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.systemSetting.deleteMany({ where: { key: 'platform.modules' } });
    admin = (await api().post('/api/auth/login').send({ email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD }).expect(200)).body
      .accessToken;
    for (const name of ['a', 'b']) {
      const account = { name: `Fixture ${name}`, firmName: `Ledger test ${name} ${uid}`, email: `ledger.${name}.${uid}@e2e.test`, password: 'Fixture@12345' };
      const firm = await api().post('/api/admin/organizations').set(header(admin)).send(account).expect(201);
      const token = (await api().post('/api/auth/login').send(account).expect(200)).body.accessToken;
      if (name === 'a') {
        a = token;
        orgA = firm.body.id;
      } else b = token;
    }
  });
  afterAll(async () => {
    await app.close();
  });
  it('round-trips imported nulls and updates one field without changing other values', async () => {
    const source = await prisma.inventoryItem.create({ data: {
      organizationId: orgA, sector: 'Sector 38', houseNo: 'Imported edit fixture', sourceType: 'PDF_REGISTER',
      purpose: 'RENT', monthlyRent: 13000, rent: 13000, area: 900, areaUnit: 'SQ_FT', notes: 'Preserve source',
      details: { securityMonths: 1, advanceMonths: 1, projectName: 'Original project' },
      contacts: { create: [{ name: null, phone: '+919999999999', role: 'UNKNOWN', note: 'Preserve contact note' }] },
    } });
    const original = (await api().get(`/api/inventory/${source.id}`).set(header(a)).expect(200)).body;
    expect(original.clientMutationId).toBeNull();
    expect(inventoryInputSchema.safeParse(prepareInventoryEditorInput(original)).success).toBe(true);
    let saved = (await api().patch(`/api/inventory/${source.id}`).set(header(a)).send(inventoryEditorPatch({ ...original, houseNo: 'Updated house only' }, original)).expect(200)).body;
    for (const field of ['contacts', 'details', 'notes', 'monthlyRent', 'rent', 'sector', 'area', 'sourceType', 'clientMutationId']) expect(saved[field]).toEqual(original[field]);
    saved = (await api().patch(`/api/inventory/${source.id}`).set(header(a)).send(inventoryEditorPatch({ ...saved, monthlyRent: '14000' }, saved)).expect(200)).body;
    expect(saved.monthlyRent).toBe(14000);
    expect(saved.rent).toBe(14000);
    saved = (await api().patch(`/api/inventory/${source.id}`).set(header(a)).send(inventoryEditorPatch({ ...saved, monthlyRent: '', details: { ...saved.details, projectName: '' } }, saved)).expect(200)).body;
    expect(saved.monthlyRent).toBeNull(); expect(saved.rent).toBeNull(); expect(saved.price).toBeNull();
    expect(saved.details).toEqual({ securityMonths: 1, advanceMonths: 1, projectName: null });
    await api().patch(`/api/inventory/${source.id}`).set(header(b)).send({ notes: 'Wrong firm' }).expect(404);
    await prisma.inventoryItem.delete({ where: { id: source.id } });
  });
  it('uploads a full 300 MB ZIP in resumable encrypted chunks and extracts all messages', async () => {
    const chat = Array.from({ length: 31 }, (_, i) => `25/10/2026, 11:${String(i).padStart(2, '0')} - Broker: Requirement 2 BHK Sector 45 budget 40k`).join('\n');
    const zip = Buffer.from(zipSync({ 'WhatsApp Chat.txt': strToU8(chat), 'photo.jpg': new Uint8Array([1, 2, 3]) }, { level: 0 }));
    // Legal ZIP trailing padding exercises the exact upload boundary without retaining a 300 MB JS buffer.
    const input = { clientKey: `large-zip-${uid}`, fileName: 'group.zip', contentType: 'application/zip', sourceType: 'CHAT_EXPORT', totalBytes: IMPORT_MAX_BYTES, groupName: `Regression ${uid}` };
    let state = (await api().post('/api/imports/uploads').set(header(a)).send(input).expect(201)).body;
    const block = Buffer.alloc(IMPORT_CHUNK_BYTES);
    for (let index = 0; index < IMPORT_MAX_BYTES / IMPORT_CHUNK_BYTES; index++) {
      block.fill(0); if (index === 0) zip.copy(block);
      state = (await api().post(`/api/imports/uploads/${state.id}/chunks/${index}`).set(header(a)).send({ data: block.toString('base64') }).expect(201)).body;
      if (index === 2) {
        const resumed = (await api().post('/api/imports/uploads').set(header(a)).send(input).expect(201)).body;
        expect(resumed.nextIndex).toBe(3); expect(resumed.receivedBytes).toBe(3 * IMPORT_CHUNK_BYTES);
        await api().post(`/api/imports/uploads/${state.id}/chunks/3`).set(header(b)).send({ data: block.toString('base64') }).expect(404);
      }
    }
    const complete = (await api().post(`/api/imports/uploads/${state.id}/complete`).set(header(a)).send({}).expect(201)).body;
    await app.get(ImportsService).extract(complete.id);
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: complete.id }, include: { _count: { select: { entries: true } } } });
    expect(batch.status).toBe('NEEDS_REVIEW'); expect(batch._count.entries).toBe(31);
    const repeated = (await api().post(`/api/imports/uploads/${state.id}/complete`).set(header(a)).send({}).expect(201)).body;
    expect(repeated.id).toBe(complete.id);
    await api().post('/api/imports/uploads').set(header(a)).send({ ...input, clientKey: `${input.clientKey}-over`, totalBytes: IMPORT_MAX_BYTES + 1 }).expect(400);
  }, 240_000);
  it('captures first, requires review, preserves multiple units and idempotency', async () => {
    const source = { sourceType: 'TEXT', target: 'INVENTORY', rawText: 'House 99, Sector 45, 2 BHK for rent, Rent 20k. Contact 9899980802' };
    const first = await api().post('/api/imports').set(header(a)).send(source).expect(201);
    await app.get(ImportsService).extract(first.body.id);
    const batch = (await api().get(`/api/imports/${first.body.id}`).set(header(a)).expect(200)).body;
    expect(batch.metadata.requestedTarget).toBe('INVENTORY');
    expect(await prisma.inventoryItem.count({ where: { organizationId: orgA } })).toBe(0);
    const entry = batch.entries[0];
    const entity = entry.extracted[0];
    const entities = [
      { kind: 'UNRELATED', warnings: [] },
      ...[1, 2].map((floor) => ({ ...entity, inventory: { ...entity.inventory, floor: String(floor), monthlyRent: 20000 + floor * 1000 } })),
    ];
    try {
      await api()
        .patch('/api/admin/modules/leads')
        .set(header(admin))
        .send({ state: 'HIDDEN', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] })
        .expect(200);
      await api().post(`/api/imports/entries/${entry.id}/approve`).set(header(a)).send({ entities, expectedUpdatedAt: entry.updatedAt }).expect(201);
    } finally {
      await api()
        .patch('/api/admin/modules/leads')
        .set(header(admin))
        .send({ state: 'ACTIVE', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] })
        .expect(200);
    }
    let rows = await prisma.inventoryItem.findMany({ where: { organizationId: orgA }, orderBy: { floor: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.floor)).toEqual(['1', '2']);
    expect(rows.every((r) => r.availability === 'UNKNOWN' && r.sourceEntryId === entry.id)).toBe(true);
    await api().patch(`/api/inventory/${rows[0].id}`).set(header(a)).send({ expectedRevision: rows[0].revision, monthlyRent: 25000 }).expect(200);
    await api().patch(`/api/inventory/${rows[0].id}`).set(header(a)).send({ expectedRevision: rows[0].revision, monthlyRent: 26000 }).expect(409);
    const duplicate = await api().post('/api/imports').set(header(a)).send(source).expect(201);
    expect(duplicate.body.id).toBe(first.body.id);
    await api().post(`/api/imports/entries/${entry.id}/approve`).set(header(a)).send({ entities }).expect(201);
    rows = await prisma.inventoryItem.findMany({ where: { organizationId: orgA }, orderBy: { floor: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].monthlyRent)).toBe(25000);
    const pending = await api().get(`/api/imports/${first.body.id}`).set(header(a)).query({ reviewState: 'NEEDS_REVIEW' }).expect(200);
    expect(pending.body.entries).toEqual([]);
    expect(pending.body.total).toBe(0);
    const approved = await api().get(`/api/imports/${first.body.id}`).set(header(a)).query({ reviewState: 'APPROVED' }).expect(200);
    expect(approved.body.entries.map((e: any) => e.id)).toEqual([entry.id]);
    await api().get(`/api/imports/${first.body.id}`).set(header(a)).query({ reviewState: 'INVALID' }).expect(400);
    await api().get(`/api/imports/${first.body.id}`).set(header(b)).expect(404);
    await api().get(`/api/imports/${first.body.id}`).set(header(b)).query({ reviewState: 'APPROVED' }).expect(404);
    await api().get(`/api/inventory/${rows[0].id}`).set(header(b)).expect(404);
  });
  it('deduplicates manual offline saves and retains retryable integration failures', async () => {
    const property = { sector: 'Sector 46', houseNo: 'Offline fixture', purpose: 'RENT', monthlyRent: 22000, clientMutationId: `offline.${uid}` };
    const first = await api().post('/api/inventory').set(header(a)).send(property).expect(201);
    const repeated = await api()
      .post('/api/inventory')
      .set(header(a))
      .send({ ...property, monthlyRent: 24000 })
      .expect(201);
    expect(repeated.body.id).toBe(first.body.id);
    expect(repeated.body.monthlyRent).toBe(22000);
    const req = { purpose: 'RENT', localityNames: ['Sector 46'], propertyTypes: [], bedrooms: [], maxBudget: 25000, clientMutationId: `requirement.${uid}` };
    const requirement = await api().post('/api/broker-requirements').set(header(a)).send(req).expect(201);
    const duplicate = await api().post('/api/broker-requirements').set(header(a)).send(req).expect(201);
    expect(duplicate.body.id).toBe(requirement.body.id);
    const missing = await api().post('/api/broker/connectors/housing_api/sync').set(header(a)).send({}).expect(424);
    expect(missing.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
    const jobs = app.get(JobsService);
    const old = await jobs.enqueue('connector.housing.poll', { orgId: orgA }, { key: `repeat.${uid}` });
    await prisma.job.update({ where: { id: old.id }, data: { status: 'DONE' } });
    const next = await jobs.enqueue('connector.housing.poll', { orgId: orgA }, { key: `repeat.${uid}`, repeat: true });
    expect(next.id).toBe(old.id);
    expect(next.status).toBe('PENDING');
  });
  it('retains overlapping export source evidence without importing the same exact message twice', async () => {
    const message = '[10/10/2026, 10:00:00] Fixture sender: Requirement 2 BHK for rent Sector 45 budget 45k to 55k';
    const first = await api()
      .post('/api/imports')
      .set(header(a))
      .send({ sourceType: 'CHAT_EXPORT', groupName: `export-group.${uid}`, rawText: message })
      .expect(201);
    await app.get(ImportsService).extract(first.body.id);
    const second = await api()
      .post('/api/imports')
      .set(header(a))
      .send({
        sourceType: 'CHAT_EXPORT',
        groupName: `export-group.${uid}`,
        rawText: message + '\n[11/10/2026, 10:00:00] Fixture sender: Not a property message',
      })
      .expect(201);
    await app.get(ImportsService).extract(second.body.id);
    const batch = await api().get(`/api/imports/${second.body.id}`).set(header(a)).expect(200);
    expect(batch.body.entries[0].reviewState).toBe('DUPLICATE');
    expect(batch.body.entries[0].duplicateOfId).toBeTruthy();
    expect(batch.body.entries[0].rawText).toContain('Requirement');
  });
  it('filters typed commercial facts, units, media and null-safe price sorting', async () => {
    const one = await api()
      .post('/api/inventory')
      .set(header(a))
      .send({
        sector: 'Sector 56',
        houseNo: 'Commercial filter fixture',
        purpose: 'SALE',
        category: 'COMMERCIAL',
        propertyType: 'SHOP',
        area: 400,
        areaUnit: 'SQ_FT',
        totalSalePrice: 15000000,
        photoUrls: ['https://example.test/photo.jpg'],
        details: {
          purchaseType: 'RESALE',
          possessionStatus: 'READY_TO_MOVE',
          investmentType: 'PRE_LEASED',
          areaBasis: 'CARPET',
          postedBy: 'OWNER',
          bathrooms: 2,
          additionalRooms: 1,
        },
        amenities: ['LIFT', 'POWER_BACKUP'],
      })
      .expect(201);
    const filter = { investmentType: ['PRE_LEASED'], postedBy: ['OWNER'], bathrooms: { min: 2, max: 3 }, additionalRooms: { min: 1, max: 1 } };
    const filtered = await api()
      .get('/api/inventory')
      .set(header(a))
      .query({ sector: 'Sector 56', detailFilters: JSON.stringify(filter), hasPhotos: 'true', amenities: 'LIFT,POWER_BACKUP', sort: 'ratePerSqft:asc' })
      .expect(200);
    expect(filtered.body.items.map((r: any) => r.id)).toContain(one.body.id);
    expect(one.body.ratePerSqft).toBe(37500);
    await api().get('/api/inventory').set(header(a)).query({ detailFilters: '{"bathrooms":{"min":"oops"}}' }).expect(400);
    await api()
      .patch(`/api/inventory/${one.body.id}`)
      .set(header(a))
      .send({ expectedRevision: one.body.revision, totalSalePrice: 16000000, details: { bathrooms: 3 } })
      .expect(200);
    const updated = await api().get(`/api/inventory/${one.body.id}`).set(header(a)).expect(200);
    expect(updated.body.ratePerSqft).toBe(40000);
    expect(updated.body.details.purchaseType).toBe('RESALE');
    expect(updated.body.details.additionalRooms).toBe(1);
    const excluded = await api()
      .get('/api/inventory')
      .set(header(a))
      .query({ detailFilters: JSON.stringify({ additionalRooms: { min: 2 } }) })
      .expect(200);
    expect(excluded.body.items.map((r: any) => r.id)).not.toContain(one.body.id);
  });
  it('requires webhook signature configuration and deduplicates durable events', async () => {
    const wa = app.get(WhatsAppService);
    const raw = Buffer.from('{"entry":[]}');
    const signature = 'sha256=' + createHmac('sha256', 'fixture-secret').update(raw).digest('hex');
    expect(wa.verifySignature(undefined, raw, undefined)).toBe(false);
    expect(wa.verifySignature('fixture-secret', raw, signature)).toBe(true);
    expect(wa.verifySignature('fixture-secret', Buffer.from('tampered'), signature)).toBe(false);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgA } });
    const body = { entry: [{ changes: [{ value: { messages: [], statuses: [] } }] }] };
    await wa.handleWebhook(org.webhookKey, body);
    await wa.handleWebhook(org.webhookKey, body);
    const events = await prisma.webhookEvent.findMany({ where: { organizationId: orgA, provider: 'whatsapp' } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('RECEIVED');
    expect(await prisma.job.count({ where: { key: `whatsapp:${events[0].id}` } })).toBe(1);
  });
  it('rejects cross-firm bulk operations atomically', async () => {
    const own = await api().post('/api/inventory').set(header(a)).send({ sector: 'Sector 43', houseNo: '10', purpose: 'RENT', monthlyRent: 20000 }).expect(201);
    const foreign = await api().post('/api/inventory').set(header(b)).send({ sector: 'Sector 43', houseNo: '11' }).expect(201);
    await api()
      .patch('/api/inventory/bulk/update')
      .set(header(a))
      .send({ ids: [own.body.id, foreign.body.id], data: { availability: 'AVAILABLE' } })
      .expect(403);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: own.body.id } })).availability).toBe('UNKNOWN');
    await api().post('/api/inventory').set(header(a)).send({ sector: 'Sector 43', purpose: 'SALE', monthlyRent: 30000 }).expect(400);
  });
  it('keeps separate requirements and distinguishes unknown from available matches', async () => {
    const body = { contactName: 'Requirement fixture', contactPhone: '9899980802', purpose: 'RENT', localityNames: ['Sector 43'], maxBudget: 30000 };
    const first = (await api().post('/api/broker-requirements').set(header(a)).send(body).expect(201)).body;
    await api()
      .post('/api/broker-requirements')
      .set(header(a))
      .send({ ...body, localityNames: ['Sector 45'] })
      .expect(201);
    expect(await prisma.brokerRequirement.count({ where: { organizationId: orgA, contactPhone: body.contactPhone } })).toBe(2);
    const matches = (await api().get(`/api/broker-requirements/${first.id}/matches`).set(header(a)).expect(200)).body;
    expect(matches.available).toHaveLength(0);
    expect(matches.unknown).toHaveLength(1);
    const id = matches.unknown[0].item.id;
    await api().patch(`/api/inventory/${id}`).set(header(a)).send({ availability: 'AVAILABLE' }).expect(200);
    const updated = (await api().get(`/api/broker-requirements/${first.id}/matches`).set(header(a)).expect(200)).body;
    expect(updated.available).toHaveLength(1);
    expect(updated.unknown).toHaveLength(0);
    try {
      await api()
        .patch('/api/admin/modules/inventory')
        .set(header(admin))
        .send({ state: 'HIDDEN', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] })
        .expect(200);
      await api().get(`/api/broker-requirements/${first.id}/matches`).set(header(a)).expect(403);
    } finally {
      await api()
        .patch('/api/admin/modules/inventory')
        .set(header(admin))
        .send({ state: 'ACTIVE', roles: ['BROKER_ADMIN', 'SUPER_ADMIN'] })
        .expect(200);
    }
  });
  it('accepts more than twenty chat documents while preserving the original and firm isolation', async () => {
    const files = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`${i}.txt`, strToU8('Requirement 2 BHK Sector 43')]));
    const archive = Buffer.from(zipSync(files));
    const capture = await api()
      .post('/api/imports')
      .set(header(a))
      .send({ sourceType: 'CHAT_EXPORT', fileDataUrl: 'data:application/zip;base64,' + archive.toString('base64') })
      .expect(201);
    await app.get(ImportsService).extract(capture.body.id);
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: capture.body.id } });
    expect(batch.status).toBe('NEEDS_REVIEW');
    expect(await prisma.sourceEntry.count({ where: { batchId: batch.id } })).toBe(21);
    expect(batch.mediaRef).toBeTruthy();
    await api().get(`/api/imports/${batch.id}/source`).set(header(b)).expect(404);
  });
});
