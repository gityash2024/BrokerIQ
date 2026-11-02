# Connected staging release checkpoint — not final production sign-off

## Published identity

The existing connected staging now runs pinned product commit `4b521ad7e53d1716e866fc03ed5e600189ee8a2f` from `/opt/brokeriq/releases/rc-4b521ad7e53d`. API `/health`, web `/release.json` and embedded Android `assets/app.config` agree. Web and APK publication: **2 November 2026, 13:21:52 IST**. The landing reads the generated manifest, with independent portal/APK identities and dates.

Signed Android **v2.3.0 / Build41**, package `com.brokeriq.app`,186,510,494 bytes:

- Public download: https://brokeriq.mymultimeds.com/downloads/BrokerIQ-v2.3.0-build41.apk
- Full public HTTPS download SHA256: `4dd3efac1da78d5728611ffca6d39097f5cba0723c88f22e134d9f57b19bb02f`, matching the signed local artifact. Verified from the staging host. The local Python HTTP client received403 and the browser media-download helper timed out; neither failed attempt was counted as acceptance.
- Signing certificate SHA256 remains `d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce`.
- Clean native prebuild and final APK dexdump show secure-window calls in both MainActivity and FaceCaptureActivity. All60 ARM64/x86_64 native libraries have >=16KB LOAD alignment; `zipalign -c -P16 4` passed.
- The phone is unavailable; the user explicitly deferred physical upgrade/camera/push/background/recording checks. No installed-device claim.

Old screenshots were excluded because their captions did not describe the captured build. The manifest currently has no accepted mobile screenshots. Newly captured staging web evidence is under the private `output/playwright/` directory; publishable masked captures/manuals remain open.

## Real-data operations and recovery

41 additive migrations were applied after the fresh pre-migration backup chain and actual scratch restore passed. Original table counts did not decrease. No seed, fixture test suite or second worker was run against the connected real-data database.

All10 legacy KYC documents were copied into authenticated private storage.6,776,237 original bytes and the original KycDocument fields were independently verified before changing provider access. A new encrypted off-host snapshot chain was then restored:101 tables and614 storage files,2,476,085,307 bytes. See `../evidence/staging-20261102/postcopy-restore.json`. The base and new delta are BOTH required for recovery.

Only after that restore passed, original Cloudinary assets were changed to authenticated delivery. No original asset was deleted. The first check saw3 cached public responses; a later check independently confirmed **all10 original URLs return404**. Private file hashes are retained; role-safe authenticated previews still require complete browser/device acceptance.

The protected rollback is `releases/f02daa4`, its actual `.next` build and Build40. Its API must run through `/opt/brokeriq/ops/rollback-api-93bb8a0.cjs`, which blocks KYC/uploads during recovery; the old ordinary API would expose newly private KYC keys. The scoped rollback ecosystem was smoke-tested privately with jobs disabled. Do not reverse additive migrations or restore away newly created business rows.

After verifying active/rollback references,6 unused `.next-*` directories,19 APKs older than Build40 and2 unused aliases were removed. Measured available-space increase4,875,345,920 bytes. Post-operations disk:62,187,225,088 bytes available,51% used. No actual backup/upload/secret/model was removed. Other eight PM2 processes retained their PIDs/restart counts; only BrokerIQ processes were reloaded.

## Mail and account rollout

Zoho HTTPS is the selected, enabled, successfully tested transactional provider, sender `hello@yarvixhq.com`. An actual application `MailService.send` message was accepted and received in the authorized Gmail inbox. SMTP remains disabled; no paid fallback was introduced. This is independent of the unconnected firm Gmail CRM integration.

The user supplied three exact account-email corrections. Each transaction preserved user IDs, password hashes, roles, firm ownership and records, revoked existing device/OTP tokens, reset email verification and wrote an audit record. The matching Olive Estate reply email was corrected too. A requested duplicate Gmail address was detected and left unchanged; the user's alternate address was used instead. No accounts were merged/deleted. The bootstrap Super Admin email was aligned in private `api.env` so restart cannot recreate the obsolete account; other env values were preserved.

Password-followed-by-email-OTP is now required. Minimum/latest mobile version2.3.0 and the verified Build41 update URL are configured, with an explicit upgrade-without-uninstall message. The user completed actual Admin password/OTP sign-in. Server evidence shows PASSWORD/EMAIL, sent and consumed timestamps, zero wrong attempts and verified email; authenticated Super Admin dashboard was observed. No old Admin account reappeared. Rahul/Agent/customer sign-in, invitation and recovery delivery remain separate acceptance gates.

## Still open

The original full reconciliation ledger is NOT closed. In particular: connected Textbee credentials/SIM/filter/webhook/send/reply acceptance, firm Gmail OAuth/production consent and real correspondence, all-process channel automation/reminders/property sharing, complete Super Admin hierarchy/action coverage, AI semantic extraction/holdout evaluation, remaining KYC management parity/languages, load/soak and four final manuals. Follow the full STATUS/ledger, not just this release checkpoint.

Source changes committed after4b521ad are not automatically included in Build41. A new pinned candidate, signed artifact, matching release manifest and publication timestamp are required for the next update.
