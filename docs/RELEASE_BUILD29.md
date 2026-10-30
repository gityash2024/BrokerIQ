# BrokerIQ Build 29 — 30 October 2026

Comprehensive Release: Complete Agent Role Boundary Sealing, Inbox Chat Stabilization, 12 Major Indian Languages, and Release v2.1.4-build29.

---

## 1. Scope & Delivered Enhancements

### 1. Complete Agent Role (BROKER_AGENT) Boundary Sealing across Web & Mobile
- **Web App:**
  - **Dashboard:** Hero action dynamically displays `"Open leads ↗"` linking to `/broker/leads` for agents, with subtitle `"Your assigned leads, follow-ups and performance targets."`
  - **Directory (`/broker/inventory/directory`):** Added redirect guard: agents navigating here are immediately redirected to `/broker/leads`.
  - **Legacy Scanner (`/broker/scanner/listing-drafts`):** Added redirect guard: agents are immediately redirected to `/broker/leads`.
  - **Capture Workspace (`/broker/scanner` & `/broker/imports`):**
    - Agents navigating to scanner mode are redirected to `/broker/leads`.
    - Target destination selector filters out `INVENTORY` for agents, defaulting to `REQUIREMENT`.
  - **Lead Requirements Dialog & Matching:**
    - Hidden `"Open inventory →"` link from `LeadRequirements` dialog for agents.
    - On Requirements page matching dialog (`/broker/leads/requirements`), items render as non-clickable cards rather than linking to `/broker/inventory`.
  - **Workspace Catalog (`ProductCatalog`):** Inventory, Directory, and Team are strictly hidden from 9-dot menu for `BROKER_AGENT`.
  - **Sidebar (`broker/layout.tsx`):** Inventory navigation tab is excluded for `BROKER_AGENT`.
  - **Shared Policies (`packages/shared/src/modules.ts`):** Removed `BROKER_AGENT` from default policies for `inventory`, `directory`, and `team`.
- **Mobile App:**
  - **Tabs Layout (`(broker)/_layout.tsx`):** `inventory` tab screen options set to `href: null` for `BROKER_AGENT`.
  - **Inventory Screen (`(broker)/inventory.tsx`):** Redirects agents to `/(broker)/leads`.
  - **Inventory Editor (`inventory-edit.tsx`):** Added redirect guard: agents are immediately redirected to `/(broker)/leads`.
  - **Publish Rental (`publish-rental.tsx`):** Added redirect guard: agents are immediately redirected to `/(broker)/leads`.
  - **Product Tools (`product-tools.tsx`):** Scanner and Drafts restricted to `BROKER_ADMIN`.

### 2. Inbox / WhatsApp First-Click Error Fix
- Stabilized `onRead` callback with `useCallback` and `useRef` inside `WaThread`.
- Added inline error boundary and retry banner in `WaThread` preventing global fallback page triggers.
- Cleaned arrow returns in `useEffect` across all web components to prevent non-function cleanup errors in React Fiber.
- Added filter in `report-error.ts` to ignore third-party Chrome extension errors.

### 3. Top 12 Indian Languages Enabled
- Enabled Hindi, English, Hinglish, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, and Urdu across Web and Mobile.

---

## 2. Release Artifacts & Verification

- **Package:** `com.brokeriq.app`
- **Version:** `2.1.4`
- **VersionCode:** `29`
- **APK Path:** `apps/web/public/downloads/BrokerIQ-v2.1.4-build29.apk`
- **SHA-256 Checksum:** `1ecb0fe47b0e7dff0417755d5f882fb29de992ea62eb7672887ca0aceda80ec4`
- **File Size:** 141 MB
- **Landing Page Link:** [https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.4-build29.apk](https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.1.4-build29.apk)
- **Production Server:** `165.232.182.189`
