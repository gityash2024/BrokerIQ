#!/usr/bin/env bash
# Immutable BrokerIQ-only checkpoint with a real scratch restore and exact table counts.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
umask 077
TS="$(date -u +%Y%m%d-%H%M%S)"
DEST="$BASE/backups/checkpoints/$TS-broker-first"
SCRATCH="brokeriq_restore_${TS//-/}"
KEY="$BASE/secrets/backup.key"
mkdir -p "$DEST"
enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" "$@"; }
db() { runuser -u postgres -- psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -X -q "$@"; }
counts() {
  db -d "$1" -tAc "SELECT format('SELECT %L, count(*) FROM %I.%I;', tablename, schemaname, tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename" |
    db -d "$1" -tA -F $'\t'
}
APP="$BASE/app"
[ ! -e "$BASE/current" ] || APP="$(readlink -f "$BASE/current")"
log "Checkpoint $DEST"
runuser -u postgres -- pg_dump -p "$PG_PORT" -Fc -Z 6 "$DB_NAME" | enc -out "$DEST/db.dump.enc"
counts "$DB_NAME" > "$DEST/table-counts.tsv"
tar -C "$BASE/secrets" -cz api.env web.env db.password | enc -out "$DEST/secrets.tgz.enc"
tar -C "$APP" --exclude=.git --exclude=node_modules --exclude=.next --exclude=dist --exclude=build --exclude=.turbo -cz . |
  enc -out "$DEST/source.tgz.enc"
git -C "$APP" rev-parse HEAD > "$DEST/release-commit.txt"
rsync -a "$BASE/storage/media/" "$DEST/media/"
db -d postgres -c "CREATE DATABASE $SCRATCH OWNER $DB_OWNER"
trap 'db -d postgres -c "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null' EXIT
enc -d -in "$DEST/db.dump.enc" |
  runuser -u postgres -- pg_restore -p "$PG_PORT" -d "$SCRATCH" --no-owner --role="$DB_OWNER" --exit-on-error
counts "$SCRATCH" > "$DEST/restored-counts.tsv"
cmp "$DEST/table-counts.tsv" "$DEST/restored-counts.tsv"
db -d postgres -c "DROP DATABASE $SCRATCH"
trap - EXIT
(cd "$DEST" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
printf 'Exact table counts matched after scratch restore.\n' > "$DEST/RESTORE_VERIFIED.txt"
log "Restore verified: $DEST"
