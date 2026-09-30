#!/usr/bin/env bash
# BrokerIQ watchdog (cron, every 2 min): if the API or website fails its local health check twice in a row,
# restart only that BrokerIQ pm2 process and record an incident. The API reports incidents to Super Admins.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.sh"
STATE="$BASE/logs/watchdog.state"
INCIDENTS="$BASE/logs/incidents.log"
mkdir -p "$BASE/logs"
touch "$STATE" "$INCIDENTS"

check() { # name url
  local name="$1" url="$2" fails
  fails="$(grep -E "^$name=" "$STATE" | cut -d= -f2)"
  fails="${fails:-0}"
  if curl -fsS -m 10 -o /dev/null "$url"; then
    fails=0
  else
    fails=$((fails + 1))
    if [ "$fails" -ge 2 ]; then
      local ts
      ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      log "$name down ($url) — restarting brokeriq-$name"
      pm2 restart "brokeriq-$name" >/dev/null 2>&1
      echo "$ts brokeriq-$name restarted (health check failed twice)" >> "$INCIDENTS"
      fails=0
    fi
  fi
  grep -vE "^$name=" "$STATE" > "$STATE.tmp" || true
  echo "$name=$fails" >> "$STATE.tmp"
  mv "$STATE.tmp" "$STATE"
}

check api "http://127.0.0.1:$API_PORT/api/health"
check web "http://127.0.0.1:$WEB_PORT/"
