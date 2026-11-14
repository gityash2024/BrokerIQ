# Staging Build 62 · v2.3.21

Published 14 November 2026 at **11:14:12 IST**. The API, web portal, in-app update and signed APK agree on commit `4d8ec106451235cf4a4ff75d7a6790101db56213`.

- [Landing page](https://brokeriq.mymultimeds.com/) · [Android APK](https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.21-build62.apk) · [Guides](https://brokeriq.mymultimeds.com/guides).
- The public download is 186,607,762 bytes and its SHA-256 is `5cdb5b1f98ff5d4c23db54400ece28e4b23b79b747e36f3debf35ab0def0e35b`. The APK retains the original signer. The signed emulator upgrade from Build 61 preserved the installation timestamp and launched successfully.
- Public landing checks passed at six viewport widths from 320 to 1440 px. Theme and Hindi preferences survived reload. The gallery serves 16 original images with their recorded capture provenance. The four guides contain current Build 62 supplements.
- Normal API regression passed 500 cases, with 33 conditional cases skipped. Four Broker-first suites separately passed their 31 conditional cases. Mobile passed 127 tests across 17 suites. Workspace typechecks passed. See the [test counts and scope](../evidence/staging-build62-20261114/test-summary.json).
- Chrome passed 14 workflows against isolated PostgreSQL, including 91 route checks at 390 px. Tested roles included Super Admin, Broker Admin, Agent and Customer. [Browser regression](../evidence/staging-build62-20261114/isolated-browser-regression.json).
- The source audit maps 160 ledger requests to the released commit. Every referenced path exists. Functional sign-off is recorded separately for each workflow in the ledger.

Authorized Broker Admin and Super Admin location views refresh every ten minutes. Android requests active-shift background fixes at the same cadence. Super Admin has a read-only Time Logging screen on Android with explicit member selection across firms. Existing fixes keep their capture times. See the [location implementation and verification](LOCATION_10MIN_20261114.md).

Property and profile photo persistence, stale revision handling and tenant isolation passed on the isolated real API and PostgreSQL. The web workflow verified the selected photo link reaching the editable Inbox draft. The configured Cloudinary account passed a live connection check and handles direct property and profile uploads. Private KYC uses encrypted self-hosted storage. [Media provider health](../evidence/staging-build62-20261114/media-provider-health.json). Physical Android photo picking and upload remain part of handset acceptance. See the [photo workflow report](../evidence/staging-build61-20261113/photo-workflows.md).

The exact free model is approved for reviewed text and photo drafts. The frozen text evaluation reached 97.78% precision for critical fields and 96.12% record recall. The photo sample contains five cases. A subsequent deployed settings check matched expected text and original-photo facts with OpenRouter charged usage unchanged at zero. Earlier live attempts omitted expected fields, so the review step remains required. See the [quality report](AI_QUALITY_20261114.md) and [live sample check](../evidence/staging-build62-20261114/live-capture-verification.json).

Gmail inbound and outbound lead workflow evidence predates this release. On 14 November, Google Verification Center visibly accepted the production scope submission and displayed **under review**. Google approval and any required CASA assessment remain outstanding. The SMS reply and physical Android acceptance tests remain deferred at the owner's request. [Google review observation](../evidence/staging-build62-20261114/gmail-review.json).

The encrypted off-host backup was independently restored in scratch and verified across 101 tables and 867 media files, including 30 private KYC documents. The release reused the existing schema. Cleanup removed 3,969,585,152 bytes of inactive compiler output before activation. [Backup evidence](../evidence/staging-build62-20261114/backup-verified.json) · [Cleanup evidence](../evidence/staging-build62-20261114/cleanup-native.json).

During the stability run, two unused candidates yielded another 979,435,520 bytes of generated output. The live API and web manifest passed checks before and after both removals. [Candidate cleanup](../evidence/staging-build62-20261114/cleanup62-unused-candidate.json) · [Dependency cleanup](../evidence/staging-build62-20261114/cleanup62-unused-dependencies.json).

The two-hour stability test is running on the staging host against isolated PostgreSQL with 20 authenticated CRM sessions. The initial five rounds passed with list p95 of 707 ms, detail p95 of 504 ms and mutation p95 of 520 ms. Final stability acceptance requires the completed run report.
