#!/usr/bin/env bash
# Daily BrokerIQ backup (cron 02:30 IST). Keeps 7 daily + 4 weekly copies in /opt/brokeriq/backups.
#  - db.dump.enc      pg_dump (custom format, compressed) encrypted with secrets/backup.key
#  - media/           hard-link snapshot of storage/media (files are already compressed +
#                     encrypted and never change, so unchanged files cost no extra disk)
#  - secrets.tgz.enc  api.env / web.env (hold ENCRYPTION_MASTER_KEY — needed to read media + settings)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
umask 077

KEY="$BASE/secrets/backup.key"
TS="$(date -u +%Y%m%d-%H%M%S)"
DAILY="$BASE/backups/daily"
DEST="$DAILY/$TS"
PREV="$(find "$DAILY" -mindepth 1 -maxdepth 1 -type d | sort | tail -1 || true)"
mkdir -p "$DEST"
enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" "$@"; }

log "Database → $DEST/db.dump.enc"
runuser -u postgres -- pg_dump -p "$PG_PORT" -Fc -Z 6 "$DB_NAME" | enc -out "$DEST/db.dump.enc"
# Prove the backup is readable before trusting it.
enc -d -in "$DEST/db.dump.enc" | runuser -u postgres -- pg_restore -l >/dev/null

log "Media snapshot"
rsync -a --delete ${PREV:+--link-dest="$PREV/media/"} "$BASE/storage/media/" "$DEST/media/"

log "Secrets"
tar -C "$BASE/secrets" -cz api.env web.env db.password | enc -out "$DEST/secrets.tgz.enc"

( cd "$DEST" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )

# Sunday → also keep as weekly (hard links, no extra space).
if [ "$(date -u +%u)" = 7 ]; then cp -al "$DEST" "$BASE/backups/weekly/$TS"; fi

log "Rotate (7 daily, 4 weekly)"
find "$DAILY" -mindepth 1 -maxdepth 1 -type d | sort | head -n -7 | xargs -r rm -rf
find "$BASE/backups/weekly" -mindepth 1 -maxdepth 1 -type d | sort | head -n -4 | xargs -r rm -rf

du -sh "$DEST" "$BASE/backups" | sed 's/^/  /'
log "Backup OK: $DEST"
