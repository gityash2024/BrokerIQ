# BrokerIQ build 27 — 29 October 2026

Scope: 6 Core Product Improvements, Release v2.1.3-build27, and Security Hardening across Mobile App, Web App, Backend API, and Database.

---

## 1. Scope & Delivered Enhancements

### 1. Site Visit Sheet & Filters Upgrade (`apps/mobile/app/lead/[id].tsx`)
- **Custom Date/Time:** Added custom date input (`YYYY-MM-DD`) and interactive hour (01–12), minute (00, 15, 30, 45), and AM/PM chips.
- **Unlimited & Deduplicated Properties:** Removed the 12-property display limit; added real-time instant property search filter; deduplicated property addresses.
- **Rich Property Details:** Property selection chips now display configuration details: BHK, formatted monthly rent (₹), and furnishing status.
- **Custom Meeting Point / Address:** Brokers can type custom meeting points/addresses directly in the visit scheduling form.
- **Modern Mobile Native UX:** Card-based styling, clean touch targets, full Hindi & English localization support.

### 2. Manual Lead Add Fix (`apps/api/src/modules/leads/leads.service.ts`)
- **Root Cause:** Ingesting/adding a lead that already existed without an assignee or adding by a `BROKER_AGENT` caused `getScoped` to fail with `404: Lead नहीं मिली`.
- **Resolution:**
  - If creator is `BROKER_AGENT`, auto-assigns the lead to the agent.
  - If existing lead is unassigned in the database, automatically assigns it to the creating agent upon ingest.
  - If already assigned to another agent, returns a clear, descriptive `ConflictException` instead of `404`.

### 3. Session Persistence & Multi-Device Management (`apps/api`, `apps/web`)
- **365-Day Retention:** Refresh token TTL extended to 365 days (`31536000` seconds) across API (`JWT_ACCESS_TTL = '7d'`, `REFRESH_TTL_DAYS = 365`) and Web cookies.
- **5 Concurrent Sessions:** `auth.service.ts` now allows up to 5 concurrent sessions per account. Oldest sessions beyond 5 are safely evicted without abruptly invalidating active devices.
- **Race Condition Safety:** Fixed single-use refresh token rotation race condition so multi-device refreshes do not invalidate sibling sessions.
- **Endpoints Added:** `GET /api/auth/sessions` and `POST /api/auth/sessions/revoke`.

### 4. Agent Role & Dedicated Dashboard Overhaul (`apps/api`, `apps/mobile`, `apps/web`)
- **Inventory Isolation:** Inventory tab completely hidden for `BROKER_AGENT` in mobile navigation (`apps/mobile/app/(broker)/_layout.tsx`) and web sidebar (`apps/web/src/app/broker/layout.tsx`). Direct web navigation to `/broker/inventory` redirects agents to `/broker/leads`.
- **Performance Targets & Metrics:** Agent dashboard exclusively shows assigned leads:
  - Active Leads in Pipeline
  - New Assigned Leads
  - Overdue Follow-ups
  - Scheduled Site Visits
  - Deals Closed
  - Monthly Site Visits Target (e.g., `0/20`)
  - Monthly Closed Deals Target (e.g., `0/3`)
  - First-response SLA Health (`100%`)
- Excluded inventory records, availability donut, and locality charts for agents.

### 5. Anti-Screen Capture & Anti-Recording Hardening (`apps/mobile`, `apps/web`)
- **Android App:** Added native `WindowManager.LayoutParams.FLAG_SECURE` in `MainActivity.kt`. Completely prevents:
  - Screenshots (Android system displays policy restriction message)
  - Screen recording (video output records black screen)
  - Screen mirroring and external casting
  - Multitasking recents preview
- **Web App:** Added `@media print { html, body { display: none !important; } }` and `.protected-view` with `user-select: none`. Added keyboard interceptors for PrintScreen, `Ctrl+P`, and `Cmd+P`.

### 6. 'Not Interested' Lead Stage (`DB`, `@brokeriq/shared`, `API`, `Mobile`, `Web`)
- **Database:** Executed `ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'NOT_INTERESTED';` on production PostgreSQL (`127.0.0.1:5433/brokeriq_b2b_20261015`).
- **Prisma & Shared:** Added `NOT_INTERESTED` to `LeadStage` enum, `LEAD_STAGE_LABELS` (`'Not interested'`), `LEAD_STAGE_COLORS` (`#64748B`), and Hindi translation (`'इच्छुक नहीं'`).
- **Mobile App:** Horizontal stage stepper includes `NOT_INTERESTED`. Tapping opens a quick-reason sheet (`Budget mismatch`, `Location mismatch`, `Plan postponed`, etc.) or allows 1-tap change.
- **Web App:** Stage stepper includes `Not interested`. Tapping opens a reason modal with 1-tap confirmation or skip.

---

## 2. Release Artifacts & Verification

- **Package:** `com.brokeriq.app`
- **Version:** `2.1.3`
- **VersionCode:** `27`
- **Signing Keystore:** `brokeriq-upload.keystore` (Homebrew JDK 17, SHA256: `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce`)
- **APK SHA256:** `5b2a07882ba10b728dcb28d1538ed641b46c8ffab5a4bc3f9d134319f3cc56a3`
- **APK Download:** `https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.3-build27.apk`
- **Landing Page Updated:** `https://brokeriq.mymultimeds.com` reflects build 27 APK link, checksum, and timestamps.
- **Production Server:** DigitalOcean `165.232.182.189`
  - `brokeriq-api` (PM2 PID 10): Online (`uptimeSec > 0`, DB Latency ~2ms)
  - `brokeriq-web` (PM2 PID 11): Online (`HTTP 200 OK`)
  - All unrelated PM2 processes online and undisturbed.
