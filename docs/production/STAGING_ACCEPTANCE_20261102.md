# Connected staging release checkpoint — not final production sign-off

## Build43 current checkpoint

Published pinned `0d6c2bc273dcc6851501ee3cf5799a1415bae7f6` / **v2.3.2, Build43** at2026-11-02T11:17:17.940Z (**2 November,16:47:17 IST**). Active candidate `/opt/brokeriq/releases/rc-0d6c2bc273dc`. Canonical download https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.2-build43.apk ,186,523,902 bytes, SHA256 `27a2755f173a5cca923b86d4d4753ffa3b1c609f6cfced4b8c86d753310c0609`. Certificate unchanged. Strict origin/public API, portal/APK identities, PM2 paths and complete public bytes passed. Runtime latest/update URL43, minimum2.3.0 and required email OTP retained. Eight unrelated services' PID/status/restart counters matched baseline; no nginx/global reload. No database migration was needed for43.

Final APK embedded commit/version43 match. MainActivity/FaceCaptureActivity secure calls/8192 flags and all60 64-bit libraries/16KB alignment pass. Clean Gradle build completed770 tasks. Its final copy step initially failed because the fresh checkout had no `releases/` parent; the already signed APK was independently rechecked and copied, and the builder now creates that parent. No stale APK was substituted.

Fresh isolated full API suite:354 passed/27 configuration skips. The separate Broker-first selection initially failed one test using a revision from before publication; the application correctly returned409. The test now asserts that stale write is denied, GETs the current resource and edits its new revision. Rerun53/53 passed. This was a test/ops-only correction after the product pin; candidate application source is unchanged. Shared61/61, workspace typechecks and changed-source ESLint zero errors pass.

New standalone encrypted off-host archive `production-20261102T104109Z.tar.age`, SHA256 `f80064a10c5e3d469d4886364c6e076696f666b6101c5719d6b2e7e34be8a3ff`,2,481,481,412 bytes. Actual scratch restore verified101 tables,615 storage files,2,476,164,552 media bytes and10 private KYC documents. This archive is independently complete; earlier accepted base/delta chains remain protected. See prebuild43-restore.json. The host had no `age` binary; archive encryption was performed on the Mac from the SSH tar stream, with pipeline status checked. No plaintext archive was saved locally.

Textbee was saved for Olive Estate using the user's existing authorized key/device. The real API returned one enabled SIM subscription3; it does not report a phone number, so9899980802 binding relies on the user's explicit device confirmation. Actual connection test passed. The user created an outgoing-only signed webhook for sent/delivered/failed events. API key/signing secret encrypted, webhook subscription bound, wrong signature403 and valid signature/malformed event400 verified without creating a business event or sending SMS. Inbound remainsOFF; no live SMS delivery/reply claim. See textbee-signed-setup.json. Browser access became disabled again; final43 visual checks are open, as are deferred installed-phone tests and every outstanding product/provider/manual/performance gate.

Build42 is retained as the immediate rollback through `/opt/brokeriq/ops/rollback-ecosystem-build42.cjs`; its jobs-disabled API smoke passed. Additive data is not reversed/restored away. Before switch43's exact public APK was verified from the old serving release. The first added-file request returned404 because Next.js had indexed public files at startup; refreshing **only** the existing BrokerIQ web process made the immutable download available. Old manifest/time remained42 until activation. Strict post-switch checks waited through old-process handover and only accepted expected0d6/43.

## Historical Build42 checkpoint

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

## Verified Build44 staging update — 2 November,17:59:30 IST

Product commit `be21ed4087e144a006851e192fdb16fa9ee3efc8`, v2.3.3/Build44, published2026-11-02T12:29:30.072Z. API and web execute `/opt/brokeriq/releases/rc-be21ed4087e1`; strict origin/public API/manifests/PM2 and complete186,518,390-byte APK verification passed. Public download: https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.3-build44.apk . SHA256 `194def48d3a019ba15ba849984c95e6b7fd3a2781ac0ab03a4603726ab2e028e`; original signing certificate unchanged.

The compiled APK's `assets/app.config` independently contains the pinned commit/versionCode44; both MainActivity and FaceCaptureActivity bytecode include secure-window calls/8192. All60 64-bit native libraries and APK zip alignment pass16KB checks. Fresh native build completed in4m53s. Only generated native outputs were later removed after retaining/checksumming the signed versioned APK. Neither signing keys nor app data were removed.

Shipped source includes all-firms shared Inventory, complete filtered/selected role-safe CSV, locked same-firm assignment, reversible archive/restore, firm-correct lead counts, meaningful import headings/fractional layouts and bounded constrained local JSON output. Local Qwen extraction quality remains unaccepted. Admin Team routes/hierarchy corrections worked on AFTER this pin are not included in44.

Fresh isolated PostgreSQL41 migrations/master-data setup: final complete run361 passed/27 configuration skips,49 suites passed/4 skipped,42.798s. A prior run under concurrent native compilation had two visit socket hangups; all five visit tests passed separately and the final full rerun passed. Supported Broker-first selection37/37 (six suites); the broader selection initially included a platform-support/moderator session fixture that Broker-first deliberately disallows, so its three setup failures are not claimed as successful tests. Full historical-mode coverage includes that connector suite. Shared63/63 at this pin; workspace typechecks pass. No fixture touched connected staging.

A new encrypted4,517,140-byte off-host delta `production-20261102T121856Z.tar.age` (SHA256 `e157d0d054704656b2463ae872354d373862efe176b8021cbd7f5b6840ff9289`) includes the fresh database/env files and four changed media files. It REQUIRES the independently verified standalone `production-20261102T104109Z.tar.age` base. Actual combined scratch restore `brokeriq_restore_prebuild44_20261102_121856` verified101 table digests,619 media files/2,476,435,230 bytes and10 private KYC documents. No application/worker started on restored data.

Public APK prepublication initially returned404 because the old Next worker had not indexed its new static filename. Only the existing BrokerIQ web process was refreshed; the complete canonical download then passed BEFORE landing/symlink activation. Publication and runtime update link/latest-version are44; minimum2.3.0 and mandatory email OTP were preserved. Immediate protected rollback is Build43 using `/opt/brokeriq/ops/rollback-ecosystem-build43.cjs`. All8 unrelated services retained exact PID/status/restart counts. Evidence is in `docs/evidence/staging-build44-20261102/`.

Browser visual acceptance remains blocked by Work settings; screenshots remain empty rather than relabelling older captures. Physical installed upgrade/camera/push/background-location acceptance is explicitly user-deferred. SMS send/reply, Gmail CRM authorization, capable free AI/real holdout, all remaining modules/hierarchy, performance/soak, final screenshots/legal/manuals and full request reconciliation remain OPEN. This verified staging release is not full production-launch sign-off.
