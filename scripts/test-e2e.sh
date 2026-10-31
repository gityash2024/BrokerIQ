#!/usr/bin/env bash
# ==============================================================================
# BrokerIQ 4-Tier Requirement-Driven E2E Test Suite Runner
# Requirements: R1 (Filters), R2 (Export), R3 (Time Logging), R4 (Regression)
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Running BrokerIQ Requirement-Driven E2E Test Suite..."
npx tsx test/e2e/run-all.ts
