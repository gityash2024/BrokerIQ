# Build 54 staging publication

BrokerIQ staging published Android **2.3.13 / 54** and the matching portals on **4 November 2026 at 11:09 IST**. The public API, manifest and the two BrokerIQ PM2 executable paths resolved to commit `88ef337153c7d8c4b1ff032146353bbb9b391446`. The public download was hashed in full on the server and independently on the Mac. The 186,564,830-byte APK SHA-256 is `e44dbbef956a65a0b21df9a79dd34d67b1d97f4bc3f85d4dbc407d8312c15373`.

The clean Android build verified the existing signing certificate, four ABIs, alignment of 60 64-bit libraries, required permissions and `FLAG_SECURE` in both Android activities. Device acceptance remains open. The Build 53 rollback APK remains available. The encrypted off-host snapshot restored 101 tables and verified 664 files, including 10 private KYC documents.

The first activation from systemd inherited no HOME. PM2 opened a separate registry, so exact public API verification rejected the switch. Build 53 remained the live service. The retry explicitly bound to the existing staging registry, confirmed the private candidate again, then verified public API/web/APK before updating the runtime link. Commit `15bb5c9` persists the daemon guard. Only the two BrokerIQ services were selected by the release switch. The runtime minimum remains 2.3.0, latest is 2.3.13, and email OTP stays required.

Chrome showed the correct timestamp on all three public landing cards. The published Terms and Privacy pages and Contact showed the company details. The manifest contains zero Android screenshots pending same-release captures. Evidence is in `docs/evidence/staging-build54-20261104/`.

## Follow-up candidate 55

Commit `f606692d0b3299a03e76a617f3c2c7fd181d0732` includes the screenshot-reported mobile contact and timeline actions, narrow-screen profile header, Super Admin sidebar groups and record switching, Inbox/Pipeline mobile-width fixes and the oversized WhatsApp inbound attachment fallback. The web source passed 22 browser tests against a separate PostgreSQL database, including 91 static route checks at 390 px and the Super Admin sidebar at 320 px. Mobile source passed 115 tests. Five isolated WhatsApp database tests passed, including retained inbound caption and explicit attachment-limit status on replay.

Staging inspection distinguished 168 WhatsApp receipts with no matching outbound record, two unlinked Textbee diagnostic receipts and two inbound videos above the existing 12 MiB download cap. No message was sent or replayed during inspection. The video fix preserves future captions and message history when the attachment exceeds the cap. Unknown receipts still require a matching provider identifier and firm. They remain available for review.

Build 55 needs its own publication and artifact verification. Browser source checks cover the tested fixtures and routes. Physical Android workflows, production provider approval and end-to-end checks, representative soak completion, AI acceptance and final manuals remain separate gates.

The staging comparison found no PID, status or restart-count change across all eight unrelated PM2 services. The Build 55 backup separately restored 101 tables and verified 665 media files and 10 private KYC documents. The full isolated API regression at the Build 55 source passed 449 tests with 33 configuration skips. A subsequent isolated browser test used an accepted Agent invitation and verified assigned leads, CSV scope, personal settings and direct-route restrictions. Both verification steps used the existing product APIs and separate PostgreSQL databases.
