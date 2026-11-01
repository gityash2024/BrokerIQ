import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { MailService } from '../src/core/mail/mail.service';
import { ZohoMailService } from '../src/core/mail/zoho-mail.service';

describe('Email provider settings, OAuth secrecy and roles (PostgreSQL; provider stubbed)', () => {
  let app: INestApplication, db: PrismaService, token: string, broker: string, prior: any[], zoho: ZohoMailService;
  const keys = ['integration.zoho_mail', 'email.provider'];
  const uid = Date.now().toString(36);
  const h = (actor = token) => ({ Authorization: 'Bearer ' + actor });
  const req = () => request(app.getHttpServer());
  const fields = { region: 'IN', clientId: 'test-client-id', clientSecret: 'fixture-only-client-secret', fromEmail: 'hello@e2e.test' };
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(PrismaService);
    zoho = app.get(ZohoMailService);
    prior = await db.systemSetting.findMany({ where: { key: { in: keys } } });
    await db.systemSetting.deleteMany({ where: { key: { in: keys } } });
    const admin = await db.user.create({
      data: { name: 'Email test admin', email: 'email-admin' + uid + '@e2e.test', role: 'SUPER_ADMIN' },
      include: { organization: true },
    });
    token = (await app.get(AuthService).issue(admin)).accessToken;
    const org = await db.organization.create({ data: { name: 'Email fixture firm', slug: 'email-fixture-' + uid, restrictions: [] } });
    const user = await db.user.create({
      data: { name: 'Email test broker', email: 'email-broker' + uid + '@e2e.test', role: 'BROKER_ADMIN', organizationId: org.id },
      include: { organization: true },
    });
    broker = (await app.get(AuthService).issue(user)).accessToken;
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await db.systemSetting.deleteMany({ where: { key: { in: keys } } });
    for (const row of prior) await db.systemSetting.create({ data: row });
    await app?.close();
  });
  it('allows partial OAuth setup encrypted without reporting a connected provider', async () => {
    const saved = await req().patch('/api/admin/integrations/zoho_mail').set(h()).send({ enabled: true, fields }).expect(200);
    expect(saved.body.configured).toBe(false);
    expect(JSON.stringify(saved.body)).not.toContain(fields.clientSecret);
    expect(saved.body.lastTestOk).toBeNull();
    const row = await db.systemSetting.findUniqueOrThrow({ where: { key: 'integration.zoho_mail' } });
    expect((row.value as any).fields.clientSecret.enc).toMatch(/^v1:/);
    await req().patch('/api/admin/email-delivery').set(h()).send({ provider: 'zoho_mail' }).expect(400);
  });
  it('stores only the generated refresh token encrypted and returns masked state', async () => {
    jest.spyOn(zoho, 'authorize').mockResolvedValueOnce('fixture-only-generated-refresh');
    const authorized = await req().post('/api/admin/integrations/zoho_mail/authorize').set(h()).send({ code: 'fixture-short-lived-code' }).expect(201);
    expect(authorized.body.configured).toBe(true);
    expect(JSON.stringify(authorized.body)).not.toContain('fixture-only-generated-refresh');
    const row = await db.systemSetting.findUniqueOrThrow({ where: { key: 'integration.zoho_mail' } });
    expect((row.value as any).fields.refreshToken.enc).toMatch(/^v1:/);
    expect(JSON.stringify(row.value)).not.toContain('fixture-short-lived-code');
  });
  it('requires a successful provider test, selects explicitly and invalidates stale tests on edit', async () => {
    await req().patch('/api/admin/email-delivery').set(h()).send({ provider: 'zoho_mail' }).expect(400);
    jest.spyOn(zoho, 'send').mockResolvedValue({ accepted: true, messageId: 'fixture-only' });
    const tested = await req().post('/api/admin/integrations/zoho_mail/test').set(h()).send({}).expect(201);
    expect(tested.body.ok).toBe(true);
    const selected = await req().patch('/api/admin/email-delivery').set(h()).send({ provider: 'zoho_mail' }).expect(200);
    expect(selected.body.provider).toBe('zoho_mail');
    expect(await app.get(MailService).provider()).toBe('zoho_mail');
    await req().patch('/api/admin/integrations/zoho_mail').set(h()).send({ enabled: true, fields }).expect(200);
    const state = await req().get('/api/admin/integrations/zoho_mail').set(h()).expect(200);
    expect(state.body.state.lastTestOk).toBeNull();
  });
  it('denies broker roles platform credentials, authorization and provider switching', async () => {
    await req().get('/api/admin/email-delivery').set(h(broker)).expect(403);
    await req().patch('/api/admin/integrations/zoho_mail').set(h(broker)).send({ fields }).expect(403);
    await req().post('/api/admin/integrations/zoho_mail/authorize').set(h(broker)).send({ code: 'never-used' }).expect(403);
    await req().patch('/api/admin/email-delivery').set(h(broker)).send({ provider: 'zoho_mail' }).expect(403);
  });
});
