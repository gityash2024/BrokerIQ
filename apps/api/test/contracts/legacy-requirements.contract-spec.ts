/** Historical simulator checks, deliberately separate from real NestJS/PostgreSQL acceptance. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('Legacy simulator self-tests (NOT application or release acceptance)', () => {
  jest.setTimeout(60000);

  it('runs the explicitly labelled simulator suite', () => {
    const rootDir = path.resolve(__dirname, '../../../..');
    const runnerScript = path.join(rootDir, 'test/e2e/run-all.ts');

    const result = spawnSync('pnpm', ['exec', 'tsx', runnerScript], {
      cwd: rootDir,
      encoding: 'utf-8',
      env: { ...process.env, E2E_USE_SIMULATOR: 'true', E2E_API_URL: '' },
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Contract simulation suites passed; real API/device acceptance remains required.');
  });
});
