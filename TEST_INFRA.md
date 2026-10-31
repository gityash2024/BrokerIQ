# Test Infrastructure & Methodology (`TEST_INFRA.md`)

## 1. Overview & Objective
This document outlines the architecture, methodology, and execution framework of the comprehensive 4-tier requirement-driven End-to-End (E2E) test suite for **BrokerIQ**. The suite verifies all capabilities specified in `ORIGINAL_REQUEST.md` and `PROJECT.md` under requirements **R1** (KYC & Teams Filtering), **R2** (Multi-Format Data Export), **R3** (Agent Time Logging & Location Tracking), and **R4** (Regression Safety & Production Deployment Readiness).

The test suite operates purely as an **opaque-box tester**: it asserts against external HTTP API contracts, response payloads, status codes, and binary file structures without coupling to internal private methods or implementation quirks.

---

## 2. 4-Tier Requirement-Driven Methodology

### Tier 1 — Feature Coverage (>=5 Tests Per Feature Domain)
Validates core requirements in isolation using standard happy paths and straightforward verification:
- **KYC Filtering (R1)**: Date Range presets (`today`, `yesterday`, `last_7_days`, `this_month`), Status (`PENDING`, `VERIFIED`, `REJECTED`), Role (`BROKER_ADMIN`, `BROKER_AGENT`), Search query (`name`, `email`, `phone`), and unfiltered reset.
- **Teams Filtering (R1)**: Date Range presets, Status (`ACTIVE`, `SUSPENDED`), Role, Search query, and unfiltered reset.
- **Multi-Format Export (R2)**: Binary verification of Excel (`.xlsx`), PDF (`.pdf`), and CSV (`.csv`) for both KYC and Teams modules.
- **Agent Time Logging (R3)**: Mobile Punch In with mandatory GPS pre-flight gating, 15-minute periodic GPS recording, Punch Out with duty hours calculation, and status query.
- **Interruption & Web Management (R3)**: Automatic shift pausing on GPS signal loss, automatic resumption on GPS restoration, Daily Timeline endpoint, 15-minute Location History route map points, and Working Hours Summary.

### Tier 2 — Boundary & Corner Cases (>=5 Tests Per Feature Domain)
Stress-tests boundary conditions, error responses, and resource edge cases:
- **Empty Datasets**: Non-matching filters return `200 OK` with empty arrays `[]` (no server crashes or 500 errors).
- **Empty Exports**: Exporting 0 records produces valid, uncorrupted files with headers only.
- **Geographic Bounds**: Latitude beyond `[-90, 90]`, Longitude beyond `[-180, 180]`, or non-numeric coordinate strings return `400 Bad Request`.
- **Date Inversions**: Reversed custom ranges (`from > to`) or distant future dates (`year 2099`) handled gracefully without crash.
- **Shift State Machine**: Double punch-in prevention (`409 Conflict`), punch out without active shift (`400 Bad Request`), and pause/location calls on completed shifts (`400 Bad Request`).
- **Security & RBAC**: Consumer (`USER`) access to time logging returns `403 Forbidden`; invalid bearer tokens return `401 Unauthorized`; SQL injection and XSS payloads in search queries handled safely.

### Tier 3 — Cross-Feature Combinations (Pairwise Coverage)
Evaluates interactions across multiple overlapping features:
- **Simultaneous 5-Way Filtering**: Logical `AND` combination of Date Range + Status + Role + Search + Agent ID.
- **Export with Active Filters**: Verifies that `.csv`, `.pdf`, and `.xlsx` exports strictly contain records matching active filters.
- **Export Explicitly Selected Rows**: Verifies that passing `selectedIds` overrides background filter criteria.
- **Complete Shift Lifecycle**: Seamless transitions through Punch In -> 15-min periodic checkpoints -> GPS interruption pause -> Auto-resumption -> Punch Out -> Chronological Daily Timeline verification.
- **Multi-Tenant Organization Isolation**: Strict partitioning preventing Broker A from observing or exporting Broker B records.
- **Superadmin Global vs Scoped Filtering**: Verifies Superadmin can cross-filter across all brokerages while Broker Admins are scoped.

### Tier 4 — Real-World Application Scenarios (5 Realistic Workflows)
Models end-to-end user workflows matching Gurgaon property brokerage operations:
1. **Scenario 1**: Broker Admin Morning Compliance Review & Formal PDF Audit Export.
2. **Scenario 2**: Agent Full-Day Field Shift with Interruption & Auto-Resume.
3. **Scenario 3**: Superadmin Multi-Brokerage Audit & Excel Analytics.
4. **Scenario 4**: Teams Performance Review, Complex Multi-Filtering & Reset Cycle.
5. **Scenario 5**: Concurrent Multi-Agent Time Tracking & Geolocation Boundary Verification.

---

## 3. Test Architecture & Directory Structure

```
BrokerIQ/
├── test/
│   └── e2e/
│       ├── harness/
│       │   ├── types.ts                    # TypeScript interface contracts & data models
│       │   ├── contract-simulator.ts       # Reference HTTP contract simulator & export generator
│       │   ├── client.ts                   # Opaque-box E2E HTTP client adapter
│       │   └── assertions.ts               # Binary PDF, Excel (PKZip), and CSV (UTF-8 BOM) validators
│       ├── tier1-feature-coverage/
│       │   ├── kyc-filtering.e2e.test.ts
│       │   ├── teams-filtering.e2e.test.ts
│       │   ├── multi-format-export.e2e.test.ts
│       │   ├── agent-time-logging.e2e.test.ts
│       │   └── interruption-and-web-management.e2e.test.ts
│       ├── tier2-boundary-corner/
│       │   └── boundary-and-corner-cases.e2e.test.ts
│       ├── tier3-cross-feature/
│       │   └── cross-feature-combinations.e2e.test.ts
│       ├── tier4-application-scenarios/
│       │   └── real-world-scenarios.e2e.test.ts
│       └── run-all.ts                      # Master E2E runner executing all 4 tiers
├── apps/
│   └── api/
│       └── test/
│           └── e2e-requirements/
│               └── requirements.e2e-spec.ts # Jest bridge executing requirement test suite
├── scripts/
│   └── test-e2e.sh                         # Standalone executable test runner script
├── TEST_INFRA.md                           # This document
└── TEST_READY.md                           # Verification checklist & runner instructions
```

---

## 4. Dual-Execution Mode (Progressive Testability)

To guarantee progressive testability during milestone implementation and support both local development and remote CI/CD environments, the client adapter (`E2EClient`) operates in two modes:

1. **Standalone Simulator Mode (Default)**:
   - When no `E2E_API_URL` environment variable is specified, the test suite automatically boots an in-process `ContractSimulator` on an ephemeral HTTP port.
   - Generates authentic `%PDF-1.3` documents via `pdfkit`, OpenXML PKZip spreadsheets (`.xlsx`) via `fflate`, and CSV streams with UTF-8 BOM (`\ufeff`).
   - Requires zero external database dependencies, enabling rapid verification and regression checks in milliseconds.
2. **Live Backend Target Mode**:
   - Setting `E2E_API_URL=http://localhost:3000` or `http://127.0.0.1:3100` directs the client adapter to test against a live NestJS API instance.
   - Exercises the identical opaque-box test assertions against the real production database and running API endpoints.

---

## 5. Verification Commands

Run the full requirement-driven E2E test suite using any of the following commands:

```bash
# Direct runner via standalone bash script
./scripts/test-e2e.sh

# Master TypeScript runner via tsx
npx tsx test/e2e/run-all.ts

# Individual tier execution
npx tsx --test test/e2e/tier1-feature-coverage/kyc-filtering.e2e.test.ts
npx tsx --test test/e2e/tier1-feature-coverage/teams-filtering.e2e.test.ts
npx tsx --test test/e2e/tier1-feature-coverage/multi-format-export.e2e.test.ts
npx tsx --test test/e2e/tier1-feature-coverage/agent-time-logging.e2e.test.ts
npx tsx --test test/e2e/tier1-feature-coverage/interruption-and-web-management.e2e.test.ts
npx tsx --test test/e2e/tier2-boundary-corner/boundary-and-corner-cases.e2e.test.ts
npx tsx --test test/e2e/tier3-cross-feature/cross-feature-combinations.e2e.test.ts
npx tsx --test test/e2e/tier4-application-scenarios/real-world-scenarios.e2e.test.ts
```
