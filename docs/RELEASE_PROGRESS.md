# Broker-first release — implementation ledger

Approved scope: two initial accounts (Super Admin and Olive State broker), five broker sections, all property types, Hindi/English, share/paste/export capture, free AI, current instance treated as staging. Preserve future product code.

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
