import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Website smoke tests (real API + real Next.js). Uses the installed Google Chrome — no browser download.
 * Local: `pnpm --filter @brokeriq/web e2e` (starts its own API on :3099 and website on :3311).
 */
// Own ports so a developer's running servers (3000/3001) are never reused or disturbed.
const API_PORT = 3099;
const WEB_PORT = 3311;
const API = `http://127.0.0.1:${API_PORT}`;
const WEB = `http://127.0.0.1:${WEB_PORT}`;
const testDatabase = process.env.DATABASE_URL;
if (!testDatabase) throw new Error('Set DATABASE_URL to the dedicated browser test database before running Playwright.');
const database = new URL(testDatabase);
if (
  !['postgres:', 'postgresql:'].includes(database.protocol) ||
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  !/^\/brokeriq_test_browser_[a-z0-9_]+$/.test(database.pathname)
) {
  throw new Error('Browser fixtures require a dedicated local brokeriq_test_browser_* database.');
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: WEB, channel: 'chrome', headless: true, locale: 'en-IN' },
  webServer: [
    {
      command: 'pnpm --filter @brokeriq/api exec nest start',
      env: {
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        JOBS_ENABLED: 'true',
        CORS_ORIGINS: WEB,
        PUBLIC_API_URL: API,
        PUBLIC_WEB_URL: WEB,
        MEDIA_ROOT: join(tmpdir(), 'brokeriq-browser-tests', database.pathname.slice(1)),
        SUPER_ADMIN_EMAIL: 'admin.web@e2e.test',
        SUPER_ADMIN_PASSWORD: 'Admin@12345',
      },
      url: `${API}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: '../..',
    },
    {
      command: `pnpm exec next dev -H 127.0.0.1 -p ${WEB_PORT}`,
      env: { NEXT_PUBLIC_API_URL: API, API_INTERNAL_URL: API, BROKERIQ_DISABLE_DEV_CACHE: '1' },
      url: WEB,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
