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
  it('captures first, requires review, preserves multiple units and idempotency', async () => {
    const source = { sourceType: 'TEXT', rawText: 'House 99, Sector 45, 2 BHK for rent, Rent 20k. Contact 9899980802' };
    const first = await api().post('/api/imports').set(header(a)).send(source).expect(201);
    await app.get(ImportsService).extract(first.body.id);
    const batch = (await api().get(`/api/imports/${first.body.id}`).set(header(a)).expect(200)).body;
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
    await api().get(`/api/imports/${first.body.id}`).set(header(b)).expect(404);
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
        },
        amenities: ['LIFT', 'POWER_BACKUP'],
      })
      .expect(201);
    const filter = { investmentType: ['PRE_LEASED'], postedBy: ['OWNER'], bathrooms: { min: 2, max: 3 } };
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
  it('rejects oversized archive structure before extracting all documents and preserves its original', async () => {
    const files = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`${i}.txt`, strToU8('Requirement 2 BHK Sector 43')]));
    const archive = Buffer.from(zipSync(files));
    const capture = await api()
      .post('/api/imports')
      .set(header(a))
      .send({ sourceType: 'CHAT_EXPORT', fileDataUrl: 'data:application/zip;base64,' + archive.toString('base64') })
      .expect(201);
    await expect(app.get(ImportsService).extract(capture.body.id)).rejects.toThrow('Export exceeds safe text limit');
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: capture.body.id } });
    expect(batch.status).toBe('FAILED');
    expect(batch.mediaRef).toBeTruthy();
    await api().get(`/api/imports/${batch.id}/source`).set(header(b)).expect(404);
  });
});
