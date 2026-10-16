# Broker-first release — implementation ledger

Approved scope: two initial accounts (Super Admin and Olive State broker), five broker sections, all property types, Hindi/English, share/paste/export capture, free AI, current instance treated as staging. Preserve future product code.

## Current status — 16 October 2026

The sections below this summary are a chronological implementation history; their older counts and pending items describe those checkpoints.

- Broker-first staging cutover, two new accounts, module controls, typed inventory/requirements, durable imports, five-section web/native flows, Area Directory and the landing page are deployed. Application code currently at `af4d497`, with reconciliation reporting added separately below. Only BrokerIQ paths and its two PM2 registrations have been changed.
- Signed Android v2.0.0 build 13 is live at `https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.0.0-build13.apk`; SHA256 `afd4403a084680c5f3620a3243d931f93fe51e88bfc6d7f9b285654bfdc2f074`. Complete public download was hashed. Signing certificate unchanged.
- Android emulator checks cover broker login, Hindi/English, native text/image Share, persisted offline draft recovery after process restart, directory map/list, and safe-area filter controls. Real Android hardware has not been tested.
- Latest completed test runs: shared 20 passed; focused API launch 12 passed; all 12 Playwright journeys passed; workspace typechecks and API/web production builds passed. These are isolated fixtures, not proof of live Housing/WhatsApp integration.
- Source review now covers pages 1–18: 292 groups, 81 approved groups, 90 source-linked ledger records, 211 unresolved examined groups. Another 99 pages / 1,249 candidate blocks need entry review. All imported availability is UNKNOWN. See [REGISTER_RECONCILIATION.md](REGISTER_RECONCILIATION.md). Do not claim complete inventory or production-launch readiness.
- Checkpoint `/opt/brokeriq/backups/checkpoints/20261016-100938-broker-first` includes the 90 source-linked records and restored successfully into a scratch database with exact table counts and active media checksums. Later user-confirmed source amendments are recorded separately in audit history.
- Live provider credentials and an explicitly authorized WhatsApp recipient are still awaited. No real outbound integration test has been run. Directory coverage is 2,102 source identities / 1,237 mapped, not an exhaustive list of unique city projects.
- Original inputs, extraction evidence and old APKs are preserved privately; local releases now retains build 13 only. Product/future-module code and signing material remain intact.

## Completed verification

- Current initial server release: de168ac, BrokerIQ-specific API/web processes only.
- Recoverable checkpoint: /opt/brokeriq/backups/checkpoints/20261013-181702-broker-first. Encrypted database/secrets/source plus media; restore into scratch database succeeded and exact counts for all public tables matched. Scratch removed.
- Foundation commit pushed: 26c6267. Shared module policies, HTTP/job/cron gates, current membership authentication, minimal web navigation, admin create-broker UI/API, safe bootstrap, missing original inventory migration.
- Isolated local PostgreSQL: 127.0.0.1:55432, brokeriq_release_test; initialized under ~/Library/Caches/BrokerIQ/release-postgres. Never use existing business databases for tests.
- New inventory/source/requirements migration applied to isolated test database. Shared tests: 16 passed. Broker-first + source-ledger e2e: 6 passed (real Postgres). Typechecks passed at checkpoints.
- Fresh offline Apple Vision OCR and 200dpi renders captured all 117 pages from original PDF. Original SHA256: 46173d8bb00bf10253c3fbb8c72941b69b5793c008c60fff9dc5824c5091764f. Private output in ~/Library/Application Support/BrokerIQ/imports/<sha>. These raw OCR observations are not verified inventory.

## Remaining work (do not mark production ready)

- Finish register segmentation, visual per-page verification, source-backed reconciliation and accurate import for Rahul; preserve uncertain fields in review. Old 1698 JSON is comparison only.
- Finish broker web journeys and admin overview; mobile native redesign, SQLite drafts/imports, native Android share target, source review, requirements/matching and automation/Housing.
- Complete connector errors, signed/idempotent WhatsApp ingestion and media capture, free-only AI configuration, worker retry safeguards.
- New apps/landing package, homepage routing, versioned signed APK/download/checksum.
- More e2e/UI and Hindi/English verification, release builds, emulator/device checks.
- Create fresh B2B database and bootstrap on server, deploy from isolated release checkout, switch only BrokerIQ processes/secrets after verification. Old database/release remain rollback. Do not run deployment migrations against old brokeriq DB: the initial inventory table has no historical migration record there.
- User will enter Housing/WhatsApp/AI credentials in Settings before launch. No external test messages without a user-selected authorized test recipient.
- Final archive/cleanup only after source/release evidence is preserved; do not delete signing material, untracked user inputs or future feature code.

## Implementation notes

- expo-sharing SDK57 provides incoming Android share intents; packages expo-sqlite, expo-document-picker and expo-sharing installed. Plugins added to dynamic config; prebuild/release not run yet.
- tesseract.js postinstall is donation messaging only; explicitly disabled in pnpm allowBuilds. All runtime OCR is free/local and original bytes are stored privately with AES-GCM.
- Existing private media HTTP handler lacked authentication. New handler enforces owner/firm/Super Admin access; binary reads must carry Bearer auth.
- API contracts use nullable missing fields, distinct monthly/total/per-area prices, room kind, units, contacts and UNKNOWN availability. Approval is atomic and idempotent; reimport preserves broker edits; optimistic revision conflicts tested.

## Scope extension confirmed 2026-10-15

- Gurugram city and its sectors only; exclude Sohna/Manesar district-only records unless explicitly part of the city scope.
- Inventory → Area Directory on web/native; retain the same five primary tabs. Separate module policy for directory access.
- Cover screenshot filters in a shared field/filter registry: purchase/tenure, investment/pre-leased, possession, new booking/resale, locality/project/builder, size with units and basis, amenities/facilities, photos/video, posted-by/source, verified data and sort by recency/price/unit rate. Add contextual residential/commercial/land details.
- Public directory sources: HRERA registration register, TCP Haryana/OFA and public authoritative GIS where accessible. Keep source URLs, fetched date, source record identities and coordinate provenance; distinguish registration, possession and actual availability. Do not claim exhaustive coverage or invented map coordinates.
- Current local evidence: all workspace typechecks passed; shared16, API unit29, broker-first/source e2e9 and web Playwright3 passed. Android v2.0.0 build9 signed build succeeded; certificate verified. Native runtime/device and staging cutover still pending.

### Scope extension implementation checkpoint

- Shared typed property registry covers screenshot filter families and residential/commercial/land detail fields. Web/native editors, import review and filter interfaces use it. Server filters validate JSON fields, units, media and posted-by; derived price and per-sqft rate maintained on edits/approval.
- Area Directory implemented inside Inventory on web/native, independent directory permission, paginated list, source details and a Leaflet map with source coordinate provenance.
- Private directory snapshot imported into isolated UI DB: 865 HARERA + 600 TCP licensed colonies + 637 OSM named buildings/areas = 2,102 source records; 1,237 with geometry/coordinates. Separate source identities intentionally retained. See DIRECTORY_SOURCES.md for boundary age and coverage limitations.
- Chat export exact duplicate protection across overlapping exports requires explicit group, sender, timestamp and text; duplicate source evidence retained. No fuzzy merging.
- Updated shared tests 17 passed; broker-first/source-ledger e2e 11 passed, including typed filters and overlapping exports. Remaining UI/build checks follow new directory changes.

### Latest verified checkpoint — 15 October 2026

- New server checkpoint `/opt/brokeriq/backups/checkpoints/20261015-174354-broker-first`: encrypted database/secrets/source and private media; actual scratch restore, exact per-table counts matched. No cutover yet.
- Four Playwright journeys passed, including import approval, direct-route gating and the source-backed directory map; all workspace typechecks and web production build passed.
- Shared tests 17 passed. API historical regression after durable-queue adaptation: 19 passed; broker-first/source suites: 11 passed. Earlier full API run: 114 passed and one old queue expectation failed, now repaired and rerun.
- Controlled register source importer stores original PDF and all 117 authenticated page images with checksums. Isolated import: 1,461 candidate blocks, all NEEDS_REVIEW, zero invented/auto-approved inventory. This is not a final property count or a completed page-by-page transcription.
- Register review supports selecting the original page and splitting multiple units. Source import is resumable and does not overwrite existing reviewed entries.
- Mobile draft selection, completed-review state, source group preservation, pushed-screen safe areas and password-first login corrected. Updated signed Android build and emulator checks are in progress.

### Staging cutover — 15 October 2026

- Fresh database `brokeriq_b2b_20261015` is active. Original `brokeriq` database and original `/opt/brokeriq/app` checkout retained. Only BrokerIQ API/web process registrations changed; nginx and other product processes unchanged.
- Current application pointer: `/opt/brokeriq/current` → `/opt/brokeriq/releases/f02daa4` (release commit a403ad3 plus later operational updates). New encrypted media root `/opt/brokeriq/storage/media-b2b`.
- Verified over public HTTPS: Yash SUPER_ADMIN login, Rahul BROKER_ADMIN login, admin modules 200 for admin/403 for broker, disabled deals 403 FEATURE_DISABLED, directory 2102, import batches 1, Today 200. Actual old-process cwd retention was detected and corrected by recreating only the two BrokerIQ process registrations.
- Rollback: `/opt/brokeriq/backups/cutover/20261015-175526/rollback.sh` restores original environments, release pointer and BrokerIQ registrations. Old business database is not dropped or renamed.
- Original PDF and all 117 pages imported privately; 1461 candidate blocks NEEDS_REVIEW, canonical inventory 0. Manual transcription/reconciliation is still required; do not claim full inventory completion.
- Android v2.0.0 build10 signed, certificate verified and installed on emulator. SHA256 `e3d7933c3cc9a6b32d77bd9cd6a735694ed01bfe496ac6ec80b20cc603881b77`. HTTPS APK returns 200. Native broker login and Today with live review count verified; further native flow checks ongoing. Real-device and live-provider tests pending.
