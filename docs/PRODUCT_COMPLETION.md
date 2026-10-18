# BrokerIQ — Product completion ledger, 18 October 2026

User scope: retain every existing capability; restore scanner discovery on web/native; WhatsApp text, screenshot and bulk TXT/ZIP imports into Inventory or Requirements through source review; comprehensive role-aware UI refinement; visible disabled upcoming catalog for every role; richer source-backed Area Directory details/media; verified signed Android and all web portals deployed.

## Acceptance rules

- Preserve private source/register data, page84 exclusion, offline drafts, queues, installed upgrade identity, credentials and all existing features.
- Keep five primary Broker/Admin sections. Surface supporting workflows through contextual actions and a searchable product catalog.
- Coming-soon presentation is separate from authorization. Show every configured COMING_SOON module to every signed-in role; disabled controls must not mount protected content or fetch denied data.
- Camera/gallery scans, image/text/ZIP capture, review editing, Inventory/Requirement selection, rotation/crop, retry and original-source readback must remain discoverable.
- Directory enrichments carry exact source URL, retrieval time and verified identity; absent data stays absent. Real project photos only; generated imagery is brand illustration only.
- Audit every route and shared component. Do not label all-screen acceptance complete from shared styling alone.
- No release claim without runtime checks, deployment identity, checksum and documented remaining external dependencies.

## Work packages

- [x] Feature and route inventory across native, public, User, Broker and Super Admin.
- [x] Scanner and bulk WhatsApp import workspace, durable native capture and source-review target selection (code and isolated browser/API verification; signed-device verification remains in release gate).
- [x] Role-aware product catalog, all configured upcoming modules visible and disabled (code/shared permissions verified; full runtime matrix remains in release gate).
- [x] Rich private inventory cards/details, all recorded fields and contextual actions (shared contracts and desktop/390px browser verified; signed-device gate pending).
- [x] Directory detail presentation and bounded enrichment prepared; exact-identity enrichment applied to isolated master data (1,122 records, one attributed real project photo; production application pending).
- [ ] Shared enterprise layout/components and route-by-route web/native refinement.
- [ ] Runtime visual/function/accessibility checks, regression suites, fresh signed APK, screenshot refresh and deployed all-portal checks.

## Route audit

See generated `docs/evidence/product-route-inventory.json`. Each route records its module mapping and source component, so unavailable paths and legacy aliases can be reviewed without deleting code.

## Capture/catalog checkpoint

Native `/scanner` authorization mapping restored. Inventory/Requirements expose direct scanner/import/paste actions. Capture preserves originals, multi-page camera/gallery sources and TXT/ZIP exports; named destination is stored as review guidance only. Existing public-listing scanner remains reachable through its explicit rental-draft route, including page preview/rotation. Native composer uses SQLCipher; web composer uses account-scoped IndexedDB AES-GCM with non-extractable keys and cross-tab key creation serialization. Bulk file input snapshots FileList before async draft persistence and resets, preventing empty uploads. Shared roadmap presentation does not grant API access.

## Inventory / Directory presentation checkpoint

Web Inventory now has table/card views and read-only detail hierarchy before editing. Both native and web expose recorded configuration, pricing/terms, amenities, contacts, notes, media and private source audit. Zero/false facts remain visible. Directory detail panels show exact-source project facts, expandable unit/approval/specification tables and map/provenance, with absent photos explicitly identified. The metadata-only importer dry-runs by default, matches exact identities, creates an exclusive durable private backup before writes, and atomically rejects mismatched/unknown sources. No inventory rows or original geometry/source timestamps are changed. Real PostgreSQL rollback/preservation tests passed (2/2); shared tests 31/31; browser scanner/catalog and rich detail checks 2/2. Full source enrichment and production application remain release work.

## Workspace audit checkpoint

91 static signed-in routes were exercised at 390px through real APIs: 42 Admin, 35 Broker, 14 User, including 13 disabled future routes. Final audit captured no page/hydration exception, unexpected API failure or page overflow. Shared headers, 44px controls, mobile Admin record cards, complete System tool discovery, role controls, validated forms and sticky guarded saves were refined. Route checks found and fixed activity pages without a chart default, invitation plans querying a disabled billing endpoint, long profile email overflow, homepage-editor overflow, and a customer-requirements module-registry collision. Customer requirement actions are now sibling controls rather than nested buttons. Capture/import drafts remain bound to their original account during async writes/account changes. These checks cover route rendering, not every possible populated-data interaction.

Regression checkpoint: shared 31 tests; API full run 127 passed / 18 conditional skips; separate Broker-first suites 18 passed; native 17 tests; all 12 Playwright journeys passed in four isolated server groups to preserve the real login rate limit. Web/API/native typechecks passed. APK24 signed with the existing certificate; emulator upgrade and production promotion are in progress.
