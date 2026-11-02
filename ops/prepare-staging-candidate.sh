#!/usr/bin/env bash
# Build only. Never switches current, starts API/jobs, migrates a database or reloads PM2.
set -euo pipefail
BASE=/opt/brokeriq
COMMIT="${1:?pinned full Git commit required}"
ARTIFACTS="${2:?verified Android artifact directory required}"
[[ "$COMMIT" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$ARTIFACTS" == "$BASE/artifacts/"* ]] && [ -f "$ARTIFACTS/android-release.json" ] || exit 2
if [ ! -e "$BASE/releases/rc-${COMMIT:0:12}" ]; then
 bash "$BASE/ops/prepare-staging-source.sh" "$COMMIT"
fi
export PATH="$BASE/runtime/node/bin:$PATH" COREPACK_HOME="$BASE/runtime/corepack"
export CI=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
exec 9>"$BASE/candidate-build.lock"
flock -n 9 || { echo 'Another BrokerIQ candidate build is active' >&2; exit 1; }
CANDIDATE="$BASE/releases/rc-${COMMIT:0:12}"
[ "$(cat "$CANDIDATE/.candidate-source-built")" = "$COMMIT" ]
[ "$(git -C "$CANDIDATE" rev-parse HEAD)" = "$COMMIT" ]
[ ! -e "$CANDIDATE/.candidate-build-complete" ] || { echo 'Candidate already complete; inspect it instead of rebuilding' >&2; exit 1; }
cd "$CANDIDATE"
node - "$COMMIT" "$ARTIFACTS" <<'NODE'
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const [commit,dir]=process.argv.slice(2);
const android=JSON.parse(fs.readFileSync(path.join(dir,'android-release.json'),'utf8'));
if(android.commit!==commit||android.versionCode<=40)throw Error('Android/source identity mismatch');
const filename=path.basename(android.url);if(android.url!==`/downloads/${filename}`)throw Error('Unsafe artifact name');
const file=fs.readFileSync(path.join(dir,filename));
if(file.length!==android.bytes||crypto.createHash('sha256').update(file).digest('hex')!==android.sha256)throw Error('APK byte checksum mismatch');
const now=new Date().toISOString();
const portals={version:android.version,commit,builtAt:now,publishedAt:now};
const manifest={schemaVersion:1,environment:'staging',portals,android:{...android,publishedAt:now},screenshots:[]};
require('./packages/shared/dist').releaseManifestSchema.parse(manifest);
fs.mkdirSync('apps/web/public/downloads',{recursive:true});
fs.copyFileSync(path.join(dir,filename),path.join('apps/web/public/downloads',filename));
// Preserve the immediate accepted rollback APK, verified from its manifest.
const previousManifest=JSON.parse(fs.readFileSync('/opt/brokeriq/current/release-manifest.json','utf8'));
const previous=previousManifest.android;
const previousName=path.basename(previous.url);
if(previous.url!==`/downloads/${previousName}`||previous.versionCode>=android.versionCode)throw Error('Rollback/new Android identity mismatch');
const previousBytes=fs.readFileSync(path.join('/opt/brokeriq/current/apps/web/public/downloads',previousName));
if(previousBytes.length!==previous.bytes||crypto.createHash('sha256').update(previousBytes).digest('hex')!==previous.sha256)throw Error('Accepted rollback APK checksum mismatch');
fs.copyFileSync(path.join('/opt/brokeriq/current/apps/web/public/downloads',previousName),path.join('apps/web/public/downloads',previousName));
fs.writeFileSync('release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('apps/api/dist/release.json',JSON.stringify({commit,version:android.version,builtAt:now})+'\n');
NODE
( set -a; source "$BASE/secrets/web.env"; set +a; nice -n 10 pnpm --filter @brokeriq/web build )
node - <<'NODE'
const fs=require('fs');const manifest=JSON.parse(fs.readFileSync('release-manifest.json','utf8'));
manifest.portals.builtAt=new Date().toISOString();
fs.writeFileSync('release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('.candidate-build-complete',manifest.portals.commit+'\n');
console.log(JSON.stringify({candidate:process.cwd(),commit:manifest.portals.commit,apkSha256:manifest.android.sha256,status:'BUILT_NOT_ACTIVATED'}));
NODE
