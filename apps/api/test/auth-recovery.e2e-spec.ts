import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { sha256 } from '../src/common/utils';

// OTPs are inserted only into the explicitly selected isolated fixture database.
// No SMTP provider or external recipient is involved in recovery verification.
describe('Password recovery and one-time OTP consumption', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let userId: string;
  let refreshToken: string;
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
  });
  afterAll(async () => { await app.close(); });

  it('allows only one reset when both requests read the same unused OTP', async () => {
    await otp('123456');
    // Synchronize the reads to reproduce the race instead of depending on timing.
    const original = prisma.otpCode.findFirst.bind(prisma.otpCode);
    let arrived = 0;
    let release!: () => void;
    const bothRead = new Promise<void>((resolve) => { release = resolve; });
    const spy = jest.spyOn(prisma.otpCode, 'findFirst').mockImplementation(async (args: any) => {
      const row = await original(args);
      if (args.where.email === email && args.where.purpose.in.includes('RESET_PASSWORD')) {
        if (++arrived === 2) release();
        await bothRead;
      }
      return row as any;
    });
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
});
