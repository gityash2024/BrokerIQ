# Staging Build 59 · 2.3.18

- Published: 2026-11-10 23:04:32 IST (17:34:32.783 UTC).
- Pinned API, web and APK source: `4901ce9cdacfe93bc36dd007951bfc702ec12c19`.
- APK: [BrokerIQ-v2.3.18-build59.apk](https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.18-build59.apk), 186,569,658 bytes.
- Public APK SHA-256: `279630d516d7e1b409f107fbd86a49bd1955d6b60d78a3bf25118c9d09ef8aa1`.
- Signing certificate SHA-256: `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce`.

## Verified

- Workspace typechecks, 455 API tests (33 configuration-dependent skips), 123 mobile tests and 30 separately run PostgreSQL checks for SMS, location, notifications, KYC and visits.
- Android APK identity, signing, required permissions, 16 KiB alignment, and secure-window bytecode in the main and face capture activities. Installed over Build 58 on the QA emulator, preserving first install time. App UI rendered and the window reported SECURE.
- Candidate API/database health, unauthenticated API denial, public landing timestamps, 16 existing gallery images, 4 PDF guides and 5 legal/support routes. Independently checked the complete public APK bytes.
- Encrypted off-host backup restored to scratch: 101 tables and 806 media files verified. No schema migration. Build 58 retained for rollback. BrokerIQ's generated native outputs and Gradle transform cache reclaimed about 5.6 GiB; about 21 GiB usable remained after activation.

## OpenRouter and acceptance boundaries

- Encrypted key authenticated. Every OpenRouter request uses free-only model selection, zero price caps and data collection denial. Live OpenRouter is disabled; diagnostics used synthetic content, reported zero cost, and observed unchanged key usage at zero.
- The tested free models did not qualify for automatic capture. The tested extraction model passed 3 of 8 synthetic checks and failed both image checks. Independent holdout precision/recall thresholds remain unverified. Existing OCR/rules remain available.
- Emulator and code checks do not verify physical Android login retention, KYC camera, actual push delivery or background location. Live inbound SMS acceptance was deferred. Gmail's Google production approval remains separate from staging acceptance.
