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

# The shared PM2 dump is outside our scope. If it resurrects an old checkout after
# reboot, reconcile just these two registrations from BrokerIQ's current release.
if [ -e "$BASE/current" ]; then
  STALE="$(pm2 jlist | node -e '
    const fs=require("fs"),base="/opt/brokeriq",app=fs.realpathSync(base+"/current");
    const settings=Object.fromEntries(fs.readFileSync(base+"/secrets/api.env","utf8").split("\n").map(l=>{const m=/^([A-Z_]+)=(.*)$/.exec(l);return m?[m[1],m[2].replace(/^([\x27\"])(.*)\1$/,"$2")]:[];}).filter(a=>a.length));
    let input="";process.stdin.on("data",x=>input+=x).on("end",()=>{
      const processes=JSON.parse(input);
      for(const suffix of ["api","web"]){const name="brokeriq-"+suffix,p=processes.find(p=>p.name===name);
        if(!p||p.pm2_env.pm_cwd!==app+"/apps/"+suffix||(suffix==="api"&&p.pm2_env.DATABASE_URL!==settings.DATABASE_URL))console.log(name);
      }
    });')"
  for name in $STALE; do
    case "$name" in brokeriq-api|brokeriq-web)
      pm2 delete "$name" >/dev/null 2>&1 || true
      pm2 start "$BASE/ecosystem.config.js" --only "$name" --update-env >/dev/null 2>&1
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $name reconciled to current BrokerIQ release" >> "$INCIDENTS"
      ;;
    esac
  done
fi

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
