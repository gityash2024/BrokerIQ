# Shared settings for the BrokerIQ self-host scripts. Everything lives under $BASE.
BASE=/opt/brokeriq
BRANCH=${BRANCH:-feat/production}
REPO=${REPO:-https://github.com/gityash2024/BrokerIQ.git}
NODE_VERSION=22.20.0
PNPM_VERSION=11.25.0
PG_VERSION=14
PG_CLUSTER=brokeriq
PG_PORT=5433
DB_NAME=brokeriq
DB_OWNER=brokeriq
MEDIA_DIR="$BASE/storage/media"
API_PORT=3100
WEB_PORT=3101
WEB_DOMAIN=brokeriq.mymultimeds.com
API_DOMAIN=brokeriqapi.mymultimeds.com

# BrokerIQ's own Node 22 comes first; the server's global Node 20 is left alone.
export PATH="$BASE/runtime/node/bin:$PATH"
export COREPACK_HOME="$BASE/runtime/corepack"
# Follow the active BrokerIQ database after a fresh-database cutover.
if [ -f "$BASE/secrets/api.env" ]; then
  DB_NAME="$(set -a; source "$BASE/secrets/api.env"; node -e 'const u=new URL(process.env.DATABASE_URL); if(u.hostname!=="127.0.0.1" && u.hostname!=="localhost") throw Error("Expected local BrokerIQ database"); if(u.port!=="5433") throw Error("Expected BrokerIQ port 5433"); const n=u.pathname.slice(1); if(!/^brokeriq(?:_[a-z0-9_]+)?$/.test(n)) throw Error("Unexpected database name"); process.stdout.write(n)')"
  MEDIA_DIR="$(set -a; source "$BASE/secrets/api.env"; node -e 'const fs=require("fs"),p=require("path"); const root=p.resolve(process.env.MEDIA_ROOT||"/opt/brokeriq/storage/media"); const storage=fs.realpathSync("/opt/brokeriq/storage"); const resolved=fs.realpathSync(root); if(!resolved.startsWith(storage+p.sep)) throw Error("Media must be inside BrokerIQ storage"); process.stdout.write(resolved)')"
fi

# pm2 daemon is the server's shared one (global Node 20) — always call it with the system PATH.
pm2() { env PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root pm2 "$@"; }
log() { printf '\n\033[1;34m[brokeriq]\033[0m %s\n' "$*"; }

# Keep operator transcripts/amendments with the encrypted original source evidence.
# A real extraction verifies every byte before a snapshot can be trusted.
snapshot_register_evidence() (
  set -euo pipefail
  local dest="${1:?backup destination required}" source_dir="$BASE/storage/register-source" scratch
  [ -d "$source_dir" ] || exit 0
  [ "$(readlink -f "$source_dir")" = "$BASE/storage/register-source" ] || { echo 'Unexpected register evidence path' >&2; exit 1; }
  case "$(readlink -f "$dest")" in "$BASE/backups/"*) ;; *) echo 'Unexpected backup destination' >&2; exit 1 ;; esac
  tar -C "$BASE/storage" -cz register-source |
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BASE/secrets/backup.key" -out "$dest/register-source.tgz.enc"
  scratch="$(mktemp -d "$dest/evidence-verify.XXXXXX")"
  trap 'rm -rf -- "$scratch"' EXIT
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BASE/secrets/backup.key" -in "$dest/register-source.tgz.enc" |
    tar -xz -C "$scratch" --no-same-owner
  diff -q <(cd "$source_dir" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum) \
    <(cd "$scratch/register-source" && find . -type f -print0 | sort -z | xargs -0 -r sha256sum)
)
