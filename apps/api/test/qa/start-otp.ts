import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Test } from '@nestjs/testing';
import { delegableModules, defaultModulePolicies } from '@brokeriq/shared';
import { MailService } from '../../src/core/mail/mail.service';
import { captureQaWhatsApp, qaMail, qaPhones, type QaDelivery } from './otp-inbox';

async function main() {
  process.umask(0o077);
  const suffix = randomBytes(6).toString('hex');
  const database = `brokeriq_test_otp_${suffix}`;
  const pgUser = userInfo().username;
  const pgHost = '127.0.0.1';
  const filePrefix = mkdtempSync(join(tmpdir(), 'brokeriq-otp-qa-'));
  const inbox = join(filePrefix, 'inbox.jsonl');
  const accountsFile = join(filePrefix, 'accounts.json');
  writeFileSync(inbox, '', { mode: 0o600, flag: 'wx' });

  // Only a new loopback database is accepted. Child processes inherit no provider credentials.
  const path = process.env.PATH;
  const home = process.env.HOME;
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, {
    PATH: path || '/usr/local/bin:/usr/bin:/bin',
    ...(home ? { HOME: home } : {}),
    NODE_ENV: 'test',
    DATABASE_URL: `postgresql://${encodeURIComponent(pgUser)}@${pgHost}:5432/${database}`,
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    ENCRYPTION_MASTER_KEY: randomBytes(32).toString('hex'),
    CORS_ORIGINS: 'http://localhost:3312,http://127.0.0.1:3312',
    PUBLIC_API_URL: 'http://127.0.0.1:3098',
    PUBLIC_WEB_URL: 'http://localhost:3312',
    MEDIA_ROOT: join(filePrefix, 'media'),
    BROKER_FIRST: 'false',
    JOBS_ENABLED: 'false',
  });
  execFileSync('createdb', ['-h', pgHost, '-p', '5432', '-U', pgUser, database], { stdio: 'inherit' });
  execFileSync('bash', ['test/setup-db.sh'], { stdio: 'inherit' });

  const [{ AppModule }, { configureApp }, { PrismaService }, { SettingsService }, { WhatsAppService }] = await Promise.all([
    import('../../src/app.module'),
    import('../../src/bootstrap'),
    import('../../src/prisma/prisma.service'),
    import('../../src/core/settings/settings.service'),
    import('../../src/modules/whatsapp/whatsapp.service'),
  ]);
  const record = (delivery: QaDelivery) => appendFileSync(inbox, JSON.stringify(delivery) + '\n', { mode: 0o600 });
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MailService).useValue(qaMail(record)).compile();
  const app = module.createNestApplication();
  configureApp(app);

  try {
    await app.init();
    const settings = app.get(SettingsService);
    const config = await settings.getAppConfig();
    await settings.updateAppConfig({ auth: { ...config.auth, requireLoginEmailOtp: true, allowPasswordLogin: true, allowGoogle: false } });
    const db = app.get(PrismaService);
    const organization = await db.organization.create({ data: { name: 'Local OTP QA', slug: 'local-otp-qa', onboarded: true } });
    const roles = Object.values(Role);
    const accounts = await Promise.all(roles.map(async (role) => {
      const email = `${role.toLowerCase().replaceAll('_', '-')}@brokeriq.test`;
      const password = 'Qa-' + randomBytes(15).toString('base64url');
      const firmMember = role.startsWith('BROKER_') || role === 'SUB_BROKER_ADMIN' || role === 'PROPERTY_OWNER';
      const delegatedPermissions = role === 'SUB_BROKER_ADMIN'
        ? delegableModules(defaultModulePolicies()).flatMap(({ key, actions }) => actions.map((action) => `${key}:${action}`))
        : [];
      await db.user.create({
        data: {
          name: `QA ${role}`,
          role,
          email,
          passwordHash: await bcrypt.hash(password, 10),
          organizationId: firmMember ? organization.id : null,
          emailVerified: role === 'PROPERTY_OWNER',
          delegatedPermissions,
        },
      });
      return { role, email, password };
    }));
    captureQaWhatsApp(app.get(WhatsAppService), record, organization.id);
    writeFileSync(accountsFile, JSON.stringify({ accounts, whatsappRecipients: qaPhones }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await app.listen(3098, pgHost);
    console.log(`Local OTP API: http://127.0.0.1:3098/api\nAccounts: ${accountsFile}\nInbox: ${inbox}\nDatabase: ${database}`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unable to start the local OTP environment');
  process.exitCode = 1;
});
