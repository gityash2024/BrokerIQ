# Connected staging release checkpoint — not final production sign-off

## Published identity

The existing connected staging runs pinned product commit `b58aac46a5fe39b01085afdae5d3f95ab74d9aae` from `/opt/brokeriq/releases/rc-b58aac46a5fe`. Origin/public API health, web release manifests, PM2 executing paths and embedded Android identity were checked against that independently expected commit. Publication: **2 November 2026, 15:05:19 IST**. The landing and runtime latest-version/download settings are42; minimum supported version2.3.0 and required email OTP were preserved.

Signed Android **v2.3.1 / Build42**, package `com.brokeriq.app`,186,515,510 bytes:

- Public download: https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.1-build42.apk
- Full canonical public HTTPS download SHA256: `04cbc95f9e6b93ad3ebf02d7d32da06d0d2160040f4be61ba9912889e8c966e1`, matching the signed local artifact. See `../evidence/staging-20261102/release42-verification.json`.
- Signing certificate SHA256 remains `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce`.
- Clean native prebuild and final APK show secure-window calls/8192 flag in MainActivity and FaceCaptureActivity. All60 ARM64/x86_64 libraries have >=16KB LOAD alignment; `zipalign -c -P16 4` passed.
- Final fresh isolated PostgreSQL suite atb58aac4:346 passed/27 configuration skips,48 passed/4 skipped suites. No simulator or staging fixtures. Shared59/59 and native SQLite tests82/82 also pass; these are separate from live provider/device gates.
- The phone is unavailable; the user explicitly deferred physical upgrade/camera/push/background/recording checks. No installed-device claim.

Build42 includes channel-separated conflict-preserving Inbox drafts, mobile SMS/Email/WhatsApp lead actions, assignment-safe follow-up completion, and explicit Super Admin firm connector management. Real browser navigation confirmed Olive Estate's manager while its WhatsApp/Housing connections remained configured. Textbee setup is pending its business device credentials/SIM validation.

The temporary activation probe initially accepted mutually consistent all-old responses during PM2 handover. That was not valid42 acceptance. A first canonical request also returned404 during the switch. Subsequent independent strict verification passed for the exact expectedb58/42 identity and complete public APK bytes. The tracked verifier and prepublication procedure in STAGING_RELEASE_RUNBOOK.md replace that loose probe.
Old screenshots were excluded because their captions did not describe the captured build. The manifest currently has no accepted mobile screenshots. Newly captured staging web evidence is under the private `output/playwright/` directory; publishable masked captures/manuals remain open.

## Real-data operations and recovery

41 additive migrations were applied after the fresh pre-migration backup chain and actual scratch restore passed. Original table counts did not decrease. No seed, fixture test suite or second worker was run against the connected real-data database.

All10 legacy KYC documents were copied into authenticated private storage.6,776,237 original bytes and the original KycDocument fields were independently verified before changing provider access. A new encrypted off-host snapshot chain was then restored:101 tables and614 storage files,2,476,085,307 bytes. See `../evidence/staging-20261102/postcopy-restore.json`. The base and new delta are BOTH required for recovery.

Only after that restore passed, original Cloudinary assets were changed to authenticated delivery. No original asset was deleted. The first check saw3 cached public responses; a later check independently confirmed **all10 original URLs return404**. Private file hashes are retained; role-safe authenticated previews still require complete browser/device acceptance.

Build42 required no new migrations. Its fresh pre-release encrypted off-host chain was actually restored:101 tables,615 files,2,476,164,552 bytes, including10 private KYC documents. See `../evidence/staging-20261102/prebuild42-restore.json`. Snapshot time in the proof is authoritative; the directory name was assigned before transfer. Base and delta are BOTH required.

The protected rollback is now `releases/rc-4b521ad7e53d` / Build41 through `/opt/brokeriq/ops/rollback-ecosystem-build41.cjs`. Its API wrapper preserves private KYC/email OTP and temporarily blocks follow-ups and unsafe legacy connector mutations. The wrapper was smoke-tested privately with jobs disabled. Never substitute the ordinary old API, reverse additive migrations, or restore away newly created business rows. Historicalf02/Build40 is also retained.

After verifying active/rollback references,6 unused `.next-*` directories,19 APKs older than Build40 and2 unused aliases were removed. Measured available-space increase4,875,345,920 bytes. Post-operations disk:62,187,225,088 bytes available,51% used. No actual backup/upload/secret/model was removed. Other eight PM2 processes retained their PIDs/restart counts; only BrokerIQ processes were reloaded.

## Mail and account rollout

Zoho HTTPS is the selected, enabled, successfully tested transactional provider, sender `hello@yarvixhq.com`. An actual application `MailService.send` message was accepted and received in the authorized Gmail inbox. SMTP remains disabled; no paid fallback was introduced. This is independent of the unconnected firm Gmail CRM integration.

The user supplied three exact account-email corrections. Each transaction preserved user IDs, password hashes, roles, firm ownership and records, revoked existing device/OTP tokens, reset email verification and wrote an audit record. The matching Olive Estate reply email was corrected too. A requested duplicate Gmail address was detected and left unchanged; the user's alternate address was used instead. No accounts were merged/deleted. The bootstrap Super Admin email was aligned in private `api.env` so restart cannot recreate the obsolete account; other env values were preserved.

Password-followed-by-email-OTP is now required. Minimum mobile version2.3.0, latest2.3.1 and the verified Build42 update URL are configured, with an explicit upgrade-without-uninstall message. The user completed actual Admin password/OTP sign-in. Server evidence shows PASSWORD/EMAIL, sent and consumed timestamps, zero wrong attempts and verified email; authenticated Super Admin dashboard was observed. No old Admin account reappeared. Rahul/Agent/customer sign-in, invitation and recovery delivery remain separate acceptance gates.

## Still open

The original full reconciliation ledger is NOT closed. In particular: connected Textbee credentials/SIM/filter/webhook/send/reply acceptance, firm Gmail OAuth/production consent and real correspondence, all-process channel automation/reminders/property sharing, complete Super Admin hierarchy/action coverage, AI semantic extraction/holdout evaluation, remaining KYC management parity/languages, load/soak and four final manuals. Follow the full STATUS/ledger, not just this release checkpoint.

Product-source changes committed afterb58aac4 are not automatically included in Build42. Ops/docs evidence commits do not alter its artifact identity. A new tested pinned candidate, signed artifact, manifest and publication timestamp are required for the next product update.
