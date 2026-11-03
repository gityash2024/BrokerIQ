import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from '../src/core/media/local-storage.service';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { ImportsService } from '../src/modules/imports/imports.service';
import { OcrService } from '../src/modules/imports/ocr.service';
import { Test } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { LeadsService } from '../src/modules/leads/leads.service';
import { NotificationsService } from '../src/core/notifications/notifications.service';
import { AutomationService } from '../src/modules/automation/automation.service';
import { JobsService } from '../src/core/jobs/jobs.service';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { followUpIstDayEnd, defaultModulePolicies } from '@brokeriq/shared';

/** Real NestJS guards + isolated PostgreSQL; no contract simulator. */
describe('Production agent/firm record boundaries', () => {
  let app: INestApplication;
  let db: PrismaService;
  let org: string;
  let otherOrg: string;
  let a: { id: string; token: string };
  let b: { id: string; token: string };
  let admin: { id: string; token: string };
  let outsider: { id: string; token: string };
  let leadA: string;
  let leadB: string;
  let conversationA: string;
  let conversationB: string;
  let unassignedConversation: string;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const headers = (actor: { token: string }) => ({ Authorization: 'Bearer ' + actor.token });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    org = (await db.organization.create({ data: { name: 'Isolated permissions fixture', slug: 'permissions-' + uid, restrictions: [] } })).id;
    otherOrg = (await db.organization.create({ data: { name: 'Isolated other firm', slug: 'permissions-other-' + uid, restrictions: [] } })).id;
    const actor = async (role: Role, firm: string, suffix: string) => {
      const user = await db.user.create({ data: { name: suffix, email: suffix + '.' + uid + '@e2e.test', role, organizationId: firm } });
      const login = await app.get(AuthService).issue({ ...user, organization: await db.organization.findUnique({ where: { id: firm } }) });
      return { id: user.id, token: login.accessToken };
    };
    a = await actor('BROKER_AGENT', org, 'agent-a');
    b = await actor('BROKER_AGENT', org, 'agent-b');
    admin = await actor('BROKER_ADMIN', org, 'admin');
    outsider = await actor('BROKER_ADMIN', otherOrg, 'outsider');
    leadA = (
      await db.lead.create({ data: { organizationId: org, name: 'Assigned A', phone: '+919700000001', assignedToId: a.id, scoreReasons: [], tags: [] } })
    ).id;
    leadB = (
      await db.lead.create({ data: { organizationId: org, name: 'Assigned B', phone: '+919700000002', assignedToId: b.id, scoreReasons: [], tags: [] } })
    ).id;
    const chat = async (key: string, leadId?: string) =>
      (await db.conversation.create({ data: { organizationId: org, channel: 'CHAT', contactKey: key, contactName: 'Search match', leadId, unreadCount: 1 } }))
        .id;
    conversationA = await chat('a-' + uid, leadA);
    conversationB = await chat('b-' + uid, leadB);
    unassignedConversation = await chat('none-' + uid);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('does not expose or mutate a legacy follow-up after its lead belongs to another agent', async () => {
    const task = await db.followUp.create({ data: { organizationId: org, leadId: leadB, assignedToId: a.id, dueAt: new Date() } });
    const own = await request(app.getHttpServer()).get('/api/follow-ups').set(headers(a)).expect(200);
    expect(own.body.map((row: any) => row.id)).not.toContain(task.id);
    const managed = await request(app.getHttpServer()).get('/api/follow-ups').set(headers(admin)).expect(200);
    expect(managed.body.map((row: any) => row.id)).toContain(task.id);
    await request(app.getHttpServer())
      .patch('/api/follow-ups/' + task.id)
      .set(headers(a))
      .send({ status: 'DONE' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/follow-ups/' + task.id)
      .set(headers(a))
      .expect(404);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('PENDING');
  });

  it('applies current lead ownership to dashboard previews/KPIs and separates unread chats from messages', async () => {
    const owned = await db.followUp.create({ data: { organizationId: org, leadId: leadA, assignedToId: a.id, dueAt: new Date(Date.now() - 60000) } });
    const deleted = await db.lead.create({
      data: { organizationId: org, name: 'Deleted dashboard lead', phone: '+919700008101', assignedToId: a.id, deletedAt: new Date() },
    });
    const hidden = await db.followUp.create({ data: { organizationId: org, leadId: deleted.id, assignedToId: a.id, dueAt: new Date(Date.now() - 60000) } });
    const staleVisit = await db.siteVisit.create({ data: { organizationId: org, leadId: leadB, assignedToId: a.id, scheduledAt: new Date() } });
    const ownVisit = await db.siteVisit.create({ data: { organizationId: org, leadId: leadA, assignedToId: a.id, scheduledAt: new Date() } });
    const sms = await db.conversation.create({ data: { organizationId: org, channel: 'SMS', contactKey: 'sms-' + uid, leadId: leadA, unreadCount: 4 } });
    await db.conversation.create({ data: { organizationId: org, channel: 'EMAIL', contactKey: 'email-' + uid, leadId: leadA, unreadCount: 3 } });
    await db.conversation.create({ data: { organizationId: org, channel: 'WHATSAPP', contactKey: 'non-housing-' + uid, leadId: leadA, unreadCount: 8 } });
    const today = (await request(app.getHttpServer()).get('/api/broker/today').set(headers(a)).expect(200)).body;
    expect(today.followUps.some((x: any) => x.id === owned.id)).toBe(true);
    expect(today.followUps.every((x: any) => x.lead.id === leadA && x.id !== hidden.id)).toBe(true);
    expect(today.visits.some((x: any) => x.id === ownVisit.id)).toBe(true);
    expect(today.visits.some((x: any) => x.id === staleVisit.id)).toBe(false);
    const stats = (await request(app.getHttpServer()).get('/api/whatsapp/unread-stats').set(headers(a)).expect(200)).body;
    expect(stats.sms).toEqual({ unreadConversations: 1, unreadMessages: 4 });
    expect(stats.email).toEqual({ unreadConversations: 1, unreadMessages: 3 });
    expect(stats.whatsapp.unreadConversations).toBe(0);
    expect(today.unreadConversations).toBe(stats.total.unreadConversations);
    expect(today.unreadMessages).toBe(stats.total.unreadMessages);
    expect(today.unreadMessages).toBeGreaterThan(today.unreadConversations);
    const legacy = (await request(app.getHttpServer()).get('/api/broker/dashboard').set(headers(a)).expect(200)).body;
    expect(legacy.kpis.unreadMessages).toBe(today.unreadMessages);
    expect(legacy.kpis.unreadConversations).toBe(today.unreadConversations);
    expect(legacy.todayFollowUps.every((x: any) => x.lead.id === leadA)).toBe(true);
    expect(legacy.todayVisits.some((x: any) => x.id === staleVisit.id)).toBe(false);
    const metrics = (await request(app.getHttpServer()).get('/api/broker/dashboard/metrics').set(headers(a)).expect(200)).body;
    expect(metrics.metrics.find((x: any) => x.key === 'overdue').value).toBe(1);
    await request(app.getHttpServer()).post(`/api/whatsapp/conversations/${sms.id}/read`).set(headers(a)).expect(200);
    const read = (await request(app.getHttpServer()).get('/api/broker/today').set(headers(a)).expect(200)).body;
    expect(read.unreadMessages).toBe(today.unreadMessages - 4);
  });

  it('completes one task atomically on retries and rejects invalid reschedule dates', async () => {
    const task = await db.followUp.create({ data: { organizationId: org, leadId: leadA, assignedToId: a.id, dueAt: new Date() } });
    const before = await db.activity.count({ where: { leadId: leadA, type: 'FOLLOW_UP' } });
    await Promise.all(
      [1, 2, 3].map(() =>
        request(app.getHttpServer())
          .patch('/api/follow-ups/' + task.id)
          .set(headers(a))
          .send({ status: 'DONE', outcomeNote: 'client reached' })
          .expect(200),
      ),
    );
    expect(await db.activity.count({ where: { leadId: leadA, type: 'FOLLOW_UP' } })).toBe(before + 1);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).completedAt).not.toBeNull();
    await request(app.getHttpServer())
      .patch('/api/follow-ups/' + task.id)
      .set(headers(a))
      .send({ dueAt: '2026-02-31T10:00:00Z' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/follow-ups/' + task.id)
      .set(headers(a))
      .send({ status: 'PENDING', dueAt: '2026-12-10T10:00:00+05:30' })
      .expect(200);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).completedAt).toBeNull();
  });

  it('moves pending visits and follow-ups with the lead once, preserving completed attribution', async () => {
    const lead = await db.lead.create({ data: { organizationId: org, name: 'Transfer tasks', phone: '+919700008301', assignedToId: a.id } });
    const at = new Date(Date.now() + 600_000);
    const task = await db.followUp.create({ data: { organizationId: org, leadId: lead.id, assignedToId: a.id, dueAt: at, reminderSentAt: new Date() } });
    const visit = await db.siteVisit.create({
      data: { organizationId: org, leadId: lead.id, assignedToId: a.id, scheduledAt: at, reminderSentAt: new Date() },
    });
    const historical = await db.siteVisit.create({ data: { organizationId: org, leadId: lead.id, assignedToId: a.id, scheduledAt: at, status: 'COMPLETED' } });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app.getHttpServer())
          .patch('/api/leads/' + lead.id + '/assign')
          .set(headers(admin))
          .send({ assignedToId: b.id })
          .expect(200),
      ),
    );
    expect(await db.activity.count({ where: { leadId: lead.id, type: 'ASSIGNMENT' } })).toBe(1);
    expect(await db.notification.count({ where: { userId: b.id, kind: 'LEAD_ASSIGNED', data: { path: ['leadId'], equals: lead.id } } })).toBe(1);
    expect(await db.followUp.findUnique({ where: { id: task.id } })).toMatchObject({ assignedToId: b.id, reminderSentAt: null });
    expect(await db.siteVisit.findUnique({ where: { id: visit.id } })).toMatchObject({ assignedToId: b.id, reminderSentAt: null });
    expect((await db.siteVisit.findUniqueOrThrow({ where: { id: historical.id } })).assignedToId).toBe(a.id);
    expect((await request(app.getHttpServer()).get('/api/visits').set(headers(b)).expect(200)).body.some((x: any) => x.id === visit.id)).toBe(true);
    expect((await request(app.getHttpServer()).get('/api/visits').set(headers(a)).expect(200)).body.some((x: any) => x.id === visit.id)).toBe(false);
    const claim = new Date();
    await db.followUp.update({ where: { id: task.id }, data: { reminderSentAt: claim } });
    await request(app.getHttpServer())
      .patch('/api/leads/' + lead.id + '/assign')
      .set(headers(admin))
      .send({ assignedToId: b.id })
      .expect(200);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: task.id } })).reminderSentAt).toEqual(claim);
  });

  it('excludes non-broker/deleted/suspended members from round-robin and filters private lead recipients', async () => {
    const unrelated = await db.user.create({
      data: { organizationId: org, role: 'USER', name: 'Customer is not an assignee', email: 'customer-rr.' + uid + '@e2e.test' },
    });
    const deleted = await db.user.create({
      data: { organizationId: org, role: 'BROKER_AGENT', name: 'Deleted assignee', email: 'deleted-rr.' + uid + '@e2e.test', deletedAt: new Date() },
    });
    const suspended = await db.user.create({
      data: { organizationId: org, role: 'BROKER_AGENT', name: 'Suspended assignee', email: 'suspended-rr.' + uid + '@e2e.test', status: 'SUSPENDED' },
    });
    const lead = await db.lead.create({ data: { organizationId: org, name: 'Round robin boundary', phone: '+919700008302' } });
    expect(await app.get(LeadsService).assignRoundRobin(lead.id, org, [unrelated.id, deleted.id, suspended.id, b.id])).toBe(b.id);
    await app
      .get(NotificationsService)
      .notify([a.id, b.id, admin.id, outsider.id, unrelated.id], { kind: 'SYSTEM', title: 'Lead recipient scope', data: { leadId: leadA }, push: false });
    const rows = await db.notification.findMany({
      where: { title: 'Lead recipient scope', data: { path: ['leadId'], equals: leadA } },
      select: { userId: true },
    });
    expect(rows.map((x) => x.userId).sort()).toEqual([a.id, admin.id].sort());
  });

  it('does not create invisible tasks for an Agent who does not own the lead', async () => {
    const at = new Date(Date.now() + 600_000).toISOString();
    await request(app.getHttpServer()).post('/api/follow-ups').set(headers(admin)).send({ leadId: leadA, assignedToId: b.id, dueAt: at }).expect(400);
    await request(app.getHttpServer()).post('/api/visits').set(headers(admin)).send({ leadId: leadA, assignedToId: b.id, scheduledAt: at }).expect(400);
    expect(await db.followUp.count({ where: { leadId: leadA, assignedToId: b.id } })).toBe(0);
    expect(await db.siteVisit.count({ where: { leadId: leadA, assignedToId: b.id } })).toBe(0);
  });

  it('allows explicit firm-admin assignment rules and rechecks module/member permission at execution', async () => {
    const input = {
      name: 'Isolated scoped assignment',
      trigger: 'LEAD_CREATED',
      isActive: true,
      respectBusinessHours: false,
      conditions: { sources: [], stages: [] },
      actions: [{ type: 'ASSIGN_TO', delayMinutes: 0, params: { userId: b.id } }],
    };
    await request(app.getHttpServer()).post('/api/automations').set(headers(a)).send(input).expect(403);
    await request(app.getHttpServer())
      .post('/api/automations')
      .set(headers(admin))
      .send({ ...input, actions: [{ ...input.actions[0], params: { userId: outsider.id } }] })
      .expect(400);
    const rule = (await request(app.getHttpServer()).post('/api/automations').set(headers(admin)).send(input).expect(201)).body;
    const lead = await db.lead.create({ data: { organizationId: org, name: 'Automatic assignment boundary', phone: '+919700008304' } });
    const automation = app.get(AutomationService);
    await automation.trigger('LEAD_CREATED', org, lead.id);
    const job = await db.job.findFirstOrThrow({ where: { type: 'automation.action', payload: { path: ['ruleId'], equals: rule.id } } });
    const claimed = await db.job.update({ where: { id: job.id }, data: { status: 'RUNNING', attempts: 1, lockedAt: new Date() } });
    await (app.get(JobsService) as any).execute(claimed);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBe(b.id);
    await automation.runAction(rule.id, lead.id, 0, {}, job.id);
    expect(await db.activity.count({ where: { leadId: lead.id, type: 'ASSIGNMENT' } })).toBe(1);
    if (process.env.BROKER_FIRST === 'true') {
      const previous = await db.systemSetting.findUnique({ where: { key: 'platform.modules' } });
      const policies = defaultModulePolicies();
      policies.team.state = 'HIDDEN';
      await db.systemSetting.upsert({
        where: { key: 'platform.modules' },
        create: { key: 'platform.modules', value: policies as any },
        update: { value: policies as any },
      });
      try {
        await expect(automation.runAction(rule.id, lead.id, 0, {}, job.id)).rejects.toThrow('disabled');
      } finally {
        if (previous) await db.systemSetting.update({ where: { key: previous.key }, data: { value: previous.value as any } });
        else await db.systemSetting.delete({ where: { key: 'platform.modules' } });
      }
    }
  });

  it('hides stale lead notifications from list/count/open, including legacy URLs and unassigned leads', async () => {
    const unassigned = await db.lead.create({ data: { organizationId: org, name: 'Unassigned reminder lead', phone: '+919700008201' } });
    const foreign = await db.lead.create({ data: { organizationId: otherOrg, name: 'Other firm reminder lead', phone: '+919700008202' } });
    const note = (leadId: string, legacy = false) =>
      db.notification.create({
        data: { userId: a.id, kind: 'VISIT_REMINDER', title: 'Private reminder', link: '/broker/leads/' + leadId, ...(legacy ? {} : { data: { leadId } }) },
      });
    const owned = await note(leadA);
    const hidden = await Promise.all([note(leadB), note(unassigned.id, true), note(foreign.id), note('missing-lead', true)]);
    const before = (await request(app.getHttpServer()).get('/api/me/notifications').set(headers(a)).expect(200)).body;
    expect(before.items.some((x: any) => x.id === owned.id)).toBe(true);
    for (const item of hidden) {
      expect(before.items.some((x: any) => x.id === item.id)).toBe(false);
      await request(app.getHttpServer())
        .post('/api/me/notifications/' + item.id + '/open')
        .set(headers(a))
        .expect(404);
    }
    expect(before.unreadCount).toBe(await db.notification.count({ where: { userId: a.id, readAt: null, id: { notIn: hidden.map((x) => x.id) } } }));
    await db.user.update({ where: { id: a.id }, data: { role: 'USER' } });
    try {
      const demoted = (await request(app.getHttpServer()).get('/api/me/notifications').set(headers(a)).expect(200)).body;
      expect(demoted.items.some((x: any) => x.id === owned.id)).toBe(false);
      await request(app.getHttpServer())
        .post('/api/me/notifications/' + owned.id + '/open')
        .set(headers(a))
        .expect(404);
    } finally {
      await db.user.update({ where: { id: a.id }, data: { role: 'BROKER_AGENT' } });
    }
  });

  it('pages every matching follow-up beyond500 and keeps counts/search scoped to current lead assignment', async () => {
    const marker = 'paged-' + uid;
    await db.followUp.createMany({
      data: Array.from({ length: 503 }, () => ({
        organizationId: org,
        leadId: leadA,
        assignedToId: a.id,
        dueAt: new Date('2026-01-01T00:00:00Z'),
        note: marker,
      })),
    });
    await db.followUp.createMany({
      data: [
        { organizationId: org, leadId: leadB, assignedToId: b.id, dueAt: new Date('2026-01-01T00:00:00Z'), note: marker },
        { organizationId: org, leadId: leadB, assignedToId: a.id, dueAt: new Date('2026-01-01T00:00:00Z'), note: marker },
      ],
    });
    const ids = new Set<string>();
    for (let page = 1; page <= 6; page++) {
      const result = await request(app.getHttpServer())
        .get('/api/follow-ups')
        .query({ paginated: 'true', pageSize: 100, page, search: marker })
        .set(headers(a))
        .expect(200);
      expect(result.body.total).toBe(503);
      expect(result.body.totalPages).toBe(6);
      result.body.items.forEach((row: { id: string }) => {
        expect(ids.has(row.id)).toBe(false);
        ids.add(row.id);
      });
    }
    expect(ids.size).toBe(503);
    const summary = await request(app.getHttpServer()).get('/api/follow-ups/summary').query({ search: marker }).set(headers(a)).expect(200);
    expect(summary.body).toEqual({ today: 503, overdue: 503 });
    expect(
      (await request(app.getHttpServer()).get('/api/follow-ups').query({ paginated: 'true', search: marker }).set(headers(outsider)).expect(200)).body.total,
    ).toBe(0);
    expect(
      (await request(app.getHttpServer()).get('/api/follow-ups/summary').query({ search: marker, assignedToId: b.id }).set(headers(a)).expect(200)).body,
    ).toEqual({ today: 0, overdue: 0 });
  });

  it('intersects custom dates with views and uses an IST end-of-day independently of server timezone', async () => {
    const marker = 'ist-boundary-' + uid;
    const end = followUpIstDayEnd();
    await db.followUp.createMany({
      data: [end, new Date(end.getTime() + 1)].map((dueAt) => ({ organizationId: org, leadId: leadA, assignedToId: a.id, dueAt, note: marker })),
    });
    const base = { paginated: 'true', search: marker, view: 'today' };
    const result = await request(app.getHttpServer()).get('/api/follow-ups').query(base).set(headers(a)).expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items[0].dueAt).toBe(end.toISOString());
    const outsideRange = await request(app.getHttpServer())
      .get('/api/follow-ups')
      .query({ ...base, from: new Date(end.getTime() + 1).toISOString() })
      .set(headers(a))
      .expect(200);
    expect(outsideRange.body.total).toBe(0);
    for (const query of [
      { status: 'INVALID' },
      { from: 'bad' },
      { from: '2026-02-31T10:00:00Z' },
      { page: 0 },
      { pageSize: 101 },
      { from: '2026-11-03T00:00:00Z', to: '2026-11-02T00:00:00Z' },
    ])
      await request(app.getHttpServer()).get('/api/follow-ups').query(query).set(headers(a)).expect(400);
  });

  it('search does not widen agent conversation ownership, and unlinked chats stay admin-only', async () => {
    const result = await request(app.getHttpServer()).get('/api/whatsapp/conversations?channel=CHAT&q=Search').set(headers(a)).expect(200);
    expect(result.body.map((c: any) => c.id)).toEqual([conversationA]);
    await request(app.getHttpServer())
      .get('/api/whatsapp/conversations/' + conversationB + '/messages')
      .set(headers(a))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/whatsapp/conversations/' + unassignedConversation + '/messages')
      .set(headers(a))
      .expect(403);
  });

  it('the alternate website-chat routes enforce the same assignment boundary', async () => {
    await request(app.getHttpServer())
      .get('/api/chat/threads/' + conversationA)
      .set(headers(a))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/chat/threads/' + conversationB)
      .set(headers(a))
      .expect(403);
    await request(app.getHttpServer())
      .delete('/api/chat/threads/' + conversationB)
      .set(headers(a))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/chat/threads/' + conversationA)
      .set(headers(outsider))
      .expect(403);
    expect(await db.conversation.count({ where: { id: conversationB } })).toBe(1);
  });

  it('requirements search, archive and matching do not elevate an agent to firm administrator', async () => {
    const create = (actor: { token: string }, id: string) =>
      request(app.getHttpServer())
        .post('/api/broker-requirements')
        .set(headers(actor))
        .send({ clientMutationId: id, purpose: 'RENT', localityNames: ['Sector 38'], notes: 'searchable boundary' });
    const own = await create(a, 'a-' + uid).expect(201);
    const foreign = await create(b, 'b-' + uid).expect(201);
    const list = await request(app.getHttpServer()).get('/api/broker-requirements?search=searchable').set(headers(a)).expect(200);
    expect(list.body.items.map((r: any) => r.id)).toEqual([own.body.id]);
    await request(app.getHttpServer())
      .delete('/api/broker-requirements/' + foreign.body.id)
      .set(headers(a))
      .expect(404);
    await create(a, 'b-' + uid).expect(403);
    await db.inventoryItem.createMany({
      data: [
        { organizationId: org, sector: 'Sector 38', purpose: 'RENT', createdById: a.id, assignedToId: a.id, status: 'ACTIVE', availability: 'AVAILABLE' },
        { organizationId: org, sector: 'Sector 38', purpose: 'RENT', createdById: b.id, assignedToId: b.id, status: 'ACTIVE', availability: 'AVAILABLE' },
      ],
    });
    const matched = await request(app.getHttpServer())
      .get('/api/broker-requirements/' + own.body.id + '/matches')
      .set(headers(a))
      .expect(200);
    expect(matched.body.available).toHaveLength(1);
    for (const match of [...matched.body.available, ...matched.body.unknown]) expect(match.item.createdById).toBe(a.id);
    expect(await db.brokerRequirement.count({ where: { id: foreign.body.id, deletedAt: null } })).toBe(1);
  });

  it('agents cannot bind requirements to somebody else’s lead', async () => {
    await request(app.getHttpServer())
      .post('/api/broker-requirements')
      .set(headers(a))
      .send({ leadId: leadB, purpose: 'RENT', localityNames: ['Sector 38'] })
      .expect(404);
  });

  it('private captures are scoped to their creator even inside the same firm', async () => {
    const source = await db.importBatch.create({
      data: {
        organizationId: org,
        createdById: b.id,
        sourceType: 'TEXT',
        sourceHash: 'private-' + uid,
        rawText: 'Private source boundary fixture',
        status: 'NEEDS_REVIEW',
      },
    });
    await request(app.getHttpServer())
      .get('/api/imports/' + source.id)
      .set(headers(a))
      .expect(404);
    const list = await request(app.getHttpServer()).get('/api/imports').set(headers(a)).expect(200);
    expect(list.body.items.some((r: any) => r.id === source.id)).toBe(false);
    await request(app.getHttpServer())
      .get('/api/imports/' + source.id)
      .set(headers(admin))
      .expect(200);
  });

  it('imports ZIP photo evidence with private record scope and keeps a reviewed entry across retries', async () => {
    const original = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#cccccc' } }).png().toBuffer();
    const other = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#dddddd' } }).png().toBuffer();
    const caption = '<attached: property.png>';
    const source = (image: Buffer, extra = {}) => zipSync({
      'chat.txt': strToU8(`02/11/2026, 10:00 - Sender: ${caption}\n02/11/2026, 10:01 - Sender: <attached: missing.png>`),
      'images/property.png': image,
      ...extra,
    });
    const capture = async (file: Uint8Array) => {
      const response = await request(app.getHttpServer()).post('/api/imports').set(headers(a)).send({
        sourceType: 'CHAT_EXPORT',
        groupName: 'zip-photo-permissions-' + uid,
        fileDataUrl: 'data:application/zip;base64,' + Buffer.from(file).toString('base64'),
      }).expect(201);
      await app.get(ImportsService).extract(response.body.id);
      return response.body.id as string;
    };

    const root = await mkdtemp(join(tmpdir(), 'brokeriq-photo-permissions-'));
    const storage = jest.replaceProperty(app.get(LocalStorageService) as unknown as { root: string | undefined }, 'root', root);
    const ocr = jest.spyOn(app.get(OcrService), 'recognize').mockResolvedValue({
      text: 'Available 2 BHK for rent in Sector 45, rent 35000',
      confidence: 58,
    });
    try {
      const id = await capture(source(original));
      const review = await request(app.getHttpServer()).get('/api/imports/' + id).set(headers(a)).expect(200);
      const [entry, missing] = review.body.entries;
      expect(entry.rawText).toBe(caption);
      expect(entry.ocr).toMatchObject({ sender: 'Sender', timestamp: '02/11/2026, 10:00', sourceFile: 'chat.txt' });
      const [photo] = entry.ocr.attachments;
      expect(photo).toMatchObject({ available: true, confidence: 58, name: 'images/property.png' });
      expect(photo).not.toHaveProperty('mediaRef');
      expect(entry.extracted.some((entity: { warnings: string[] }) => entity.warnings.some((warning) => warning.includes('From photo OCR')))).toBe(true);
      expect(missing.ocr.attachmentWarnings).toEqual(['Attachment missing from archive: missing.png']);
      expect(ocr).toHaveBeenCalledTimes(1);

      const path = `/api/imports/${id}/entries/${entry.id}/attachments/${photo.index}`;
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer()).get(path).set(headers(b)).expect(404);
      await request(app.getHttpServer()).get(path).set(headers(outsider)).expect(404);
      const file = await request(app.getHttpServer()).get(path).set(headers(admin)).expect(200).expect('Cache-Control', 'private, no-store');
      expect(file.body.equals(original)).toBe(true);
      const persisted = await db.sourceEntry.findUniqueOrThrow({ where: { id: entry.id } });
      const key = (persisted.ocr as unknown as { attachments: { mediaRef: string }[] }).attachments[0].mediaRef;
      await request(app.getHttpServer()).get('/api/media/f/' + key).set(headers(a)).expect(404);
      await db.sourceEntry.update({ where: { id: entry.id }, data: { reviewState: 'APPROVED', reviewNote: 'Reviewed by agent' } });
      const approved = await db.sourceEntry.findUniqueOrThrow({ where: { id: entry.id } });
      await db.importBatch.update({ where: { id }, data: { status: 'FAILED' } });
      await app.get(ImportsService).extract(id);
      expect(await db.sourceEntry.findUniqueOrThrow({ where: { id: entry.id } })).toEqual(approved);

      const previewUrl = '/api/imports/' + id + '/preview';
      const previewStart = () => request(app.getHttpServer()).post(previewUrl).set(headers(a)).expect(201);
      await request(app.getHttpServer()).post(previewUrl).set(headers(b)).expect(404);
      await request(app.getHttpServer()).post(previewUrl).set(headers(outsider)).expect(404);
      const attempts = await Promise.all(Array.from({ length: 4 }, previewStart));
      const previewId = attempts[0].body.id as string;
      expect(previewId).not.toBe(id);
      expect(attempts.every((attempt) => attempt.body.id === previewId)).toBe(true);
      expect(await db.job.count({ where: { key: 'import:' + previewId } })).toBe(1);
      await app.get(ImportsService).extract(previewId);
      const preview = await request(app.getHttpServer())
        .get('/api/imports/' + previewId + '?reviewState=NEEDS_REVIEW').set(headers(a)).expect(200);
      expect(preview.body).toMatchObject({ previewOfImportId: id, status: 'COMPLETE', pending: 0, canPreview: false });
      const previewEntry = preview.body.entries.find((item: { rawText: string }) => item.rawText === caption);
      expect(previewEntry).toMatchObject({ reviewState: 'PREVIEW', messageIdentity: null, duplicateOfId: null });
      expect(previewEntry.extracted).toEqual(entry.extracted);
      const previewAttachment = `/api/imports/${previewId}/entries/${previewEntry.id}/attachments/${photo.index}`;
      const previewFile = await request(app.getHttpServer()).get(previewAttachment).set(headers(admin)).expect(200);
      expect(previewFile.body.equals(original)).toBe(true);
      await request(app.getHttpServer()).get(previewAttachment).set(headers(b)).expect(404);
      const requirementsBefore = await db.brokerRequirement.count();
      await request(app.getHttpServer()).patch('/api/imports/entries/' + previewEntry.id)
        .set(headers(a)).send({ entities: [] }).expect(403);
      await request(app.getHttpServer()).post('/api/imports/entries/' + previewEntry.id + '/approve')
        .set(headers(admin)).send({ entities: previewEntry.extracted }).expect(403);
      await request(app.getHttpServer()).post('/api/imports/entries/' + previewEntry.id + '/approve')
        .set(headers(a)).send({ entities: [], ignore: true }).expect(403);
      await request(app.getHttpServer()).post('/api/imports/' + previewId + '/preview').set(headers(a)).expect(400);
      expect(await db.brokerRequirement.count()).toBe(requirementsBefore);
      expect(await db.sourceEntry.findUniqueOrThrow({ where: { id: entry.id } })).toEqual(approved);


      const repeated = await capture(source(original, { 'irrelevant.txt': strToU8('another chat export segment') }));
      const distinct = await capture(source(other));
      const first = await db.sourceEntry.findFirstOrThrow({ where: { batchId: repeated, rawText: caption } });
      const second = await db.sourceEntry.findFirstOrThrow({ where: { batchId: distinct, rawText: caption } });
      expect(first.duplicateOfId).toBe(entry.id);
      expect(second.reviewState).toBe('NEEDS_REVIEW');
      expect(second.messageIdentity).not.toBe(approved.messageIdentity);
    } finally {
      ocr.mockRestore();
      storage.restore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('dashboard totals and unread counts exclude another agent’s inventory and unlinked conversations', async () => {
    const result = await request(app.getHttpServer()).get('/api/broker/dashboard').set(headers(a)).expect(200);
    expect(result.body.kpis.totalInventory).toBe(1);
    expect(result.body.housingConnector).toBeNull();
    const unread = await request(app.getHttpServer()).get('/api/whatsapp/unread-stats').set(headers(a)).expect(200);
    expect(unread.body.chat.unreadConversations).toBe(0);
  });

  it('member details do not expose another agent’s KYC or location', async () => {
    await request(app.getHttpServer())
      .get('/api/broker/team/members/' + b.id)
      .set(headers(a))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/broker/team/' + a.id)
      .set(headers(a))
      .expect(process.env.BROKER_FIRST === 'true' ? 403 : 200);
    await request(app.getHttpServer())
      .get('/api/broker/team/' + b.id)
      .set(headers(admin))
      .expect(200);
  });

  it('the member alias cannot bypass validation to promote someone to Super Admin', async () => {
    await request(app.getHttpServer())
      .patch('/api/broker/team/members/' + b.id)
      .set(headers(admin))
      .send({ role: 'SUPER_ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/broker/team/members/' + b.id)
      .set(headers(a))
      .send({ role: 'BROKER_ADMIN' })
      .expect(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: b.id } })).role).toBe('BROKER_AGENT');
  });

  it('even Super Admin cannot orphan a firm by removing or demoting its last active administrator', async () => {
    const user = await db.user.create({ data: { name: 'Isolated platform admin', email: 'platform.' + uid + '@e2e.test', role: 'SUPER_ADMIN' } });
    const superActor = { token: (await app.get(AuthService).issue({ ...user, organization: null })).accessToken };
    await request(app.getHttpServer())
      .patch('/api/broker/team/' + admin.id)
      .set(headers(superActor))
      .send({ role: 'BROKER_AGENT', targets: { monthlyDeals: 999 } })
      .expect(400);
    expect(await db.orgSetting.findUnique({ where: { organizationId_key: { organizationId: org, key: 'agent_targets' } } })).toBeNull();
    await request(app.getHttpServer())
      .delete('/api/broker/team/' + admin.id)
      .set(headers(superActor))
      .expect(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('BROKER_ADMIN');
  });
});
