# Build 58 staging release | 10 November 2026

BrokerIQ 2.3.17 / Android 58 was published at **16:36:29 IST** from commit `cc7793b3f66554864581f97196f2469248d7313d`. Origin and public API/web, PM2 executable paths, embedded Android identity and app update settings match the pinned release. The signed APK is 186,569,090 bytes with SHA-256 `1347a89fd7cd0971d287d769198b6a7856270e6b92de840c61000749e0a11bef`. Build 57 remains the immediate rollback release.

## Verified changes

- Android uses the system sound for both existing notification channels. On the isolated Android 36 emulator the custom-sound error disappeared and both channel sound URIs resolved to the system setting.
- At 320 dp and 1.3 font scale the Leads toolbar wraps within the screen gutters. The notification bell and More controls share a row, and all four contact actions stay aligned. Opening an in-app notification on the QA emulator opened its matching Lead Details and lowered the unread count.
- Signed Build 58 installed over signed Build 57 on Android 36 ARM64 with the same first-install timestamp, rendered the marketplace and retained the MainActivity secure flag. Native bytecode checks covered both secure activities and 60 aligned 64-bit libraries. Authenticated user-data retention and physical-device checks are separate.
- The landing page uses the actual release timestamps and serves 16 revised screenshots across the Customer, Broker, Android and Super Admin interfaces. All four bilingual PDFs match the committed files. Captures show Build 57 UI in isolated QA with explicit provenance. The Android captures use the QA build. Terms, Privacy, help, contact and account-deletion routes were checked.
- 451 API tests passed with 33 configuration-dependent skips. Focused tests in broker-first mode passed 55 PostgreSQL cases and 18 AI adapter cases. All 123 mobile cases and workspace typechecks passed. The full connected role/workflow matrix is still open.
- The authorized Gmail send/reply was verified on staging in Inbox, Lead timeline and scoped notification, with duplicate-free sync. Build 58 ships the subsequent Gmail/SMS activity timestamp correction. Google production approval remains open.

## Data and deployment

The final encrypted off-host backup chain restored 101 tables, 793 media files and 25 private KYC documents before activation. The migration set matched Build 57. Candidate smoke ran with jobs disabled. The existing BrokerIQ web process required a refresh to see the prepublished APK. Activation then switched only BrokerIQ API/web and updated the app runtime URL after release verification.

The first cleanup removed generated QA Android files/dependencies and ten inactive web caches. Usable space rose from 16,358,600 KiB to 21,751,892 KiB with PM2 and Docker identities unchanged. Later cleanup removed abandoned candidate dependencies, generated Build 58 native caches and BrokerIQ Gradle transforms. The transform directory measured 5,973,324 KiB and available space rose from 19,443,604 KiB to 24,883,804 KiB during that cleanup. Post-activation available space was 24,681,400 KiB with 80% reported used. Backups, live storage, active and rollback artifacts remained protected.

## Open launch gates

- Physical Android authentication retention, camera/KYC, push delivery and background tracking.
- SMS incoming client reply, deferred at the user's request.
- Qualifying AI provider, independent holdout field precision and record recall, and attachment acceptance. Automatic extraction remains disabled.
- Production Gmail verification, representative staging load and complete live role/workflow acceptance.
- Investigation of the tracking import cycle and React pre-mount warning observed in the debug emulator.

Evidence is under `../evidence/staging-build58-20261110/`. Capture provenance is under `../evidence/staging-build57-20261105/gallery-captures-20261110.json`.
