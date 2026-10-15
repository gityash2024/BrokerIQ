# Shared settings for the BrokerIQ self-host scripts. Everything lives under $BASE.
BASE=/opt/brokeriq
BRANCH=${BRANCH:-feat/production}
REPO=${REPO:-https://github.com/gityash2024/BrokerIQ.git}
NODE_VERSION=22.20.0
PNPM_VERSION=11.25.0
PG_VERSION=14
PG_CLUSTER=brokeriq
PG_PORT=5433
DB_NAME=brokeriq
DB_OWNER=brokeriq
API_PORT=3100
WEB_PORT=3101
WEB_DOMAIN=brokeriq.mymultimeds.com
API_DOMAIN=brokeriqapi.mymultimeds.com

# BrokerIQ's own Node 22 comes first; the server's global Node 20 is left alone.
export PATH="$BASE/runtime/node/bin:$PATH"
export COREPACK_HOME="$BASE/runtime/corepack"
# Follow the active BrokerIQ database after a fresh-database cutover.
if [ -f "$BASE/secrets/api.env" ]; then
  DB_NAME="$(set -a; source "$BASE/secrets/api.env"; node -e 'const u=new URL(process.env.DATABASE_URL); if(u.hostname!=="127.0.0.1" && u.hostname!=="localhost") throw Error("Expected local BrokerIQ database"); if(u.port!=="5433") throw Error("Expected BrokerIQ port 5433"); const n=u.pathname.slice(1); if(!/^brokeriq(?:_[a-z0-9_]+)?$/.test(n)) throw Error("Unexpected database name"); process.stdout.write(n)')"
fi

# pm2 daemon is the server's shared one (global Node 20) — always call it with the system PATH.
pm2() { env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root pm2 "$@"; }
log() { printf '\n\033[1;34m[brokeriq]\033[0m %s\n' "$*"; }
