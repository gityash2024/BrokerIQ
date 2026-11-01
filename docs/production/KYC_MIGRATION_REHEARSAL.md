# KYC media migration rehearsal — real restored data, production unchanged

The verified production snapshot was restored into `brokeriq_restore_launch_20261101_114118`. All new additive migrations applied successfully to that database without seeding or starting the API/workers. Production schema/code/provider access were not changed.

## Exact result

- Ten existing personal KYC documents were found, all on the configured Cloudinary account under the original KYC folder.
- All ten delivery downloads and authenticated original-download responses were byte-identical. Asset ID, version, provider byte count and original format were checked; the public URL's version matched the provider version.
- Initial migration logic incorrectly assumed Admin API resource responses always contain the upload response's ETag. Actual metadata omitted ETag. The rehearsal stopped without writing a document. We corrected that assumption: stable asset identity/version, two matching downloads and our own SHA-256 are required; if ETag is returned it is checked too. No checksum mismatch was ignored.
- Ten private encrypted copies were created in the isolated restore. All ten were decrypted again and their SHA-256/byte counts matched the preserved originals: **6,776,237 original bytes**.
- Record count stayed ten. Reconstructing the pre-migration JSON rows with their retained original URLs produced the exact original snapshot's whole-table content digest. Thus document numbers, subjects, firm associations, types, review decisions/notes/reviewers and timestamps remained unchanged.
- Original provider references are retained encrypted in `SystemSetting` migration records. Audits contain IDs, checksums and byte counts, not government identifiers or provider URLs.
- Private copied files and the checksum report were additionally archived off-host with age. Verified archive: `/Users/yashjangid/Documents/BrokerIQ-private-backups/kyc-originals-verified-20261101T114118Z.tar.age`, 6,709,044 bytes; SHA-256 `6ad0355c17af433eba02337860f951a49a68d8711af9ed0e7c44ec03a542b972`. The archive was fully authenticated and all eleven files (ten encrypted media files plus report) matched their source ciphertext files. The earlier supplemental archive with macOS metadata is retained but is not the accepted artifact.

## Release operations

`src/ops/kyc-private-migration.ts` deliberately does not start AppModule, schedulers or providers outside the selected operation. It requires an explicit matching database name. Copy/inspection requires verified off-host backup proof. Local `ops/rehearse-kyc-migration.py` loads backed-up configuration only in memory and passes it through stdin; it only allows a local restored database and cannot request public retirement.

Public retirement is a distinct production-only operation. It is blocked from test/restore databases even if the environment gate is set. It additionally requires a fresh restored off-host backup **taken after private copying**, containing the copied KYC media. The original pre-copy backup does not meet that gate. The release must first support authenticated previews on web and the signed upgrade APK, including explicit old-client update handling.

Retirement uses the configured provider account, checks the preserved asset identity/version before changing delivery to `authenticated`, preserves the provider original, requests CDN invalidation, verifies the authenticated original's SHA-256, then separately checks the exact old public URL. HTTP 200, 429 or server failure never counts as secured access. Retries retain state and do not repeatedly rename assets or duplicate the final retirement audit. Production retirement and CDN blocking are still **PENDING**.

## Validation boundaries

- Four real PostgreSQL/encrypted-file migration tests use a stubbed Cloudinary boundary for mutation/response cases; they do not prove live retirement. They cover source allowlisting, no-Etag resource responses, preserved bytes/status/count, encrypted legacy references, idempotence, CDN acceptance separation and operations guardrails.
- Real Cloudinary read/download + actual encrypted-file/database copying and whole-table preservation were verified on the production restore. No document was displayed, sent to AI or used for training. No live provider write/rename occurred.
- Broker Admin local browser also loaded all five authorized synthetic QA previews and saved exact-document approval; pending count decreased and review actions disappeared. Screenshot `output/playwright/kyc-admin-review-local.png` is QA evidence, not a production/manual screenshot or real face verification.
