#!/usr/bin/env bash
# Restore a BrokerIQ backup.
#   restore.sh <backup-dir>              → test restore into scratch DB "brokeriq_restore_test" (safe, nothing live changes)
#   restore.sh <backup-dir> --live       → stop API/web, replace the live DB + media, start again
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"

SRC="${1:?usage: restore.sh <backup-dir> [--live]}"
MODE="${2:-test}"
KEY="$BASE/secrets/backup.key"
dec() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KEY" -in "$1"; }
psqlp() { runuser -u postgres -- psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -q "$@"; }

( cd "$SRC" && sha256sum -c --quiet SHA256SUMS ) && log "Checksums OK"

if [ "$MODE" != "--live" ]; then
  T=brokeriq_restore_test
  psqlp -c "DROP DATABASE IF EXISTS $T" -c "CREATE DATABASE $T OWNER $DB_NAME"
  dec "$SRC/db.dump.enc" | runuser -u postgres -- pg_restore -p "$PG_PORT" -d "$T" --no-owner --role="$DB_NAME" --exit-on-error
  log "Test restore row counts:"
  psqlp -d "$T" -c "SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY relname" 2>/dev/null || true
  psqlp -d "$T" -tAc "SELECT 'users='||count(*) FROM \"User\"" 
  psqlp -c "DROP DATABASE $T"
  log "Test restore OK (scratch DB dropped). Media files in backup: $(find "$SRC/media" -type f | wc -l)"
  exit 0
fi

read -r -p "Replace LIVE BrokerIQ data with $SRC? type YES: " ok; [ "$ok" = YES ] || exit 1
pm2 stop brokeriq-api brokeriq-web || true
psqlp -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid()"
psqlp -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_before_restore_$(date -u +%Y%m%d%H%M%S)"
psqlp -c "CREATE DATABASE $DB_NAME OWNER $DB_NAME"
dec "$SRC/db.dump.enc" | runuser -u postgres -- pg_restore -p "$PG_PORT" -d "$DB_NAME" --no-owner --role="$DB_NAME" --exit-on-error
mv "$BASE/storage/media" "$BASE/storage/media.before_restore_$(date -u +%Y%m%d%H%M%S)"
cp -a "$SRC/media" "$BASE/storage/media"
pm2 start brokeriq-api brokeriq-web
log "Live restore done. Old DB/media kept with *_before_restore_* names — drop them once verified."
