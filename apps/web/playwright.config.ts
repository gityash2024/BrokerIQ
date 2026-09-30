import { defineConfig } from '@playwright/test';

/**
 * Website smoke tests (real API + real Next.js). Uses the installed Google Chrome — no browser download.
 * Local: `pnpm --filter @brokeriq/web e2e` (starts its own API on :3099 and website on :3311).
 */
// Own ports so a developer's running servers (3000/3001) are never reused or disturbed.
const API_PORT = 3099;
const WEB_PORT = 3311;
const API = process.env.E2E_API_URL ?? `http://localhost:${API_PORT}`;
const WEB = process.env.E2E_WEB_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: WEB, channel: 'chrome', headless: true, locale: 'en-IN' },
  webServer: [
    {
      command: `PORT=${API_PORT} CORS_ORIGINS=${WEB} PUBLIC_WEB_URL=${WEB} pnpm --filter @brokeriq/api exec nest start`,
      url: `${API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      cwd: '../..',
    },
    {
      command: `NEXT_PUBLIC_API_URL=${API} API_INTERNAL_URL=${API} pnpm exec next dev -p ${WEB_PORT}`,
      url: WEB,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
