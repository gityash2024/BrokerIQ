# BrokerIQ — shared DigitalOcean server operations

Current broker-first operational instructions: [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).
Current release evidence, APK and verified backup: [docs/RELEASE_HANDOFF.md](../../docs/RELEASE_HANDOFF.md).

The existing shared server is already provisioned. Work is restricted to `/opt/brokeriq` and PM2 processes `brokeriq-api` / `brokeriq-web`. Do not run `bootstrap.sh` or `install-edge.sh` on this server: those historical first-server provisioning tools can change system packages, PostgreSQL setup or edge configuration. They remain in source for future dedicated-server provisioning, outside this release workflow.

- Deploy: `bash /opt/brokeriq/bin/deploy.sh`
- Immutable restore-tested checkpoint: `bash /opt/brokeriq/bin/checkpoint.sh`
- Non-live restore test: `bash /opt/brokeriq/bin/restore.sh <backup-directory>`
- BrokerIQ logs: `/opt/brokeriq/logs`
- Secrets: `/opt/brokeriq/secrets`, private permissions; never commit them.

`config.sh` follows the active database/media environment after the fresh B2B cutover. Current data is in `brokeriq_b2b_20261015` with private encrypted media under `storage/media-b2b`; the original checkout/database are retained for rollback.

New checkpoints include encrypted `register-source.tgz.enc` when private source inputs exist. They decrypt/extract it inside the checkpoint directory and compare every file SHA256. Live recovery preserves the previous register-source directory before replacement; older backups remain compatible. Checksum failure stops recovery before database or process changes. Keep `ENCRYPTION_MASTER_KEY` and `backup.key` privately recoverable alongside off-server encrypted backups.

The deployment script does not write `/etc/cron.d`, modify nginx, replace PostgreSQL clusters, change global runtimes, save global PM2 state or reload other products. No new recurring backup/watchdog scheduling is asserted by this release.
