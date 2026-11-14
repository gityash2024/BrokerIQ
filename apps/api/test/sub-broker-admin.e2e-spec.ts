import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Sub-Broker Admin authorization on real PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  let auth: AuthService;
  const stamp = Date.now().toString(36);
  const api = () => request(app.getHttpServer());
  const header = (token: string) => ({ Authorization: 'Bearer ' + token });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    auth = app.get(AuthService);
  });
  afterAll(async () => { await app?.close(); });

  it('promotes an agent, checks separate grants, keeps firm scope, and revokes sessions on changes', async () => {
    const firm = await db.organization.create({ data: { name: 'Isolated delegation', slug: 'delegate-' + stamp, restrictions: [] } });
    const other = await db.organization.create({ data: { name: 'Isolated other firm', slug: 'other-' + stamp, restrictions: [] } });
    const owner = await db.user.create({ data: { name: 'Owner', email: 'owner.' + stamp + '@e2e.test', role: 'BROKER_ADMIN', organizationId: firm.id }, include: { organization: true } });
    const agent = await db.user.create({ data: { name: 'Agent', email: 'agent.' + stamp + '@e2e.test', role: 'BROKER_AGENT', organizationId: firm.id }, include: { organization: true } });
    const ownerHeader = header((await auth.issue(owner)).accessToken);
    const prior = header((await auth.issue(agent)).accessToken);
    const path = '/api/broker/team/' + agent.id;
    await api().patch(path).set(ownerHeader).send({ role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['admin:view'] }).expect(403);
    await api().patch(path).set(ownerHeader).send({ role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['leads:view', 'team:view', 'team:edit'] }).expect(200);
    await api().get('/api/auth/me').set(prior).expect(401);
    const delegate = await db.user.findUniqueOrThrow({ where: { id: agent.id }, include: { organization: true } });
    const session = await auth.issue(delegate);
    const delegatedHeader = header(session.accessToken);
    expect(session.user.role).toBe('SUB_BROKER_ADMIN');
    expect(session.user.delegatedPermissions).toContain('leads:view');
    const own = await db.lead.create({ data: { name: 'Local lead', phone: '9811199911', organizationId: firm.id } });
    const foreign = await db.lead.create({ data: { name: 'Other lead', phone: '9811199912', organizationId: other.id } });
    await api().get('/api/leads/' + own.id).set(delegatedHeader).expect(200);
    await api().get('/api/leads/' + foreign.id).set(delegatedHeader).expect(404);
    await api().post('/api/leads').set(delegatedHeader).send({ name: 'Denied', phone: '9811199913' }).expect(403);
    await api().get('/api/leads/export').set(delegatedHeader).expect(403);
    await api().get('/api/inventory').set(delegatedHeader).expect(403);
    await api().get('/api/leads/assignees').set(delegatedHeader).expect(403);
    await api().get('/api/broker/dashboard/metrics?days=30').set(delegatedHeader).expect(403);
    await api().get('/api/inventory/assignees').set(delegatedHeader).expect(403);
    await api().get('/api/broker/team').set(delegatedHeader).expect(200);
    await api().patch('/api/broker/team/' + owner.id + '/').set(delegatedHeader).send({ role: 'BROKER_AGENT' }).expect(403);
    await api().post('/api/broker/team/invite').set(delegatedHeader).send({ name: 'Denied', email: 'denied@e2e.test' }).expect(403);
    await api().patch(path).set(ownerHeader).send({ delegatedPermissions: ['leads:edit', 'time_logging:view'] }).expect(200);
    await api().get('/api/leads').set(delegatedHeader).expect(401);
    const fresh = await db.user.findUniqueOrThrow({ where: { id: agent.id }, include: { organization: true } });
    const newHeader = header((await auth.issue(fresh)).accessToken);
    await api().patch('/api/leads/' + own.id).set(newHeader).send({ name: 'Updated lead' }).expect(200);
    await api().patch('/api/leads/' + own.id).set(newHeader).send({ assignedToId: owner.id }).expect(403);
    await api().delete('/api/leads/' + own.id).set(newHeader).expect(403);
    await api().get('/api/broker/team').set(newHeader).expect(403);
    const picker = await api().get('/api/time-logging/members').set(newHeader).expect(200);
    expect(picker.body.members).toContainEqual({ id: owner.id, name: owner.name, role: owner.role });
    expect(picker.body.members.every((row: object) => Object.keys(row).length === 3)).toBe(true);
    await api().post('/api/time-logging/punch-in').set(newHeader).send({}).expect(403);
  });

  it('opens delegated dashboard, leaderboard and assignment screens and runs a complete shift', async () => {
    const firm = await db.organization.create({ data: { name: 'Full grants firm', slug: 'full-grants-' + stamp, restrictions: [] } });
    const owner = await db.user.create({ data: { name: 'Firm owner', email: 'full.owner.' + stamp + '@e2e.test', role: 'BROKER_ADMIN', organizationId: firm.id }, include: { organization: true } });
    const member = await db.user.create({
      data: { name: 'Firm delegate', email: 'full.delegate.' + stamp + '@e2e.test', role: 'SUB_BROKER_ADMIN', organizationId: firm.id,
        delegatedPermissions: ['today:view', 'team:view', 'leads:view', 'leads:assign', 'inventory:view', 'inventory:assign', 'time_logging:view', 'time_logging:create'] },
      include: { organization: true },
    });
    const headers = header((await auth.issue(member)).accessToken);
    for (const path of ['/broker/today', '/broker/dashboard/metrics?days=30', '/broker/dashboard/records?days=30&chart=leads',
      '/broker/performance?range=MONTH', '/broker/team', '/time-logging/members', '/time-logging/status', '/time-logging/timeline', '/time-logging/history']) {
      const response = await api().get('/api' + path).set(headers);
      expect([path, response.status]).toEqual([path, 200]);
    }
    for (const path of ['/leads/assignees', '/inventory/assignees']) {
      const response = await api().get('/api' + path).set(headers).expect(200);
      expect(response.body.members).toContainEqual({ id: owner.id, name: owner.name, role: owner.role });
      expect(response.body.members).toHaveLength(2);
    }
    const lead = await db.lead.create({ data: { organizationId: firm.id, name: 'Delegated assignment', phone: '9811199914' } });
    await api().patch('/api/leads/' + lead.id + '/assign').set(headers).send({ assignedToId: owner.id }).expect(200);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBe(owner.id);
    const location = { latitude: 28.42, longitude: 77.08, accuracy: 12, address: 'Sector 57, Gurugram' };
    await api().post('/api/time-logging/punch-in').set(headers).send(location).expect(201);
    await api().post('/api/time-logging/location').set(headers).send(location).expect(201);
    await api().post('/api/time-logging/pause').set(headers).send({ reason: 'MANUAL' }).expect(201);
    await api().post('/api/time-logging/resume').set(headers).send(location).expect(201);
    await api().post('/api/time-logging/punch-out').set(headers).send(location).expect(201);
    await api().get('/api/time-logging/timeline').set(headers).expect(200);
    await api().get('/api/broker/dashboard/records?days=30&chart=enquiries').set(headers).expect(403);
    await api().get('/api/whatsapp/conversations').set(headers).expect(403);
  });

  it('allows Super Admin to promote an existing firm agent without extending invitation or grant editing rights', async () => {
    const firm = await db.organization.create({ data: { name: 'Promotion firm', slug: 'promotion-' + stamp, restrictions: [] } });
    const admin = await db.user.create({
      data: { name: 'Platform admin', email: 'super.' + stamp + '@e2e.test', role: 'SUPER_ADMIN' }, include: { organization: true },
    });
    const agent = await db.user.create({
      data: { name: 'Existing agent', email: 'promotion.' + stamp + '@e2e.test', role: 'BROKER_AGENT', organizationId: firm.id },
    });
    const actor = header((await auth.issue(admin)).accessToken);
    const path = '/api/broker/team/' + agent.id;
    const promotion = { role: 'SUB_BROKER_ADMIN', expectedUpdatedAt: agent.updatedAt.toISOString() };
    await api().patch(path).set(actor).send({ ...promotion, delegatedPermissions: ['platform:edit'] }).expect(403);
    await api().patch(path).set(actor).send({ ...promotion, delegatedPermissions: ['inventory:view'] }).expect(200);
    const updated = await db.user.findUniqueOrThrow({ where: { id: agent.id } });
    expect(updated).toMatchObject({ organizationId: firm.id, role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:view'] });
    await api().patch(path).set(actor).send({ role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:edit'] }).expect(403);
    await api().post('/api/broker/team/invite').set(actor).send({ name: 'Invitee', email: 'no@e2e.test', ...promotion, delegatedPermissions: [] }).expect(403);
  });

  it('creates and accepts a restricted invitation without inheriting unrelated access', async () => {
    const firm = await db.organization.create({ data: { name: 'Invitation firm', slug: 'invite-' + stamp, restrictions: [] } });
    const owner = await db.user.create({ data: { name: 'Inviter', email: 'inviter.' + stamp + '@e2e.test', role: 'BROKER_ADMIN', organizationId: firm.id }, include: { organization: true } });
    const candidate = await db.user.create({ data: { name: 'Invitee', email: 'invitee.' + stamp + '@e2e.test', role: 'USER' }, include: { organization: true } });
    const ownerHeader = header((await auth.issue(owner)).accessToken);
    const candidateHeader = header((await auth.issue(candidate)).accessToken);
    const invite = { name: candidate.name, email: candidate.email, role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:view', 'automation:connection_status'] };
    await api().post('/api/broker/team/invite').set(ownerHeader).send({ ...invite, delegatedPermissions: ['platform:edit'] }).expect(403);
    const created = await api().post('/api/broker/team/invite').set(ownerHeader).send(invite).expect(201);
    const token = new URL(created.body.link).pathname.split('/').pop();
    expect(token).toBeTruthy();
    const joined = await api().post('/api/invites/' + token + '/accept').set(candidateHeader).expect(201);
    expect(joined.body.user).toMatchObject({ role: 'SUB_BROKER_ADMIN', delegatedPermissions: ['inventory:view', 'automation:connection_status'] });
    const delegatedHeader = header(joined.body.accessToken);
    await api().get('/api/inventory').set(delegatedHeader).expect(200);
    await api().get('/api/leads').set(delegatedHeader).expect(403);
    await api().get('/api/INVENTORY/EXPORT/').set(delegatedHeader).expect(403);
    await api().post('/api/inventory').set(delegatedHeader).send({}).expect(403);
    const overview = await api().get('/api/broker/connectors').set(delegatedHeader).expect(200);
    expect(overview.body.webhook.url).toBeNull();
    expect(overview.body.connectors.every((item: { extra: object }) => !Object.keys(item.extra).length)).toBe(true);
    await api().post('/api/broker/connectors/housing_api/sync').set(delegatedHeader).expect(403);
    await api().patch('/api/broker/connectors/housing_api').set(delegatedHeader).send({ enabled: false }).expect(403);
    await api().post('/api/messaging/gmail/connect').set(delegatedHeader).expect(403);
    await api().post('/api/invites/' + token + '/accept').set(delegatedHeader).expect(403);
  });
});
