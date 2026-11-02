# Team detail and permission checkpoint — 2 November 2026

## Changes

- Mobile Team cards now open a dedicated `/team-member/:id` page with list/back navigation. Removed the modal editor whose one-time `useState` initializer ran before a member existed, leaving fields blank/default0.
- Web detail now reads the authorized single-member endpoint instead of fetching a whole team and searching for the id. Both platforms display actual metrics, profile/targets, account status, last recorded position/accuracy and explicit KYC/Time Logging links. KYC documents/review are in the KYC module; removed obsolete unauthenticated image/review controls from the web Team detail page.
- Unset targets remain unset; explicit0 is preserved. Changed members have `expectedUpdatedAt` conflict protection inside the serialized membership transaction; target-only changes also advance the revision timestamp. New clients keep a draft on conflict rather than silently replacing a newer edit. Legacy update requests remain compatible.
- Agent `/leads/assignees` now returns only their own member record. Previously that picker reused the full team reader and could expose peer KYC/location/metrics despite the management screen being denied. Broker Admin retains their own firm's picker. Real negative tests cover role/query/export/foreign member boundaries.
- Super Admin Team query with no firm returns actual all-firm members/invites and firm identities, with no first-active-firm/current-user-org fallback. Explicit firm selection remains supported. This does not complete Super Admin parity across every other module.
- Team role/status query values are validated; date ranges reject impossible/reversed dates. Selection intersects other query criteria, including member id, rather than replacing permission/filter scope. Positions come from firm-scoped shift history rather than a user's cross-firm legacy location ledger.
- Mobile Team includes role/account/KYC/member/search/joined-date/sort controls, selected/filtered CSV/XLSX/PDF export through authenticated binary requests and the OS share sheet. No public report link/token is created; temporary report file is removed after sharing. Export rejects account/role/firm changes during response reads.
- Web Team export uses the exact filtered/selected member ids, covering KYC/location filters that previously were absent from the server export request. Up to500 explicit members per export; larger exports need server-side query-filter pagination before acceptance at larger scale.

## Verification

-16/16 Team source + actual Nest/PostgreSQL release cases passed, including two new hierarchy/privacy and stale-edit cases.
-33/33 combined Team/ownership/KYC regression cases passed on the isolated test database. Real Gmail/SMS/Inbox35 cases passed separately at008e61b.
-Mobile80/80 source tests pass, including authenticated report bytes and late role-change rejection. Workspace types pass. Browser/native bundle/staging-installed UI acceptance remains required.

## Staging clarification and release gates

User reconfirmed existing `brokeriq.mymultimeds.com` is staging and requested connected-account testing there. Repository DEPLOYMENT.md agrees; live inspection found only one BrokerIQ service pair/API3100/web3101, database brokeriq_b2b_20261015. Chrome was logged into Rahul/Olive Estate and visibly showed WhatsApp and Housing Connected plus current lead counts. No settings changed and no outbound message or manual synchronization was triggered by this inspection.

This environment contains real business data: do not seed fixtures, reset it, copy credentials into local QA, or run destructive/concurrency tests there. Builds must be made in a new candidate directory and current services changed only after backups, migrations, coordinated client compatibility and rollback checks. Production launch is still the final objective; staging acceptance does not itself close APK/device/provider/manual/performance gates.
