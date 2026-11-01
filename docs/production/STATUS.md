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
