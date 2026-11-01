# BrokerIQ production implementation status

Baseline: feat/production, 93bb8a0. Existing live data is production data; never seed test records into it.

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
