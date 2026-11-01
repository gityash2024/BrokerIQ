# Production snapshot and off-host restore evidence

This is a verified safety checkpoint, not a production release or a disaster-recovery RTO claim.

- Production source: `/opt/brokeriq/current` resolved to `/opt/brokeriq/releases/f02daa4` (unchanged live checkout).
- Snapshot: `/opt/brokeriq/backups/production-20261101T114118Z`.
- PostgreSQL 14.24 custom dump uses one exported Repeatable Read snapshot. All 99 public tables have row counts and deterministic row-content digests from that same snapshot. No live rows were modified.
- Dump SHA-256: `fe648a658f15313dfc1927611131fc910d1ac26d77bc2c38158245e2cd8b2fb4`.
- Storage manifest: 595 files, 2,468,884,506 bytes. SHA-256 is recorded per original stored file. Storage symlinks fail the backup rather than silently excluding a target.
- Off-host archive: `/Users/yashjangid/Documents/BrokerIQ-private-backups/production-20261101T114118Z.tar.age`, mode 0600 in a mode-0700 directory; 2,474,096,564 bytes.
- Archive SHA-256: `d6cc986c8392d198af0a7f5abe4be7a1128f7f6230288c9b65b4173a5b6c189d`.
- Archive includes storage, database dump, manifest and the existing application env files needed to recover encrypted fields/media. It was streamed over SSH directly into age encryption using the user's existing SSH public-key recipient. No secret values or plaintext archive were logged or committed.
- The archive was fully decrypted/authenticated locally. All 595 media file hashes/sizes and the dump hash matched. Secrets were not extracted into local files.
- Actual scratch restore: `brokeriq_restore_launch_20261101_114118` on local PostgreSQL. All 99 restored table counts and content digests matched the snapshot. No application, worker, provider callback or outbound job was started against this database.
- A temporary mode-0600 plaintext dump was removed by the verifier after restore. The scratch database is retained for further controlled migration checks; it is real production data, not a fixture database. Do not connect API/jobs or run seed/tests against it.
- Machine-readable proof: same private directory, `production-20261101T114118Z.tar.verified.json`.

Repeatable tooling: `ops/backup-private.cjs` on the BrokerIQ host; `ops/verify-private-backup.py` on the user's Mac. The verifier refuses an existing scratch database and never resets one. Refresh this snapshot before the final release/migration if live data has changed.

## Local tool installation incident

Installing age 1.3.2 through Homebrew unexpectedly ran Homebrew's default cleanup, removing old formula versions and auto-removing the previously installed Homebrew Node/mongosh CLIs and their now-unused dependencies. The active NVM Node 24.21.0 and the explicit Node 22.17.0 test runtime were unaffected. Node and mongosh were reinstalled from Homebrew with cleanup disabled; Homebrew resolved current Node 26.13.0_1, mongosh 2.14.1 and their dependencies, including updates to shared formulae. `mongosh --version` and the unchanged default NVM `node --version` were verified. No project dependency manifest or production service was changed by these local package operations. Do not describe this as an exact restoration of the old Homebrew package versions. Future package commands must set `HOMEBREW_NO_INSTALL_CLEANUP=1` and `HOMEBREW_NO_AUTO_UPDATE=1`.
