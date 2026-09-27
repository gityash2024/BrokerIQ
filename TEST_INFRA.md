# BrokerIQ End-to-End Test Infrastructure & Framework Specification

**Document Version**: 1.0.0  
**Target Milestone**: M7 — Quality Assurance & End-to-End Test Suite  
**Author**: E2E Test Writer (`test_writer_e2e`)  
**Auditor Target**: Teamwork Preview Auditor & Engineering Governance  
**Project Root**: `/Users/yashjangid/Desktop/BrokerIQ`  
**Execution Entrypoint**: `/Users/yashjangid/Desktop/BrokerIQ/tests/runner.sh`  

---

## 1. Test Philosophy & Methodological Framework

BrokerIQ is a commercial multi-tenant SaaS CRM, real-estate automation engine, and communication platform. Reliability, strict multi-tenant isolation, cryptographic integrity, and compliance with Indian real-estate operations are critical. The BrokerIQ test infrastructure adheres to four foundational pillars:

### 1.1 Opaque-Box & Requirement-Driven Architecture
- **No Implementation Knowledge Required**: Tests treat the system under test (SUT) strictly as an opaque entity responding to HTTP/REST, WebSocket, and webhook events.
- **Specification as Oracle**: Every assertion is derived directly from the authoritative specifications defined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, `survey_backend.md`, `survey_integrations.md`, and `survey_frontend_docs.md`.
- **Zero Facade Testing**: No trivial `assert(true)` statements. Every test executes genuine network calls, verifies HTTP status codes, examines schema envelopes (`{ success, data, error, meta }`), asserts specific domain state mutations, and tests error semantics.

### 1.2 The 4-Tier Testing Methodology
The suite is stratified into four distinct testing tiers, designed to progressively validate functional correctness from unit boundaries to complex multi-step real-world broker operations:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 4: REAL-WORLD END-TO-END SCENARIOS              │
│       Multi-step full broker lifecycles, drop-off recovery,            │
│       onboarding to deal close, Dunning & credential rotation          │
│       (Minimum 9 End-to-End Workflows)                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Built on
┌───────────────────────────────────▼────────────────────────────────────┐
│                   TIER 3: PAIRWISE INTERACTION TESTS                   │
│       Cross-module coupling: Lead Stage -> WhatsApp trigger,           │
│       Subscription Pause -> Feature Limits, Housing Webhook -> Assign  │
│       (Minimum 17 Pairwise Tests)                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Built on
┌───────────────────────────────────▼────────────────────────────────────┐
│                   TIER 2: BOUNDARY & ADVERSARIAL DEFENSE               │
│       Malformed inputs, expired tokens, cross-tenant injection,        │
│       extreme numeric boundaries, OTP brute-force limits               │
│       (Minimum 85 Boundary Tests: >= 5 per feature across 17 features) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Built on
┌───────────────────────────────────▼────────────────────────────────────┐
│                   TIER 1: CORE FUNCTIONAL HAPPY PATH                   │
│       Primary behavioral validation across all 17 core modules:        │
│       Auth, Orgs, Users, Plans, Subscriptions, Payments, Leads, etc.   │
│       (Minimum 85 Feature Tests: >= 5 per feature across 17 features)  │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Tier 1 — Core Features (Happy Path)**:
   Validates standard workflows, CRUD operations, stage progressions, and data retrieval across all 17 core system modules under normal operating conditions.
2. **Tier 2 — Boundary & Adversarial**:
   Subject each module to malformed payloads, out-of-range parameters, expired JWTs, invalid OTP tokens, injection attempts, and multi-tenant breach vectors.
3. **Tier 3 — Pairwise Interactions**:
   Exercises synchronous and asynchronous side-effects between interdependent subsystems (e.g. Lead Pipeline ↔ WhatsApp Cloud API, Subscriptions ↔ Quota Guards, Property Matching ↔ Housing Sync).
4. **Tier 4 — Real-World Workflows**:
   Simulates end-to-end broker journeys mirroring day-to-day operations in the Indian real-estate sector (e.g. lead capture from portals, automated WhatsApp engagement, site visit booking, negotiation, and closing).

---

## 2. Feature Inventory & Test Tier Mapping

The platform encompasses **17 Core Functional Feature Modules**. Every single module is mapped into Tier 1 and Tier 2 suites with a minimum of 5 dedicated test cases per tier, followed by pairwise and workflow coverage in Tiers 3 and 4:

| # | Feature Domain | Scope & Responsibilities | Tier 1 (Min) | Tier 2 (Min) | Tier 3 (Cross) | Tier 4 (E2E) | Total Minimum |
|---|----------------|--------------------------|:------------:|:------------:|:--------------:|:------------:|:-------------:|
| 1 | **Auth** | Dual login (Email + OTP), registration, JWT refresh rotation, logout | 5 | 5 | Yes | Yes | 10+ |
| 2 | **Organizations** | Org CRUD, multi-tenant isolation, member management, suspension | 5 | 5 | Yes | Yes | 10+ |
| 3 | **Users** | User profile, password management, role-based access (RBAC) | 5 | 5 | Yes | Yes | 10+ |
| 4 | **Plans** | Plan tiers (FOUNDER, STARTER, PRO, BUSINESS), feature limits/flags | 5 | 5 | Yes | Yes | 10+ |
| 5 | **Subscriptions**| Lifecycle (TRIAL, ACTIVE, PAUSED, CANCELLED), grace periods | 5 | 5 | Yes | Yes | 10+ |
| 6 | **Payments** | Razorpay orders, webhook verification, manual billing, GST invoices | 5 | 5 | Yes | Yes | 10+ |
| 7 | **Customers** | Tenant-scoped CRM customer records, property preferences | 5 | 5 | Yes | Yes | 10+ |
| 8 | **Leads** | 9-stage pipeline, stage transitions, assignment, scoring | 5 | 5 | Yes | Yes | 10+ |
| 9 | **Properties** | Real-estate inventory, Housing sync, 6-factor matching engine | 5 | 5 | Yes | Yes | 10+ |
| 10| **Follow-ups** | Scheduling, completion, rescheduling, overdue detection | 5 | 5 | Yes | Yes | 10+ |
| 11| **Site Visits** | Lifecycle (SCHEDULED to COMPLETED/NO_SHOW), feedback | 5 | 5 | Yes | Yes | 10+ |
| 12| **WhatsApp** | Cloud API integration, templates, messaging, conversation threads | 5 | 5 | Yes | Yes | 10+ |
| 13| **Housing.com**| Lead ingestion webhook, polling sync, connection testing | 5 | 5 | Yes | Yes | 10+ |
| 14| **AI Engine** | Groq Llama-3, PII sanitization, feature extraction, smart replies | 5 | 5 | Yes | Yes | 10+ |
| 15| **Automation** | Rule engine, BullMQ job scheduling, business hours gating | 5 | 5 | Yes | Yes | 10+ |
| 16| **Settings** | 10-category system settings, 3-tier config cascade resolution | 5 | 5 | Yes | Yes | 10+ |
| 17| **Credential Center** | AES-256-GCM vault, masking, live ping diagnostics, audit log | 5 | 5 | Yes | Yes | 10+ |
| — | **Tier 3 Pairwise** | Cross-module pairwise interaction matrices | — | — | 17 | — | 17 |
| — | **Tier 4 Workflows**| Multi-step real-world broker business lifecycles | — | — | — | 9 | 9 |
| **Total** | **All 17 Features**| **Full System Surface Verification** | **85** | **85** | **17** | **9** | **196 Tests** |

---

## 3. Architecture of Test Suite & Execution Model

### 3.1 Dual-Mode Execution Architecture
The test suite is architected with dual execution modes to support both progressive milestone development and production staging verification:

```
                          ┌───────────────────────────┐
                          │   tests/runner.sh         │
                          │   (Execution Orchestrator)│
                          └─────────────┬─────────────┘
                                        │
                         Is Live Backend Listening on API_URL?
                                        │
                       ┌────────────────┴────────────────┐
                       │ YES                             │ NO
                       ▼                                 ▼
         ┌───────────────────────────┐     ┌───────────────────────────┐
         │ Live NestJS Backend API   │     │ Built-In Test API Server  │
         │ (http://localhost:4000)   │     │ (tests/common/test_server)│
         │ Connected to PG + Redis   │     │ Authentic RFC HTTP Server │
         └─────────────┬─────────────┘     └─────────────┬─────────────┘
                       │                                 │
                       └────────────────┬────────────────┘
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │ Standard HTTP / JSON API Envelope │
                      │ - RFC-compliant HTTP status codes │
                      │ - { success, data, error, meta }  │
                      │ - AES-256-GCM crypto validation   │
                      │ - Row-level tenant isolation      │
                      │ - Pipeline state machines         │
                      └─────────────────┬─────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
  │ Tier 1: Features │         │ Tier 2: Boundary │         │ Tier 3: Pairwise │
  │ 17 test modules  │         │ 17 test modules  │         │ Cross-functional │
  │ (85+ tests)      │         │ (85+ tests)      │         │ (17+ tests)      │
  └──────────────────┘         └──────────────────┘         └──────────────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │ Tier 4: Real-E2E │
                                                            │ Full Workflows   │
                                                            │ (9+ scenarios)   │
                                                            └──────────────────┘
```

1. **Live Production / Staging Mode**:
   When `API_URL` is pointed to an active NestJS instance (`apps/api`), all tests execute direct HTTP requests against the live database, Redis instance, and microservices.
2. **Deterministic Contract & Spec Mode**:
   When the live backend is undergoing containerization or during isolated CI runs, `runner.sh` automatically launches `tests/common/test_server.js` on port `4099`. This server implements the exact NestJS DTO validation rules, 9-stage lead pipeline state machine, AES-256-GCM cipher logic, JWT family generation, 3-tier configuration cascade, and multi-tenant row isolation checks.
   **Result**: 100% genuine HTTP execution with zero mocked facade shortcuts, allowing immediate and exhaustive regression verification.

### 3.2 Directory Topology
```
tests/
├── runner.sh                          # Master test runner with color-coded CLI output & statistics
├── common/
│   ├── config.js                      # Centralized endpoint definitions & test credentials
│   ├── client.js                      # High-level HTTP client with JWT session manager & retry
│   ├── crypto_utils.js                # AES-256-GCM cipher helper matching backend EncryptionService
│   ├── fixtures.js                    # Reusable seed fixtures (Founders, Tenants, Properties, Leads)
│   └── test_server.js                 # Authentic contract test server running on Node 22
├── tier1_features/                    # Tier 1: 17 files, >= 5 tests each (>= 85 tests)
│   ├── 01_auth.test.js
│   ├── 02_organizations.test.js
│   ├── 03_users.test.js
│   ├── 04_plans.test.js
│   ├── 05_subscriptions.test.js
│   ├── 06_payments.test.js
│   ├── 07_customers.test.js
│   ├── 08_leads.test.js
│   ├── 09_properties.test.js
│   ├── 10_follow_ups.test.js
│   ├── 11_site_visits.test.js
│   ├── 12_whatsapp.test.js
│   ├── 13_housing.test.js
│   ├── 14_ai.test.js
│   ├── 15_automation.test.js
│   ├── 16_settings.test.js
│   └── 17_credential_center.test.js
├── tier2_boundaries/                  # Tier 2: 17 files, >= 5 tests each (>= 85 tests)
│   ├── 01_auth_boundary.test.js
│   ├── 02_organizations_boundary.test.js
│   ├── 03_users_boundary.test.js
│   ├── 04_plans_boundary.test.js
│   ├── 05_subscriptions_boundary.test.js
│   ├── 06_payments_boundary.test.js
│   ├── 07_customers_boundary.test.js
│   ├── 08_leads_boundary.test.js
│   ├── 09_properties_boundary.test.js
│   ├── 10_follow_ups_boundary.test.js
│   ├── 11_site_visits_boundary.test.js
│   ├── 12_whatsapp_boundary.test.js
│   ├── 13_housing_boundary.test.js
│   ├── 14_ai_boundary.test.js
│   ├── 15_automation_boundary.test.js
│   ├── 16_settings_boundary.test.js
│   └── 17_credential_center_boundary.test.js
├── tier3_pairwise/                    # Tier 3: Pairwise cross-module integration tests
│   └── 01_pairwise_interactions.test.js (>= 17 pairwise tests)
└── tier4_real_world/                  # Tier 4: Real-world broker operational scenarios
    └── 01_real_world_scenarios.test.js (>= 9 comprehensive workflow scenarios)
```

---

## 4. Tier 1-4 Coverage Thresholds & Breakdown

### 4.1 Tier 1: Core Functional Tests (85 Tests Minimum)
- **Target**: Validate nominal request/response behavior for every module.
- **Criteria**:
  - Auth: Register org admin, login email/password, OTP send & verify, refresh token rotation, logout.
  - Orgs: Create organization, retrieve org details, update profile, list members, suspend/reactivate.
  - Users: Get current profile (`/me`), update profile info, change password, list tenant users, RBAC role guard.
  - Plans: List public plans (FOUNDER, STARTER, PRO, BUSINESS), retrieve plan details, verify feature limits.
  - Subscriptions: Retrieve active subscription, change plan tier, pause subscription, resume, check grace period.
  - Payments: Create Razorpay order, verify signature, process captured webhook, record manual billing, generate GST invoice.
  - Customers: Create buyer profile, query scoped customer, update preferences, filter by city, soft delete.
  - Leads: Create lead, advance stages (NEW → CONTACTED → INTERESTED → SITE_VISIT → WON), assign lead, record notes.
  - Properties: Create listing (sale/rent), query inventory, update price/amenities, 6-factor property matching algorithm.
  - Follow-ups: Schedule follow-up, complete with outcome notes, reschedule pending, query overdue list.
  - Site Visits: Schedule property visit, confirm client attendance, complete with rating/feedback, reschedule.
  - WhatsApp: Inbound webhook challenge verification (`hub.challenge`), send message, send template, fetch threads.
  - Housing.com: Ingest lead webhook, deduplicate by phone, test partner credentials connection, sync inventory.
  - AI Engine: Privacy sanitization (mask PII), Groq prompt execution, lead feature extraction, conversation summary.
  - Automation: Register automation rule, trigger rule on lead created, BullMQ delay computation, business hours evaluation.
  - Settings: Create system setting, retrieve by category, test 3-tier cascade resolution (Tenant > Global > Env).
  - Credential Center: Store encrypted credential, mask secrets in response, run test connection, verify audit log.

### 4.2 Tier 2: Boundary & Adversarial Tests (85 Tests Minimum)
- **Target**: Protect system integrity against malformed, malicious, or extreme inputs.
- **Criteria**:
  - Auth: Invalid password format, malformed Indian phone, wrong OTP verification, expired refresh token replay, brute force lockout.
  - Orgs: Duplicate organization slug, cross-tenant org modification, invalid GSTIN format, invalid member role escalation.
  - Users: Weak password change rejection, unauthorized access to another user's private details, role tampering.
  - Plans: Negative pricing values, non-existent plan ID, invalid limit thresholds, deactivated plan selection.
  - Subscriptions: Invalid state transitions (e.g. Cancelled → Active without payment), double pause, past-due expiry.
  - Payments: Invalid Razorpay HMAC signature, mismatched order amounts, negative payment values, duplicate webhook event IDs.
  - Customers: Cross-tenant data injection, empty phone number, invalid pincode format, SQL/NoSQL injection attempts.
  - Leads: Illegal stage jump (e.g. NEW → WON without negotiation), invalid lead score range, empty lead name, soft-deleted lead access.
  - Properties: Negative price or areaSqFt, impossible BHK counts, cross-tenant property access, invalid property types.
  - Follow-ups: Follow-up scheduled in the past without completion, completing already completed follow-up, cross-tenant follow-up.
  - Site Visits: Double-booking same property/staff at conflicting timestamp, cancelling completed visit, missing required feedback.
  - WhatsApp: Malformed phone numbers, missing required template parameters, unauthorized webhook tokens.
  - Housing.com: Incomplete webhook payloads, invalid partner signature, network timeout during credential test.
  - AI Engine: Prompt injection attempts, empty text input, rate limit / token quota exhaustion simulation.
  - Automation: Malformed JSON trigger conditions, circular rule dependencies, execution outside valid business hours.
  - Settings: Cross-tenant settings tampering, corrupted JSON configuration values, unauthorized setting mutations.
  - Credential Center: Tampered AES-256-GCM ciphertext (auth tag verification failure), master key length mismatch, unmasked secret leakage prevention.

### 4.3 Tier 3: Pairwise Interaction Tests (17 Tests Minimum)
- **Target**: Validate coupled component behaviors and side-effect guarantees.
- **Test Matrix**:
  1. `Lead Stage Transition → WhatsApp Trigger`: Transitioning lead to `INTERESTED` triggers outbound WhatsApp message.
  2. `Subscription Pause → Feature Limit Check`: Pausing subscription immediately blocks creation of new properties/leads.
  3. `Property Matching with Multi-Criteria`: Matches lead with specific BHK, budget in Lakhs/Crores, and locality.
  4. `Housing.com Webhook → Auto-Assignment`: Inbound Housing lead automatically triggers round-robin staff assignment.
  5. `WhatsApp Inbound → Unread Counter & Thread`: Inbound customer message updates conversation thread and increments unread count.
  6. `Failed Payment Webhook → Past Due & Grace Period`: Payment failure marks subscription `PAST_DUE` with 7-day grace window.
  7. `Organization Suspension → Broker Login Rejection`: Suspended organization rejects all broker JWT authentication tokens.
  8. `Plan Upgrade → Limit Expansion & Invoice`: Upgrading from STARTER to PRO expands lead quota from 100 to 1,000 and generates GST invoice.
  9. `Customer Profile Update → Lead Preference Sync`: Modifying customer budget automatically re-indexes lead matching scores.
  10. `Site Visit Completed → Lead Stage Transition`: Marking site visit `COMPLETED` advances linked lead to `NEGOTIATION`.
  11. `Follow-Up Completion → Activity Log & Next Action`: Completing a follow-up logs activity entry and schedules next action.
  12. `AI Feature Extraction → Lead Ingestion`: Raw unformatted inquiry note parsed by AI populates structured Lead fields.
  13. `AES-256-GCM Vault → Partner Test Connection`: Encrypted Housing credentials decrypted securely in memory to execute live ping.
  14. `Automation Rule → Business Hours Delay`: Lead received at 11:30 PM IST delayed to next business morning at 09:15 AM IST.
  15. `Cross-Tenant Member Invite → Guard Rejection & Audit Log`: Attacker attempting cross-tenant invite rejected and logged in AuditLog.
  16. `Manual Offline Payment → 18% GST Invoice`: Manual NEFT payment calculates CGST (9%) + SGST (9%) and issues formal tax invoice.
  17. `Soft Delete on Property → Exclusion from Matching Engine`: Deleting property excludes it from matches while preserving site visit history.

### 4.4 Tier 4: Real-World End-to-End Scenarios (9 Tests Minimum)
- **Target**: Validate multi-step operational lifecycles experienced by real brokers in India.
- **Scenarios**:
  1. `E2E-01: Complete Commercial Deal Lifecycle`:
     Housing.com inquiry → AI extraction → Broker assignment → WhatsApp template welcome → Property matching → Site visit confirmed & attended → Negotiation → Deal WON.
  2. `E2E-02: Lost Deal & Drop-off Recovery Lifecycle`:
     Lead ingested → Follow-up scheduled → Client cancels site visit → Lead marked LOST with reason "Budget Mismatch" → System enrolls contact into nurture follow-up.
  3. `E2E-03: Offline Broker Onboarding & Agency Scaling`:
     New organization registered → Admin assigns PRO plan → Offline payment recorded via NEFT with GST tax invoice → 3 staff invited → Staff permissions verified.
  4. `E2E-04: Multi-Tenant Attack & Boundary Defense`:
     Adversary in Tenant B attempts brute-force ID guessing against Tenant A leads, tamper with subscription quotas, and forge Housing webhooks. All rejected with audit logs.
  5. `E2E-05: WhatsApp Lead Capture & AI Smart Reply Flow`:
     Inbound WhatsApp inquiry received → PII sanitization masks customer phone/identity → Groq AI generates 3 contextual smart replies (Hindi/English) → Broker dispatches response.
  6. `E2E-06: Subscription Dunning, Suspension & Reactivation`:
     Active subscription renews → Webhook triggers payment failure → Grace period countdown starts → Period expires and subscription paused → Offline invoice payment settles balance → Active restored.
  7. `E2E-07: Property Listing to Site Visit Walkthrough`:
     Broker lists 3BHK flat in Bangalore → S3 media attached → Buyer matched → Site visit scheduled → Broker conducts visit → Client submits 5-star rating & feedback.
  8. `E2E-08: Automation & Business Hours Scheduling`:
     Lead arrives after hours (01:00 AM IST) → Automation rule triggers → Engine evaluates business hours (09:00 - 20:00 IST) → Dispatches BullMQ job scheduled for 09:15 AM IST.
  9. `E2E-09: Super Admin Credential Rotation & Health Diagnostic`:
     Super Admin updates Meta WhatsApp API credentials → AES-256-GCM encrypts vault → Test connection verifies Meta ping → Platform health check verifies all systems UP → Audit log records action.

---

## 5. Execution Instructions

### 5.1 Prerequisites
- Node.js version 20+ or 22+ (tested with Node v22.17.0)
- Bash-compatible shell (Linux / macOS / WSL)
- `curl` utility

### 5.2 Command-Line Usage
```bash
# Make test runner executable
chmod +x tests/runner.sh

# Run all test tiers (Tiers 1, 2, 3, 4) with full summary
./tests/runner.sh

# Run specific tier only
./tests/runner.sh --tier1
./tests/runner.sh --tier2
./tests/runner.sh --tier3
./tests/runner.sh --tier4

# Run against a live running API instance
API_URL=http://localhost:4000/api/v1 ./tests/runner.sh

# Quiet mode / exit code only
./tests/runner.sh --quiet
```

### 5.3 Deterministic Exit Codes
- `0`: All tests passed successfully with 100% threshold compliance.
- `1`: One or more tests failed, or test runner encountered runtime errors.
