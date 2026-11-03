#!/usr/bin/env bash
# BrokerIQ-owned, isolated Linux SDK/JDK. Existing accepted SDK licenses must be supplied.
set -euo pipefail
BASE=/opt/brokeriq/build-tools
SDK="$BASE/android-sdk"
[ "$(uname -sm)" = 'Linux x86_64' ] || { echo 'This toolchain requires Linux x86_64' >&2; exit 1; }
FREE=$(df -Pk /opt/brokeriq | awk 'NR==2 {print $4}')
[ "$FREE" -ge 31457280 ] || { echo 'At least 30 GiB free space required before installing the build toolchain' >&2; exit 1; }
test -s "$SDK/licenses/android-sdk-license" || { echo 'Supply the owner’s existing accepted SDK license file before setup' >&2; exit 1; }
mkdir -p "$BASE/downloads" "$SDK/cmdline-tools"
chmod 700 "$BASE" "$BASE/downloads"
exec 9>"$BASE/toolchain.lock"
flock -n 9 || { echo 'Toolchain setup is already running' >&2; exit 1; }

if [ ! -x "$BASE/jdk17/bin/java" ]; then
  curl -fsSL --retry 2 --max-time 60 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=linux&vendor=eclipse' > "$BASE/downloads/jdk17.json"
  python3 - "$BASE/downloads/jdk17.json" > "$BASE/downloads/jdk17-package" <<'PY'
import json,re,sys
package=json.load(open(sys.argv[1]))[0]['binary']['package']
assert package['link'].startswith('https://github.com/adoptium/temurin17-binaries/releases/download/')
assert re.fullmatch('[a-f0-9]{64}',package['checksum'])
print(package['link'])
print(package['checksum'])
PY
  JDK_URL=$(sed -n '1p' "$BASE/downloads/jdk17-package")
  JDK_SHA=$(sed -n '2p' "$BASE/downloads/jdk17-package")
  curl -fsSL --retry 2 --max-time 600 "$JDK_URL" -o "$BASE/downloads/jdk17.tar.gz"
  echo "$JDK_SHA  $BASE/downloads/jdk17.tar.gz" | sha256sum -c -
  mkdir "$BASE/jdk17"
  tar -xzf "$BASE/downloads/jdk17.tar.gz" -C "$BASE/jdk17" --strip-components=1
fi
export JAVA_HOME="$BASE/jdk17"
export ANDROID_HOME="$SDK"
export PATH="$JAVA_HOME/bin:$PATH"

if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fsSL --retry 2 --max-time 600 https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o "$BASE/downloads/commandlinetools.zip"
  echo "4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  $BASE/downloads/commandlinetools.zip" | sha256sum -c -
  TEMP=$(mktemp -d "$BASE/command-tools.XXXXXX")
  unzip -q "$BASE/downloads/commandlinetools.zip" -d "$TEMP"
  mv "$TEMP/cmdline-tools" "$SDK/cmdline-tools/latest"
  rmdir "$TEMP"
fi
# No automatic license acceptance. An unaccepted package must fail and be reviewed.
"$SDK/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$SDK"   'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.22.1' </dev/null
for executable in "$SDK/build-tools/36.0.0/apksigner" "$SDK/ndk/27.1.12297006/toolchains/llvm/prebuilt/linux-x86_64/bin/clang"; do
  test -x "$executable"
done
FREE=$(df -Pk /opt/brokeriq | awk 'NR==2 {print $4}')
[ "$FREE" -ge 20971520 ] || { echo 'Less than 20 GiB remains; do not start a candidate build' >&2; exit 1; }
"$JAVA_HOME/bin/java" -version
printf 'JAVA_HOME=%s\nANDROID_HOME=%s\n' "$JAVA_HOME" "$SDK" > "$BASE/android.env"
echo 'BrokerIQ Linux Android toolchain ready'
