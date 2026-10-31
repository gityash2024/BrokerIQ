/**
 * Requirements E2E Integration Suite for Jest / NestJS runner
 * Connects the 4-Tier requirement-driven test suite into apps/api/test.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('BrokerIQ 4-Tier Requirements Verification (E2E)', () => {
  jest.setTimeout(60000);

  it('passes all 4 tiers of requirement-driven E2E tests (R1-R4)', () => {
    const rootDir = path.resolve(__dirname, '../../../..');
    const runnerScript = path.join(rootDir, 'test/e2e/run-all.ts');

    const result = spawnSync('npx', ['tsx', runnerScript], {
      cwd: rootDir,
      encoding: 'utf-8',
      env: process.env,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('All 4-tier requirement E2E test suites passed successfully!');
  });
});
