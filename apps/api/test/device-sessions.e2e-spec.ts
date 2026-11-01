import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { RealtimeGateway } from '../src/core/realtime/realtime.gateway';
import { sha256 } from '../src/common/utils';

/** Authenticated real database flows; isolated local test database only. */
describe('Stable device sessions and explicit replacement', () => {
  let app: INestApplication;
  let db: PrismaService;
  let auth: AuthService;
  let user: any;
  let sessions: any[];
  let challenge: string;
  let replacement: any;
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sid = (token: string) => (app.get(JwtService).decode(token) as any).sid;
  const activeCount = (userId: string) => db.refreshToken.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } });
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication(); configureApp(app); await app.init();
    db = app.get(PrismaService); auth = app.get(AuthService);
    user = await db.user.create({ data: { email: 'sessions.' + uid + '@e2e.test', name: 'Isolated session fixture', role: 'USER' }, include: { organization: true } });
    sessions = [];
    for (let i = 0; i < 5; i++) sessions.push(await auth.issue(user, { userAgent: 'Device ' + i }));
  });
  afterAll(async () => { await app?.close(); });

  it('the sixth login returns a short-lived selection and keeps all five sessions alive', async () => {
    try { await auth.issue(user); throw new Error('Expected session challenge'); }
    catch (error: any) {
      const body = error.getResponse();
      expect(body.code).toBe('SESSION_LIMIT_REACHED');
      expect(body.details.sessions).toHaveLength(5);
      expect(body.details.sessions[0].tokenHash).toBeUndefined();
      challenge = body.details.challenge;
    }
    expect(await activeCount(user.id)).toBe(5);
    for (const session of sessions) await request(app.getHttpServer()).get('/api/auth/me').auth(session.accessToken, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).get('/api/auth/me').auth(challenge, { type: 'bearer' }).expect(401);
  });

  it('only an owned active device can be selected; invalid selection never evicts another device', async () => {
    await request(app.getHttpServer()).post('/api/auth/sessions/replace').send({ challenge, sessionId: 'foreign-session' }).expect(409);
    expect(await activeCount(user.id)).toBe(5);
    const result = await request(app.getHttpServer()).post('/api/auth/sessions/replace').send({ challenge, sessionId: sid(sessions[0].accessToken) }).expect(200);
    replacement = result.body;
    expect(await activeCount(user.id)).toBe(5);
    await request(app.getHttpServer()).get('/api/auth/me').auth(sessions[0].accessToken, { type: 'bearer' }).expect(401);
    for (const session of sessions.slice(1)) await request(app.getHttpServer()).get('/api/auth/me').auth(session.accessToken, { type: 'bearer' }).expect(200);
    const retry = await request(app.getHttpServer()).post('/api/auth/sessions/replace').send({ challenge, sessionId: sid(sessions[1].accessToken) }).expect(200);
    expect(retry.body.refreshToken).toBe(replacement.refreshToken);
    expect(await activeCount(user.id)).toBe(5);
  });

  it('concurrent refresh keeps one stable device row and returns the same rotation', async () => {
    const before = await db.refreshToken.findUniqueOrThrow({ where: { id: sid(replacement.accessToken) } });
    const results = await Promise.all([auth.refresh(replacement.refreshToken, {}), auth.refresh(replacement.refreshToken, {})]);
    expect(results[0].refreshToken).toBe(results[1].refreshToken);
    expect(sid(results[0].accessToken)).toBe(before.id);
    expect(await activeCount(user.id)).toBe(5);
    const after = await db.refreshToken.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(after.rotationResponse).toMatch(/^v1:/);
    expect(after.rotationResponse).not.toContain(results[0].refreshToken);
    await db.refreshToken.update({ where: { id: before.id }, data: { rotationExpiresAt: new Date(Date.now() - 1000) } });
    await expect(auth.refresh(replacement.refreshToken, {})).rejects.toMatchObject({ status: 401 });
    replacement = results[0];
  });

  it('individual revocation denies access, refresh and realtime without revoking other devices', async () => {
    await auth.revokeSession(user.id, sid(replacement.accessToken));
    await request(app.getHttpServer()).get('/api/auth/me').auth(replacement.accessToken, { type: 'bearer' }).expect(401);
    await expect(auth.refresh(replacement.refreshToken, {})).rejects.toMatchObject({ status: 401 });
    const socket = { handshake: { auth: { token: replacement.accessToken }, headers: {} }, data: {}, on: jest.fn(), join: jest.fn(), disconnect: jest.fn() };
    await app.get(RealtimeGateway).handleConnection(socket as any);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
    await request(app.getHttpServer()).get('/api/auth/me').auth(sessions[1].accessToken, { type: 'bearer' }).expect(200);
  });

  it('concurrent logins cannot exceed five devices', async () => {
    const outcomes = await Promise.allSettled([auth.issue(user), auth.issue(user)]);
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await activeCount(user.id)).toBe(5);
  });

  it('upgrades a legacy refresh row without creating an extra device or requiring password login', async () => {
    const legacyUser = await db.user.create({ data: { email: 'legacy.' + uid + '@e2e.test', name: 'Legacy fixture', role: 'USER' }, include: { organization: true } });
    const token = 'legacy-test-refresh-' + uid;
    const row = await db.refreshToken.create({ data: { userId: legacyUser.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 86400_000) } });
    const upgraded = await auth.refresh(token, {});
    expect(sid(upgraded.accessToken)).toBe(row.id);
    expect(await activeCount(legacyUser.id)).toBe(1);
    await request(app.getHttpServer()).get('/api/auth/me').auth(upgraded.accessToken, { type: 'bearer' }).expect(200);
    await auth.revokeSession(user.id, row.id);
    await request(app.getHttpServer()).get('/api/auth/me').auth(upgraded.accessToken, { type: 'bearer' }).expect(200);
  });
});
