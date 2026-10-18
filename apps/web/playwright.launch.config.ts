import { defineConfig } from '@playwright/test';
const database = process.env.DATABASE_URL ?? '';
if (!/^brokeriq_release_test/.test(new URL(database).pathname.slice(1))) throw new Error('Launch UI tests require an isolated brokeriq_release_test database');
export default defineConfig({
  testDir: './e2e',
  testMatch: ['launch.spec.ts', 'enterprise.spec.ts', 'product-completion.spec.ts'],
  workers: 1,
  timeout: 60000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3311', channel: 'chrome', headless: true, locale: 'en-IN', trace: 'retain-on-failure' },
  webServer: [
    {
      command:
        'PORT=3099 BROKER_FIRST=true JOBS_ENABLED=true CORS_ORIGINS=http://localhost:3311 PUBLIC_WEB_URL=http://localhost:3311 SUPER_ADMIN_EMAIL=admin.web@e2e.test pnpm --filter @brokeriq/api start',
      url: 'http://localhost:3099/api/health',
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://localhost:3099 API_INTERNAL_URL=http://localhost:3099 pnpm exec next dev -p 3311',
      url: 'http://localhost:3311',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
