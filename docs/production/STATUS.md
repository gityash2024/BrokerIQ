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
