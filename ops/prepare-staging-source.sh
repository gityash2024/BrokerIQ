#!/usr/bin/env bash
# Source build only: never starts services/jobs, seeds, migrates or changes current.
set -euo pipefail
BASE=/opt/brokeriq
COMMIT="${1:?pinned full Git commit required}"
[[ "$COMMIT" =~ ^[a-f0-9]{40}$ ]] || exit 2
export PATH="$BASE/runtime/node/bin:$PATH" COREPACK_HOME="$BASE/runtime/corepack"
export CI=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536
exec 9>"$BASE/candidate-build.lock"
flock -n 9 || { echo 'Another BrokerIQ candidate build is active' >&2; exit 1; }
FREE=$(df -Pk "$BASE" | awk 'NR==2 {print $4}')
[ "$FREE" -ge 20971520 ] || { echo 'At least20GiB free space required' >&2; exit 1; }
CANDIDATE="$BASE/releases/rc-${COMMIT:0:12}"
[ ! -e "$CANDIDATE" ] || { echo 'Candidate already exists; inspect it instead of overwriting' >&2; exit 1; }
git clone --no-checkout --filter=blob:none https://github.com/gityash2024/BrokerIQ.git "$CANDIDATE"
git -C "$CANDIDATE" checkout --detach "$COMMIT"
[ "$(git -C "$CANDIDATE" rev-parse HEAD)" = "$COMMIT" ] || exit 1
cd "$CANDIDATE"
nice -n 10 pnpm install --frozen-lockfile --network-concurrency=4 --child-concurrency=1
nice -n 10 pnpm --filter @brokeriq/shared build
( set -a; source "$BASE/secrets/api.env"; set +a; nice -n 10 pnpm --filter @brokeriq/api build )
printf '%s\n' "$COMMIT" > .candidate-source-built
