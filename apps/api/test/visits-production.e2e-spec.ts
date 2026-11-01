import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Production visit association, permissions and retry safety (PostgreSQL)', () => {
  let app: INestApplication, db: PrismaService;
  let org: string, otherOrg: string, lead: string, foreignLead: string, own: string, otherUnit: string, foreign: string, visitId: string;
  let agent: { id: string; token: string }, admin: { id: string; token: string }, peer: { id: string; token: string }, outsider: { id: string; token: string };
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const at = '2026-12-05T10:30:00+05:30';
  const h = (actor = agent) => ({ Authorization: 'Bearer ' + actor.token });
  const req = () => request(app.getHttpServer());
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Visit isolation fixture', slug: 'visit-' + uid, restrictions: [] } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Other visit fixture', slug: 'visit-other-' + uid, restrictions: [] } })).id;
    const actor = async (name: string, role: 'BROKER_ADMIN' | 'BROKER_AGENT', organizationId: string) => {
      const user = await db.user.create({ data: { name, role, organizationId, email: name + uid + '@e2e.test' }, include: { organization: true } });
      return { id: user.id, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    agent = await actor('agent', 'BROKER_AGENT', org);
    peer = await actor('peer', 'BROKER_AGENT', org);
    admin = await actor('admin', 'BROKER_ADMIN', org);
    outsider = await actor('outsider', 'BROKER_ADMIN', otherOrg);
    lead = (
      await db.lead.create({ data: { organizationId: org, assignedToId: agent.id, name: 'Visit lead', phone: '+919700000101', scoreReasons: [], tags: [] } })
    ).id;
    foreignLead = (
      await db.lead.create({
        data: { organizationId: otherOrg, assignedToId: outsider.id, name: 'Foreign visit lead', phone: '+919700000102', scoreReasons: [], tags: [] },
      })
    ).id;
    const item = async (floor: string, owner = agent, organizationId = org) =>
      (
        await db.inventoryItem.create({
          data: {
            organizationId,
            createdById: owner.id,
            assignedToId: owner.id,
            houseNo: '1994',
            sector: 'Sector 38',
            floor,
            bhk: 2,
            purpose: 'RENT',
            monthlyRent: 21000,
            availability: 'AVAILABLE',
            address: '1994 Sector 38',
          },
        })
      ).id;
    own = await item('Ground floor');
    otherUnit = await item('2nd floor');
    foreign = await item('1st floor', peer);
    await db.inventoryItem.createMany({
      data: Array.from({ length: 61 }, (_, i) => ({
        organizationId: org,
        createdById: agent.id,
        assignedToId: agent.id,
        houseNo: 'pagination-' + uid + '-' + i,
        sector: 'Sector 38',
        floor: '1st floor',
      })),
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('searches and pages all inventory without merging units in the same house', async () => {
    const units = await req().get('/api/inventory?search=1994&pageSize=25').set(h()).expect(200);
    expect(units.body.items.map((x: any) => x.id).sort()).toEqual([own, otherUnit].sort());
    const ids: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await req().get(`/api/inventory?search=pagination-${uid}&pageSize=25&page=${page}`).set(h()).expect(200);
      ids.push(...result.body.items.map((x: any) => x.id));
      expect(result.body.total).toBe(61);
    }
    expect(new Set(ids).size).toBe(61);
  });
  it('rejects invalid dates, foreign/other-agent properties and unauthorized assignments', async () => {
    for (const scheduledAt of ['not-a-date', '2026-02-31T10:00:00Z', '2026-11-01T10:30:00'])
      await req().post('/api/visits').set(h()).send({ leadId: lead, scheduledAt }).expect(400);
    await req().post('/api/visits').set(h()).send({ leadId: lead, scheduledAt: at, inventoryId: foreign }).expect(404);
    await req().post('/api/visits').set(h(outsider)).send({ leadId: foreignLead, scheduledAt: at, inventoryId: own }).expect(404);
    await req().post('/api/visits').set(h()).send({ leadId: lead, scheduledAt: at, assignedToId: peer.id }).expect(403);
    await req().post('/api/visits').set(h()).send({ leadId: foreignLead, scheduledAt: at }).expect(404);
  });
  it('atomically stores one typed association, snapshot and activity on concurrent retries', async () => {
    const payload = { leadId: lead, inventoryId: otherUnit, scheduledAt: at, clientMutationId: 'visit-' + uid };
    const results = await Promise.all([1, 2, 3].map(() => req().post('/api/visits').set(h()).send(payload).expect(201)));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    visitId = results[0].body.id;
    expect(results[0].body.inventoryId).toBe(otherUnit);
    expect(results[0].body.propertySnapshot).toMatchObject({ floor: '2nd floor', bhk: 2, price: 21000, availability: 'AVAILABLE' });
    expect(new Date(results[0].body.scheduledAt).toISOString()).toBe('2026-12-05T05:00:00.000Z');
    expect(await db.activity.count({ where: { leadId: lead, type: 'SITE_VISIT' } })).toBe(1);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead } })).stage).toBe('SITE_VISIT');
    await req()
      .post('/api/visits')
      .set(h())
      .send({ ...payload, inventoryId: own })
      .expect(409);
    await db.inventoryItem.update({ where: { id: otherUnit }, data: { monthlyRent: 25000, floor: 'Edited floor' } });
    const history = (await req().get('/api/visits?paginated=true&pageSize=1').set(h()).expect(200)).body;
    expect(history.total).toBe(1);
    expect(history.items[0].propertySnapshot.floor).toBe('2nd floor');
  });
  it('reschedules safely, resets reminders and rejects stale concurrent edits', async () => {
    const before = await db.siteVisit.update({
      where: { id: visitId },
      data: { reminderSentAt: new Date(), tenantDayReminderAt: new Date(), tenantHourReminderAt: new Date() },
    });
    const changed = await req()
      .patch('/api/visits/' + visitId)
      .set(h())
      .send({ scheduledAt: '2026-12-06T10:00:00Z', expectedUpdatedAt: before.updatedAt.toISOString() })
      .expect(200);
    expect(changed.body.reminderSentAt).toBeNull();
    expect(changed.body.tenantDayReminderAt).toBeNull();
    expect(changed.body.tenantHourReminderAt).toBeNull();
    await req()
      .patch('/api/visits/' + visitId)
      .set(h())
      .send({ status: 'CANCELLED', expectedUpdatedAt: before.updatedAt.toISOString() })
      .expect(409);
    await Promise.all(
      [1, 2].map(() =>
        req()
          .patch('/api/visits/' + visitId)
          .set(h())
          .send({ status: 'COMPLETED' })
          .expect(200),
      ),
    );
    expect(await db.activity.count({ where: { leadId: lead, type: 'SITE_VISIT', content: 'Site visit completed' } })).toBe(1);
    await req()
      .patch('/api/visits/' + visitId)
      .set(h())
      .send({ scheduledAt: at })
      .expect(409);
  });
  it('allows custom addresses and keeps reassigned leads private', async () => {
    const custom = await req().post('/api/visits').set(h(admin)).send({ leadId: lead, address: 'Meet at main gate', scheduledAt: at }).expect(201);
    expect(custom.body.inventoryId).toBeNull();
    expect(custom.body.address).toBe('Meet at main gate');
    await req()
      .patch('/api/visits/' + visitId)
      .set(h(peer))
      .send({ feedback: 'unauthorized' })
      .expect(404);
    await req()
      .patch('/api/visits/' + visitId)
      .set(h(outsider))
      .send({ feedback: 'unauthorized' })
      .expect(404);
    await db.lead.update({ where: { id: lead }, data: { assignedToId: peer.id } });
    expect((await req().get('/api/visits?paginated=true').set(h()).expect(200)).body.total).toBe(0);
    await req()
      .patch('/api/visits/' + custom.body.id)
      .set(h())
      .send({ status: 'CANCELLED' })
      .expect(404);
    expect((await req().get('/api/visits?paginated=true').set(h(admin)).expect(200)).body.total).toBe(2);
  });
});
