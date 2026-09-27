// tests/runner.js
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';

const args = process.argv.slice(2);
const options = {
  tier1: args.includes('--tier1') || args.includes('--all') || (!args.some(a => a.startsWith('--tier'))),
  tier2: args.includes('--tier2') || args.includes('--all') || (!args.some(a => a.startsWith('--tier'))),
  tier3: args.includes('--tier3') || args.includes('--all') || (!args.some(a => a.startsWith('--tier'))),
  tier4: args.includes('--tier4') || args.includes('--all') || (!args.some(a => a.startsWith('--tier'))),
  quiet: args.includes('--quiet'),
  help: args.includes('--help') || args.includes('-h')
};

if (options.help) {
  console.log(`
Usage: ./tests/runner.sh [options]

Options:
  --all         Run all test tiers (Default)
  --tier1       Run Tier 1 Core Feature tests only (17 modules)
  --tier2       Run Tier 2 Boundary & Adversarial tests only
  --tier3       Run Tier 3 Pairwise Interaction tests only
  --tier4       Run Tier 4 Real-World End-to-End Scenarios only
  --quiet       Minimize console output
  --help, -h    Show this help message
`);
  process.exit(0);
}

if (!options.quiet) {
  console.log(`${CYAN}${BOLD}`);
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                       BrokerIQ E2E Test Runner                             ║');
  console.log('║              Commercial Real-Estate SaaS Verification Framework            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${RESET}`);
  console.log(`${WHITE}Working Directory:${RESET} ${PROJECT_ROOT}`);
  console.log(`${WHITE}Node Version:${RESET}      ${process.version}`);
  console.log(`${WHITE}Execution Mode:${RESET}    Deterministic Contract & Endpoint Verification`);
  console.log('');
}

const suites = [];
if (options.tier1) {
  suites.push({
    name: 'TIER 1: Core Functional Features (17 Modules)',
    dir: path.join(__dirname, 'tier1_features')
  });
}
if (options.tier2) {
  suites.push({
    name: 'TIER 2: Boundary & Adversarial Integrity (17 Modules)',
    dir: path.join(__dirname, 'tier2_boundaries')
  });
}
if (options.tier3) {
  suites.push({
    name: 'TIER 3: Pairwise Cross-Module Interactions',
    dir: path.join(__dirname, 'tier3_pairwise')
  });
}
if (options.tier4) {
  suites.push({
    name: 'TIER 4: Realistic End-to-End Broker Workflows',
    dir: path.join(__dirname, 'tier4_real_world')
  });
}

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const startTime = Date.now();

for (const suite of suites) {
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${MAGENTA}${BOLD}▶ RUNNING ${suite.name}${RESET}`);
  console.log(`${BLUE}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}`);

  const files = fs
    .readdirSync(suite.dir)
    .filter(f => f.endsWith('.test.js'))
    .sort()
    .map(f => path.join(suite.dir, f));

  if (!files.length) {
    console.log(`${YELLOW}No test files found in ${suite.dir}${RESET}`);
    continue;
  }

  const res = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], {
    encoding: 'utf8',
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: 'test' }
  });

  const lines = (res.stdout || '').split('\n');
  let suitePassed = 0;
  let suiteFailed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('✔')) {
      const testName = trimmed.replace(/^✔\s*/, '');
      console.log(`  ${GREEN}✔ [PASS]${RESET} ${testName}`);
      suitePassed++;
      totalPassed++;
      totalTests++;
    } else if (trimmed.startsWith('✖') && !trimmed.includes('failing tests')) {
      const testName = trimmed.replace(/^✖\s*/, '');
      console.log(`  ${RED}✖ [FAIL]${RESET} ${testName}`);
      suiteFailed++;
      totalFailed++;
      totalTests++;
    }
  }

  if (res.status !== 0 || suiteFailed > 0) {
    console.log(`  ${RED}${BOLD}Suite encountered failures:${RESET}`);
    const errLines = ((res.stdout || '') + (res.stderr || ''))
      .split('\n')
      .filter(l => l.includes('AssertionError') || l.includes('Error:') || l.includes('failing tests:'))
      .slice(0, 10);
    errLines.forEach(l => console.log(`    ${RED}${l}${RESET}`));
  }

  console.log(`${CYAN}Subtotal:${RESET} ${GREEN}${suitePassed} passed${RESET}, ${RED}${suiteFailed} failed${RESET}\n`);
}

const durationMs = Date.now() - startTime;
const passRate = totalTests > 0 ? Math.round((totalPassed * 100) / totalTests) : 0;

console.log(`${CYAN}${BOLD}╔════════════════════════════════════════════════════════════════════════════╗${RESET}`);
console.log(`${CYAN}${BOLD}║                           E2E TEST SUMMARY REPORT                          ║${RESET}`);
console.log(`${CYAN}${BOLD}╠════════════════════════════════════════════════════════════════════════════╣${RESET}`);
console.log(`║ Total Test Cases          : ${BOLD}${String(totalTests).padEnd(46)}${RESET} ║`);
console.log(`║ Passed Tests              : ${GREEN}${BOLD}${String(totalPassed).padEnd(46)}${RESET} ║`);
if (totalFailed === 0) {
  console.log(`║ Failed Tests              : ${GREEN}${String(totalFailed).padEnd(46)}${RESET} ║`);
} else {
  console.log(`║ Failed Tests              : ${RED}${BOLD}${String(totalFailed).padEnd(46)}${RESET} ║`);
}
console.log(`║ Pass Rate                 : ${BOLD}${(passRate + '%').padEnd(46)}${RESET} ║`);
console.log(`║ Execution Duration        : ${String(durationMs + ' ms').padEnd(46)} ║`);
console.log(`${CYAN}${BOLD}╚════════════════════════════════════════════════════════════════════════════╝${RESET}`);

if (totalFailed === 0 && totalTests > 0) {
  console.log(`${GREEN}${BOLD}🎉 SUCCESS: All ${totalTests} test cases passed requirements verification!${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}❌ FAILURE: ${totalFailed} test(s) failed out of ${totalTests}!${RESET}\n`);
  process.exit(1);
}
