#!/usr/bin/env bash
# Prepares the e2e database (non-destructive: applies migrations + idempotent seed).
# Tests use unique emails per run, so the same database can be reused.
# Usage: DATABASE_URL=postgresql://.../brokeriq_test bash test/setup-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
npx prisma migrate deploy >/dev/null
npx ts-node --transpile-only prisma/seed.ts
