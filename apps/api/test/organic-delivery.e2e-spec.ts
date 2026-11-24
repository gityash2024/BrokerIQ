import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { OrganicDeliveryService } from '../src/modules/organic/organic-delivery.service';
import { OrganicService } from '../src/modules/organic/organic.service';
import * as sourceAdapter from '../src/modules/organic/organic-source';
import { discoveryPhases, normalizeOrganicRecord, nextOrganicTime } from '../src/modules/organic/organic-record';

describe('Organic daily delivery', () => {
  let app: INestApplication;
  let db: PrismaService;
  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });

  it('normalizes Gurugram and computes the next local day without assuming undated sources are newly published', () => {
    const property = { kind: 'SUPPLY' as const, title: 'Gurgaon Sector 30 Apartment', url: 'https://example.org/property',
      ownership: 'OWNER_CONFIRMED' as const, availability: 'UNKNOWN' as const, amenities: [], sectors: ['Sec-30'], phone: '9811100001' };
    expect(normalizeOrganicRecord(property, [], false)?.data).toMatchObject({ sectors: ['Sector 30'], city: 'Gurugram' });
    expect(normalizeOrganicRecord(property, [], false)?.data.phone).toBeUndefined();
    expect(normalizeOrganicRecord({ ...property, city: 'Noida' }, [], true)).toBeNull();
    expect(nextOrganicTime('07:00', new Date('2026-11-24T01:31:00Z')).toISOString()).toBe('2026-11-25T01:30:00.000Z');
  });

  it('saves a restart-safe scheduled run and publishes only the previous IST day after classification', async () => {
    const key = randomUUID();
    const service = app.get(OrganicService);
    const config = { enabled: true, time: '00:00', enrichTime: '05:00', resultsTime: '06:00', notifyTime: '07:00' };
    expect(discoveryPhases(config.time, config.notifyTime)).toEqual({ enrichTime: '05:00', resultsTime: '06:00' });
    const source = await db.organicSource.create({ data: {
      name: 'Isolated schedule source', url: 'https://example.org/schedule/' + key, permissionUrl: 'https://example.org/terms',
      format: 'JSON', supports: ['SUPPLY'], enabled: true,
    } });
    const broken = await db.organicSource.create({ data: { name: 'Isolated failed source', url: source.url + '/failed',
      permissionUrl: source.permissionUrl, format: 'JSON', supports: ['SUPPLY'], enabled: true } });
    const publishedAt = '2026-11-23T22:00:00+05:30';
    const entry = { title: 'Gurgaon Sector 30 rent ' + key, externalId: key, kind: 'SUPPLY' as const, url: source.url + '/listing',
      purpose: 'RENT', ownership: 'OWNER_CONFIRMED', propertyType: 'Apartment', price: 50000, publishedAt };
    const fetch = jest.spyOn(sourceAdapter, 'readOrganicSource').mockImplementation(async (url) => {
      if (url === broken.url) throw new Error('Isolated fetch failure');
      return { text: JSON.stringify([entry, { ...entry, externalId: key + '-late', publishedAt: '2026-11-24T04:00:00+05:30' }]), etag: null };
    });
    const readSettings = jest.spyOn(service, 'settingsFor').mockResolvedValue(config);
    const date = new Date('2026-11-23T18:30:00.000Z');
    const day = '2026-11-24';
    const runKey = 'organic-discovery:SUPPLY:' + day;
    try {
      await Promise.all([service['scheduleRun']('SUPPLY', config, date), service['scheduleRun']('SUPPLY', config, date)]);
      const jobs = await db.job.findMany({ where: { OR: [{ key: { startsWith: runKey + ':' } }, { key: 'organic-ready:SUPPLY:' + day }] }, orderBy: { runAt: 'asc' } });
      expect(jobs.map(({ type, runAt }) => [type, runAt.toISOString()])).toEqual([
        ['organic.collect', '2026-11-23T18:30:00.000Z'], ['organic.enrich', '2026-11-23T23:30:00.000Z'],
        ['organic.publish', '2026-11-24T00:30:00.000Z'], ['organic.ready', '2026-11-24T01:30:00.000Z'],
      ]);
      await service['collectScheduled']('SUPPLY', runKey, day);
      await service['collectScheduled']('SUPPLY', runKey, day);
      expect(fetch).toHaveBeenCalledTimes(2);
      const run = await db.organicRun.findUniqueOrThrow({ where: { key: runKey } });
      expect(run).toMatchObject({ status: 'COLLECTED', report: { sources: 2, failed: 1 } });
      await expect(service['publishScheduled']('SUPPLY', runKey)).rejects.toThrow('classification is still running');
      await service['enrichScheduled']('SUPPLY', runKey);
      expect(await db.organicSourceReference.count({ where: { sourceId: source.id } })).toBe(0);
      await service['publishScheduled']('SUPPLY', runKey);
      await service['publishScheduled']('SUPPLY', runKey);
      expect(await db.organicSourceReference.count({ where: { sourceId: source.id } })).toBe(1);
      const batch = await db.organicSourceBatch.findFirstOrThrow({ where: { runId: run.id, sourceId: source.id } });
      expect(batch).toMatchObject({ status: 'PUBLISHED', processed: 1, inserted: 1, rows: null });
      expect(await db.organicRun.findUnique({ where: { id: run.id } })).toMatchObject({ status: 'PARTIAL', report: { records: 1, failed: 1 } });
    } finally {
      fetch.mockRestore();
      readSettings.mockRestore();
      await db.job.deleteMany({ where: { OR: [{ key: { startsWith: runKey + ':' } }, { key: 'organic-ready:SUPPLY:' + day }] } });
      await db.organicRun.deleteMany({ where: { key: runKey } });
      await db.organicSource.updateMany({ where: { id: { in: [source.id, broken.id] } }, data: { enabled: false } });
    }
  });

  it('transfers each qualifying lead only once, preserves firm scope, and rejects a foreign recipient', async () => {
    const key = randomUUID();
    const identity = async (name: string, role: 'SUPER_ADMIN' | 'BROKER_ADMIN', organizationId?: string) => {
      const user = await db.user.create({ data: { name, organizationId, email: name + key + '@e2e.test', role }, include: { organization: true } });
      return { user, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    const first = await db.organization.create({ data: { name: 'Organic first firm', slug: 'organic-first-' + key } });
    const outer = await db.organization.create({ data: { name: 'Organic second firm', slug: 'organic-second-' + key } });
    const admin = await identity('platform', 'SUPER_ADMIN');
    const broker = await identity('recipient', 'BROKER_ADMIN', first.id);
    const other = await identity('otherrecipient', 'BROKER_ADMIN', outer.id);
    const source = await db.organicSource.create({ data: { name: 'Isolated source fixture', url: 'https://example.org/feed/' + key,
      permissionUrl: 'https://example.org/permissions', format: 'JSON', supports: ['DEMAND'], enabled: true, contactRedistribution: true } });

    const valid = { organizationId: first.id, brokerAdminId: broker.user.id, time: '09:13', enabled: true, leadType: 'ALL', sectors: ['Sec-30'] };
    await api().post('/api/admin/organic/delivery').set(auth(broker.token)).send(valid).expect(403);
    await api().post('/api/admin/organic/delivery').set(auth(admin.token)).send({ ...valid, brokerAdminId: other.user.id }).expect(400);
    const rule = (await api().post('/api/admin/organic/delivery').set(auth(admin.token)).send(valid).expect(201)).body;
    const now = Date.now();
    const from = new Date(now - 30_000);
    const cutoff = new Date(now - 1_000);
    await db.organicDeliverySchedule.update({ where: { id: rule.id }, data: { cursorFrom: from, nextRunAt: cutoff } });
    const record = await db.organicRecord.create({ data: {
      kind: 'DEMAND', key, title: 'Lease search', status: 'APPROVED', sectors: ['Sector 30'], locality: 'Sector 30', intent: 'TENANT',
      availability: 'UNKNOWN', priority: 'HIGH', confidence: 92, eligibleAt: new Date(now - 3_000),
      values: { kind: 'DEMAND', title: 'Lease search', url: source.url, purpose: 'RENT', city: 'Gurugram',
        sectors: ['Sector 30'], phone: '9811100831', bhk: 2, maxBudget: 43000 },
      sourceRefs: { create: { sourceId: source.id, kind: 'DEMAND', externalId: key, url: source.url } },
    } });

    const dailyPreview = await api().post('/api/admin/organic/delivery/preview').set(auth(admin.token)).send(valid).expect(201);
    expect(dailyPreview.body).toMatchObject({ qualifying: 1, alreadyTransferred: 0 });
    const recipients = [{ organizationId: first.id, brokerAdminId: broker.user.id }];
    const preview = (await api().post('/api/admin/organic/transfer/preview').set(auth(admin.token)).send({ ids: [record.id], targets: recipients }).expect(201)).body;
    expect(preview.firms[0]).toMatchObject({ selected: 1, duplicates: 0, newRecords: 1 });

    const service = app.get(OrganicDeliveryService);
    await Promise.all([
      service['deliverRun'](rule.id, cutoff.toISOString()),
      service['deliverRun'](rule.id, cutoff.toISOString()),
    ]);
    expect(await db.organicTransfer.count({ where: { recordId: record.id, organizationId: first.id } })).toBe(1);
    const lead = await db.lead.findUniqueOrThrow({ where: { organizationId_phone: { organizationId: first.id, phone: '+919811100831' } }, include: { requirement: true } });
    expect(lead).toMatchObject({ source: 'ORGANIC_DEMAND', assignedToId: broker.user.id, requirement: { bedrooms: [2], maxBudget: 43000 } });
    await api().get('/api/leads/' + lead.id).set(auth(other.token)).expect(404);
    expect(await db.notification.count({ where: { userId: broker.user.id, kind: 'ORGANIC_DELIVERY' } })).toBe(1);
  });
});
