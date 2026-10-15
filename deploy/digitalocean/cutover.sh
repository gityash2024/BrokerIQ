#!/usr/bin/env bash
# Switch only the two BrokerIQ processes. Old checkout, database and secrets stay recoverable.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
umask 077
RELEASE="$(readlink -f "${1:?usage: cutover.sh /opt/brokeriq/releases/<release>}")"
case "$RELEASE" in "$BASE"/releases/*) ;; *) echo 'Expected a BrokerIQ release directory'; exit 1;; esac
test -f "$RELEASE/apps/api/dist/src/main.js"
test -f "$RELEASE/apps/web/.next/BUILD_ID"
test -f "$BASE/secrets/api.b2b.env"
test -f "$BASE/secrets/web.b2b.env"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ROLLBACK="$BASE/backups/cutover/$STAMP"
mkdir -p "$ROLLBACK"
cp "$BASE/secrets/api.env" "$ROLLBACK/api.env"
cp "$BASE/secrets/web.env" "$ROLLBACK/web.env"
cp "$BASE/ecosystem.config.js" "$ROLLBACK/ecosystem.config.js"
readlink -f "$BASE/current" > "$ROLLBACK/previous-release.txt" 2>/dev/null || printf '%s\n' "$BASE/app" > "$ROLLBACK/previous-release.txt"
cat > "$ROLLBACK/rollback.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
source "$BASE/bin/config.sh"
install -m 600 "$ROLLBACK/api.env" "$BASE/secrets/api.env"
install -m 600 "$ROLLBACK/web.env" "$BASE/secrets/web.env"
PREVIOUS="\$(cat "$ROLLBACK/previous-release.txt")"
ln -sfn "\$PREVIOUS" "$BASE/current"
install -m 600 "$ROLLBACK/ecosystem.config.js" "$BASE/ecosystem.config.js"
pm2 startOrReload "$BASE/ecosystem.config.js" --only brokeriq-api,brokeriq-web --update-env
EOF
chmod 700 "$ROLLBACK/rollback.sh"
install -m 600 "$BASE/secrets/api.b2b.env" "$BASE/secrets/api.env"
install -m 600 "$BASE/secrets/web.b2b.env" "$BASE/secrets/web.env"
ln -s "$RELEASE" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
install -m 600 "$RELEASE/deploy/digitalocean/ecosystem.config.js" "$BASE/ecosystem.config.js"
pm2 startOrReload "$BASE/ecosystem.config.js" --only brokeriq-api,brokeriq-web --update-env
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null && curl -fsS "http://127.0.0.1:$WEB_PORT/" >/dev/null; then
    log "BrokerIQ cutover healthy. Rollback: $ROLLBACK/rollback.sh"; exit 0
  fi
  sleep 2
done
echo "Health failed. Restoring previous BrokerIQ release."
bash "$ROLLBACK/rollback.sh"
exit 1
