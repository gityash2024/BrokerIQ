#!/usr/bin/env bash
# No schema migration here. A changed migration set requires a reviewed release-specific recovery procedure.
set -euo pipefail
BASE=/opt/brokeriq
PIN="${1:?full candidate commit required}"
BACKUP="${2:?verified scoped backup directory required}"
[[ "$PIN" =~ ^[a-f0-9]{40}$ ]] && [[ "$BACKUP" =~ ^/opt/brokeriq/backups/production-[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
export PATH="$BASE/runtime/node/bin:$PATH" COREPACK_HOME="$BASE/runtime/corepack"
exec 9>"$BASE/activation.lock"; flock -n 9 || exit 1
CANDIDATE="$BASE/releases/rc-${PIN:0:12}"
OLD="$(readlink -f "$BASE/current")"
[ "$OLD" != "$CANDIDATE" ] && [ "$(cat "$CANDIDATE/.candidate-build-complete")" = "$PIN" ]
node - "$CANDIDATE" "$OLD" "$BACKUP" <<'JS'
const fs=require('fs'),path=require('path'),crypto=require('crypto');const [candidate,old,backup]=process.argv.slice(2);
if(!/^\/opt\/brokeriq\/releases\/rc-[a-f0-9]{12}$/.test(old))throw Error('Unreviewed current release path');
const proof=JSON.parse(fs.readFileSync(backup+'/offhost-restore-proof.json'));if(proof.result!=='VERIFIED_SCRATCH_RESTORE_NO_APPLICATION_STARTED')throw Error('Actual restore proof required');
const digest=root=>fs.readdirSync(root+'/apps/api/prisma/migrations').filter(n=>n!=='migration_lock.toml').sort().map(n=>n+':'+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'apps/api/prisma/migrations',n,'migration.sql'))).digest('hex')).join('\n');
if(digest(candidate)!==digest(old))throw Error('Migration set differs: release-specific rehearsed recovery is required');
const previous=JSON.parse(fs.readFileSync(old+'/release-manifest.json'));
const file='/opt/brokeriq/ops/rollback-ecosystem-'+path.basename(candidate)+'.cjs';if(fs.existsSync(file))throw Error('Rollback file exists; inspect previous attempt before retrying');
fs.writeFileSync(file,`const base=require('/opt/brokeriq/ecosystem.config.js');const root=${JSON.stringify(old)};module.exports={apps:base.apps.filter(a=>['brokeriq-api','brokeriq-web'].includes(a.name)).map(a=>({...a,cwd:root+'/apps/'+(a.name==='brokeriq-api'?'api':'web'),script:root+(a.name==='brokeriq-api'?'/apps/api/dist/src/main.js':'/apps/web/node_modules/next/dist/bin/next')}))};\n`,{mode:0o600});
const pm2=require('/usr/lib/node_modules/pm2');pm2.connect(error=>{if(error)throw error;pm2.list((error,apps)=>{if(error)throw error;fs.writeFileSync(candidate+'/.processes-before.json',JSON.stringify(apps.map(a=>({name:a.name,pid:a.pid,status:a.pm2_env.status,restarts:a.pm2_env.restart_time}))));pm2.disconnect();});});
fs.writeFileSync(candidate+'/.previous-release.json',JSON.stringify({root:old,manifest:previous,rollbackConfig:file}),{mode:0o600});
JS
HASH="$(node -e 'console.log(require(process.argv[1]).android.sha256)' "$CANDIDATE/release-manifest.json")"
CODE="$(node -e 'console.log(require(process.argv[1]).android.versionCode)' "$CANDIDATE/release-manifest.json")"
if ! node "$BASE/ops/prepublish-staging-apk.cjs" "$PIN" "$HASH"; then
 env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root pm2 reload brokeriq-web --update-env
 prepublished=false
 for i in $(seq 1 20); do
  if node "$BASE/ops/prepublish-staging-apk.cjs" "$PIN" "$HASH"; then prepublished=true; break; fi
  sleep 2
 done
 [ "$prepublished" = true ] || { echo 'APK remained unavailable after the existing web process refreshed; current release retained' >&2; exit 1; }
fi
for name in api web; do
 PID=$(cat "$CANDIDATE/.$name-smoke.pid")
 [ "$(readlink -f /proc/$PID/cwd)" = "$CANDIDATE/apps/$name" ]
 kill -TERM "$PID"
done
rollback() {
 local config="$BASE/ops/rollback-ecosystem-$(basename "$CANDIDATE").cjs"
 ln -s "$OLD" "$BASE/current-recover-${PIN:0:12}"; mv -Tf "$BASE/current-recover-${PIN:0:12}" "$BASE/current"
 node "$BASE/ops/start-pinned-processes.cjs" "$config"
 echo 'Candidate activation rejected; preceding release restored. Runtime-link update was not attempted.' >&2
}
node - "$CANDIDATE/release-manifest.json" <<'JS'
const fs=require('fs');const p=process.argv[2];const m=JSON.parse(fs.readFileSync(p));const now=new Date().toISOString();m.portals.publishedAt=now;m.android.publishedAt=now;fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');
JS
ln -s "$CANDIDATE" "$BASE/current-next-${PIN:0:12}";mv -Tf "$BASE/current-next-${PIN:0:12}" "$BASE/current"
if ! node "$BASE/ops/start-pinned-processes.cjs" "$BASE/ecosystem.config.js"; then rollback;exit 1;fi
accepted=false
for i in $(seq 1 20); do
 if node "$BASE/ops/verify-active-staging-release.cjs" "$PIN" "$CODE" "$HASH" > "$CANDIDATE/.strict-release-verification.json" 2> "$CANDIDATE/.strict-release-verification-error.json";then accepted=true;break;fi
 sleep 2
done
if [ "$accepted" != true ];then rollback;exit 1;fi
# Crucially sequential: no update is possible before accepted exact API/web/public bytes.
node "$BASE/ops/update-active-release.cjs" "$PIN" > "$CANDIDATE/.runtime-release-verification.json"
cat "$CANDIDATE/.strict-release-verification.json"
cat "$CANDIDATE/.runtime-release-verification.json"
