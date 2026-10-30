# BrokerIQ build 28 — 30 October 2026

Scope: Inbox chat-click error resolution, Agent Role strict boundary enforcement, 12 Major Indian Languages deployment across Web & Mobile, and Release v2.1.3-build28.

---

## 1. Scope & Delivered Enhancements

### 1. Inbox / WhatsApp First-Click Error Fix (`apps/web/src/components/legacy/inbox-page.tsx`, `apps/web/src/lib/report-error.ts`)
- **Root Cause:**
  - React effect cleanup functions returning non-void/promises or unstable callbacks triggered `TypeError: i is not a function at iS` during component lifecycle transitions on conversation selection.
  - Thread unread read receipt effect lacked callback stability, triggering cascading re-renders.
  - Absence of an inline query error fallback triggered the global PageError boundary on transient network/query delays.
  - Chrome extensions throwing uncaught exceptions on web pages were polluting the client error logger.
- **Resolution:**
  - Stabilized `onRead` using a persistent `useCallback` and `onReadRef` inside `WaThread`.
  - Added safe optional chaining (`q.data?.items?.length`) and wrapped `end.current?.scrollIntoView()` inside a proper block body returning `undefined`.
  - Added an inline error fallback inside `WaThread` with retry action so initial query settlement never crashes the page layout.
  - Cleaned up arrow returns in `useEffect` across all web components (`providers.tsx`, `google-button.tsx`, `assistant.tsx`, `theme-toggle.tsx`, `hooks.ts`, `shell.tsx`).
  - Added filtering in `report-error.ts` to ignore third-party browser extension exceptions (`chrome-extension://`, `moz-extension://`).

### 2. Strict Agent Role (BROKER_AGENT) Boundary Enforcement (`packages/shared`, `apps/web`, `apps/mobile`)
- **Dashboard Hero Action:**
  - On Web Dashboard (`apps/web/src/components/dashboard/dashboard.tsx`), for `BROKER_AGENT`, the primary hero action now displays `"Open leads ↗"` linking directly to `/broker/leads`.
  - Subtitle updated to: `"Your assigned leads, follow-ups and performance targets."`
- **Module Policy Hardening:**
  - In `packages/shared/src/modules.ts`, removed `BROKER_AGENT` from default policies for `inventory`, `directory`, and `team`.
  - Automatically filters out Inventory, Directory, and Team from the "Your product workspace" catalog (`ProductCatalog`) for agents.
  - Web `ModuleAccess` automatically denies agent access to `/broker/inventory`.
- **Mobile Product Tools & Navigation:**
  - In `apps/mobile/app/product-tools.tsx`, restricted "Capture & fill" tools (Scanner and Drafts) to `BROKER_ADMIN`.
  - Added route restriction so agents cannot navigate to inventory or team from product tools.
  - In `apps/mobile/app/(broker)/inventory.tsx`, added a native redirect guard: if `user?.role === 'BROKER_AGENT'`, immediately redirect to `/(broker)/leads`.

### 3. All 12 Major Indian Languages Enabled (`apps/web`, `apps/mobile`, `packages/shared`)
- Enabled all 12 major Indian languages across both Web and Mobile platforms:
  1. हिन्दी (Hindi)
  2. English
  3. Default (हिंग्लिश)
  4. বাংলা (Bengali)
  5. मराठी (Marathi)
  6. తెలుగు (Telugu)
  7. தமிழ் (Tamil)
  8. ગુજરાતી (Gujarati)
  9. ಕನ್ನಡ (Kannada)
  10. മലയാളം (Malayalam)
  11. ਪੰਜਾਬੀ (Punjabi)
  12. ଓଡ଼ିଆ (Odia)
  13. অসমীয়া (Assamese)
  14. اردو (Urdu - RTL support)
- Web `LanguagePicker` (`apps/web/src/components/i18n/language-picker.tsx`): removed hardcoded `en/hi` filter, enabling all languages in dropdown.
- Mobile `LanguageSheet` (`apps/mobile/src/components/language.tsx`): removed hardcoded `en/hi` filter, enabling all languages in the selection sheet.
- Rebuilt `@brokeriq/shared` locale bundles so all dictionaries are synchronized in distribution.

---

## 2. Release Artifacts & Verification

- **Package:** `com.brokeriq.app`
- **Version:** `2.1.3`
- **VersionCode:** `28`
- **Signing Keystore:** `brokeriq-upload.keystore` (Homebrew JDK 17)
- **APK SHA256:** `32a76e321e3ace7ad97e3ec9424f791547ef184217dec5e7ca30021e8b4d05e4`
- **APK Local File:** `apps/web/public/downloads/BrokerIQ-v2.1.3-build28.apk`
- **APK Download:** `https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.3-build28.apk`
- **Landing Page Updated:** `https://brokeriq.mymultimeds.com` reflects build 28 APK link, checksum, and timestamps (`2026-10-30T06:47:41Z`).
- **Production Server:** DigitalOcean `165.232.182.189`
  - `brokeriq-api` (PM2 PID 10): Online
  - `brokeriq-web` (PM2 PID 11): Online
