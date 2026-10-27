import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

(process.env.BROKER_FIRST === 'true' ? describe : describe.skip)('Broker team release', () => {
  let app: INestApplication;
  let db: PrismaService;
  let owner: string;
  let other: string;
  let org: string;
  let agent: string;
  let agentId: string;
  const uid = Date.now().toString(36);
  const email = `agent.${uid}@e2e.test`;
  const password = 'Fixture@12345';
  const api = () => request(app.getHttpServer());
  const h = (token: string) => ({ Authorization: `Bearer ${token}` });
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init(); db = app.get(PrismaService);
    await db.systemSetting.deleteMany({ where: { key: 'platform.modules' } });
    const admin = (await api().post('/api/auth/login').send({ email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD }).expect(200)).body.accessToken;
    for (const name of ['owner', 'other']) {
      const input = { name: 'Team fixture', firmName: `Team ${name} ${uid}`, email: `${name}.${uid}@e2e.test`, password };
      const firm = (await api().post('/api/admin/organizations').set(h(admin)).send(input).expect(201)).body;
      const token = (await api().post('/api/auth/login').send(input).expect(200)).body.accessToken;
      if (name === 'owner') { owner = token; org = firm.id; } else other = token;
    }
  });
  afterAll(async () => { await app.close(); });
  it('invites, signs up, accepts once and supports the sub-agent workspace', async () => {
    const cfg = (await api().get('/api/public/config').expect(200)).body;
    expect(cfg.modules.team.state).toBe('ACTIVE');
    const invitation = (await api().post('/api/broker/team/invite').set(h(owner)).send({ name: 'Sub-agent', email, role: 'BROKER_AGENT' }).expect(201)).body;
    const token = invitation.link.split('/').pop();
    const preview = (await api().get(`/api/invites/${token}`).expect(200)).body;
    expect(preview.email).toBe(email);
    const signed = (await api().post('/api/auth/register').send({ name: 'Sub-agent', email, password, accountType: 'USER' }).expect(201)).body;
    const joined = (await api().post(`/api/invites/${token}/accept`).set(h(signed.accessToken)).send({}).expect(201)).body;
    agentId = joined.user.id; agent = joined.accessToken;
    expect(joined.user.role).toBe('BROKER_AGENT'); expect(joined.user.organization.id).toBe(org);
    await api().post(`/api/invites/${token}/accept`).set(h(agent)).send({}).expect(404);
    const login = (await api().post('/api/auth/login').send({ email, password }).expect(200)).body;
    agent = login.accessToken;
    await api().get('/api/broker/team').set(h(agent)).expect(200);
    await api().get('/api/broker/dashboard/metrics').set(h(agent)).expect(200);
    await api().get('/api/inventory').set(h(agent)).expect(200);
    await api().get('/api/imports').set(h(agent)).expect(200);
    await api().post('/api/broker/team/invite').set(h(agent)).send({ name: 'Forbidden', email: `denied.${uid}@e2e.test` }).expect(403);
    await api().get('/api/admin/users').set(h(agent)).expect(403);
    await api().get('/api/broker/connectors').set(h(agent)).expect(403);
  });
  it('restricts leads, assignment, records and cross-firm updates', async () => {
    const mine = (await api().post('/api/leads').set(h(owner)).send({ name: 'Assigned fixture', phone: '9999999901', assignedToId: agentId }).expect(201)).body;
    const others = (await api().post('/api/leads').set(h(owner)).send({ name: 'Unassigned fixture', phone: '9999999902' }).expect(201)).body;
    await api().get(`/api/leads/${mine.id}`).set(h(agent)).expect(200);
    await api().get(`/api/leads/${others.id}`).set(h(agent)).expect(404);
    await api().patch(`/api/leads/${mine.id}/assign`).set(h(agent)).send({ assignedToId: null }).expect(403);
    const records = (await api().get('/api/broker/dashboard/records?chart=leads').set(h(agent)).expect(200)).body;
    expect(records.items.map((i: any) => i.id)).toContain(mine.id);
    expect(records.items.map((i: any) => i.id)).not.toContain(others.id);
    const item = (await api().post('/api/inventory').set(h(owner)).send({ sector: 'Sector 45', notes: 'Shared firm inventory' }).expect(201)).body;
    await api().patch(`/api/inventory/${item.id}`).set(h(agent)).send({ notes: 'Agent update', expectedRevision: item.revision }).expect(200);
    await api().get(`/api/inventory/${item.id}`).set(h(other)).expect(404);
    await api().patch(`/api/broker/team/${agentId}`).set(h(other)).send({ status: 'SUSPENDED' }).expect(404);
    const assignees = (await api().get('/api/leads/assignees').set(h(owner)).expect(200)).body;
    expect(assignees.members.some((m: any) => m.id === agentId)).toBe(true);
  });
  it('rejects wrong-email, expired and cancelled invitations', async () => {
    const invite = (await api().post('/api/broker/team/invite').set(h(owner)).send({ name: 'Next agent', email: `next.${uid}@e2e.test` }).expect(201)).body;
    const token = invite.link.split('/').pop();
    await api().post(`/api/invites/${token}/accept`).set(h(agent)).send({}).expect(403);
    await db.invite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await api().get(`/api/invites/${token}`).expect(404);
    const cancel = (await api().post('/api/broker/team/invite').set(h(owner)).send({ name: 'Cancel agent', email: `cancel.${uid}@e2e.test` }).expect(201)).body;
    await api().delete(`/api/broker/team/invites/${cancel.id}`).set(h(owner)).expect(200);
    await api().get(`/api/invites/${cancel.link.split('/').pop()}`).expect(404);
  });
  it('keeps agent list filters and task assignments inside their access scope', async () => {
    const ownerId = (await db.user.findFirstOrThrow({ where: { organizationId: org, role: 'BROKER_ADMIN' } })).id;
    const otherId = (await db.user.findFirstOrThrow({ where: { organizationId: { not: org }, email: `other.${uid}@e2e.test` } })).id;
    const mine = (await api().post('/api/leads').set(h(owner)).send({ name: 'Scoped task fixture', phone: '9999999903', assignedToId: agentId }).expect(201)).body;
    const theirs = (await api().post('/api/leads').set(h(owner)).send({ name: 'Admin task fixture', phone: '9999999904', assignedToId: ownerId }).expect(201)).body;
    const at = new Date(Date.now() + 86400_000).toISOString();
    const ownFollowUp = (await api().post('/api/follow-ups').set(h(agent)).send({ leadId: mine.id, dueAt: at }).expect(201)).body;
    const otherFollowUp = (await api().post('/api/follow-ups').set(h(owner)).send({ leadId: theirs.id, dueAt: at }).expect(201)).body;
    const ownVisit = (await api().post('/api/visits').set(h(agent)).send({ leadId: mine.id, scheduledAt: at }).expect(201)).body;
    const otherVisit = (await api().post('/api/visits').set(h(owner)).send({ leadId: theirs.id, scheduledAt: at }).expect(201)).body;
    expect((await api().get(`/api/leads?assignedToId=${ownerId}`).set(h(agent)).expect(200)).body.items).toEqual([]);
    const columns = (await api().get(`/api/leads/kanban?assignedToId=${ownerId}`).set(h(agent)).expect(200)).body;
    expect(columns.flatMap((column: any) => column.items)).toEqual([]);
    expect((await api().get(`/api/follow-ups?assignedToId=${ownerId}`).set(h(agent)).expect(200)).body).toEqual([]);
    const followUps = (await api().get('/api/follow-ups').set(h(agent)).expect(200)).body.map((item: any) => item.id);
    expect(followUps).toContain(ownFollowUp.id); expect(followUps).not.toContain(otherFollowUp.id);
    const visits = (await api().get(`/api/visits?assignedToId=${ownerId}`).set(h(agent)).expect(200)).body.map((item: any) => item.id);
    expect(visits).toContain(ownVisit.id); expect(visits).not.toContain(otherVisit.id);
    for (const [path, timing] of [['follow-ups', { dueAt: at }], ['visits', { scheduledAt: at }]] as const) {
      await api().post(`/api/${path}`).set(h(agent)).send({ leadId: mine.id, ...timing, assignedToId: ownerId }).expect(403);
      await api().post(`/api/${path}`).set(h(owner)).send({ leadId: mine.id, ...timing, assignedToId: otherId }).expect(400);
    }
  });
  it('suspends, reactivates and removes a member while revoking old sessions', async () => {
    await api().patch(`/api/broker/team/${agentId}`).set(h(owner)).send({ status: 'SUSPENDED' }).expect(200);
    await api().get('/api/leads').set(h(agent)).expect(401);
    await api().post('/api/auth/login').send({ email, password }).expect(403);
    await api().patch(`/api/broker/team/${agentId}`).set(h(owner)).send({ status: 'ACTIVE' }).expect(200);
    agent = (await api().post('/api/auth/login').send({ email, password }).expect(200)).body.accessToken;
    await api().delete(`/api/broker/team/${agentId}`).set(h(owner)).expect(200);
    await api().get('/api/leads').set(h(agent)).expect(401);
    expect((await db.user.findUniqueOrThrow({ where: { id: agentId } })).organizationId).toBeNull();
  });
});
