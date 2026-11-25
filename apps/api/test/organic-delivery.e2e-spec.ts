import { randomUUID } from 'node:crypto';
import { organicQuery } from '@brokeriq/shared';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { OrganicDeliveryService } from '../src/modules/organic/organic-delivery.service';
import { OrganicWebSearchService } from '../src/modules/organic/organic-web-search.service';
import { OrganicService } from '../src/modules/organic/organic.service';
import * as sourceAdapter from '../src/modules/organic/organic-source';
import { discoveryPhases, normalizeOrganicRecord, nextOrganicTime, pastOrganicTime } from '../src/modules/organic/organic-record';

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

  it('extracts explicit mixed-language property facts and requires review for model-only evidence', () => {
    const base = { city: 'Gurugram', url: 'https://example.org/source', availability: 'UNKNOWN' as const, amenities: [], sectors: [] };
    const normalize = (input: Parameters<typeof normalizeOrganicRecord>[0]) => normalizeOrganicRecord(input, [], true);
    expect(normalize({ ...base, kind: 'DEMAND', title: 'Sec-30 me kiraye pe flat chahiye. Budget 42k.' })?.data)
      .toMatchObject({ intent: 'TENANT', purpose: 'RENT', maxBudget: 42000, sectors: ['Sector 30'] });
    expect(normalize({ ...base, kind: 'DEMAND', title: 'Sector 57 mein flat khareedna hai. Budget 85 lakh.' })?.data)
      .toMatchObject({ intent: 'BUYER', purpose: 'SALE', maxBudget: 8500000, sectors: ['Sector 57'] });
    expect(normalize({ ...base, kind: 'SUPPLY', title: 'Selling my Sector 56 apartment for ₹1.27 crore' })?.data)
      .toMatchObject({ purpose: 'SALE', price: 12700000 });
    expect(normalize({ ...base, kind: 'DEMAND', title: 'Sector 30 tenant inquiry', intent: 'TENANT', modelEvidence: 'tenant inquiry' })?.priority).toBe('REVIEW');
  });

  it('separates confirmed owners, uncertain owners and genuine demand while honoring explicit filters', () => {
    const service = app.get(OrganicService);
    const view = (query: Record<string, string>) => service.where(organicQuery.parse(query));
    expect(view({ kind: 'SUPPLY', view: 'DIRECT_OWNERS' })).toMatchObject({ ownership: 'OWNER_CONFIRMED' });
    expect(view({ kind: 'SUPPLY', view: 'OWNER_REVIEW' })).toMatchObject({ ownership: { in: ['OWNER_LIKELY', 'UNKNOWN'] } });
    expect(view({ kind: 'DEMAND', view: 'GENUINE_DEMAND' })).toMatchObject({ intent: { in: expect.arrayContaining(['BUYER', 'TENANT']) } });
    expect(view({ kind: 'SUPPLY', view: 'DIRECT_OWNERS', ownership: 'DEVELOPER' })).toMatchObject({ ownership: 'DEVELOPER' });
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
      const admin = await db.user.create({ data: {
        email: key + '@workflow.e2e.test', name: 'Workflow admin', role: 'SUPER_ADMIN',
      }, include: { organization: true } });
      const headers = auth((await app.get(AuthService).issue(admin)).accessToken);
      const workflow = '/api/admin/organic/executions';
      await api().get(workflow).expect(401);
      await api().post(workflow + '/steps/' + jobs[0].id + '/retry').set(headers).expect(409);
      await db.job.update({ where: { id: jobs[0].id }, data: { status: 'FAILED', attempts: 5, lastError: 'External private payload' } });
      const queued = (await api().get(workflow).set(headers).expect(200)).body.executions.find(({ key }: { key: string }) => key === runKey);
      expect(queued).toMatchObject({ kind: 'SUPPLY', status: 'FAILED', runId: null,
        steps: expect.arrayContaining([expect.objectContaining({ type: 'organic.collect', status: 'FAILED', canRetry: true })]) });
      expect(queued.steps).toHaveLength(4);
      expect(queued.steps[0]).not.toHaveProperty('lastError');
      await api().post(workflow + '/steps/' + jobs[0].id + '/retry').set(headers).expect(201);
      expect(await db.job.findUnique({ where: { id: jobs[0].id } })).toMatchObject({ status: 'PENDING', attempts: 0 });
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
      const completed = (await api().get(workflow).set(headers).expect(200)).body.executions.find(({ key }: { key: string }) => key === runKey);
      expect(completed.sourceBatches).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: source.id, inserted: 1, status: 'PUBLISHED' }),
        expect.objectContaining({ sourceId: broken.id, status: 'FAILED' }),
      ]));
    } finally {
      fetch.mockRestore();
      readSettings.mockRestore();
      await db.job.deleteMany({ where: { OR: [{ key: { startsWith: runKey + ':' } }, { key: 'organic-ready:SUPPLY:' + day }] } });
      await db.organicRun.deleteMany({ where: { key: runKey } });
      await db.organicSource.updateMany({ where: { id: { in: [source.id, broken.id] } }, data: { enabled: false } });
    }
  });

  it('queues restartable manual source phases while the schedule is paused', async () => {
    const key = randomUUID();
    const service = app.get(OrganicService);
    const source = await db.organicSource.create({ data: {
      name: 'Manual run source', url: 'https://example.org/manual/' + key, permissionUrl: 'https://example.org/terms',
      format: 'JSON', supports: ['SUPPLY'], enabled: true,
    } });
    const settings = jest.spyOn(service, 'settingsFor').mockResolvedValue({
      enabled: false, time: '00:00', enrichTime: '05:00', resultsTime: '06:00', notifyTime: '07:00',
    });
    const read = jest.spyOn(sourceAdapter, 'readOrganicSource').mockResolvedValue({ text: '[]', etag: null });
    let runKey: string | undefined;
    try {
      const collect = await service.runNow('SUPPLY', source.id);
      const payload = collect.payload as { key: string; day: string };
      runKey = payload.key;
      expect((await service.runNow('SUPPLY', source.id)).id).toBe(collect.id);
      expect(await db.job.count({ where: { key: { startsWith: runKey + ':' } } })).toBe(3);
      await service['collectScheduled']('SUPPLY', runKey, payload.day, source.id);
      await service['enrichScheduled']('SUPPLY', runKey);
      await service['publishScheduled']('SUPPLY', runKey);
      expect(read).toHaveBeenCalledTimes(1);
      expect(await db.organicRun.findUnique({ where: { key: runKey } })).toMatchObject({
        status: 'COMPLETE', report: { sources: 1, records: 0 },
      });
    } finally {
      settings.mockRestore();
      read.mockRestore();
      if (runKey) {
        await db.job.deleteMany({ where: { key: { startsWith: runKey + ':' } } });
        await db.organicRun.deleteMany({ where: { key: runKey } });
      }
      await db.organicSource.update({ where: { id: source.id }, data: { enabled: false } });
    }
  });

  it('searches through today on manual runs and refines sparse categories only once', async () => {
    const run = await db.organicRun.create({ data: { key: randomUUID(), kind: 'SUPPLY' } });
    const provider = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ results: [] })));
    try {
      const search = app.get(OrganicWebSearchService);
      await search.run(run.id, 'SUPPLY', '2026-11-25', true);
      expect(provider).toHaveBeenCalledTimes(8);
      for (const [, request] of provider.mock.calls) {
        expect(JSON.parse(String(request?.body))).toMatchObject({ start_date: '2026-11-24', end_date: '2026-11-26', search_depth: 'basic' });
      }
      expect(await db.organicWebSearchQuery.count({ where: { runId: run.id, label: { endsWith: 'targeted follow-up' } } })).toBe(4);
      await search.run(run.id, 'SUPPLY', '2026-11-25', true);
      expect(provider).toHaveBeenCalledTimes(8);
    } finally {
      provider.mockRestore();
      await db.organicRun.delete({ where: { id: run.id } });
    }
  });

  it('pins the saved workflow version into a new daily run and rejects stale editor saves', async () => {
    const service = app.get(OrganicService);
    const admin = await db.user.create({ data: { email: randomUUID() + '@flow.e2e.test', name: 'Workflow admin', role: 'SUPER_ADMIN' },
      include: { organization: true } });
    const headers = auth((await app.get(AuthService).issue(admin)).accessToken);
    const path = '/api/admin/organic/workflows/DEMAND';
    const initial = await service.workflowFor('DEMAND');
    const when = new Date('2026-11-19T18:30:00.000Z');
    const key = 'organic-discovery:DEMAND:2026-11-20';
    try {
      const draft = { revision: initial.revision, sourceIds: [], useAi: false, searchWeb: true };
      const saved = (await api().patch(path).set(headers).send(draft).expect(200)).body;
      expect(saved).toEqual({ ...draft, revision: initial.revision + 1 });
      await api().patch(path).set(headers).send(draft).expect(409);
      await api().patch(path).set(headers).send({ ...saved, sourceIds: ['invalid-source'] }).expect(400);
      const schedule = { enabled: true, time: '00:00', enrichTime: '05:00', resultsTime: '06:00', notifyTime: '07:00' };
      await service['scheduleRun']('DEMAND', schedule, when);
      await api().patch(path).set(headers).send({ ...saved, sourceIds: null, useAi: true }).expect(200);
      await service['scheduleRun']('DEMAND', schedule, when);
      const steps = await db.job.findMany({ where: { key: { startsWith: key + ':' } } });
      expect(steps).toHaveLength(3);
      for (const step of steps) expect(step.payload).toMatchObject({ workflow: saved });
    } finally {
      await db.job.deleteMany({ where: { OR: [{ key: { startsWith: key + ':' } }, { key: 'organic-ready:DEMAND:2026-11-20' }] } });
      await db.systemSetting.deleteMany({ where: { key: 'organic.workflow.demand' } });
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
    await db.organicDeliverySchedule.update({ where: { id: rule.id }, data: { enabled: false } });
    const queued = await db.organicRun.create({ data: { kind: 'DELIVERY', key: randomUUID(), scheduleId: rule.id, status: 'RUNNING' } });
    await expect(service['transfer'](record.id, recipients[0], queued.id, undefined, { id: rule.id, cutoff })).resolves.toBe('skipped');
    expect(await db.organicTransfer.count({ where: { recordId: record.id } })).toBe(0);
    await db.organicDeliverySchedule.update({ where: { id: rule.id }, data: { enabled: true } });
    await Promise.all([
      service['deliverRun'](rule.id, cutoff.toISOString()),
      service['deliverRun'](rule.id, cutoff.toISOString()),
    ]);
    expect(await db.organicTransfer.count({ where: { recordId: record.id, organizationId: first.id } })).toBe(1);
    const settled = await db.organicRun.findUnique({ where: { key: `delivery:${rule.id}:${cutoff.toISOString()}` } });
    expect(settled).toMatchObject({ status: 'COMPLETE', report: { delivered: 1, failed: 0 } });
    const lead = await db.lead.findUniqueOrThrow({ where: { organizationId_phone: { organizationId: first.id, phone: '+919811100831' } }, include: { requirement: true } });
    expect(lead).toMatchObject({ source: 'ORGANIC_DEMAND', assignedToId: broker.user.id, requirement: { bedrooms: [2], maxBudget: 43000 } });
    await api().get('/api/leads/' + lead.id).set(auth(other.token)).expect(404);
    expect(await db.notification.count({ where: { userId: broker.user.id, kind: 'ORGANIC_DELIVERY' } })).toBe(1);

    await db.organicRecord.update({ where: { id: record.id }, data: {
      values: { ...(record.values as Record<string, unknown>), contactSourceId: source.id },
    } });
    await db.organicSource.update({ where: { id: source.id }, data: { contactRedistribution: false } });
    const alternate = await db.organicSource.create({ data: { name: 'Another authorized publisher', url: source.url + '/other',
      permissionUrl: source.permissionUrl, format: 'JSON', supports: ['DEMAND'], enabled: true, contactRedistribution: true } });
    await db.organicSourceReference.create({ data: { sourceId: alternate.id, recordId: record.id, kind: 'DEMAND',
      externalId: key, url: alternate.url } });
    const manual = await db.organicRun.create({ data: { kind: 'MANUAL', key: randomUUID() } });
    await expect(service['transfer'](record.id, { organizationId: outer.id, brokerAdminId: other.user.id }, manual.id, admin.user.id)).resolves.toBe('delivered');
    expect(await db.lead.count({ where: { organizationId: outer.id, phone: '+919811100831' } })).toBe(0);
    expect(await db.organicTransfer.findFirst({ where: { recordId: record.id, organizationId: outer.id } })).toMatchObject({ targetType: 'REQUIREMENT' });

    const failedCutoff = new Date(cutoff.valueOf() + 5000);
    const failedRule = await db.organicDeliverySchedule.update({ where: { id: rule.id }, data: { nextRunAt: failedCutoff } });
    const failedRun = await db.organicRun.create({ data: { kind: 'DELIVERY', key: randomUUID(), scheduleId: rule.id,
      windowFrom: cutoff, windowTo: failedCutoff, status: 'PARTIAL', report: { failed: 1 } } });
    await db.job.create({ data: { type: 'organic.delivery', status: 'FAILED', attempts: 8, maxAttempts: 8,
      key: `organic-delivery:${rule.id}:${failedCutoff.toISOString()}` } });
    const pending = await Promise.all([3000, 30_000].map((offset) => db.organicRecord.create({ data: {
      kind: 'DEMAND', key: key + offset, title: 'Sector 30 lease ' + offset, status: 'APPROVED', sectors: ['Sector 30'], intent: 'TENANT',
      availability: 'UNKNOWN', priority: 'HIGH', confidence: 90, eligibleAt: new Date(cutoff.valueOf() + offset),
      values: { kind: 'DEMAND', title: 'Sector 30 lease ' + offset, url: source.url + '/' + offset, purpose: 'RENT', sectors: ['Sector 30'] },
      sourceRefs: { create: { sourceId: source.id, kind: 'DEMAND', externalId: key + offset, url: source.url + '/' + offset } },
    } })));
    const later = new Date(cutoff.valueOf() + 2 * 86_400_000);
    const laterCutoff = pastOrganicTime(failedRule.time, later);
    await service['queueDue'](failedRule, later);
    expect(await db.organicDeliverySchedule.findUnique({ where: { id: rule.id } })).toMatchObject({ cursorFrom: cutoff, nextRunAt: laterCutoff });
    await api().post(`/api/admin/organic/delivery/runs/${failedRun.id}/retry`).set(auth(admin.token)).expect(404);
    await service['deliverRun'](rule.id, laterCutoff.toISOString());
    expect(await db.organicTransfer.count({ where: { organizationId: first.id, recordId: { in: pending.map(({ id }) => id) } } })).toBe(2);
  });
});
