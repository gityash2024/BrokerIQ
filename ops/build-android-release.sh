#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
git diff --quiet && git diff --cached --quiet || { echo 'Commit tracked changes before building a pinned release' >&2; exit 1; }
test -z "$(git ls-files --others --exclude-standard apps packages)" || { echo 'Commit new application files before building a pinned release' >&2; exit 1; }
# A clean native build temporarily duplicates CMake, DEX and packaging outputs.
# Fail before touching the generated project rather than losing a late signed build.
AVAILABLE_KIB="$(df -Pk "$TASK_ROOT" | awk 'NR==2 {print $4}')"
[[ "$AVAILABLE_KIB" =~ ^[0-9]+$ ]] && [ "$AVAILABLE_KIB" -ge 8388608 ] || {
  echo 'At least 8 GiB usable local disk is required for a clean Android release; review regenerable build files first.' >&2
  exit 1
}
export BROKERIQ_RELEASE_COMMIT="$(git rev-parse HEAD)"
export BROKERIQ_RELEASE_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export EXPO_PUBLIC_API_URL=https://brokeriqapi.mymultimeds.com/api
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export CI=1 CMAKE_BUILD_PARALLEL_LEVEL=2
pnpm --filter @brokeriq/shared build
cd apps/mobile
pnpm exec expo prebuild --clean --platform android --no-install
node - <<'NODE'
const fs=require('fs');
const main=fs.readFileSync('android/app/src/main/java/com/brokeriq/app/MainActivity.kt','utf8');
const gradle=fs.readFileSync('android/app/build.gradle','utf8');
const props=fs.readFileSync('android/gradle.properties','utf8');
if(!main.includes('FLAG_SECURE')||!gradle.includes('refusing a debug-signed release')||!props.includes('expo.sqlite.useSQLCipher=true')) throw Error('Native protection/signing/SQLCipher configuration missing');
NODE
cd android
./gradlew :app:assembleRelease --console=plain --max-workers=2 --no-parallel -Dorg.gradle.jvmargs='-Xmx1536m -XX:MaxMetaspaceSize=384m' -DCMAKE_BUILD_PARALLEL_LEVEL=2
cd "$TASK_ROOT"
test "$(git rev-parse HEAD)" = "$BROKERIQ_RELEASE_COMMIT" && git diff --quiet && git diff --cached --quiet || { echo 'Pinned source changed during Android build' >&2; exit 1; }
node - <<'NODE'
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=process.cwd();
const aapt=path.join(process.env.ANDROID_HOME,'build-tools/36.0.0/aapt');
const signer=path.join(process.env.ANDROID_HOME,'build-tools/36.0.0/apksigner');
const apk=path.join(root,'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
const badging=cp.execFileSync(aapt,['dump','badging',apk],{encoding:'utf8'});
const m=/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
let previousCode=40;
for(const entry of fs.readdirSync(path.join(root,'docs/evidence'),{recursive:true})) {
 if(!entry.endsWith('release-manifest.json'))continue;
 const release=JSON.parse(fs.readFileSync(path.join(root,'docs/evidence',entry),'utf8'));
 if(release.android?.publishedAt&&Number.isInteger(release.android.versionCode)) previousCode=Math.max(previousCode,release.android.versionCode);
}
if(!m||m[1]!=='com.brokeriq.app'||Number(m[2])<=previousCode)throw Error('Android versionCode must exceed every recorded published release');
const permissions=cp.execFileSync(aapt,['dump','permissions',apk],{encoding:'utf8'});
for(const permission of ['CAMERA','RECORD_AUDIO','POST_NOTIFICATIONS','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE_LOCATION']) {
 if(!permissions.includes(`name='android.permission.${permission}'`))throw Error(`Signed APK is missing required ${permission} permission`);
}
const cert=cp.execFileSync(signer,['verify','--verbose','--print-certs',apk],{encoding:'utf8'});
const sha=/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i.exec(cert)?.[1]?.toLowerCase();
if(sha!=='d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce')throw Error('Signing identity mismatch');
const bytes=fs.readFileSync(apk), hash=crypto.createHash('sha256').update(bytes).digest('hex');
// The signed APK is verified and retained; these generated intermediates are not a rollback artifact.
fs.rmSync(path.join(root,'apps/mobile/android/app/build/intermediates'),{recursive:true,force:true});
fs.mkdirSync(path.join(root,'releases'),{recursive:true,mode:0o700});
const folder=path.join(root,'releases',`build${m[2]}-${process.env.BROKERIQ_RELEASE_COMMIT.slice(0,12)}`);fs.mkdirSync(folder,{recursive:false,mode:0o700});
const filename=`BrokerIQ-v${m[3]}-build${m[2]}.apk`;fs.copyFileSync(apk,path.join(folder,filename));
const result={version:m[3],versionCode:Number(m[2]),commit:process.env.BROKERIQ_RELEASE_COMMIT,builtAt:new Date().toISOString(),url:`/downloads/${filename}`,sha256:hash,bytes:bytes.length,certificateSha256:sha};
fs.writeFileSync(path.join(folder,'android-release.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({folder,...result}));
NODE
