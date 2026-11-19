import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Agent assignment dashboard', () => {
  let app: INestApplication;
  let db: PrismaService;
  let ownerToken: string;
  let delegateToken: string;
  let agentToken: string;
  let unrelatedToken: string;
  let organizationId: string;
  let managed: string;
  let assignedLead: string;
  let idle: string;
  let outside: string;
  let delegate: string;
  const stamp = randomUUID();
  const path = '/api/broker/dashboard/agent-assignments';
  const grants = ['today:view', 'team:view', 'leads:view'];
  const api = () => request(app.getHttpServer());
  const h = (token: string) => ({ Authorization: 'Bearer ' + token });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    organizationId = (await db.organization.create({ data: { name: 'Assignment verification firm', slug: 'assignment-' + stamp } })).id;
    const other = (await db.organization.create({ data: { name: 'Separate firm', slug: 'other-assignment-' + stamp } })).id;
    const create = async (name: string, role: 'BROKER_ADMIN' | 'SUB_BROKER_ADMIN' | 'BROKER_AGENT', org = organizationId, permissions: string[] = []) => {
      const user = await db.user.create({
        data: { name, email: name + '.' + stamp + '@e2e.test', role, organizationId: org, delegatedPermissions: permissions },
        include: { organization: true },
      });
      return { ...user, token: (await app.get(AuthService).issue(user)).accessToken };
    };
    ownerToken = (await create('Owner', 'BROKER_ADMIN')).token;
    unrelatedToken = (await create('OutsideOwner', 'BROKER_ADMIN', other)).token;
    const agent = await create('AssignedAgent', 'BROKER_AGENT');
    managed = agent.id;
    agentToken = agent.token;
    idle = (await create('IdleAgent', 'BROKER_AGENT')).id;
    outside = (await create('OutsideAgent', 'BROKER_AGENT', other)).id;
    const manager = await create('Delegate', 'SUB_BROKER_ADMIN', organizationId, grants);
    delegate = manager.id;
    delegateToken = manager.token;

    const lead = await db.lead.create({ data: { organizationId, assignedToId: managed, name: 'Assigned lead', phone: '+919701188900' } });
    assignedLead = lead.id;
    await db.activity.create({ data: { organizationId, leadId: lead.id, type: 'NOTE', content: 'Called to arrange a visit' } });
    const deletedLead = await db.lead.create({
      data: { organizationId, assignedToId: managed, name: 'Deleted lead', phone: '+919701188901', deletedAt: new Date() },
    });
    await db.brokerRequirement.create({ data: { organizationId, assignedToId: managed, leadId: lead.id } });
    await db.inventoryItem.create({ data: { organizationId, assignedToId: managed, sector: 'Sector 46' } });
    await db.followUp.createMany({ data: [lead.id, deletedLead.id].map((leadId) => ({ organizationId, leadId, assignedToId: managed, dueAt: new Date() })) });
    await db.siteVisit.create({ data: { organizationId, leadId: lead.id, assignedToId: managed, scheduledAt: new Date() } });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('shows exact current counts, zero assignments, and only agents from the caller’s firm', async () => {
    const { body } = await api().get(path).set(h(ownerToken)).expect(200);
    expect(body.scope).toBe('FIRM');
    expect(body.agents).toEqual([
      { id: managed, name: 'AssignedAgent', counts: { leads: 1, requirements: 1, properties: 1, followUps: 1, visits: 1 } },
      { id: idle, name: 'IdleAgent', counts: { leads: 0, requirements: 0, properties: 0, followUps: 0, visits: 0 } },
    ]);
    await api().get(path).set(h(agentToken)).expect(403);
    const other = await api().get(path).set(h(unrelatedToken)).expect(200);
    expect(other.body.agents.map((agent: { id: string }) => agent.id)).toEqual([outside]);
  });

  it('returns live records, latest lead activity and canonical lead links for tasks', async () => {
    const records = path + '/' + managed;
    const { body } = await api()
      .get(records + '?kind=leads')
      .set(h(ownerToken))
      .expect(200);
    expect(body.agent.id).toBe(managed);
    expect(body.hasMore).toBe(false);
    expect(body.items).toEqual([
      expect.objectContaining({
        recordId: assignedLead,
        title: 'Assigned lead',
        status: 'NEW',
        summary: 'Called to arrange a visit',
      }),
    ]);
    for (const kind of ['followUps', 'visits']) {
      const tasks = await api()
        .get(records + '?kind=' + kind)
        .set(h(ownerToken))
        .expect(200);
      expect(tasks.body.items).toEqual([expect.objectContaining({ recordId: assignedLead })]);
    }
    await api()
      .get(records + '?kind=leads&page=0')
      .set(h(ownerToken))
      .expect(400);
    await api()
      .get(records + '?kind=invalid')
      .set(h(ownerToken))
      .expect(400);
    await api()
      .get(records + '?kind=leads')
      .set(h(agentToken))
      .expect(403);
    await api()
      .get(records + '?kind=leads')
      .set(h(unrelatedToken))
      .expect(404);
  });

  it('starts with an empty delegated scope, validates agent selections and returns only granted counts', async () => {
    const memberPath = '/api/broker/team/' + delegate;
    const draft = await api().get(path).set(h(delegateToken)).expect(200);
    expect(draft.body.agents).toEqual([]);
    const selection = await api()
      .get(memberPath + '/assignment-dashboard')
      .set(h(ownerToken))
      .expect(200);
    expect(selection.body.agents.map((agent: { id: string }) => agent.id)).toEqual([managed, idle]);
    await api()
      .get(memberPath + '/assignment-dashboard')
      .set(h(delegateToken))
      .expect(403);
    await api()
      .patch(memberPath)
      .set(h(delegateToken))
      .send({ assignmentDashboardAgentIds: [idle] })
      .expect(403);
    await api()
      .patch(memberPath)
      .set(h(unrelatedToken))
      .send({ assignmentDashboardAgentIds: [outside] })
      .expect(404);
    await api()
      .patch(memberPath)
      .set(h(ownerToken))
      .send({ assignmentDashboardAgentIds: [outside] })
      .expect(400);
    const updatedAt = (await api().get(memberPath).set(h(ownerToken)).expect(200)).body.member.updatedAt;
    const saved = await api()
      .patch(memberPath)
      .set(h(ownerToken))
      .send({ expectedUpdatedAt: updatedAt, assignmentDashboardAgentIds: [managed] })
      .expect(200);
    await api()
      .patch(memberPath)
      .set(h(ownerToken))
      .send({ expectedUpdatedAt: updatedAt, assignmentDashboardAgentIds: [idle] })
      .expect(409);
    const scoped = await api().get(path).set(h(delegateToken)).expect(200);
    expect(scoped.body.scope).toBe('MANAGED_AGENTS');
    expect(scoped.body.columns).toEqual(['leads', 'requirements', 'followUps', 'visits']);
    expect(scoped.body.agents).toEqual([{ id: managed, name: 'AssignedAgent', counts: { leads: 1, requirements: 1, followUps: 1, visits: 1 } }]);
    await api()
      .get(path + '/' + managed + '?kind=leads')
      .set(h(delegateToken))
      .expect(200);
    await api()
      .get(path + '/' + managed + '?kind=properties')
      .set(h(delegateToken))
      .expect(403);
    await api()
      .get(path + '/' + idle + '?kind=leads')
      .set(h(delegateToken))
      .expect(404);
    await db.user.update({ where: { id: managed }, data: { status: 'SUSPENDED' } });
    expect((await api().get(path).set(h(delegateToken)).expect(200)).body.agents).toEqual([]);
    await db.user.update({ where: { id: managed }, data: { status: 'ACTIVE' } });
    await api().patch(memberPath).set(h(ownerToken)).send({ expectedUpdatedAt: saved.body.updatedAt, assignmentDashboardAgentIds: [] }).expect(200);
    expect((await api().get(path).set(h(delegateToken)).expect(200)).body.agents).toEqual([]);
    await db.user.update({ where: { id: delegate }, data: { delegatedPermissions: ['today:view', 'leads:view'] } });
    await api().get(path).set(h(delegateToken)).expect(403);
  });
});
