# Broker-first release — implementation ledger

Approved scope: two initial accounts (Super Admin and Olive State broker), five broker sections, all property types, Hindi/English, share/paste/export capture, free AI, current instance treated as staging. Preserve future product code.

## Current status — 16 October 2026

The sections below this summary are chronological implementation history. Their older counts and pending items describe earlier checkpoints.

- Deployed app runtime: `e7b163d`; source-review CLI: `49bbbc9`. Fresh BrokerIQ B2B database, two launch accounts, role/module gates, five broker sections, typed inventory/requirements, durable imports, Area Directory and landing page are live. Only BrokerIQ-owned paths/processes were changed.
- Signed Android v2.0.0 build 16: `https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.0.0-build16.apk`; SHA256 `ef2bd27e235b88b014bf229a68d44637bbb9b2f0b611d90f051274f14295fc33`. Complete public download was previously hashed; signing certificate unchanged. Build16 includes pending/all source-review views and removes the unused overlay permission, with the broker-confirmed unspecified additional-room field; schema, extraction, web/native editing and filters share it. Upgrade on the emulator preserved the local draft and its value after force-stop/restart.
- Native emulator checks cover Hindi/English login, text/image Share, persisted offline draft recovery after restart, directory map/list and safe-area filters. Real Android hardware has not been tested.
- All 117 register pages have a first visual transcription: 1,933 source groups, 851 approved groups, 895 source-linked ledger records, 1,051 unresolved groups and 16 confirmed repeated-scan groups. User requested skipping page84: 15 ignored groups, its prior record recoverably archived; raw evidence retained. Zero unexamined pages / pending original OCR blocks. All ledger availability is UNKNOWN. This is not a final count of unique physical units. See [REGISTER_RECONCILIATION.md](REGISTER_RECONCILIATION.md).
- User-confirmed pocket/locality corrections and 1+1 / 2+1 / 3+1 security terms were applied through version-checked source review. TF means Top Floor with unknown numeric level; CNP is a historical call-not-picked note. NC/PD do not create structured facts. Original evidence and superseded confirmations remain private.
- Full 117-page replay created zero new approvals/records. Context amendment replays are also no-ops. Live HTTPS inventory/Today counts match the database; broker admin access and disabled modules return 403; unauthenticated PDF source access returns 401.
- Latest validation: shared 23 passed; full API suite 123 passed / 12 skipped; broker-first/recovery suites 15 passed; workspace typechecks passed; production API/web builds and post-deploy health passed. Latest runtime Playwright rerun: 12 passed with the isolated PostgreSQL job worker enabled. Native emulator checks remain relevant. No live provider test is implied by isolated fixtures.
- Current verified backup: `/opt/brokeriq/backups/checkpoints/20261016-175009-broker-first` (895 active ledger records plus the archived page84 record, restore verified). Encrypted DB/secrets/source, active private media and register operator/transcription evidence; actual scratch database restore with exact public-table counts, media SHA256 comparison and decrypt/extract/hash verification of register evidence.
- Housing/WhatsApp credentials and an explicitly authorized WhatsApp test recipient are still awaited. Real Housing sync, WhatsApp send/receive/delivery and physical Android-device verification remain open. Do not claim full production-launch readiness.
- Directory coverage: 2,102 source identities / 1,237 mapped; not an exhaustive list of unique city projects. Original inputs, OCR evidence and prior APKs are privately archived; active local/public downloads retain build 16 only. Product/future-module code and signing material remain intact.

## Remaining launch acceptance

- Resolve uncertain register digits, room/floor/unit boundaries, price ranges and possible repeated-property observations in the authenticated review queue. Uncertain fields are not silently guessed or imported as verified values.
- Verify real Housing sync and WhatsApp send/receive/delivery after the user supplies credentials in Settings and explicitly authorizes a test recipient.
- Install the signed APK on a physical Android device and verify the five sections, sharing, keyboard, filters and offline drafts. Emulator evidence does not establish physical-device acceptance.

## Completed verification

- Current initial server release: de168ac, BrokerIQ-specific API/web processes only.
- Recoverable checkpoint: /opt/brokeriq/backups/checkpoints/20261013-181702-broker-first. Encrypted database/secrets/source plus media; restore into scratch database succeeded and exact counts for all public tables matched. Scratch removed.
- Foundation commit pushed: 26c6267. Shared module policies, HTTP/job/cron gates, current membership authentication, minimal web navigation, admin create-broker UI/API, safe bootstrap, missing original inventory migration.
- Isolated local PostgreSQL: 127.0.0.1:55432, brokeriq_release_test; initialized under ~/Library/Caches/BrokerIQ/release-postgres. Never use existing business databases for tests.
- New inventory/source/requirements migration applied to isolated test database. Shared tests: 16 passed. Broker-first + source-ledger e2e: 6 passed (real Postgres). Typechecks passed at checkpoints.
- Fresh offline Apple Vision OCR and 200dpi renders captured all 117 pages from original PDF. Original SHA256: 46173d8bb00bf10253c3fbb8c72941b69b5793c008c60fff9dc5824c5091764f. Private output in ~/Library/Application Support/BrokerIQ/imports/<sha>. These raw OCR observations are not verified inventory.

## Initial implementation backlog (historical; see current acceptance above)

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
