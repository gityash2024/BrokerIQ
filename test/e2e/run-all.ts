/**
 * Master E2E Requirement-Driven Test Suite Runner
 * Executes all 4 tiers of E2E requirement tests:
 * - Tier 1: Feature Coverage (KYC, Teams, Multi-Format Export, Time Logging, Interruption & Web)
 * - Tier 2: Boundary & Corner Cases (empty data, invalid coordinates, boundary dates, auth limits)
 * - Tier 3: Cross-Feature Combinations (pairwise multi-filters, active vs selected export, lifecycle)
 * - Tier 4: Real-World Application Scenarios (5 realistic end-to-end user workflows)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const SUITES = [
  { tier: 'Tier 1', name: 'KYC Module Filtering', file: 'tier1-feature-coverage/kyc-filtering.e2e.test.ts' },
  { tier: 'Tier 1', name: 'Teams Module Filtering', file: 'tier1-feature-coverage/teams-filtering.e2e.test.ts' },
  { tier: 'Tier 1', name: 'Multi-Format Data Export', file: 'tier1-feature-coverage/multi-format-export.e2e.test.ts' },
  { tier: 'Tier 1', name: 'Agent Time Logging & Tracking', file: 'tier1-feature-coverage/agent-time-logging.e2e.test.ts' },
  { tier: 'Tier 1', name: 'Interruption & Web Management', file: 'tier1-feature-coverage/interruption-and-web-management.e2e.test.ts' },
  { tier: 'Tier 2', name: 'Boundary & Corner Cases', file: 'tier2-boundary-corner/boundary-and-corner-cases.e2e.test.ts' },
  { tier: 'Tier 3', name: 'Cross-Feature Combinations', file: 'tier3-cross-feature/cross-feature-combinations.e2e.test.ts' },
  { tier: 'Tier 4', name: 'Real-World User Scenarios', file: 'tier4-application-scenarios/real-world-scenarios.e2e.test.ts' },
  { tier: 'Tier 5', name: 'Adversarial Coverage Hardening', file: 'tier5-adversarial-stress/tier5-adversarial.e2e.test.ts' },
];

console.log('======================================================================');
console.log('  BrokerIQ 5-Tier Requirement-Driven E2E Test Suite');
console.log('  Requirements: R1 (Filters), R2 (Export), R3 (Time Logging), R4 (Regression)');
console.log('======================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results: { suite: string; tier: string; passed: boolean; durationMs: number }[] = [];

const startTime = Date.now();

for (const suite of SUITES) {
  const filePath = path.resolve(__dirname, suite.file);
  process.stdout.write(`▶ Running [${suite.tier}] ${suite.name}... `);

  const t0 = Date.now();
  const proc = spawnSync('npx', ['tsx', '--tsconfig', 'apps/web/tsconfig.json', '--test', filePath], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf-8',
    env: process.env,
  });
  const durationMs = Date.now() - t0;

  if (proc.status === 0) {
    console.log(`✅ PASSED (${durationMs}ms)`);
    totalPassed++;
    results.push({ suite: suite.name, tier: suite.tier, passed: true, durationMs });
  } else {
    console.log(`❌ FAILED (${durationMs}ms)`);
    console.error(proc.stdout);
    console.error(proc.stderr);
    totalFailed++;
    results.push({ suite: suite.name, tier: suite.tier, passed: false, durationMs });
  }
}

const totalDuration = Date.now() - startTime;

console.log('\n======================================================================');
console.log('  Test Execution Summary');
console.log('======================================================================');
for (const r of results) {
  const mark = r.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${mark} [${r.tier}] ${r.suite.padEnd(35)} (${r.durationMs}ms)`);
}
console.log('----------------------------------------------------------------------');
console.log(`  Suites:  ${totalPassed} passed, ${totalFailed} failed, ${SUITES.length} total`);
console.log(`  Time:    ${(totalDuration / 1000).toFixed(2)}s`);
console.log('======================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All 4-tier requirement E2E test suites passed successfully!\n');
  process.exit(0);
}
