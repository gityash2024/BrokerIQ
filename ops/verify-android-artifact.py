#!/usr/bin/env python3
"""Inspect actual signed APK identity, DEX security, required permissions and16KB ELF/zip alignment."""
import argparse,json,os,re,struct,subprocess,tempfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('folder',type=Path);a=p.parse_args();folder=a.folder.resolve();meta=json.loads((folder/'android-release.json').read_text());apk=folder/Path(meta['url']).name
sdk=Path(os.environ.get('ANDROID_HOME',str(Path.home()/'Library/Android/sdk')))/'build-tools/36.0.0'
count=0;bad=[];activities={}
with zipfile.ZipFile(apk) as z:
 config=json.loads(z.read('assets/app.config'));embedded=config['extra']['release']
 assert embedded['commit']==meta['commit'] and embedded['versionCode']==meta['versionCode'] and config['version']==meta['version']
 for name in z.namelist():
  if name.startswith(('lib/arm64-v8a/','lib/x86_64/')) and name.endswith('.so'):
   b=z.read(name);offset=struct.unpack_from('<Q',b,32)[0];size,num=struct.unpack_from('<HH',b,54)
   align=[struct.unpack_from('<Q',b,offset+i*size+48)[0] for i in range(num) if struct.unpack_from('<I',b,offset+i*size)[0]==1];count+=1
   if not align or min(align)<16384:bad.append(name)
  if re.fullmatch(r'classes\d*\.dex',name):
   data=z.read(name)
   if b'Lcom/brokeriq/app/MainActivity;' not in data and b'Lcom/brokeriq/facecapture/FaceCaptureActivity;' not in data:continue
   with tempfile.NamedTemporaryFile(suffix='.dex') as f:
    f.write(data);f.flush();proc=subprocess.Popen([str(sdk/'dexdump'),'-d',f.name],stdout=subprocess.PIPE,text=True,errors='replace');current=None;lines=[]
    for line in proc.stdout:
     if line.startswith('Class #'):
      if current:activities[current]=''.join(lines)
      current=None;lines=[]
     if 'Class descriptor' in line and ("'Lcom/brokeriq/app/MainActivity;'" in line or "'Lcom/brokeriq/facecapture/FaceCaptureActivity;'" in line):current=line.strip()
     if current:lines.append(line)
    if current:activities[current]=''.join(lines)
    if proc.wait():raise RuntimeError('DEX inspection failed')
permissions=subprocess.check_output([str(sdk/'aapt'),'dump','permissions',str(apk)],text=True)
required=['CAMERA','RECORD_AUDIO','POST_NOTIFICATIONS','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE_LOCATION'];assert all("name='android.permission."+v+"'" in permissions for v in required)
xml=subprocess.check_output([str(sdk/'aapt'),'dump','xmltree',str(apk),'AndroidManifest.xml'],text=True)
assert 'expo.modules.audio.service.AudioRecordingService' not in xml and 'expo.modules.audio.service.AudioControlsService' not in xml
zip_result=subprocess.run([str(sdk/'zipalign'),'-c','-P','16','4',str(apk)],capture_output=True)
security={k:{'hasWindowFlagCall':'setFlags' in v or 'addFlags' in v,'hasSecure8192Constant':bool(re.search(r'8192|2000',v))} for k,v in activities.items()}
assert count>=60 and not bad and zip_result.returncode==0 and len(security)==2 and all(all(x.values()) for x in security.values())
report={'apk':str(apk),'checked64BitLibraries':count,'alignmentFailures':bad,'zipAlignmentExitCode':zip_result.returncode,'secureActivityBytecode':security,'requiredPermissions':required,'backgroundAudioServicesAbsent':True,'installedDeviceAcceptance':False}
(folder/'native-verification.json').write_text(json.dumps(report,indent=2));(folder/'embedded-identity.json').write_text(json.dumps({'asset':'assets/app.config','embeddedRelease':embedded,'version':config['version'],'verified':True},indent=2));print(json.dumps(report))
