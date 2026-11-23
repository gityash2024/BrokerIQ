import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { MailService } from '../src/core/mail/mail.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { captureQaWhatsApp, qaMail, qaPhones, type QaDelivery } from './qa/otp-inbox';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { env } from '../src/config/env';
import { sha256 } from '../src/common/utils';

describe('OTP verification through isolated delivery', () => {
  let app: INestApplication;
  let db: PrismaService;
  let settings: SettingsService;
  let original: Awaited<ReturnType<SettingsService['getAppConfig']>>;
  let organizationId: string;
  let passwordHash: string;
  const delivery: QaDelivery[] = [];
  const password = 'QaPassword@2026';
  const fixture = (role: Role = 'USER', emailVerified = false) =>
    db.user.create({
      data: {
        name: 'Isolated OTP account',
        email: `${randomUUID()}@brokeriq.test`,
        role,
        passwordHash,
        emailVerified,
        organizationId: ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT', 'PROPERTY_OWNER'].includes(role) ? organizationId : null,
      },
    });

  let requestIndex = 0;
  const http = () => {
    const client = request(app.getHttpServer());
    const ip = `192.0.2.${++requestIndex}`;
    return {
      get: (path: string) => client.get(path).set('X-Forwarded-For', ip),
      post: (path: string) => client.post(path).set('X-Forwarded-For', ip),
    };
  };
  const login = (email: string) => http().post('/api/auth/login').send({ email, password });
  const verify = (challenge: string, code: string) => http().post('/api/auth/login/otp/verify').send({ challenge, code });
  function codeFor(to: string) {
    const code = delivery.filter((message) => message.to === to).at(-1)?.code;
    expect(code).toMatch(/^\d{6}$/);
    return code!;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService).useValue(qaMail((message) => delivery.push(message))).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    settings = app.get(SettingsService);
    original = await settings.getAppConfig();
    await settings.updateAppConfig({ auth: { ...original.auth, requireLoginEmailOtp: true, allowPasswordLogin: true } });
    organizationId = (await db.organization.create({ data: { name: 'Isolated OTP test firm', slug: `otp-${randomUUID()}`, onboarded: true } })).id;
    passwordHash = await bcrypt.hash(password, 10);
    captureQaWhatsApp(app.get(WhatsAppService), (message) => delivery.push(message), organizationId);
  });

  afterAll(async () => {
    if (settings && original) await settings.updateAppConfig(original);
    await app?.close();
  });

  const roles = Object.values(Role).filter((role) => !env().BROKER_FIRST || (role !== 'SUPPORT' && role !== 'MODERATOR'));
  it.each(roles)('delivers and consumes a real login code for %s', async (role) => {
    const user = await fixture(role);
    const { body } = await login(user.email).expect(428);
    expect(body.details.devCode).toBeUndefined();
    const code = codeFor(user.email);
    await verify(body.details.challenge, '1999').expect(400);
    const result = await verify(body.details.challenge, code).expect(200);
    expect(result.body.user.role).toBe(role);
    await verify(body.details.challenge, code).expect(401);
  });

  it('rejects an expired challenge and codes issued to a different account', async () => {
    const first = await fixture();
    const second = await fixture();
    const challenge1 = (await login(first.email).expect(428)).body.details.challenge;
    const initialCode = codeFor(first.email);
    let challenge2 = (await login(second.email).expect(428)).body.details.challenge;
    while (codeFor(second.email) === initialCode) {
      challenge2 = (await login(second.email).expect(428)).body.details.challenge;
    }
    await verify(challenge2, initialCode).expect(401);
    await db.loginVerification.update({
      where: { tokenHash: sha256(challenge1) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await verify(challenge1, initialCode).expect(401);
    await verify(challenge2, codeFor(second.email)).expect(200);
  });

  it('completes signup using the delivered code and preserves verified Owner sign-in', async () => {
    const email = `${randomUUID()}@brokeriq.test`;
    const { body } = await http().post('/api/auth/register').send({ name: 'QA signup', email, password }).expect(428);
    const code = codeFor(email);
    expect((await verify(body.details.challenge, code).expect(200)).body.user.role).toBe('USER');

    const owner = await fixture('PROPERTY_OWNER', true);
    const count = delivery.length;
    const { body: session } = await login(owner.email).expect(200);
    expect(delivery).toHaveLength(count);
    await http().get('/api/owner/properties').auth(session.accessToken, { type: 'bearer' }).expect(200);
    await http().get('/api/inventory').auth(session.accessToken, { type: 'bearer' }).expect(403);
  });

  it('uses privately delivered codes for recovery and work email with the existing verifier', async () => {
    const account = await fixture();
    await http().post('/api/auth/otp/request').send({ email: account.email, purpose: 'RESET_PASSWORD' }).expect(200);
    const code = codeFor(account.email);
    const reset = (otp: string) => http().post('/api/auth/password/reset').send({ email: account.email, code: otp, password: 'QaReplacement@2026' });
    await reset('1999').expect(400);
    await reset(code).expect(200);
    await reset(code).expect(401);

    const user = await fixture();
    const challenge = await login(user.email).expect(428);
    const session = await verify(challenge.body.details.challenge, codeFor(user.email)).expect(200);
    const email = `${randomUUID()}@office.test`;
    const auth = { Authorization: `Bearer ${session.body.accessToken}` };
    await http().post('/api/me/work-email').set(auth).send({ email }).expect(201);
    const verifyWork = (workCode: string) => http().post('/api/me/work-email/verify').set(auth).send({ code: workCode });
    await verifyWork('1999').expect(400);
    await verifyWork(codeFor(email)).expect(201);
    await verifyWork(codeFor(email)).expect(400);
  });

  it('verifies an invited Owner before granting access to their workspace', async () => {
    const broker = await fixture('BROKER_ADMIN');
    const loginResult = await login(broker.email).expect(428);
    const admin = (await verify(loginResult.body.details.challenge, codeFor(broker.email)).expect(200)).body;
    const email = `${randomUUID()}@brokeriq.test`;
    const invite = await http().post('/api/broker/team/invite').auth(admin.accessToken, { type: 'bearer' })
      .send({ name: 'QA invited owner', email, role: 'PROPERTY_OWNER' }).expect(201);
    const signup = await http().post('/api/auth/register').send({ name: 'QA invited owner', email, password }).expect(428);
    const user = (await verify(signup.body.details.challenge, codeFor(email)).expect(200)).body;
    await http().get('/api/owner/properties').auth(user.accessToken, { type: 'bearer' }).expect(403);
    const token = invite.body.link.split('/').at(-1);
    const accepted = await http().post(`/api/invites/${token}/accept`).auth(user.accessToken, { type: 'bearer' }).send({}).expect(201);
    expect(accepted.body.user.role).toBe('PROPERTY_OWNER');
    await http().get('/api/owner/properties').auth(accepted.body.accessToken, { type: 'bearer' }).expect(200);
  });

  it('consumes an agreement OTP captured through the local WhatsApp adapter', async () => {
    const broker = await fixture('BROKER_ADMIN');
    const loginResult = await login(broker.email).expect(428);
    const admin = (await verify(loginResult.body.details.challenge, codeFor(broker.email)).expect(200)).body;
    const agreement = await http().post('/api/agreements').auth(admin.accessToken, { type: 'bearer' }).send({
      landlordName: 'QA landlord',
      landlordPhone: qaPhones[0],
      tenantName: 'QA tenant',
      propertyAddress: 'Sector 46, Gurugram',
      rent: 30000,
      deposit: 60000,
      startDate: new Date().toISOString().slice(0, 10),
    }).expect(201);
    await http().post(`/api/agreements/${agreement.body.id}/sign`).auth(admin.accessToken, { type: 'bearer' })
      .send({ tenantEmail: 'qa-tenant@brokeriq.test' }).expect(201);
    const message = delivery.filter((item) => item.to === qaPhones[0]).at(-1);
    const token = /\/sign\/([\w-]+)/.exec(message?.body ?? '')?.[1];
    expect(token).toBeTruthy();
    const path = `/api/public/sign/${token}`;
    await http().post(path + '/otp').expect(201);
    const code = codeFor(qaPhones[0]);
    await http().post(path + '/confirm').send({ otp: '1999' }).expect(400);
    await http().post(path + '/confirm').send({ otp: code }).expect(201);
    await http().post(path + '/otp').expect(400);
  });

  it('captures fixture WhatsApp delivery and refuses recipients outside local QA', async () => {
    const whatsapp = app.get(WhatsAppService);
    const code = String(100000 + Math.floor(Math.random() * 900000));
    await whatsapp.send(organizationId, qaPhones[0], { type: 'text', text: `Confirmation OTP: ${code}` }, { ownNumberOnly: true, storedBody: 'Confirmation OTP: ******' });
    expect(codeFor(qaPhones[0])).toBe(code);
    await expect(whatsapp.send('another-firm', qaPhones[0], { type: 'text', text: 'test' }, { ownNumberOnly: true })).rejects.toMatchObject({ status: 403 });
    await expect(app.get(MailService).send({ to: 'person@example.com', subject: 'Test', html: '<p>Test</p>' })).rejects.toMatchObject({ status: 403 });
  });
});
