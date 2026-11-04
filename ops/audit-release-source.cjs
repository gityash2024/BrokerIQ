#!/usr/bin/env node
// Source provenance only. File inclusion never implies a complete workflow/device/provider acceptance.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const [pin, output] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(pin || '') || !/^docs\/evidence\/[^.][^\n]*\.json$/.test(output || '') || output.includes('..'))
  throw Error('Expected an exact commit and a new evidence JSON path');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
if (git('rev-parse', `${pin}^{commit}`) !== pin) throw Error('Unknown commit');
const ledger = JSON.parse(fs.readFileSync('docs/production/reconciliation.json', 'utf8'));
const files = [...new Set(ledger.rows.flatMap((r) => r.sourceFiles || []))];
const byFile = new Map();
for (const file of files) {
  if (!/^(apps|packages|ops|docs)\//.test(file) || file.includes('..')) throw Error('Unsafe source reference');
  try {
    const atPin = git('rev-parse', `${pin}:${file}`);
    let working = null;
    try {
      working = git('hash-object', file);
    } catch {}
    byFile.set(file, { path: file, atPin, workingTreeMatchesPin: working === atPin });
  } catch {
    byFile.set(file, { path: file, atPin: null, workingTreeMatchesPin: false });
  }
}
const rows = ledger.rows.map((r) => ({
  id: r.id,
  requirement: r.requirement,
  status: r.sourceFiles?.length ? 'REFERENCED_FILES_AUDITED' : 'IMPLEMENTATION_MAPPING_STILL_REQUIRED',
  files: (r.sourceFiles || []).map((f) => byFile.get(f)),
  declaredCommits: (r.commits || []).map((c) => {
    try {
      const full = git('rev-parse', `${c}^{commit}`);
      git('merge-base', '--is-ancestor', full, pin);
      return { commit: c, ancestorOfPin: true };
    } catch {
      return { commit: c, ancestorOfPin: false };
    }
  }),
  workflowAcceptanceInferred: false,
}));
const report = {
  kind: 'SOURCE_PROVENANCE_ONLY',
  commit: pin,
  generatedAt: new Date().toISOString(),
  requirementCount: rows.length,
  mappedRequirements: rows.filter((r) => r.files.length).length,
  unmappedRequirements: rows.filter((r) => !r.files.length).length,
  referencedFiles: files.length,
  missingReferencedFiles: files.filter((f) => !byFile.get(f).atPin).length,
  rows,
  fullProductSignoff: false,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    kind: report.kind,
    commit: pin,
    requirements: rows.length,
    mappedRequirements: report.mappedRequirements,
    unmappedRequirements: report.unmappedRequirements,
    missingReferencedFiles: report.missingReferencedFiles,
    fullProductSignoff: false,
  }),
);
