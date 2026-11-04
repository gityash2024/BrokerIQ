# Build 55 staging publication

Build **2.3.14 / 55** published on **4 November 2026 at 13:09 IST** from `f606692d0b3299a03e76a617f3c2c7fd181d0732`. The running API, web release manifest and Android embedded Expo configuration all resolve to that commit. The signed 186,565,574-byte download matched SHA-256 `1f8f67dfa7377473d771e53f50d60760f28920d9fb83836de17fce3e4daf728c` independently on the server and the Mac. The existing signing identity, 60 native library alignments and secure flags in the app and face-capture activities passed artifact checks.

Chrome showed Build 55 and the actual publication timestamp on all three landing cards, the company details on public Terms, Privacy and Contact, and sign-in for unauthenticated Admin access. The runtime update link points to Build 55. Email OTP stays required and the minimum Android version remains 2.3.0. Build 54 is retained as the rollback. Eight unrelated PM2 services retained their PIDs, status and restart counters. Staging used the preverified off-host restore covering 101 tables, 665 media files and 10 private KYC documents.

The release includes icon-only mobile lead contact and timeline actions with accessibility labels, a responsive mobile header and lead notification entry point, searchable Super Admin sidebar groups and resource links, narrower Inbox/Pipeline layouts, permission continuity and oversized inbound WhatsApp attachment handling. Build 55 resumed from the same clean Android prebuild after the memory ceiling interrupted packaging. The matched web build ran in a separate bounded service after native verification to avoid concurrent Gradle memory pressure.

Hosted CI run 41781829778 passed 23 Chrome tests, 72 focused Broker-first PostgreSQL tests, 449 full API e2e tests with 33 configuration skips, and 115 mobile source tests. The static browser audit covered 91 routes at 390 px. Separate 320 px tests exercised Super Admin sidebar navigation and Agent scope. Browser fixtures ran against isolated PostgreSQL. Staging browser evidence covers the public surfaces and anonymous Admin guard.

The two-hour local soak passed with 20 concurrent sessions, 709 rounds, a 10.26 s maximum cadence gap, and list/detail/mutation p95 of 73/62/51 ms. This measures the isolated Nest/PostgreSQL environment. Representative staging load acceptance is tracked separately.

Physical upgrade and data retention, camera, screen capture/recents/recording, background GPS, and push device behavior remain pending. Gmail is connected for the authorized testing mailbox and Textbee signed delivery receipts were observed for the authorized diagnostic. Full client-linked provider journeys and Gmail production approval remain pending. The AI quality target, same-build mobile screenshots and four final manuals remain open. No full production sign-off is recorded.

See `docs/evidence/staging-build55-20261104/` for the release, landing and soak evidence.
