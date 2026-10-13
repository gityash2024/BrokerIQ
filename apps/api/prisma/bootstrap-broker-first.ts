import { PrismaClient } from '@prisma/client';
import { DEFAULT_APP_CONFIG, defaultModulePolicies } from '@brokeriq/shared';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  if (!/^brokeriq_(b2b|release_test)/.test(database)) throw new Error('Bootstrap requires a fresh BrokerIQ B2B/test database');
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  const brokerEmail = process.env.BOOTSTRAP_BROKER_EMAIL?.toLowerCase();
  if (!adminEmail || !brokerEmail) throw new Error('Bootstrap account emails required');
  const hash = async (prefix: string) => {
    const supplied = process.env[`${prefix}_PASSWORD_HASH`];
    if (supplied && /^\$2[aby]\$12\$/.test(supplied)) return supplied;
    const password = process.env[`${prefix}_PASSWORD`];
    if (!password || password.length < 8) throw new Error(`${prefix} password required`);
    return bcrypt.hash(password, 12);
  };
  const [adminHash, brokerHash] = await Promise.all([hash('BOOTSTRAP_ADMIN'), hash('BOOTSTRAP_BROKER')]);
  await prisma.$transaction(async (tx) => {
    const unexpected = await tx.user.count({ where: { email: { notIn: [adminEmail, brokerEmail] } } });
    if (unexpected) throw new Error('Bootstrap refuses to reset an existing business database');
    await tx.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: 'Yash', role: 'SUPER_ADMIN', emailVerified: true, passwordHash: adminHash },
      update: {},
    });
    const firm = await tx.organization.upsert({
      where: { slug: 'olive-state' },
      create: { name: 'Olive State', slug: 'olive-state', email: brokerEmail, onboarded: true, weeklyReport: false },
      update: {},
    });
    await tx.user.upsert({
      where: { email: brokerEmail },
      create: { email: brokerEmail, name: 'Rahul Upadhyay', role: 'BROKER_ADMIN', emailVerified: true, organizationId: firm.id, passwordHash: brokerHash },
      update: {},
    });
    const plan = await tx.plan.findFirst({ where: { priceMonthly: 0, isActive: true }, orderBy: { sortOrder: 'asc' } });
    if (plan)
      await tx.subscription.upsert({ where: { organizationId: firm.id }, create: { organizationId: firm.id, planId: plan.id, status: 'ACTIVE' }, update: {} });
    const app = {
      ...DEFAULT_APP_CONFIG,
      tagline: 'Your property business, organized',
      siteUrl: process.env.PUBLIC_WEB_URL ?? '',
      auth: { ...DEFAULT_APP_CONFIG.auth, allowBrokerSignup: false, allowGoogle: false, allowEmailOtp: false, allowPasswordLogin: true },
      brokerReferrals: { ...DEFAULT_APP_CONFIG.brokerReferrals, enabled: false },
      seo: {
        ...DEFAULT_APP_CONFIG.seo,
        defaultTitle: 'BrokerIQ — Operating system for property brokers',
        defaultDescription: 'Organize inventory, requirements and follow-ups. A focused workspace for property brokers in Gurgaon.',
      },
    };
    for (const [key, value] of Object.entries({ 'app.config': app, 'platform.modules': defaultModulePolicies() })) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: {} });
    }
    await tx.featureFlag.upsert({ where: { key: 'sale_listings' }, create: { key: 'sale_listings', enabled: true }, update: { enabled: true } });
  });
  console.log('Broker-first bootstrap complete: two accounts, one firm, no demo inventory.');
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
