#!/usr/bin/env python3
"""Enrich existing identities using public HARERA project forms and cached OSM tags.
Usage: enrich-public.py <private-source-cache>. Originals remain outside Git.
Only allowlisted project facts are exported; personal profiles/finance are excluded.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
import datetime, hashlib, json, re, sys, time
class Node:
 def __init__(self, tag='', parent=None): self.tag=tag;self.parent=parent;self.children=[]
 def text(self): return ' '.join(' '.join(x if isinstance(x,str) else x.text() for x in self.children if isinstance(x,str) or x.tag not in ['script','style','input']).split())
 def all(self,tag):
  for x in self.children:
   if isinstance(x,Node):
    if x.tag==tag:yield x
    yield from x.all(tag)
class Document(HTMLParser):
 def __init__(self,html): super().__init__(convert_charrefs=True);self.root=Node();self.cur=self.root;self.feed(html)
 def handle_starttag(self,tag,attrs):
  node=Node(tag,self.cur);self.cur.children.append(node)
  if tag not in ['br','hr','img','meta','link','input','source','wbr']:self.cur=node
 def handle_endtag(self,tag):
  current=self.cur
  while current.parent:
   if current.tag==tag:self.cur=current.parent;return
   current=current.parent
 def handle_data(self,data):self.cur.children.append(data)
def rows(table):
 result=[]
 for tr in table.all('tr'):
  cells=[x for x in tr.children if isinstance(x,Node) and x.tag in ['td','th']]
  if not cells or any(next(x.all('table'),None) for x in cells):continue
  values=[x.text() for x in cells];values=[v for v in values if v]
  if values:result.append(values)
 return result
FACTS=[('landArea','Land area of the project'),('permissibleFar','Permissible FAR'),('proposedFar','FAR proposed'),('licensedArea','Total licensed area'),('licenseNumber','License number granted'),('layoutApproval','Date of approval of latest layout plans'),('buildingPlanApproval','Date of approval of Building Plans'),('constructionStart','Likely date of starting the construction work'),('plannedCompletion','Likely date of completing the project')]
def parse_form(html,url):
 doc=Document(html);facts={};tables=[]
 allrows=[]
 for table in doc.root.all('table'):
  rs=rows(table)
  if len(rs)>250:continue
  allrows.extend(rs)
  # Tables must be standalone, narrow, source-factual and project-specific.
  for index,row in enumerate(rs):
   header=' '.join(row).lower()
   kind='unitMix' if 'carpet area' in header and 'number of apartments' in header else 'approvals' if 'statutory approvals status' in header else 'specifications' if 'flooring details of various parts' in header else None
   if kind:
    end=rs[index:index+65]
    if kind=='specifications':end=rs[index:index+35]
    if end and not any(t['key']==kind for t in tables):tables.append({'key':kind,'rows':[[v[:1000] for v in r[:5]] for r in end]})
 for row in allrows:
  label=row[0]
  for key,pattern in FACTS:
   if key not in facts and re.search(re.escape(pattern),label,re.I) and len(row)>=2:
    value=row[-1]
    if value and value!=label and len(value)<600:facts[key]=value
 return {'version':1,'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceHash':hashlib.sha256(html.encode()).hexdigest(),'facts':facts,'tables':tables,'photos':[]}
def fetch(url,path):
 if path.exists():return path.read_text()
 request=Request(url,headers={'User-Agent':'BrokerIQ public project directory research (source attribution retained)'})
 with urlopen(request,timeout=20) as response:
  if response.geturl().split('/')[2]!='haryanarera.gov.in':raise ValueError('Unexpected redirect')
  data=response.read(3_000_001)
  if len(data)>3_000_000:raise ValueError('Public form exceeds bounded download')
 html=data.decode('utf8',errors='replace');path.write_text(html);time.sleep(.5);return html

def main():
 root=Path(sys.argv[1]);cache=root/'project-forms';cache.mkdir(exist_ok=True)
 source=json.loads((root/'directory.json').read_text());output=root/'enrichment.json';updates=[];failures=[]
 curated=json.loads(Path(__file__).with_name('curated-photos.json').read_text())
 photos={(x['provider'],x['externalId']):x for x in curated}
 osm=json.loads((root/'osm-named.json').read_text());byid={f"{x['type']}/{x['id']}":x.get('tags',{}) for x in osm.get('elements',[])}
 allowed=['building','building:levels','building:flats','building:levels:underground','height','building:material','building:use','wheelchair','website','start_date','operator','addr:postcode']
 for record in source['records']:
  if record['provider']=='OSM':
   tags=byid.get(record['externalId'],{});facts={key:tags[key] for key in allowed if tags.get(key)}
   curated=photos.get((record['provider'],record['externalId']))
   if curated and record['name'].strip()!=curated['expectedName']:raise ValueError('Curated photograph name mismatch')
   if facts or curated:updates.append({'provider':'OSM','externalId':record['externalId'],'sourceUrl':record['sourceUrl'],'enrichment':{'version':1,'sourceUrl':record['sourceUrl'],'fetchedAt':source['fetchedAt'],'facts':facts,'tables':[],'photos':[curated['photo']] if curated else [],'attribution':'© OpenStreetMap contributors · ODbL 1.0'}})
  elif record['provider']=='HARERA':
   match=re.fullmatch(r'https://haryanarera.gov.in/view_project/searchprojectDetail/(\d+)',record['sourceUrl'])
   if not match:continue
   identity=match.group(1);url=f'https://haryanarera.gov.in/view_project/project_preview_open/{identity}'
   try:
    if '--cached-only' in sys.argv and not (cache/(identity+'.html')).exists():raise ValueError('Source not cached; fetch required')
    html=fetch(url,cache/(identity+'.html'));enriched=parse_form(html,url)
    # Match the existing identity from the linked official project form; never fuzzy-merge projects.
    if not enriched['facts'] and not enriched['tables']:raise ValueError('No supported project facts in public form')
    updates.append({'provider':'HARERA','externalId':record['externalId'],'sourceUrl':record['sourceUrl'],'enrichment':enriched})
   except Exception as error:failures.append({'externalId':record['externalId'],'error':str(error)[:180]})
  if len(updates)%25==0:output.write_text(json.dumps({'updates':updates,'failures':failures},ensure_ascii=False));print(json.dumps({'enriched':len(updates),'failed':len(failures)}),flush=True)
 output.write_text(json.dumps({'updates':updates,'failures':failures},ensure_ascii=False));print(json.dumps({'enriched':len(updates),'failed':len(failures)}),flush=True)
if __name__=='__main__':main()
