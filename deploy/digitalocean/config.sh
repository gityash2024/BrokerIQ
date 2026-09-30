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
API_PORT=3100
WEB_PORT=3101
WEB_DOMAIN=brokeriq.mymultimeds.com
API_DOMAIN=brokeriqapi.mymultimeds.com

# BrokerIQ's own Node 22 comes first; the server's global Node 20 is left alone.
export PATH="$BASE/runtime/node/bin:$PATH"
export COREPACK_HOME="$BASE/runtime/corepack"
# pm2 daemon is the server's shared one (global Node 20) — always call it with the system PATH.
pm2() { env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root pm2 "$@"; }
log() { printf '\n\033[1;34m[brokeriq]\033[0m %s\n' "$*"; }
