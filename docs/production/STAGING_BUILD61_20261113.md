# Staging Build 61 · 2.3.20

Published 13 November 2026, **16:18:58 IST** (`2026-11-13T10:48:58.011Z`). API, web and the signed APK use pinned source `980e4ee709683db2984a8e97628863addc7384c2`.

- APK: https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.20-build61.apk
- SHA-256: `cc180ab16ff9f59ee9f9affe71904b3ad58add75dfae556291b21dca15196bf2`; 186,603,550 bytes. Existing signing certificate retained.
- Independent public full-byte APK verification passed. API/database health, executable paths, all three landing timestamps and the in-app update identity agree.
- Signed Build 60 upgraded in place to 61 on the QA emulator. First install time stayed unchanged; activity launch returned Status: ok. Secure main/face activities, required permissions and 60 native library alignment checks passed. This is not physical-device acceptance.
- Live landing controls passed 320/360/390/768/1024/1440 px, Hindi, theme switching and reload persistence, with no horizontal overflow. All 16 gallery images and four PDF guides matched expected hashes. Existing captures retain their Build 57 provenance; they are not relabelled as Build 61 captures. All guides include a visually checked Build 61 supplement.
- Fresh encrypted off-host backup was restored into scratch: 101 tables, 827 files, 2,517,853,645 media bytes. No application was started against restored customer data. No schema migration or seed was applied during this release.
- Inactive generated build paths reclaimed 6,971,490,304 bytes. After verified activation, the stopped compiler checkout's generated Android/dependency outputs reclaimed another 4,051,054,592 bytes. Final usable space: 23,992,172,544 bytes. Current and rollback releases, backups, databases, uploads and credentials were protected.

## AI and provider status

OpenRouter is enabled for normal assistance, using the configured encrypted key unchanged. Only free model identifiers are accepted; all price caps are zero and provider data collection is denied. A live-settings diagnostic passed Hindi draft generation and tool selection on `dots-studio/dots-3-note-preview:free`. No tool or client message was executed. Reported key usage stayed zero before/after. Hosted Qwen remains fallback.

Text/vision capture approval is **OFF**. Actual pipeline evaluation produced 96 of 101 development-reference records and five photo results; one provider group was unavailable. Area units, OCR prices and independently reviewed holdout acceptance still prevented full capture approval. Never treat that result as a passed quality gate. Additional printed-unit/list hardening after the release pin is a separate, unshipped source change until its own verified release.

Gmail review was submitted with the owner's action-time acknowledgements and the real Unlisted QA demo https://youtu.be/tUPaKR6GR2I. Verification Center visibly reports **Your app's data access is under review**. Final Google approval and any required assessment remain external. No assessment/payment was purchased.

## Verification boundaries

Before the release pin: 84 API/import/AI/inventory tests across nine suites, workspace typechecks, 123 mobile tests, six real API assistant permission/tool tests, 21 messaging/provider authorization checks and six real-browser launch/product journeys passed. Actual property/avatar upload persistence, revision conflicts and firm isolation were exercised against isolated PostgreSQL/API; selected property-photo links survived an encrypted internal Inbox draft. This is link sharing, not a binary-attachment claim for every channel.

Physical Android camera, push, background location and real login retention remain user-deferred. Live incoming SMS acceptance remains user-deferred. Full production sign-off, independent AI semantic acceptance and final Google approval are not claimed.
