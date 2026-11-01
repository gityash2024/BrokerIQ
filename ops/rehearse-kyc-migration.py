#!/usr/bin/env python3
"""Read original env only in memory, then rehearse copies against an existing verified local restore.
This helper has no public-retirement mode and never starts the application or jobs.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--identity', type=Path, required=True)
parser.add_argument('--database', required=True)
parser.add_argument('--mode', choices=['plan', 'inspect', 'copy', 'verify'], default='plan')
parser.add_argument('--inspect-sample', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'brokeriq_restore_[a-z0-9_]+', args.database):
    raise SystemExit('Only a local restored database is allowed')
archive = args.archive.resolve()
proof = archive.with_suffix('.verified.json')
if json.loads(proof.read_text())['database'] != args.database:
    raise SystemExit('Verified restore proof does not match the database')
child = subprocess.Popen(['age', '--decrypt', '-i', str(args.identity), str(archive)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
settings = {}
manifest = None
try:
    with tarfile.open(fileobj=child.stdout, mode='r|') as tar:
        for entry in tar:
            if entry.name.endswith('/manifest.json'):
                manifest = json.loads(tar.extractfile(entry).read())
            if entry.name == 'secrets/api.env':
                for line in tar.extractfile(entry).read().decode().splitlines():
                    if '=' not in line or line.lstrip().startswith('#'):
                        continue
                    key, value = line.split('=', 1)
                    value = value.strip()
                    if value.startswith('"') and value.endswith('"'):
                        value = json.loads(value)
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    settings[key.strip()] = value
    for _ in iter(lambda: child.stdout.read(1024 * 1024), b''):
        pass
    if child.wait() or not settings.get('ENCRYPTION_MASTER_KEY'):
        raise RuntimeError('Authenticated original configuration unavailable')
finally:
    if child.poll() is None:
        child.kill()
        child.wait()
private = archive.parent / ('scratch-kyc-' + args.database)
private.mkdir(mode=0o700, exist_ok=True)
private.chmod(0o700)
project = Path(__file__).resolve().parents[1]
settings.update(DATABASE_URL='postgresql://' + os.environ['USER'] + '@localhost:5432/' + args.database, MEDIA_ROOT=str(private), JOBS_ENABLED='false', NODE_ENV='production', TS_NODE_PROJECT=str(project / 'apps/api/tsconfig.json'))
options = {'mode': args.mode, 'expectedDatabase': args.database, 'backupProof': str(proof), 'inspectSample': args.inspect_sample, 'originalKycSnapshot': next((t for t in manifest['database'] if t['table'] == 'KycDocument'), None)}
program = """
const fs=require('node:fs'); const input=JSON.parse(fs.readFileSync(0,'utf8'));
Object.assign(process.env,input.settings); require('ts-node/register/transpile-only');
require('./src/ops/kyc-private-migration').runKycPrivateMigration(input.options)
.then(result=>console.log(JSON.stringify(result)))
.catch(error=>{ console.error(JSON.stringify({result:'FAILED_NO_PROVIDER_CHANGE_REQUESTED',type:error?.name||'Unknown',code:error?.safeCode||error?.http_code||error?.error?.http_code||null})); process.exitCode=1; });
"""
result = subprocess.run([str(Path.home() / '.nvm/versions/node/v22.17.0/bin/node'), '-e', program], input=json.dumps({'settings': settings, 'options': options}).encode(), cwd=project / 'apps/api', capture_output=True)
if result.returncode:
    # The wrapper emits only a sanitized diagnostic; do not expose unexpected library logs.
    for line in result.stderr.decode().splitlines():
        if line.startswith('{"result":"FAILED_NO_PROVIDER_CHANGE_REQUESTED"'):
            print(line)
    raise SystemExit('Scratch migration rehearsal stopped; no production application was connected')
report = json.loads(result.stdout.decode().strip().splitlines()[-1])
output = archive.parent / ('kyc-rehearsal-' + args.mode + '.json')
output.write_text(json.dumps(report, indent=2))
output.chmod(0o600)
print(json.dumps(report))
