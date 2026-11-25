import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import type { Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SettingsService } from '../src/core/settings/settings.service';
import { MailService } from '../src/core/mail/mail.service';
import { sha256 } from '../src/common/utils';
import * as environment from '../src/config/env';
import type { AppConfig, LoginOtpChallenge } from '@brokeriq/shared';

/** Real guards/transactions/session rows; local-only delivery unless a provider is explicitly stubbed below. */
describe('Password/Google/signup followed by an account-bound email factor', () => {
  let app: INestApplication, db: PrismaService, settings: SettingsService, auth: AuthService, previous: AppConfig;
  const password = 'IsolatedFactor123!';
  const ua = { 'User-Agent': 'BrokerIQ isolated factor client' };
  const actor = async (role: Role = 'USER') => {
    const org = ['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT', 'PROPERTY_OWNER'].includes(role)
      ? await db.organization.create({ data: { name: 'Isolated factor firm', slug: 'factor-' + Date.now() + Math.random().toString(36).slice(2) } })
      : null;
    return db.user.create({
      data: {
        name: 'Isolated factor user',
        email: `factor.${Date.now()}.${Math.random()}@e2e.test`,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        organizationId: org?.id,
      },
      include: { organization: true },
    });
  };
  const login = (email: string) => request(app.getHttpServer()).post('/api/auth/login').set(ua).send({ email, password });
  const begin = async (email: string) => {
    const result = await login(email).expect(428);
    expect(result.body.code).toBe('LOGIN_OTP_REQUIRED');
    return result.body.details as LoginOtpChallenge;
  };
  const verify = (challenge: LoginOtpChallenge, code = challenge.devCode!) =>
    request(app.getHttpServer()).post('/api/auth/login/otp/verify').set(ua).send({ challenge: challenge.challenge, code, factor: 'EMAIL' });

  beforeEach(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    settings = app.get(SettingsService);
    auth = app.get(AuthService);
    previous = await settings.getAppConfig();
    await settings.updateAppConfig({ auth: { ...previous.auth, requireLoginEmailOtp: true, allowPasswordLogin: true, allowGoogle: true } });
  });
  afterEach(async () => {
    if (settings && previous) await settings.updateAppConfig(previous);
    jest.restoreAllMocks();
    await app?.close();
  });

  it('requires OTP for staff and regular users, and a factor challenge cannot access a protected API', async () => {
    for (const role of ['SUPER_ADMIN', 'BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT', 'USER'] as Role[]) {
      const user = await actor(role);
      await request(app.getHttpServer()).post('/api/auth/login').set(ua).send({ email: user.email, password: 'Wrong password' }).expect(401);
      const challenge = await begin(user.email);
      expect(challenge.destination).not.toBe(user.email);
      expect(challenge.requiredFactors).toEqual(['EMAIL']);
      expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
      await request(app.getHttpServer()).get('/api/auth/me').auth(challenge.challenge, { type: 'bearer' }).expect(401);
      const response = await verify(challenge).expect(200);
      expect(response.body.user.role).toBe(role);
      expect(response.body.user.emailVerified).toBe(true);
      await verify(challenge).expect(401);
      expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(1);
    }
  });

  it('lets a verified Property Owner sign in above five sessions without a second email code', async () => {
    const owner = await actor('PROPERTY_OWNER');
    await begin(owner.email);
    await db.user.update({ where: { id: owner.id }, data: { emailVerified: true } });
    await request(app.getHttpServer()).post('/api/auth/login').set(ua).send({ email: owner.email, password: 'Wrong password' }).expect(401);
    for (let i = 0; i < 6; i++) {
      const result = await login(owner.email).expect(200);
      expect(result.body.user.role).toBe('PROPERTY_OWNER');
      await request(app.getHttpServer()).get('/api/owner/properties').auth(result.body.accessToken, { type: 'bearer' }).expect(200);
      await request(app.getHttpServer()).get('/api/inventory').auth(result.body.accessToken, { type: 'bearer' }).expect(403);
    }
    expect(await db.refreshToken.count({ where: { userId: owner.id, revokedAt: null } })).toBe(6);
    expect(await db.loginVerification.count({ where: { userId: owner.id } })).toBe(1);
    await db.user.update({ where: { id: owner.id }, data: { status: 'SUSPENDED' } });
    await login(owner.email).expect(403);
  });

  it('persists five failed attempts under concurrency and does not reset attempts on resend', async () => {
    const user = await actor(),
      challenge = await begin(user.email);
    const wrong = challenge.devCode === '111111' ? '222222' : '111111';
    const results = await Promise.all(Array.from({ length: 5 }, () => verify(challenge, wrong)));
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    const row = await db.loginVerification.findUniqueOrThrow({ where: { tokenHash: sha256(challenge.challenge) } });
    expect(row.attempts).toBe(5);
    await verify(challenge).expect(401);
    await db.loginVerification.update({ where: { id: row.id }, data: { resendAt: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).post('/api/auth/login/otp/resend').set(ua).send({ challenge: challenge.challenge }).expect(401);
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects another client, expiry and changed credentials; concurrent success issues one session', async () => {
    const user = await actor(),
      challenge = await begin(user.email);
    await request(app.getHttpServer())
      .post('/api/auth/login/otp/verify')
      .set('User-Agent', 'Different client')
      .send({ challenge: challenge.challenge, code: challenge.devCode })
      .expect(401);
    const results = await Promise.all([verify(challenge), verify(challenge)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const expired = await begin(user.email);
    await db.loginVerification.update({ where: { tokenHash: sha256(expired.challenge) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await verify(expired).expect(401);
    const revoked = await begin(user.email);
    await auth.revokeAll(user.id);
    await verify(revoked).expect(401);
    const changed = await begin(user.email);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash('Changed isolated password', 10) } });
    await verify(changed).expect(401);
  });

  it('requires OTP above five sessions and preserves the existing sessions', async () => {
    const user = await actor();
    const sessions = await Promise.all(Array.from({ length: 6 }, () => auth.issue(user)));
    const legacySelection = app.get(JwtService).sign(
      { sub: user.id, purpose: 'replace-device-session', sessionVersion: user.sessionVersion, nonce: user.id, emailOtpVerified: false },
      { secret: environment.env().JWT_REFRESH_SECRET, expiresIn: '5m' },
    );
    const firstSession = await db.refreshToken.findFirstOrThrow({ where: { userId: user.id } });
    await request(app.getHttpServer()).post('/api/auth/sessions/replace').set(ua).send({ challenge: legacySelection, sessionId: firstSession.id }).expect(401);
    const challenge = await begin(user.email);
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(6);
    const newSession = await verify(challenge).expect(200);
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(7);
    await request(app.getHttpServer()).get('/api/auth/me').auth(newSession.body.accessToken, { type: 'bearer' }).expect(200);
    for (const session of sessions)
      await request(app.getHttpServer()).get('/api/auth/me').auth(session.accessToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken: sessions[0].refreshToken }).expect(200);
  });

  it('bounds new factor challenges without rejecting the sixth first-factor attempt', async () => {
    const user = await actor();
    const meta = { userAgent: ua['User-Agent'] };
    for (let i = 0; i < 10; i++) await expect(auth.login(user.email, password, meta)).rejects.toMatchObject({ status: 428 });
    await expect(auth.login(user.email, password, meta)).rejects.toMatchObject({ status: 429 });
    expect(await db.loginVerification.count({ where: { userId: user.id } })).toBe(10);
  });

  it('blocks passwordless/verification-code bypass and requires tested mail before enabling production policy', async () => {
    const user = await actor();
    await request(app.getHttpServer()).post('/api/auth/otp/request').send({ email: user.email, purpose: 'LOGIN' }).expect(403);
    await request(app.getHttpServer()).post('/api/auth/otp/verify').send({ email: user.email, code: '123456' }).expect(403);
    const admin = await actor('SUPER_ADMIN'),
      session = await auth.issue(admin);
    await settings.updateAppConfig({ auth: { ...previous.auth, requireLoginEmailOtp: false } });
    await request(app.getHttpServer())
      .patch('/api/admin/app-config')
      .auth(session.accessToken, { type: 'bearer' })
      .send({ auth: { requireLoginEmailOtp: true } })
      .expect(400);
    await settings.updateAppConfig({ auth: { ...previous.auth, requireLoginEmailOtp: true } });
  });

  it('resend obeys cooldown, invalidates the old code and preserves original expiry', async () => {
    const user = await actor(),
      challenge = await begin(user.email);
    await request(app.getHttpServer()).post('/api/auth/login/otp/resend').set(ua).send({ challenge: challenge.challenge }).expect(429);
    await db.loginVerification.update({ where: { tokenHash: sha256(challenge.challenge) }, data: { resendAt: new Date(Date.now() - 1000) } });
    const resend = await request(app.getHttpServer()).post('/api/auth/login/otp/resend').set(ua).send({ challenge: challenge.challenge }).expect(200);
    expect(resend.body.expiresAt).toBe(challenge.expiresAt);
    await verify(challenge).expect(401);
    await verify(resend.body).expect(200);
  });

  it('provider failure invalidates the challenge; production never returns a local development code', async () => {
    const user = await actor(),
      mail = app.get(MailService);
    const cfg = jest.spyOn(mail, 'isConfigured').mockResolvedValue(true);
    const send = jest.spyOn(mail, 'sendTemplate').mockRejectedValue(new Error('Isolated provider outage'));
    const failed = await login(user.email);
    expect(failed.status).toBe(500);
    expect(failed.body.details?.devCode).toBeUndefined();
    expect(await db.loginVerification.count({ where: { userId: user.id, consumedAt: null } })).toBe(0);
    send.mockRestore();
    cfg.mockRestore();
    const env = jest.spyOn(environment, 'env').mockReturnValue({ ...environment.env(), NODE_ENV: 'production' });
    try {
      const missing = await login(user.email);
      expect(missing.status).toBe(424);
      expect(missing.body.code).toBe('INTEGRATION_NOT_CONFIGURED');
      expect(missing.body.details?.devCode).toBeUndefined();
    } finally {
      env.mockRestore();
    }
  });

  it('new signup and verified Google first factor also require email OTP; signup cannot mint tokens directly', async () => {
    const email = `factor.signup.${Date.now()}@e2e.test`;
    const signup = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(ua)
      .send({ name: 'Isolated signup factor', email, password, accountType: 'USER' })
      .expect(428);
    const created = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await db.refreshToken.count({ where: { userId: created.id } })).toBe(0);
    await verify(signup.body.details).expect(200);
    const user = await actor();
    const requireIntegration = settings.require.bind(settings);
    jest
      .spyOn(settings, 'require')
      .mockImplementation((key, orgId) =>
        key === 'google_oauth' ? Promise.resolve({ webClientId: 'isolated-google-client' }) : requireIntegration(key, orgId),
      );
    jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockResolvedValue({ getPayload: () => ({ sub: `isolated-google-${user.id}`, email: user.email, email_verified: true }) } as never);
    const google = await request(app.getHttpServer()).post('/api/auth/google').set(ua).send({ idToken: 'isolated-token-for-stubbed-provider' }).expect(428);
    expect(google.body.code).toBe('LOGIN_OTP_REQUIRED');
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
    await verify(google.body.details).expect(200);
    const owner = await actor('PROPERTY_OWNER');
    await db.user.update({ where: { id: owner.id }, data: { emailVerified: true } });
    jest
      .mocked(OAuth2Client.prototype.verifyIdToken)
      .mockResolvedValue({ getPayload: () => ({ sub: `owner-google-${owner.id}`, email: owner.email, email_verified: true }) } as never);
    const ownerGoogle = await request(app.getHttpServer()).post('/api/auth/google').set(ua).send({ idToken: 'isolated-owner-token' }).expect(200);
    expect(ownerGoogle.body.user.role).toBe('PROPERTY_OWNER');
    expect(await db.loginVerification.count({ where: { userId: owner.id } })).toBe(0);
  });
});
