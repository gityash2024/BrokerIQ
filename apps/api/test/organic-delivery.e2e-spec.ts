import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { OrganicDeliveryService } from '../src/modules/organic/organic-delivery.service';
import { normalizeOrganicRecord, nextOrganicTime } from '../src/modules/organic/organic-record';

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

    const recipients = [{ organizationId: first.id, brokerAdminId: broker.user.id }];
    const preview = (await api().post('/api/admin/organic/transfer/preview').set(auth(admin.token)).send({ ids: [record.id], targets: recipients }).expect(201)).body;
    expect(preview.firms[0]).toMatchObject({ selected: 1, duplicates: 0, newRecords: 1 });

    const service = app.get(OrganicDeliveryService);
    await service['deliverRun'](rule.id, cutoff.toISOString());
    await service['deliverRun'](rule.id, cutoff.toISOString());
    expect(await db.organicTransfer.count({ where: { recordId: record.id, organizationId: first.id } })).toBe(1);
    const lead = await db.lead.findUniqueOrThrow({ where: { organizationId_phone: { organizationId: first.id, phone: '+919811100831' } }, include: { requirement: true } });
    expect(lead).toMatchObject({ source: 'ORGANIC_DEMAND', assignedToId: broker.user.id, requirement: { bedrooms: [2], maxBudget: 43000 } });
    await api().get('/api/leads/' + lead.id).set(auth(other.token)).expect(404);
    expect(await db.notification.count({ where: { userId: broker.user.id, kind: 'ORGANIC_DELIVERY' } })).toBe(1);
  });
});
