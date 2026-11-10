# BrokerIQ production implementation status

Baseline: feat/production, 93bb8a0. Existing live data is production data; never seed test records into it.

## Current checkpoint — 5 November 2026

Build 57 is the verified staging release, pinned to `58bd4eaf73b4351053219f3acc8ff7f6316f46c4`, version 2.3.16, published 5 November at 10:44:25 IST. All 11 gallery assets, four public guides and three landing timestamps were fetched and checked; the full public APK hash matched. API/web/runtime identities agree and eight unrelated services are unchanged. See `STAGING_BUILD57_20261105.md`. The dated sections below retain their historical results.

Build 57 fixes shared native header wrapping, puts compact-screen settings in a menu, and provides password visibility and inline OTP on web/mobile. All workspace typechecks, 122 mobile tests, eight SMS API/PostgreSQL cases and native artifact checks passed. A later Android 36 emulator check verified the signed Build 56 → 57 in-place upgrade, secure window, authenticated compact header, notification-to-lead route and four icon-only contact actions. Physical-device acceptance remains open.

The original diagnostic and client-linked SMS sends delivered; both pending batches on the replacement test lead later reached DELIVERED after the gateway resumed reporting. The user deferred SMS reply acceptance until the end. The replacement Gmail test completed a real browser send, provider acceptance, incoming reply, Inbox/timeline display, scoped notification link and duplicate-free repeat sync. The live check exposed stale lead activity time; the subsequent monotonic activity correction and explicit free/no-training AI transport restrictions are tested source changes after Build 57. Production Gmail approval, AI quality, physical Android acceptance and full role/workflow sign-off remain open.

## Build 58 preparation — 10 November 2026

Nine web and seven Android screenshots were captured with isolated QA data from Build 57, including the Customer, Broker and Super Admin interfaces. The Android captures use a debug APK separate from the signed download. The four reviewed A4 manuals and the expanded gallery are committed for the next coordinated release. Capture source, checksums and timestamps are in `../evidence/staging-build57-20261105/gallery-captures-20261110.json`.

Android QA found two additional issues: Expo treated the literal channel sound `default` as an absent bundled resource, and the Leads filter button clipped at 320 dp with 1.3 font scale. A reload with the corrected source eliminated the channel error and verified the complete Filters label and touch target within the screen gutters. The notification bell and More remained aligned, and all four lead contact actions remained within one row. All 123 mobile cases passed. Focused suites passed 18 AI adapter cases and 55 real PostgreSQL cases for Gmail, SMS, roles, firm isolation, Super Admin records and KYC privacy. Debug startup also logged a tracking module import cycle and a React pre-mount update warning. Both need separate investigation. The app continued to render.

The isolated Android QA checkout's generated project/dependencies and ten inactive web release caches were removed after retaining and verifying the QA APK. Available space rose from 16,358,600 KiB (87% used) to 21,751,892 KiB (83% used), a 5,393,292 KiB net gain. The current and immediate rollback releases were excluded. PM2 and Docker process identities and API/PostgreSQL health were rechecked. A fresh encrypted base/delta scratch restore verified 101 tables, 776 media files and 25 private KYC documents. Build 57 remains the published staging artifact until the next candidate passes the release gate.

## Latest connected staging checkpoint — 2 November 2026

Build51 supersedes50: pinned `a34015c4f54b6e70e2cd52b1086d64394d59666b`, v2.3.10, published **22:33:42 IST** (2026-11-02T17:03:42.683Z). Strict public/origin API/web identities, actual executable paths and embedded APK identity agree. Independent full186,664,770-byte public APK matches SHA256 `3a373f51136cbd604f53bb692e24a8177ed2c31cd48b1235639ddd6cd740fa0c`; signing identity is unchanged. All three landing timestamps/download and runtime latest51 match; minimum2.3.0/email OTP remain unchanged. Eight unrelated services retain exact PID/status/restarts. Actual encrypted off-host base+delta restore verifies101 tables/628 media/10 private KYC. Migration set remains43; no staging migration/seed/fixtures/reset.

This ships the WEB counterpart of private draft isolation: persisted cross-tab context revisions, role/firm form remounts, scoped AES-GCM capture/Inbox storage, verified legacy plaintext quarantine, conflict-safe encrypted moves and original-context binary/upload/chunk guards. Final /auth/me updates are fenced on web/mobile. Fresh19 Node WebCrypto/fake-indexeddb storage contracts and104 mobile tests pass, with all workspace types and zero changed-source lint errors. Node tests are not browser acceptance. API/shared sources exactly match49, so398 API/27 skips,82 Broker-first and65 shared results are inherited rather than rerun for51. Fresh native344-second build; secure activities, required permissions and60-library16KB checks pass. Hosted CI, browser and handset acceptance remain unverified.

Nine release/backup/native-build requests now have reviewed source/evidence mappings, bringing the current ledger to75/154 mapped and79 unmapped. The first51 provenance snapshot recorded66; source-provenance-reviewed.json records the later mappings against the SAME pin, with zero missing referenced files. No workflow status was promoted from file presence. Actual screenshots/manuals, historical draft ownership recovery,13-language notices, task-form restart persistence, all module/role/export coverage, provider delivery/consent, AI gold/ZIP OCR,20-session load/soak, full legal/operations signoff and all remaining launch work stay OPEN. Evidence: docs/evidence/staging-build51-20261102/.


Build50 supersedes49: pinned `7ce71947cd92eeb3d6e2a509a29638e26da3a4ca`, v2.3.9, published **21:59:40 IST** (2026-11-02T16:29:40.285Z). Strict public/origin API/web identity, actual PM2 paths and embedded APK identity agree. Independent full186,664,718-byte public download matches SHA256 `9a13969e0d40ffff9f84147b6f5b76da07f12c41c53cd654477ba6fd2e9fb8cb`; original certificate retained. All three landing timestamps, download and runtime latest50 agree; minimum2.3.0 and email OTP remain unchanged. Eight unrelated services are unchanged. Actual encrypted base+delta restore verifies101 tables/628 media/10 private KYC. Migration set remains43 and staging receives no fixtures/seed/reset.

This ships native AccountContext/epoch fencing, scoped private mutation/Inbox drafts, role/firm screen remounts, guarded queue and upload chunks, explicit guest workspace adoption, non-destructive legacy warnings/separate-draft flow and paginated Saved drafts. Full native JS/unit suites104/104 and all workspace typechecks pass. API/shared/web source trees are identical to tested49: its398 API passes/27 skips,82 Broker-first and65 shared results are inherited, not a freshly rerun database suite for50. Clean Android build424seconds; native secure activities, required permissions and60-library16KB checks pass. Browser/handset acceptance remains false.

The corresponding WEB private-draft/Inbox ownership review found account-only keys and sessionStorage deletion on role changes. That web correction is NOT in50. Legacy handset ownership recovery, durable follow-up/visit form restart persistence, full module/role/field/export/language coverage, providers, AI holdout/ZIP photos,20-session load/soak, actual screenshots/legal verification and four final manuals remain OPEN. Source provenance maps66/154 requests;88 remain unmapped. Evidence: docs/evidence/staging-build50-20261102/.


Build49 supersedes48: pinned `d70af6f4f4423070c9a1f429e3c01a7b40861d96`, v2.3.8, published **21:25:39 IST** (2026-11-02T15:55:39.583Z). Public/origin API/web, actual PM2 executable paths and embedded APK identity match. Independent full186,540,694-byte public download matches SHA256 `0289a4e7ec1d616a5d004a77a920aea04afae92f0a80e8ec9e102c1b32edcf12`; original signing certificate retained. Landing/version/timestamp/update link49 agree; minimum2.3.0 and email OTP preserved. Eight unrelated services remain unchanged. Fresh isolated full API398 pass/27 skips; expanded Broker-first82/82; shared65/mobile92/types pass. Fresh encrypted off-host backup actually restores101 table digests/627 media/10 private KYC. Migration set remains43; no staging migration/seed/fixture used. Native secure activities, permissions and60-library16KB checks pass; physical acceptance remains deferred.

This ships pending-visit/follow-up assignment transfer, idempotent assignment, eligible round-robin, invisible-task rejection, current notification recipient checks and task-bound native local reminders. Staff replacement does not repeat the same scheduled customer reminder. Native reminders reconcile task state on foreground/resume and successful mutations; old-scope/late OS scheduling and failed token-removal cleanup are guarded. No customer outreach or new staging automation rule was created by this release. Source provenance maps66/154 requests;88 remain unmapped. Browser visuals, physical device/providers, AI gold evaluation/ZIP photos, full role/module/export/language coverage, load/soak and four final manuals remain OPEN. See docs/evidence/staging-build49-20261102/.

A subsequent source inspection found private mobile draft queues and message drafts scoped only by user ID; same-user role/firm transitions could retain forms or replay old queued payloads in the new workspace. This is NOT fixed by49. Preserve legacy rows/files, prevent automatic unproven rebinding and require scope-bound client operations before closing that gate.


Build48 supersedes47: pinned `256f508713e229bc9feed6c38eca3bc411823d14`, v2.3.7, published **20:44:17 IST** (2026-11-02T15:14:17.443Z). Public/origin API/web, actual PM2 executable paths and embedded APK identity match. Independent full186,525,958-byte public download matches SHA256 `bd7a3af21293c676c493b887f00b656905f912b5378a117ab2fe936a521f0048`; original signing certificate retained. Landing/version/timestamp/update link48 agree; minimum2.3.0 and email OTP preserved. Eight unrelated services remain exactly unchanged. Fresh isolated full API392 pass/27 skips; Broker-first46/46; shared65/mobile82/types pass. Fresh encrypted off-host backup restores101 table digests/627 media/10 private KYC. Migration set remains43; no staging migration/seed/fixture used. Native security/permissions/60-library16KB checks pass; physical acceptance remains deferred.

This ships transactional in-app reminder/push outbox, current task/ownership checks before delivery, stale lead notification list/count/open filtering, durable visit-trigger work and correct provider rejection reporting. It does not yet ship the later pending-visit reassignment/round-robin/repeated-assignment corrections being tested. Whole-product, browser visual, physical device/provider, AI semantic evaluation/ZIP photo processing, full role/module/export/language coverage, load/soak and four final manuals remain OPEN. Source provenance maps65/154 requests;89 remain unmapped. See docs/evidence/staging-build48-20261102/.

Build47 supersedes46: pinned `b7f1273db0247c4360eb156d50546d459eab1c01`, v2.3.6, published **20:16:22 IST** (2026-11-02T14:46:22.003Z). Independent public/origin API/web and actual PM2 executable paths match. Full186,529,454-byte public APK matches SHA256 `56c3cc8c61d148515bac8e542cb6d73a931b070536c5a6824b5a724f5342740d`, embedded identity and unchanged signing certificate. Landing timestamp/download and runtime latest47 agree; minimum2.3.0/email OTP preserved. Eight unrelated services retain exact PID/status/restarts. Fresh full isolated API384 pass/27 skips; Broker-first30/30; shared65/mobile82/types pass. Actual encrypted backup restore verifies101 tables/627 media/10 private KYC. No migration/seed/fixture was applied on connected staging; migration set remains43. Native secure activities, permissions and60-library16KB checks pass; physical acceptance remains deferred.

This release includes the18-resource Super Admin business overview, explicit all-firm hierarchy/filter/search/archive/detail/CSV scope, dashboard current lead ownership and four-channel unread counts. Unapproved local Qwen is now excluded from structured JSON extraction after a real Sale post was misclassified as Rent; missing eligible free provider fails explicitly instead of claiming success. This is not AI quality acceptance. Browser visual checks, physical phone, remaining providers/AI evaluation/ZIP image processing, complete module/permission/export/language coverage, performance and four final manuals remain OPEN. Source provenance maps55/154 requests;99 are still unmapped. A test-only follow-up commit f31e0c0 corrects unsupported-role session setup; production application files are unchanged from the pin.

Build46 supersedes45: pinned `e0442adbc140f93604f67246910c3c5a23daa7c4`, v2.3.5, published **19:04:50 IST** (2026-11-02T13:34:50.640Z). Independent API/web/PM2 paths, embedded APK identity and complete186,523,882-byte public APK match SHA256 `75ab7107fb82d278625acb66a25af25d7c761c2ea32398c00d8c1a84130ec789`. Runtime latest/download and landing now agree. All eight unrelated services retain exact PID/status/restarts. Full fresh isolated API376 passed/27 skips; Broker-first20/20 plus13 ownership cases; shared65 and native82 pass. Actual backup restore verifies101 tables/626 media/10 private KYC. Two additive migrations were rehearsed with all100 original business-table digests preserved, then applied without staging fixtures (43 total migrations; ten core table counts unchanged). Real native secure activities/60 library alignment/microphone permission checks pass; no installed-device claim.

This ships retry-safe follow-ups, SMS/Email scheduled tasks, recruitment exclusion, purpose-correct assistant cards/search, bounded input grammars, tenant-safe ordered WhatsApp receipts and reviewed foreground native voice input. Full provider/transcription/AI-quality and all remaining product/visual/device/manual gates remain OPEN. The complete154-row ledger has52 requirements with source mappings;102 mappings remain incomplete. Its source-provenance proof is NOT workflow acceptance. See the Build46 section of STAGING_ACCEPTANCE_20261102.md and ROOT_CAUSES_20261102.md.


Build45 supersedes44: pinned `5cbd17279520c755a4e4afe0d0fbb45ae1143b17`, v2.3.4, published **18:25:50 IST**. Independent public/origin API and manifests, PM2 paths, full186,522,118-byte APK and embedded Expo identity match. SHA256 `9161b493ddb4a3cc214d588cd3828eeda3eeb1c9c6e0e13d92f2a6ba05d86cd1`. Native secure-window and all60 64-bit-library/16KB checks pass. Fresh isolated API361 passed/27 configuration skips. Actual encrypted base+delta scratch restore verifies101 table digests,626 media files and10 private KYC documents; eight unrelated services are unchanged. Admin Team routes/hierarchy and purpose-correct AI context are shipped. Follow-up atomic retries, recruitment classification and SMS follow-up source prepared AFTER this pin are not45. Browser visual acceptance, physical phone, remaining providers/AI quality/modules/performance/manuals and complete request reconciliation remain OPEN. See the Build45 section of STAGING_ACCEPTANCE_20261102.md.

Historical checkpoints follow; they are not the current artifact identity.

Build44 now supersedes43: pinned be21ed4/v2.3.3, published17:59:30 IST. Exact public/origin identities, full signed APK bytes and embedded Expo release identity match. Final full isolated API361 passed/27 skips; supported Broker-first37/37; native security/16KB checks pass. New encrypted base+delta actually restores101 tables/619 media/10 private KYC documents. Eight unrelated services are unchanged. Newly prepared Admin Team routes are later source, not44. Browser, physical device, providers, AI quality, remaining product work and final manuals remain OPEN. See the Build44 section of STAGING_ACCEPTANCE_20261102.md.


Build43 supersedes the preceding42 checkpoint: pinned0d6c2bc /v2.3.2, published2026-11-02T11:17:17.940Z (16:47:17 IST). Strict origin/public API, manifests, PM2 paths and full public APK hash match.354 real-PostgreSQL tests passed/27 configuration skips; separate Broker-first selection53/53 passes after the test-only stale revision correction. Shared61/61, workspace types and final native security checks pass. A standalone encrypted off-host backup actually restored101 tables/615 files/10 private KYC documents. Textbee existing device/SIM3 and outgoing-only signed webhook are saved encrypted; no diagnostic SMS or inbound acceptance yet. UI visual checks await browser access; installed phone checks remain user-deferred. Full goal remains OPEN. See STAGING_ACCEPTANCE_20261102.md.

See [actual staging release evidence](STAGING_ACCEPTANCE_20261102.md): product commit b58aac4 is deployed as signed v2.3.1/Build42. The exact origin/public API, portal/APK manifests, PM2 executing paths and full186,515,510-byte public download match the independently expected commit/build/hash. Landing and runtime update link are42. No additional migration was applied for42. Fresh isolated real PostgreSQL acceptance:346 passed/27 configuration skips. The preceding off-host chain restored101 tables and615 storage files with matching digests/hashes.

Actual Admin password/email-OTP sign-in and authenticated firm integration manager were observed. Olive Estate's existing WhatsApp/Housing are connected; Textbee key/SIM/filter/webhook/send/reply and firm Gmail OAuth remain pending. A pre-existing Broker Admin platform-credential deletion boundary and stale follow-up assignment leaks were corrected. All10 legacy KYC URLs remain blocked. Physical phone acceptance is explicitly deferred by the user. The original product audit, remaining providers/modules, publishable screenshots/manuals and performance gates are still OPEN. Historical checkpoints below describe their execution time, not the latest deployment.

## Accepted decisions

- Preserve every existing enabled capability and language; coming-soon modules stay disabled.
- Agent: assigned leads, own/assigned inventory, own imports/KYC/shifts/targets. Firm administrators: own firm. Super Admin: all firms with explicit filters.
- All chat imports enter independent Requirements as demand/offer/unknown. Reviewed offer conversion creates independent Inventory; source remains Converted.
- Normal rent and sale publication. Verified firm admin publishes; unverified firm requires Super Admin; agents submit for appropriate review.
- AI: local existing Qwen first where capable, free hosted fallback, no paid fallback. Draft/approval default; Super/Broker Admin control allowlisted autonomy.
- Topbar: global search, language/theme/notifications. Settings and module discovery move into sidebar.
- Four final manuals: Hindi/English Broker and Super Admin. New screenshots must belong to verified build.

## Work packages

- [x] M00 server cleanup and exact before/after service health evidence
- [ ] M01 reproducible native protection and honest release verification
- [ ] M02 shared action/ownership permissions and API/realtime scope
- [ ] M03 sessions and explicit five-device replacement
- [ ] M04 tracking events/background service/state-machine correctness
- [ ] M05 visit selection/association and internal messaging actions
- [ ] M06 independent typed requirements and idempotent conversion
- [ ] M07 purpose-aware publication and marketplace
- [ ] M08 navigation, team/KYC parity, native pose capture, filters/exports
- [ ] M09 free AI extraction, review, modes and evaluation
- [ ] M10 Super Admin hierarchy, invoices and live integrations
- [ ] M11 immutable deployment, production tests, load/soak and recovery
- [ ] M12 verified signed APK, screenshot refresh, legal pages and manuals

Every requirement and each platform has an explicit status in reconciliation.json. PENDING is not acceptance. Commit/push completed modules; deploy only a verified pinned release. Never change other running products for BrokerIQ work.

## Baseline findings

Build 40 download is an older artifact despite later mobile/shared source changes. Native FLAG_SECURE was edited only in ignored generated Activity and is absent from the shipped Activity. Landing still labels unchanged build26 screenshots as build40. Mobile KYC pose gating and member detail pages have source gaps. Native tracking relies on JS timers; capturedAt is dropped by API. Session issuance evicts old sessions. Super Admin team data silently chooses first firm. Site visit picker caps at 30 and merges distinct units. E2E harness defaults to a simulator.

## Validation recorded before implementation

Shared 42, API source unit 125, mobile 49 tests and all workspace typechecks passed. These do not prove real database, device, live provider, or production-flow acceptance.

## M01 checkpoint

Tracked with-screen-protection Expo plugin survives Android native regeneration. Three Kotlin/Java/idempotence/fail-closed regression cases passed. Actual regenerated MainActivity contains FLAG_SECURE. Signed APK/device acceptance remains pending. E2E harness now requires a real API target by default; simulation requires explicit opt-in and cannot run as CI acceptance. CI exercises plugin tests and codex branches.

## M02 checkpoint (not full permission sign-off)

Nine real NestJS/PostgreSQL regression cases pass; API source suite 125/125 and API typecheck pass. Closed conversation/search/requirements/import/dashboard ownership leaks, assignment-aware agent realtime delivery, Team alias validation bypass, private member detail boundary and last-active-admin orphaning. Targets and membership updates are atomic. Web logout disconnects realtime.

Fresh isolated database migration exposed previously absent InventoryItem.assignedToId and LeadStage.NOT_INTERESTED migrations. Additive repair migration and explicit Requirement creator/assignee migration now produce zero Prisma schema drift on a clean local database. They have NOT been applied to production. Existing rows retain values; only null assignments are backfilled from valid same-firm creators.

Remaining: complete shared action contract, exhaustive all-module negative tests, actual realtime/browser/APK checks and permission-cache journeys. No production release claim.

## M03 implementation checkpoint

Stable device-session IDs, atomic five-session limit, explicit login-authenticated replacement challenge, per-session HTTP/realtime revocation and encrypted 15-second concurrent-refresh retry response are implemented. Existing refresh rows upgrade transparently; access JWTs without sid request refresh. Onboarding updates the current session instead of consuming a sixth slot. Web/mobile login support password, OTP and Google session-limit selection. Network/provider errors do not erase mobile credentials. New selection copy exists in all 13 enabled language dictionaries.

Validation: 18 real Nest/PostgreSQL cases (six session scenarios plus nine permissions and three recovery cases), 125 API unit tests and workspace typechecks pass. Real Chrome on localhost:3311 showed five devices and successful selected replacement into /admin against isolated PostgreSQL/API. Evidence screenshot: output/playwright/device-selection-local.png. This is local development browser evidence, not an APK or production capture. Mobile installed-device and final release acceptance remain pending.

## M04 implementation checkpoint — native acceptance still open

Added root-registered Expo TaskManager location task using the existing SQLCipher-enabled SQLite store, explicit active-shift permission disclosure, foreground notification and owner/shift binding. Native captures use OS timestamps; JS timers no longer generate Android/iOS periodic captures. Web watcher and legacy team-location endpoint no longer record outside an active shift. Pause/punch-out/logout stop native collection; stale callbacks cannot restore a cleared binding. Queue writes precede dispatch, retries preserve IDs/times, permanent rejects stay available for review and account changes stop replay. Unowned legacy SecureStore entries are preserved without uploading them as another user.

Server serializes punch/pause/resume/location actions, retains one open interval and supports idempotent offline replay from completed shifts when captured in a valid active interval. Manual pause is never auto-resumed by GPS. All-firms time summary no longer silently selects the first firm; UI hierarchy work remains in M10.

OPEN: native background GPS-off detection, battery/permission interruption, process restart behavior, blocked legacy queue review UX and installed-device durability remain required before launch. Android clean prebuild succeeds, regenerates FLAG_SECURE, and retains SQLCipher configuration; this is not a signed APK acceptance result.

## Validation and test classification checkpoint

- Shared package rebuilds before its tests, preventing stale dist evidence; 43 source tests pass, including Unicode multi-property separators.
- Full API suite against isolated, migrated, master-seeded PostgreSQL: 250 passed, 25 Broker-first-only cases skipped in full-platform configuration. This includes 125 source unit checks; provider adapters inside legacy tests are mocked and are NOT live-provider acceptance.
- Separate Broker-first configuration: 46 passed across source-ledger, enterprise, team, module/role, sessions, location and ownership suites. No active Broker-first suite skipped in this selection.
- Mobile: 59 passed. SQLite outbox SQL is exercised through Node SQLite; Android SQLCipher encryption and OS task reliability remain device gates.
- Workspace typechecks pass; native protection plugin cases 3/3 pass; repository ESLint now has zero errors (existing warnings remain).
- Historical five-tier simulator is explicitly named test:legacy-simulation, outside real database acceptance. Its nine simulator suites pass as a self-test only. Corrected its first-of-month membership-count assumption; no production evidence derives from it.
- Four previously hard-disabled UI stubs were removed; their routes/tools remain controlled by the module catalogue. This did not enable Coming Soon modules. The hidden listing AI description entry remains M09 work; its existing handler is retained.

No new production deployment, production migration, signed APK, live provider delivery, load/soak acceptance or final guide has been declared complete.

### M04 offline restart follow-up

Persisted native pause binding now survives offline hydration; a transient null UI shift no longer clears an active binding. Owner checks reject late reads after account switching. Pause/resume responses include authoritative intervals, preventing break time from being counted locally as work. Validation: mobile 61/61, real PostgreSQL location suite 6/6, workspace typechecks pass. Physical-device restart/background acceptance remains open.

## M05 visit implementation checkpoint

Inventory selectors search the complete authorized server dataset with pagination and retain distinct units/floors. Visit records store an inventory foreign key plus immutable property snapshot; custom addresses and timezone-aware dates remain supported. Atomic submission IDs prevent concurrent retries from duplicating visits, activities or stage transitions. Rescheduling resets all reminder timestamps and optional optimistic concurrency rejects stale edits. Agent scope also follows the lead's current assignee. Legacy array clients remain compatible; new visit lists paginate. Android custom dates use SDK-compatible system calendar/time controls; follow-ups share that control.

Validation: shared 46, real PostgreSQL visits 5 plus Team/Broker-first regression 9, mobile 61, workspace typechecks and Android Metro/Hermes export pass. ESLint changed sources: zero errors. Browser, signed APK, reminder provider delivery and exhaustive visit acceptance remain pending. Internal messaging is the next M05 checkpoint. No production migrations or code deployment applied.

### M05 internal Inbox checkpoint

Lead list/detail, pipeline, follow-ups, visit actions, mobile swipe, AI reply and matched-property sharing now open the internal composer. API failures no longer launch external WhatsApp. Resolver is idempotent, preserves the Housing-only list rule, denies other assignees/firms and requires admin review before exposing unlinked historical chats. Sending rejects mismatched lead/channel/phone and blocked conversations; core conversation creation cannot silently rebind another lead. Draft text stays out of URLs; mobile uses the existing SQLCipher store and web uses account-scoped session storage. Role/firm changes clear privileged query caches.

Real Chrome/isolated API evidence: 56 properties paged through three pages; separate ground/second-floor choices; selected second-floor visit saved and rescheduled; WhatsApp action stayed internal and displayed the missing-integration settings link. Local screenshots under output/playwright are QA fixtures, never landing/manual images.

Validation: full API suite 260 passed / 25 Broker-first cases skipped (125 are source unit checks); separate internal-composer/permission selection 14 passed. Mobile 65 passed, including SQLite draft/account isolation. Workspace typechecks, Android Metro/Hermes export and changed-source ESLint (zero errors) pass. Provider adapters in tests remain stubbed; no WhatsApp live-delivery claim. Inventory-owner/client-phone sharing, full Inbox message/push lifecycle and installed APK acceptance remain open in M08.

## M10 Zoho email implementation checkpoint

User chose the existing YARVIX Zoho account and `hello@yarvixhq.com` after production Gmail SMTP ports proved unreachable. Added explicit SMTP/Zoho HTTPS provider selection, minimum-scope OAuth bootstrap, encrypted refresh credentials, masked views and bounded send-only adapter. Sender must be a positively confirmed alias on an enabled account. No silent fallback, message read/delete API, organization-admin grant or paid provider was added. Credentials alone do not mark a connection tested; edits invalidate old test evidence.

Validation: full API/PostgreSQL regression 272 passed / 25 Broker-first-only cases skipped, including 133 unit checks at that point; new adapter suite subsequently 9/9 after an additional disabled/unconfirmed-account case. Separate Broker-first email/session regression 10/10. Workspace types and API build pass; changed-source ESLint zero errors. Initial full run had a single `socket hang up` in the legacy token-confirmation test; isolated rerun 29/29 and subsequent complete rerun passed. Intermittent origin is not established. Zoho responses are stubbed in these tests, never live delivery evidence.

Real Chrome/local API renders disabled unconfigured provider choices, one-time code input, masked secret fields and setup validation. Zoho minimum-scope authorization is complete; credentials are encrypted in production with the integration disabled pending the application release. A server diagnostic from hello@yarvixhq.com was visibly received in Gmail at 14:43 IST on 1 November 2026. Application deployment, recovery/invitation delivery and new APK remain unverified. See EMAIL_INTEGRATION.md for the operational boundary.

## M06 independent Requirements checkpoint

Reviewed text/WhatsApp/image/TXT/ZIP imports create Demand, Offer or Unknown requirement records instead of writing inventory. Ambiguous interleaved posts retain original text as Unknown records; WhatsApp system headers are separated from surrounding property text. Existing approved inventory/register records are unchanged. Source provenance, reviewed fields, revision and conversion identity are retained. User-reviewed open offers convert within one database transaction; retries/concurrent clicks return the same inventory ID. Demand/Unknown conversion is rejected. Inventory edits preserve original requirement/source values. Web/mobile provide type filters, review/edit and explicit conversion; mobile edits retain account-scoped encrypted offline drafts. Conversion and matching controls follow Inventory module permission.

Validation: 27 real PostgreSQL/streaming/ownership checks; shared 48; mobile 65; full API JSON report 277 passed / 25 configuration skips; Android Metro/Hermes export and workspace types pass; changed-source ESLint zero errors. Corrected a historical test restoring Inventory roles without Agent, which contaminated subsequent permission tests. No production migrations/deployment or installed APK acceptance. Browser access recovered after reconnect. Real local Chrome created an offer, converted it explicitly into a 57th independent inventory record, and retained the original Converted requirement; evidence output/playwright/requirements-independent-conversion-local.png. Unsaved reviewed edits now disable conversion until saved. Embedded ZIP photo processing, comprehensive AI extraction/evaluation, bulk conversion UX and complete translations remain open; this checkpoint is not full M06/M09 sign-off.

## M07 publication implementation checkpoint — release acceptance still open

One shared policy now governs Inventory and legacy public listing submission, edit and reactivation: verified firm Admin and Super Admin publish directly; verified-firm Agent requires Broker Admin review; unverified firms require Super Admin. Pending review lists, public preview, rejection, resubmission and withdrawal exist on web/mobile. Review authority is rechecked against current firm verification inside the write transaction. Another Agent/firm cannot read pending details or mutate the listing. Every public-field edit, including price/contact, triggers policy again; Inventory-backed listings must use their explicit public preview.

Ordinary Rent/Sale is separate from the disabled New Projects flag; Buy/Plots pages and mobile Sale search work for core properties. Publication retains one listing per inventory item, checks revision/purpose/availability, and never creates Requirements. Public fields/photos are deliberately selected; private source paths are rejected. RENTED/SOLD/withdrawn records leave public discovery. Exact repeated submission is idempotent.

Validation: new 5 real PostgreSQL cases include concurrent retry, cross-firm/Agent denial, stale review, verification change and legacy price-change regression. Mobile 65 tests; workspace typechecks and Android Metro/Hermes export pass; scoped ESLint zero errors. Local Chrome shows PENDING_REVIEW → Super Admin and retains chosen public fields when reopened, with the Broker Admin queue correctly empty for that unverified submission. Full API/PostgreSQL regression: 282 passed, 25 configuration-specific skips. Adapted a legacy fixture that assumed all verified Admin listings still needed Super Admin review. No production code/migration deployment, signed installed APK, final share/microsite/provider/device acceptance or release screenshot claim.

## M08 navigation and performance checkpoint — KYC/native parity still open

Shared permission-aware workspace groups drive web sidebar accordions and mobile Product Tools. Settings lives immediately above the sidebar account footer; Agent sees a personal-account page without firm controls or firm-profile fetch. Header now contains authorized workspace search, languages, theme and notifications. Search resolves real Leads, Inventory and Requirements and opens selected record details. Coming Soon remains disabled and role-filtered; enabled modules are preserved rather than enabled by navigation. Existing 13 languages remain, with 17 new navigation/search translations in each dictionary.

Mobile has dedicated Time Logging history/date/member selection and separate performance/leaderboard screens. Existing Profile remains the mobile entry. Old More deep links resolve to that profile instead of exposing unfiltered management tiles. Own shift controls remain separate from the selected member's history. Dashboard drill-downs honor module/role permissions, and unknown native destinations no longer silently open an unrelated customer screen. Native lead/inventory screens now apply dashboard URL filters.

New source findings: Agent dashboard hardcoded 20 visits / 3 deals and 100% SLA; leaderboard simulated Quarter/Year totals by multiplying month totals. Those fabricated values are removed. Saved targets retain explicit zero; missing goals stay unset. Agent performance endpoint returns only own record without a misleading team rank; Admin receives own firm, Super Admin explicit/all firms. Calendar/range counts come from PostgreSQL, and monthly fulfillment is identified separately. Team default fabricated target/commission/revenue fallbacks are removed. SLA uses first-response timestamps, excludes unanswered leads still within the 15-minute deadline, and includes overdue unanswered leads as misses. Fixed UTC-naive timestamp comparison against PostgreSQL IST session NOW(). Lead calendar bounds are IST-inclusive days, with validated created/stage-changed field and matching dashboard filters.

Validation: shared 53; mobile 65; full API/PostgreSQL 285 passed / 25 configuration skips; Broker-first performance/team/ownership 17 passed; workspace typechecks; Android Metro/Hermes export; scoped ESLint zero errors. Local Chrome verifies Admin sidebar/header/global search-to-selected-record and Agent restricted menus, own account page, unset goals/no fake SLA, and own-only performance table. Evidence: output/playwright/workspace-search-local.png, agent-account-navigation-local.png. These are local QA; no production deployment/APK/device claims.

Open: remaining all-screen action matrix, other dashboard drill-down datasets, native member details/filters/exports, complete language/theme audit, authenticated KYC document privacy and real native/web pose pipeline, physical tracking/camera/push/offline acceptance. M08 is not complete.

## Additional accepted scope — notifications, Gmail/SMS, password + email OTP

See ADDONS_20261101.md and six separate ADD-* ledger rows. Scope includes the supplied `brokeriq:///` Unmatched Route, common notification destination handling/cold start/mobile header bell, Gmail + SMS CRM trails/processes, and email OTP after password login with later mobile-factor extensibility. Textbee official recurring Free quota matches 300 messages/month (50/day, sent+received); it requires an online Android/SIM and carrier allowance. Dedicated business device availability is pending user reply. These additions do not remove any earlier work or count as implemented/live provider acceptance.


## Notification add-on implementation checkpoint — provider/device acceptance open

Shared destination validation separates Requirements from Lead ids, maps web/native records and channels, preserves filters, rejects unsafe URLs and sends bare `brokeriq:///` to the initial home flow. Native warm/cold response consumption waits for session/navigator readiness, deduplicates taps and resolves an owned notification id through the real API. Local lead reminders recheck current Lead access; legacy unbound pushes open the notification inbox. Mobile common headers now include the notification bell and unread counter. Notification lists paginate beyond 50 and have explicit load/error/read states. Browser service-worker clicks resolve owned notification ids after login rather than trusting arbitrary push URLs. User-supplied custom notification data cannot replace delivery identity. Suspended/deleted/excluded recipients are filtered. Push registrations persist per account; late token requests cannot register for a switched user; logout cleans the saved token and that account's local reminders.

Validation: 57 shared tests; 68 mobile source tests (including three isolated native-API boundary tests, not physical push delivery); 3 new real PostgreSQL notification/ownership/pagination cases. Fresh migrated/master-seeded isolated PostgreSQL full regression on Node 22.17: 288 passed, 25 configuration-dependent skips. Workspace types, Android Metro/Hermes export and changed-source ESLint (zero errors) pass. Actual local Chrome notification click opened the assigned Lead and decreased unread count; an Agent's Admin destination was denied. Screenshots under output/playwright/notification-*-local.png are private local QA evidence, never release screenshots.

Earlier Node 24.21 run on the repeatedly reused regression DB failed a listing fixture lookup and crashed inside V8 garbage collection (EXC_BAD_ACCESS); its isolated broker suite reran 8/8. A subsequent reused-DB run stalled and was interrupted. Fresh DB + Node 22 full run passed; those two variables changed together, so the cause is not attributed conclusively to either one. Production/device release evidence remains required.

Still open: installed APK foreground/background/killed push behavior, durable push receipts/provider failure recovery, complete scheduling/reschedule/cancel reminder deduplication, full native equivalents for administrative destinations and exhaustive role/module/deep-link acceptance. No production code, migration or new APK has been deployed at this checkpoint. SMS sender choice is Olive Estate's existing WhatsApp number; Textbee setup and delivery remain pending.


## Email login factor checkpoint — production enforcement pending verified mail/release

Password validation now leads to a nonce-bound email factor when `auth.requireLoginEmailOtp` is enabled. No access/refresh token or CRM session is created before completion. Signup and verified Google login follow the same enabled policy; passwordless and verification-code endpoints cannot bypass it. Existing persistent refresh sessions continue normally. Session-limit selection is issued only after the factor, and old/non-factor selection tokens are rejected once the policy is enabled.

An additive LoginVerification table records only hashed challenge/code, credential/session-version snapshot, client binding, bounded attempts/sends and expiry. Codes use a random per-login nonce, expire after ten minutes, allow five wrong attempts and at most three sends with a 60-second cooldown. Resend keeps the original expiry and attempt count; ten first-factor challenges per account/15 minutes allow the sixth-device journey while bounding mail requests. Concurrent success consumes once; bad attempts commit before the error is returned. Account/password/session changes invalidate outstanding challenges. Failed mail delivery invalidates its challenge; production cannot return a devCode. Expired records are removed by maintenance and account deletion removes its challenges. EMAIL is the only active factor; the channel/requiredFactors contract permits a later SMS extension without making phone mandatory now.

Web/mobile show an OTP step, masked destination, numeric input, expiry, resend/error and back actions. Mobile uses a keyboard-aware scrollable modal. Production policy activation requires the selected provider's successful settings test and an enabled first-factor method. The default remains a backward-compatible rollout gate until application mail delivery and the final release are verified; the production launch gate must set/enforce it. Old clients receive LOGIN_OTP_REQUIRED with an update message rather than an access token. Phone OTP is not claimed operational.

Additional historical defect: the Google Identity script URL was `https://user/accounts.google.com/gsi/client` from commit 3a4c5f6f (17 October), an invalid hostname introduced before this launch audit. Corrected to Google's documented `https://accounts.google.com/gsi/client`. This was a source bug, not an APK cache issue. Real Google consent/provider sign-in remains a live-provider acceptance gate; tests stub only Google's token verification.

Validation: 9 new real PostgreSQL/guard/factor scenarios pass in Broker-first mode, including all four active roles, parallel consumption/attempts, expiry, password/session invalidation, sixth-device selection, passwordless bypass rejection, mail outage and production no-dev-code behavior; one also covers new signup and a stubbed verified Google first factor. Complete API regression before the last rate-bound/legacy-selection test addition: 296 passed, 25 configuration skips. Shared 57, mobile 68, workspace types, changed-source ESLint zero errors and Android Metro/Hermes export pass. Actual local Chrome password → OTP → Agent dashboard succeeded, using explicit local test delivery (not live email). QA screenshots output/playwright/login-email-otp-*-local.png are not landing/manual release images.

Production migration, selected Zoho application activation/delivery, enforced production login/recovery/invitation, installed APK upgrade and full translations/device acceptance remain open. Existing source privacy/KYC and all original module/release work are still required.

## KYC private media/review checkpoint — not deployed

Source privacy and review defects corrected; see KYC_PRIVATE_CHECKPOINT.md for exact evidence and open gates. New original-preserving encrypted storage, authenticated role-scoped previews, superseded history, exact-document review, firm/personal separation and native management navigation are implemented. Existing ten public provider documents have NOT been migrated or retired. Actual native pose capture, complete management parity, production client compatibility and installed-device acceptance remain open.

## Production data safety checkpoint

fd96714 records an actual consistent 99-table database snapshot and 595-file checksum manifest, encrypted off-host copy and successful isolated local restore with matching table digests and media hashes. No application/worker was started against restored production data; no production code/migration was applied. See BACKUP_RESTORE_20261101.md, including the local Homebrew cleanup incident and CLI repair. Refresh backup before final release if data has changed.

## KYC migration rehearsal — production untouched

All additive migrations applied to the actual verified production restore. All ten Cloudinary KYC originals were copied to encrypted private storage there (6,776,237 original bytes), with matching SHA-256 and full pre-migration KycDocument content digest after restoring legacy URL references. Ten original ciphertext files plus checksum report were age-archived off-host and verified. The Admin API omits ETag, so the migration now verifies stable provider identity/version and matching delivery/original downloads instead of assuming upload metadata is present. Four migration tests cover provider-boundary simulation and operations safety; live retirement is not evidenced. Production public URLs remain active until compatible web/APK and a post-copy off-host restore pass. See KYC_MIGRATION_REHEARSAL.md.

## Native guided KYC capture checkpoint

Tracked local Expo Android CameraX/ML Kit module now compiles and autolinks; native pose/blink gate 9/9, mobile79/79, workspace types and Android JS export pass. See NATIVE_KYC_CAPTURE_CHECKPOINT.md. Private retry/result handling is account/role/firm scoped, and late web/mobile API responses after permission changes are rejected. Actual phone camera, recording/recents protection, final APK alignment and signed upgrade remain open.

Textbee user setup inspected in Chrome: one online Redmi device (app 2.9.0/build20), one active masked API key, free dashboard quota 50/day and 300/month, one previously sent SMS. This is provider setup evidence only; no BrokerIQ integration or outbound diagnostic was performed. Existing dashboard exposes key rename/revoke only, not full-key recovery. User chose Rahul/Olive Estate SIM ending0802; actual device SIM association and inbound privacy filters still require phone-side verification.

## SMS/Textbee source checkpoint

See SMS_CHECKPOINT_20261101.md. Firm-scoped encrypted connector, owned SMS composer/trail, atomic single-attempt dispatch, signed filtered inbound, role-safe notifications, web/mobile SMS UI and complete message pagination added. Fresh API325 pass/25 skips, subsequent targeted20 pass, mobile79/shared58/types; provider/device/browser gates still pending. Nov2 Chrome reconnection now works: Textbee form, Lead SMS/Email internal routing, four Inbox channels and correct missing-integration settings links were visibly verified. No real provider credentials entered into the QA database. All applicable automated process integration and live provider delivery remain unfinished.

## Gmail CRM implementation checkpoint — 2 November 2026

Separate encrypted firm mailbox OAuth with PKCE and originating Admin/device-session binding; owned Lead Email resolver, durable single-attempt send/reply and client-only sync, plain/HTML-to-text body handling, cursor pagination, background job scheduling and generic role-safe notification trail added. See GMAIL_CHECKPOINT_20261102.md for scope, actual database/stub-provider test evidence and explicit sync-window/attachment limitations. Chrome verifies internal Email navigation and missing-connection link to the custom Gmail connector. Google production verification/consent, actual provider send/receive, all-process channels and installed APK are still required. Transactional Zoho OTP/invitation/recovery activation remains separate and pending.

## Team detail/permissions and staging checkpoint — 2 November

See TEAM_PARITY_20261102.md. Dedicated mobile member pages, current single-member web data, stale-edit conflicts, Admin/Agent picker scope, actual all-firm Super Admin aggregation, native filters/sort/selected exports and correct Time Logging member links implemented. Team16/16 and ownership/KYC/Team33/33 passed; mobile80/80/types pass. Remaining KYC/native management parity, full i18n, installed/browser/staging acceptance remain open. User clarified the connected mymultimeds instance is staging; Chrome Rahul/Olive Estate visibly confirms WhatsApp/Housing Connected. It contains real data, so all preservation/release gates remain mandatory.

## Staging candidate build / fresh restore — 2 November

Clean signed Android2.3.0/build41 from ef1ac65 compiled successfully, with the original upload certificate and real SHA256/bytes recorded in the private artifact sidecar. It is not installed or published. A subsequent full fresh API run passed340 tests/27 configuration skips but logged a concurrent Job key insert race from visit scheduling; that defect is being fixed before candidate publication. Do not call the passing suite evidence that its asynchronous errors were absent.

Fresh connected-staging snapshot has99 tables/604 files. Encrypted off-host base+fresh delta were fully authenticated, every file hash matched, and actual scratch restore matched all table content digests. See BACKUP_RESTORE_20261101.md. User has no Android phone now and will connect one later; physical acceptance remains explicitly deferred while code/build/staging work continues. Poppler22.02.0 PDF tools were installed from official Ubuntu packages with no package upgrades/service restart requested, enabling required private PDF previews; unrelated service health must be compared at cutover.

Concurrent reminder scheduling race corrected: atomic PostgreSQL conflict handling replaces the empty-update Prisma upsert;30 concurrent first-key requests produce one durable job and a running delivery is never reset. Queue/source-ledger/SMS/Gmail28/28 passed, API types/lint zero errors. See JOB_QUEUE_20261102.md. Rebuild the unpublished candidate from the fix commit before activation.


## Prepared next release source (after Build45)

Atomic idempotent follow-up submission/assignment, SMS+Email scheduled-task parity, recruitment-post exclusion, purpose-safe assistant cards/search, transformed-input AI grammar and tenant-safe ordered WhatsApp receipts are committed. Native microphone permission/configuration and reviewed transcription are corrected; the APK builder now checks actual required native permissions. The native voice root cause is tracked in NATIVE_VOICE_20261102.md. These changes require Build46/new exact pin plus fresh backup/restore, additive migration review, full isolated regression and signed public-byte verification. No device/provider acceptance is inferred.
