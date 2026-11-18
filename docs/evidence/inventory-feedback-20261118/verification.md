# Inventory client feedback — 18 November 2026

## Implemented scope

- Agents can browse verified Available inventory from their own firm. Other members' house/unit numbers, contacts, images, source records and exact navigation require a per-property, per-Agent approval. An Agent's own inventory retains existing access. Approval grants viewing, not editing. CSV/search use the same privacy boundary.
- Broker Admin reviews access requests; Sub-Broker Admin requires the separate `inventory:approve_details` permission. Pending/rejected/revoked requests, duplicate submissions, stale reviews and other firms are handled explicitly.
- Future availability stays in the record's selected directory month and shows its separate Available from date.
- Lead assignments persist a notification and a retry-safe acceptance. Reassignment invalidates the former acceptance token. Lead list shows Location and requirement BHK/furnishing, with Source last. Explicit portal wording fills missing requirements without replacing reviewed fields.
- Sharing uses the client's requested Location, Config, Furnishing, Floor, Price order. House/unit number, area, management name, transaction and reconfirmation boilerplate are excluded from client text.
- One opaque BrokerIQ photo-gallery URL opens a browser carousel or native gallery. Inbox private-inventory selection supports details plus the gallery link on Web and Android. Existing actual photo-file sharing and published-listing sharing remain available.
- Received HTTP(S) links are clickable and canned quick replies are English. Native gallery intents are explicitly recognized.

## Verification evidence and limits

- Full historical API regression: 531 passed, 33 skipped in its documented `BROKER_FIRST=false` environment, isolated PostgreSQL database.
- Broker-mode release regression: 50 passed before the additional revocation test; final affected Broker-mode suites: 36 passed, including revocation, stale review, retry, cross-firm isolation and reassignment scenarios.
- Final historical affected suites: 9 passed, 10 environment-specific skipped. Shared and mobile regression logs are private operational artifacts. Repository-wide TypeScript checks passed.
- Browser controls exercised on an isolated QA firm: locked Agent request, delegated approval, unlocked Agent details, Agent lead acceptance, private inventory selection, safe message draft, clickable Housing link, anonymous gallery and next photo. Lead column order and Admin review controls checked in the browser.
- No QA users, inventory or conversations were added to production. No real WhatsApp messages were sent during verification.
- Physical handset/WhatsApp delivery, push-provider receipt and iOS signed-device testing require separate acceptance; source tests or emulator checks do not establish those outcomes.
- Production activation requires a matching pinned Web/API/Android release, a verified database backup before the two additive migrations, unchanged database row counts and public release/APK checksum checks. Rollback keeps the additive schema and restores the previous application release.
