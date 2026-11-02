#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TASK_ROOT"
git diff --quiet && git diff --cached --quiet || { echo 'Commit tracked changes before building a pinned release' >&2; exit 1; }
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
node - <<'NODE'
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const root=process.cwd();
const aapt=path.join(process.env.ANDROID_HOME,'build-tools/36.0.0/aapt');
const signer=path.join(process.env.ANDROID_HOME,'build-tools/36.0.0/apksigner');
const apk=path.join(root,'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
const badging=cp.execFileSync(aapt,['dump','badging',apk],{encoding:'utf8'});
const m=/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
if(!m||m[1]!=='com.brokeriq.app'||Number(m[2])<=40)throw Error('Unexpected package/version');
const cert=cp.execFileSync(signer,['verify','--verbose','--print-certs',apk],{encoding:'utf8'});
const sha=/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i.exec(cert)?.[1]?.toLowerCase();
if(sha!=='d10762404de54b82b672efce4dedcb8d0ef5c39adb195b3444d52d49be8b35ce')throw Error('Signing identity mismatch');
const bytes=fs.readFileSync(apk), hash=crypto.createHash('sha256').update(bytes).digest('hex');
const folder=path.join(root,'releases',`build${m[2]}-${process.env.BROKERIQ_RELEASE_COMMIT.slice(0,12)}`);fs.mkdirSync(folder,{recursive:false,mode:0o700});
const filename=`BrokerIQ-v${m[3]}-build${m[2]}.apk`;fs.copyFileSync(apk,path.join(folder,filename));
const result={version:m[3],versionCode:Number(m[2]),commit:process.env.BROKERIQ_RELEASE_COMMIT,builtAt:new Date().toISOString(),url:`/downloads/${filename}`,sha256:hash,bytes:bytes.length,certificateSha256:sha};
fs.writeFileSync(path.join(folder,'android-release.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({folder,...result}));
NODE
