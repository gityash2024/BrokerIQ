#!/usr/bin/env bash
# Build + (re)start BrokerIQ from the latest commit of $BRANCH. Safe to re-run any time.
#   /opt/brokeriq/bin/deploy.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
cd "$BASE/app"

log "Pull $BRANCH"
git fetch --prune origin "$BRANCH"
git checkout -q "$BRANCH"
git reset -q --hard "origin/$BRANCH"
git log --oneline -1

log "Install scripts into $BASE/bin"
install -m 755 deploy/digitalocean/{config.sh,deploy.sh,backup.sh,restore.sh,install-edge.sh,watchdog.sh} "$BASE/bin/"
# Keep BrokerIQ's own cron file (backups + watchdog) in sync with the repo.
install -m 644 deploy/digitalocean/cron.brokeriq /etc/cron.d/brokeriq
install -m 644 deploy/digitalocean/ecosystem.config.js "$BASE/ecosystem.config.js"
install -m 644 deploy/digitalocean/nginx/{cloudflare-realip.conf,proxy.conf} "$BASE/nginx/"

log "Install dependencies"
pnpm install --frozen-lockfile

log "Build"
pnpm --filter @brokeriq/shared build
pnpm --filter @brokeriq/api build
( set -a; source "$BASE/secrets/web.env"; set +a; NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @brokeriq/web build )

log "Database migrations + master data seed (idempotent)"
( set -a; source "$BASE/secrets/api.env"; set +a; cd apps/api && pnpm exec prisma migrate deploy && node dist/prisma/seed.js )

log "Start / reload"
pm2 startOrReload "$BASE/ecosystem.config.js" --update-env
pm2 save

log "Health check"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" && curl -fsS -o /dev/null "http://127.0.0.1:$WEB_PORT/"; then
    echo; log "BrokerIQ is up ✔"; exit 0
  fi
  sleep 2
done
echo "Health check failed — see $BASE/logs/*.err.log"; exit 1
