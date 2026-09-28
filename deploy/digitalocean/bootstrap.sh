#!/usr/bin/env bash
# One-time (idempotent) setup of BrokerIQ on a shared Ubuntu server. Run as root:
#   bash bootstrap.sh
# Creates only BrokerIQ-owned things: /opt/brokeriq, a separate PostgreSQL cluster whose data
# lives in /opt/brokeriq/data/postgres, and (in install-edge.sh) one nginx vhost, one cert, one cron file.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"

log "Folders"
mkdir -p "$BASE"/{runtime,data,storage/media,backups/daily,backups/weekly,secrets,logs,bin,nginx/acme}
chmod 755 "$BASE" "$BASE/data"
chmod 700 "$BASE/secrets" "$BASE/storage" "$BASE/backups"

log "Node $NODE_VERSION (private to BrokerIQ)"
if [ "$("$BASE/runtime/node/bin/node" -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
  rm -rf "$BASE/runtime/node" "$BASE/runtime/node-v$NODE_VERSION-linux-x64"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C "$BASE/runtime"
  mv "$BASE/runtime/node-v$NODE_VERSION-linux-x64" "$BASE/runtime/node"
fi
corepack enable --install-directory "$BASE/runtime/node/bin" pnpm
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack prepare "pnpm@$PNPM_VERSION" --activate
node -v && pnpm -v

log "PostgreSQL cluster '$PG_CLUSTER' on 127.0.0.1:$PG_PORT (data in $BASE/data/postgres)"
if ! pg_lsclusters -h | awk '{print $1" "$2}' | grep -qx "$PG_VERSION $PG_CLUSTER"; then
  pg_createcluster "$PG_VERSION" "$PG_CLUSTER" -d "$BASE/data/postgres" -p "$PG_PORT" --start-conf=auto \
    -- --auth-local=peer --auth-host=scram-sha-256 --encoding=UTF8 --locale=C.UTF-8
fi
systemctl enable --now "postgresql@$PG_VERSION-$PG_CLUSTER"
pg_lsclusters

if [ ! -f "$BASE/secrets/db.password" ]; then
  openssl rand -hex 24 > "$BASE/secrets/db.password"
  chmod 600 "$BASE/secrets/db.password"
fi
DB_PASS="$(cat "$BASE/secrets/db.password")"
runuser -u postgres -- psql -p "$PG_PORT" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_NAME') THEN CREATE ROLE $DB_NAME LOGIN; END IF;
END \$\$;
ALTER ROLE $DB_NAME PASSWORD '$DB_PASS';
SQL
runuser -u postgres -- psql -p "$PG_PORT" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || runuser -u postgres -- createdb -p "$PG_PORT" -O "$DB_NAME" -E UTF8 "$DB_NAME"

if [ ! -f "$BASE/secrets/backup.key" ]; then
  openssl rand -base64 48 > "$BASE/secrets/backup.key"
  chmod 600 "$BASE/secrets/backup.key"
fi

log "Source code ($BRANCH)"
if [ ! -d "$BASE/app/.git" ]; then
  git clone --branch "$BRANCH" "$REPO" "$BASE/app"
fi

log "Secrets check"
for f in api.env web.env; do
  [ -f "$BASE/secrets/$f" ] || { echo "Missing $BASE/secrets/$f — see deploy/digitalocean/README.md"; exit 1; }
  chmod 600 "$BASE/secrets/$f"
done

log "Bootstrap done. Next: bin/deploy.sh, then install-edge.sh (nginx + SSL + cron)."
