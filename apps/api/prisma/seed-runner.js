#!/usr/bin/env node
// apps/api/prisma/seed-runner.js
// Standalone Seed Runner for BrokerIQ

const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

const seedTsPath = path.resolve(__dirname, 'seed.ts');
const distSeedJs = path.resolve(__dirname, '../dist/prisma/seed.js');
const rootTsc = path.resolve(__dirname, '../../../node_modules/.bin/tsc');

// Ensure compiled
console.log('Compiling seed.ts...');
const compileRes = spawnSync(rootTsc, [
  seedTsPath,
  '--outDir', path.resolve(__dirname, '../dist/prisma'),
  '--skipLibCheck',
  '--module', 'CommonJS',
  '--target', 'ES2022',
  '--moduleResolution', 'node',
  '--esModuleInterop'
], { stdio: 'inherit' });

if (compileRes.status !== 0) {
  console.error('Failed to compile seed.ts');
  process.exit(compileRes.status || 1);
}

// Execute compiled seed
require(distSeedJs);
