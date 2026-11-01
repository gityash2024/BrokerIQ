#!/usr/bin/env python3
"""Verify encrypted archive/media and restore only into a new local scratch database.
No API/worker is started and no stored credential is decrypted for application use.
"""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('archive', type=Path)
parser.add_argument('--identity', type=Path, required=True)
parser.add_argument('--database', required=True)
args = parser.parse_args()
if not re.fullmatch(r'brokeriq_restore_[a-z0-9_]+', args.database):
    raise SystemExit('Only a new BrokerIQ scratch database is permitted')
archive = args.archive.resolve()
if not archive.is_file() or not archive.name.endswith('.tar.age'):
    raise SystemExit('An existing encrypted backup is required')
env = {**os.environ, 'PGHOST': 'localhost', 'PGPORT': '5432', 'PGUSER': getpass.getuser(), 'PGDATABASE': args.database}
for key in ('PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS'):
    env.pop(key, None)

with tempfile.TemporaryDirectory(prefix='brokeriq-restore-', dir=archive.parent) as temporary:
    os.chmod(temporary, 0o700)
    dump = Path(temporary) / 'database.dump'
    manifest = None
    media = {}
    decrypt = subprocess.Popen(['age', '--decrypt', '-i', str(args.identity), str(archive)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=decrypt.stdout, mode='r|') as tar:
            for item in tar:
                if not item.isfile():
                    continue
                source = tar.extractfile(item)
                digest = hashlib.sha256()
                output = None
                data = bytearray() if item.name.endswith('/manifest.json') else None
                if item.name.endswith('/database.dump'):
                    output = dump.open('xb')
                    dump.chmod(0o600)
                try:
                    while chunk := source.read(1024 * 1024):
                        digest.update(chunk)
                        if output:
                            output.write(chunk)
                        if data is not None:
                            data.extend(chunk)
                            if len(data) > 4 * 1024 * 1024:
                                raise RuntimeError('Manifest exceeds expected size')
                finally:
                    if output:
                        output.close()
                if item.name.startswith('storage/'):
                    media[item.name] = {'sha256': digest.hexdigest(), 'bytes': item.size}
                elif data is not None:
                    manifest = json.loads(data)
        # tar readers stop at end markers; drain age so its authenticated final chunk is checked.
        for _ in iter(lambda: decrypt.stdout.read(1024 * 1024), b''):
            pass
        _, error = decrypt.communicate()
        if decrypt.returncode:
            raise RuntimeError('Encrypted backup authentication failed')
    finally:
        if decrypt.poll() is None:
            decrypt.kill()
            decrypt.wait()
    if not manifest or not dump.is_file():
        raise RuntimeError('Backup is incomplete')
    with dump.open('rb') as stream:
        actual_dump_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual_dump_hash != manifest['dumpSha256']:
        raise RuntimeError('Database dump checksum mismatch')
    expected = {f['path']: {'sha256': f['sha256'], 'bytes': f['bytes']} for f in manifest['files']}
    if expected != media:
        raise RuntimeError('Media checksum/count mismatch; no restore acceptance')
    existing = subprocess.run(['psql', '-XAt', '-d', 'postgres', '-c', "SELECT 1 FROM pg_database WHERE datname='" + args.database + "'"], env=env, capture_output=True, text=True, check=True)
    if existing.stdout.strip():
        raise RuntimeError('Scratch database already exists; refusing overwrite')
    subprocess.run(['createdb', args.database], env=env, check=True)
    restore = subprocess.run(['pg_restore', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', '--dbname=' + args.database, str(dump)], env=env, capture_output=True)
    if restore.returncode:
        raise RuntimeError('Scratch restore failed; database retained for diagnosis')
    for expected_table in manifest['database']:
        table = '"' + expected_table['table'].replace('"', '""') + '"'
        sql = "SET TIME ZONE 'UTC'; SELECT json_build_object('count', count(*)::text, 'digest', md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), ''))) FROM " + table + ' t'
        result = subprocess.run(['psql', '-XAt', '-c', sql], env=env, capture_output=True, text=True, check=True)
        row = json.loads(result.stdout.strip().splitlines()[-1])
        if row['count'] != expected_table['count'] or row['digest'] != expected_table['digest']:
            raise RuntimeError('Restored table count/digest mismatch: ' + expected_table['table'])
    report = {'archive': archive.name, 'database': args.database, 'tablesVerified': len(manifest['database']), 'mediaFilesVerified': len(media), 'mediaBytesVerified': sum(f['bytes'] for f in media.values()), 'dumpSha256': actual_dump_hash, 'result': 'VERIFIED_SCRATCH_RESTORE_NO_APPLICATION_STARTED'}
    output = archive.with_suffix('.verified.json')
    output.write_text(json.dumps(report, indent=2))
    output.chmod(0o600)
    print(json.dumps(report))
