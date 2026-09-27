#!/usr/bin/env bash
# ==============================================================================
# BrokerIQ Unified E2E Test Suite Runner
# Requirements-driven 4-Tier Test Framework
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

exec node "$SCRIPT_DIR/runner.js" "$@"
