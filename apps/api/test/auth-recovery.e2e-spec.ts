import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { sha256 } from '../src/common/utils';
import { RealtimeGateway } from '../src/core/realtime/realtime.gateway';
import { JwtService } from '@nestjs/jwt';

// OTPs are inserted only into the explicitly selected isolated fixture database.
// No SMTP provider or external recipient is involved in recovery verification.
describe('Password recovery and one-time OTP consumption', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let userId: string;
  let refreshToken: string;
  let accessToken: string;
  const email = `recovery.${Date.now()}@e2e.test`;
  const initial = 'Initial@12345';
  const replacement = 'Replacement@12345';
  const otp = (code: string, purpose = 'RESET_PASSWORD', expiresAt = new Date(Date.now() + 60000)) =>
    prisma.otpCode.create({ data: { email, purpose, codeHash: sha256(`${email}:${code}`), expiresAt } });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    const org = await prisma.organization.create({ data: { name: 'Recovery fixture', slug: `recovery-${Date.now()}` } });
    const user = await prisma.user.create({
      data: { name: 'Recovery fixture', email, role: 'BROKER_ADMIN', organizationId: org.id, passwordHash: await bcrypt.hash(initial, 12) },
    });
    userId = user.id;
    const login = await auth.login(email, initial, {});
    refreshToken = login.refreshToken;
    accessToken = login.accessToken;
  });
  afterAll(async () => { await app.close(); });

  it('allows only one reset when both requests read the same unused OTP', async () => {
    await otp('123456');
    // Synchronize the reads to reproduce the race instead of depending on timing.
    const original = prisma.otpCode.findFirst.bind(prisma.otpCode);
    let arrived = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    const synchronizedRead = async (args: any) => {
      const row = await original(args);
      if (args.where.email === email && args.where.purpose.in.includes('RESET_PASSWORD')) {
        if (++arrived === 2) release();
        await bothRead;
      }
      return row as any;
    };
    // This test wrapper is await-only; Prisma's generated method also exposes
    // relation chaining, which recovery never uses.
    const spy = jest.spyOn(prisma.otpCode, 'findFirst').mockImplementation(synchronizedRead as typeof prisma.otpCode.findFirst);
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([
        auth.resetPassword(email, '123456', replacement),
        auth.resetPassword(email, '123456', replacement),
      ]);
    } finally { spy.mockRestore(); }
    expect(results!.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results!.filter((x) => x.status === 'rejected')).toHaveLength(1);
    await expect(auth.login(email, initial, {})).rejects.toMatchObject({ status: 401 });
    expect((await auth.login(email, replacement, {})).user.id).toBe(userId);
    await expect(auth.refresh(refreshToken, {})).rejects.toMatchObject({ status: 401 });
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    const current = await auth.login(email, replacement, {});
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${current.accessToken}`).expect(200);
    // A refresh issued after an in-flight reset using an older user snapshot
    // remains invalid even if it was inserted after the reset's revoke query.
    const staleToken = `stale-refresh-${userId}`;
    const stale = await prisma.refreshToken.create({ data: { userId, tokenHash: sha256(staleToken), sessionVersion: 0, expiresAt: new Date(Date.now() + 60000) } });
    await expect(auth.refresh(staleToken, {})).rejects.toMatchObject({ status: 401 });
    expect(stale.sessionVersion).toBeLessThan((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).sessionVersion);
    await expect(auth.resetPassword(email, '123456', initial)).rejects.toMatchObject({ status: 401 });
    expect(await prisma.auditLog.count({ where: { entityId: userId, action: 'auth.password_reset' } })).toBe(1);
  });

  it('rejects wrong-purpose, expired and exhausted codes and caps concurrent failures', async () => {
    await otp('234567', 'LOGIN');
    await request(app.getHttpServer()).post('/api/auth/password/reset').send({ email, code: '234567', password: replacement }).expect(401);
    await otp('345678', 'RESET_PASSWORD', new Date(Date.now() - 1000));
    await expect(auth.resetPassword(email, '345678', initial)).rejects.toMatchObject({ status: 401 });
    const row = await otp('456789');
    await Promise.allSettled(Array.from({ length: 8 }, () => auth.resetPassword(email, '000000', initial)));
    expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(5);
    await expect(auth.resetPassword(email, '456789', initial)).rejects.toMatchObject({ status: 401 });
    expect((await auth.login(email, replacement, {})).user.id).toBe(userId);
  });

  it('rejects old socket sessions and joins only the current organization and role', async () => {
    const gateway = app.get(RealtimeGateway);
    const socket = (token: string) => ({ handshake: { auth: { token }, headers: {} }, data: {}, join: jest.fn(), disconnect: jest.fn() });
    const old = socket(accessToken);
    await gateway.handleConnection(old as any);
    expect(old.disconnect).toHaveBeenCalledWith(true);
    expect(old.join).not.toHaveBeenCalled();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const staleClaims = app.get(JwtService).sign({ sub: userId, role: 'SUPER_ADMIN', orgId: 'another-fixture-firm', sessionVersion: user.sessionVersion });
    const current = socket(staleClaims);
    await gateway.handleConnection(current as any);
    expect(current.join).toHaveBeenCalledWith(`org:${user.organizationId}`);
    expect(current.join).not.toHaveBeenCalledWith('org:another-fixture-firm');
    expect(current.join).not.toHaveBeenCalledWith('admins');
    expect(current.disconnect).not.toHaveBeenCalled();
  });
});
