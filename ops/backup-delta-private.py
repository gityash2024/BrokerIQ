#!/usr/bin/env python3
"""Fresh server snapshot + authenticated encrypted off-host delta; keep base and delta."""
import argparse,datetime,hashlib,json,os,re,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--base-archive',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True);p.add_argument('--recipient',type=Path,required=True);p.add_argument('--state',type=Path,required=True);a=p.parse_args()
base=a.base_archive.resolve();match=re.fullmatch(r'(production-\d{8}T\d{6}Z)\.tar\.age',base.name)
if not match or not base.is_file() or not base.with_suffix('.verified.json').is_file():raise SystemExit('Verified encrypted standalone base required')
folder=a.output_dir.resolve();folder.mkdir(parents=True,exist_ok=True,mode=0o700)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');server='/opt/brokeriq/backups/production-'+stamp;archive=folder/('production-'+stamp+'.tar.age')
state={'stamp':stamp,'serverBackup':server,'archive':str(archive),'baseArchive':str(base)};a.state.write_text(json.dumps(state,indent=2));a.state.chmod(0o600)
subprocess.run(['ssh','-o','BatchMode=yes','root@165.232.182.189','/opt/brokeriq/runtime/node/bin/node /opt/brokeriq/ops/backup-private.cjs '+server],check=True)
js="""const fs=require('fs');const [folder,base]=process.argv.slice(2);const current=JSON.parse(fs.readFileSync(folder+'/manifest.json'));const previous=JSON.parse(fs.readFileSync('/opt/brokeriq/backups/'+base+'/manifest.json'));const old=new Map(previous.files.map(f=>[f.path,f]));const changed=current.files.filter(f=>old.get(f.path)?.sha256!==f.sha256||old.get(f.path)?.bytes!==f.bytes);if(changed.some(f=>!f.path.startsWith('storage/')||f.path.includes('..')))throw Error('Unsafe media path');const files=[folder.slice('/opt/brokeriq/'.length)+'/database.dump',folder.slice('/opt/brokeriq/'.length)+'/manifest.json','secrets/api.env','secrets/web.env',...changed.map(f=>f.path)];fs.writeFileSync(folder+'/delta-tar-files',files.join('\\0')+'\\0',{mode:0o600});console.log(JSON.stringify({changedMediaFiles:changed.length,allMediaFiles:current.files.length,dumpSha256:current.dumpSha256}));"""
subprocess.run(['ssh','root@165.232.182.189','/opt/brokeriq/runtime/node/bin/node - '+server+' '+match[1]],input=js.encode(),check=True)
tar=subprocess.Popen(['ssh','root@165.232.182.189','tar -C /opt/brokeriq --null -T '+server+'/delta-tar-files -cf -'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
age=subprocess.Popen(['age','-R',str(a.recipient.resolve()),'-o',str(archive)],stdin=tar.stdout,stdout=subprocess.PIPE,stderr=subprocess.PIPE);tar.stdout.close();_,ae=age.communicate();_,te=tar.communicate()
if age.returncode or tar.returncode:raise RuntimeError('Encrypted transfer incomplete; do not accept this archive')
archive.chmod(0o600)
with archive.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
state.update(bytes=archive.stat().st_size,sha256=digest);a.state.write_text(json.dumps(state,indent=2));print(json.dumps(state))
