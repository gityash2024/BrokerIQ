// Refuse implicit .env connections: regression suites create and mutate fixture rows.
const selectedDatabase = process.env.DATABASE_URL;
if (!selectedDatabase || !/^brokeriq_(?:release_test|test)/.test(new URL(selectedDatabase).pathname.slice(1)))
  throw new Error('Tests require an explicitly selected isolated BrokerIQ test DATABASE_URL');
// Runs before test modules are imported (env() is read at module load).
process.env.E2E_UNIQ = process.env.E2E_UNIQ || Date.now().toString(36);
if (process.env.BROKER_FIRST === 'true')
  process.env.MEDIA_ROOT ||= require('node:path').join(require('node:os').tmpdir(), 'brokeriq-tests', process.env.E2E_UNIQ);
process.env.NODE_ENV = 'test';
process.env.JOBS_ENABLED = 'false';
// Legacy module regression suites run explicitly with the full historical platform.
process.env.BROKER_FIRST ??= 'false';
process.env.SUPER_ADMIN_EMAIL = `admin.${process.env.E2E_UNIQ}@e2e.test`;
process.env.SUPER_ADMIN_PASSWORD = 'Admin@12345';
