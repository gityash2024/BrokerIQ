#!/usr/bin/env bash
# Prepares the e2e database (non-destructive: applies migrations + idempotent seed).
# Tests use unique emails per run, so the same database can be reused.
# Usage: DATABASE_URL=postgresql://.../brokeriq_test bash test/setup-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node <<'NODE'
let selected;
try {
  if (!process.env.DATABASE_URL) throw new Error();
  selected = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error('Set an explicit isolated BrokerIQ test DATABASE_URL before database setup.');
}
if (!['postgres:', 'postgresql:'].includes(selected.protocol) ||
    !/^brokeriq_(?:release_test|test)/.test(selected.pathname.slice(1))) {
  throw new Error('Database setup accepts only an isolated BrokerIQ test database.');
}
NODE
pnpm exec prisma migrate deploy >/dev/null
pnpm exec ts-node --transpile-only prisma/seed.ts
