import { Test } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

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
