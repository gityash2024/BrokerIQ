import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobsService } from '../src/core/jobs/jobs.service';
import { defaultModulePolicies } from '@brokeriq/shared';

/** Run separately with BROKER_FIRST=true and an isolated, migrated test database. */
(process.env.BROKER_FIRST === 'true' ? describe : describe.skip)('Broker-first authorization and module control', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;
  let broker: string;
  let orgId: string;
  const uid = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
  beforeAll(async () => {
    expect(process.env.BROKER_FIRST).toBe('true');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.systemSetting.deleteMany({ where: { key: 'platform.modules' } });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: process.env.SUPER_ADMIN_EMAIL, password: process.env.SUPER_ADMIN_PASSWORD })
      .expect(200);
    admin = login.body.accessToken;
    const created = await request(app.getHttpServer())
      .post('/api/admin/organizations')
      .set(headers(admin))
      .send({ name: 'Authorization fixture', firmName: `Access test ${uid}`, email: `broker.${uid}@e2e.test`, password: 'Fixture@12345' })
      .expect(201);
    orgId = created.body.id;
    const bl = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `broker.${uid}@e2e.test`, password: 'Fixture@12345' })
      .expect(200);
    broker = bl.body.accessToken;
  });
  afterAll(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: 'platform.modules' } });
    await app.close();
  });
  it('keeps discovery and customer signup public while broker signup remains invited', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    const cfg = await request(app.getHttpServer()).get('/api/public/config').expect(200);
    expect(cfg.body.modules.inventory.state).toBe('ACTIVE');
    await request(app.getHttpServer()).get('/api/public/homepage').expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: `consumer.${uid}@e2e.test`, name: 'Consumer fixture', password: 'Fixture@12345', accountType: 'USER' })
      .expect(201);
    expect(await prisma.user.count({ where: { email: `consumer.${uid}@e2e.test` } })).toBe(1);
  });
  it('enforces modules on direct URLs, roles and queued execution', async () => {
    await request(app.getHttpServer()).get('/api/inventory').set(headers(broker)).expect(200);
    await request(app.getHttpServer()).patch('/api/admin/modules/inventory').set(headers(broker)).send(defaultModulePolicies().inventory).expect(403);
    await request(app.getHttpServer())
      .patch('/api/admin/modules/inventory')
      .set(headers(admin))
      .send({ state: 'HIDDEN', roles: ['BROKER_ADMIN'] })
      .expect(200);
    const denied = await request(app.getHttpServer()).get('/api/inventory').set(headers(broker)).expect(403);
    expect(denied.body.code).toBe('FEATURE_DISABLED');
    const jobs = app.get(JobsService);
    const handler = jest.fn();
    jobs.register('import.pdf', handler);
    const job = await prisma.job.create({ data: { type: 'import.pdf', payload: {}, status: 'RUNNING' } });
    await (jobs as any).execute(job);
    expect(handler).not.toHaveBeenCalled();
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('FAILED');
    await request(app.getHttpServer()).patch('/api/admin/modules/inventory').set(headers(admin)).send(defaultModulePolicies().inventory).expect(200);
  });
  it('keeps public signup closed and consumes expiring invitations exactly once', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Signup fixture', email: `open.${uid}@e2e.test`, password: 'Fixture@12345', accountType: 'BROKER', firmName: 'Not created' })
      .expect(403);
    const invitation = await request(app.getHttpServer())
      .post('/api/admin/broker-invites')
      .set(headers(admin))
      .send({ email: `invite.${uid}@e2e.test`, maxUses: 1 })
      .expect(201);
    expect(new Date(invitation.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const input = {
      name: 'Invited fixture',
      firmName: `Invited ${uid}`,
      email: `invite.${uid}@e2e.test`,
      password: 'Fixture@12345',
      accountType: 'BROKER',
      inviteCode: invitation.body.code,
    };
    const joined = await request(app.getHttpServer()).post('/api/auth/register').send(input).expect(201);
    expect(joined.body.user.role).toBe('BROKER_ADMIN');
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...input, email: `other.${uid}@e2e.test` })
      .expect(400);
    const expired = await request(app.getHttpServer())
      .post('/api/admin/broker-invites')
      .set(headers(admin))
      .send({ expiresAt: new Date(Date.now() - 60000).toISOString() })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...input, email: `expired.${uid}@e2e.test`, inviteCode: expired.body.code })
      .expect(400);
  });
  it('uses current membership rather than stale JWT claims', async () => {
    await prisma.user.updateMany({ where: { organizationId: orgId }, data: { organizationId: null } });
    await request(app.getHttpServer()).get('/api/inventory').set(headers(broker)).expect(403);
    await prisma.user.updateMany({ where: { email: `broker.${uid}@e2e.test` }, data: { organizationId: orgId, status: 'SUSPENDED' } });
    await request(app.getHttpServer()).get('/api/inventory').set(headers(broker)).expect(401);
  });
});
