#!/usr/bin/env python3
"""Cache public project facts and government GIS. No login, CAPTCHA or private contacts.
Usage: fetch-public.py <private-output-directory>. Raw snapshots never go into Git.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,urlopen
from urllib.parse import urlencode
import json,sys,re,hashlib,ssl,datetime,time
ROOT=Path(sys.argv[1]);ROOT.mkdir(parents=True,exist_ok=True)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
class Rows(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='tr':self.row=[]
  if tag in ['td','th'] and self.row is not None:self.cell={'text':'','links':[]}
  if tag=='a' and self.cell is not None and attrs.get('href'):self.cell['links'].append(attrs['href'])
  if tag=='br' and self.cell is not None:self.cell['text']+=' '
 def handle_data(self,data):
  if self.cell is not None:self.cell['text']+=data
 def handle_endtag(self,tag):
  if tag in ['td','th'] and self.cell is not None and self.row is not None:self.cell['text']=' '.join(self.cell['text'].split());self.row.append(self.cell);self.cell=None
  if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def fetch(url,name,legacy=False):
 target=ROOT/name
 if target.exists():return target.read_bytes()
 ctx=ssl.create_default_context()
 if legacy:ctx.options|=0x4 # Legacy TLS renegotiation only for this old public ArcGIS server; certificate verification remains on.
 with urlopen(Request(url,headers={'User-Agent':'BrokerIQ public project-directory research/1.0'}),context=ctx,timeout=60) as response:data=response.read(30_000_000)
 target.write_bytes(data);time.sleep(1);return data

records=[];summary={};parser=Rows();raw=fetch('https://haryanarera.gov.in/admincontrol/registered_projects/2','harera.html');parser.feed(raw.decode())
for row in parser.rows:
 if len(row)<10 or not re.search(r'RERA-GRG-',row[2]['text']):continue
 t=[cell['text'] for cell in row];address=t[5];outside=bool(re.search(r'\b(sohna|manesar|pataudi|farrukh\s*nagar|farrukhnagar|t[aou]ru|nuh)\b',address,re.I));city=not outside and bool(re.search(r'gurugram|gurgaon|sector',address,re.I))
 if not city:continue
 sector=re.search(r'sec(?:tor)?[\s:.-]*(\d{1,3}\s*[a-z]?)\b',address,re.I)
 number=t[1];regStatus='SUPERSEDED' if 'SUPERSEDED' in number.upper() else 'LAPSED' if 'LAPSED' in number.upper() else 'LISTED'
 url=next((u for u in row[2]['links'] if 'searchprojectDetail' in u),'https://haryanarera.gov.in/admincontrol/registered_projects/2')
 name=t[3];category='COMMERCIAL' if re.search(r'commercial|shop|retail|business|office|sco\b|techno|cyber',name,re.I) else 'PLOT' if re.search(r'plotted|plots?\b',name,re.I) else 'RESIDENTIAL' if re.search(r'housing|residential|apartment',name,re.I) else 'UNCLASSIFIED'
 records.append({'provider':'HARERA','externalId':t[2],'name':name,'builderName':t[4],'address':address,'sector':f'Sector {sector[1].upper().strip()}' if sector else None,'city':'Gurugram','category':category,'categoryEvidence':'SOURCE_NAME' if category!='UNCLASSIFIED' else 'UNKNOWN','registrationNumber':number,'registrationStatus':regStatus,'registrationUntil':t[9] or None,'sourceUrl':url,'sourceFetchedAt':NOW,'sourceHash':hashlib.sha256(raw).hexdigest(),'latitude':None,'longitude':None,'geometry':None,'coordinateSource':None,'metadata':{'registryUrl':'https://haryanarera.gov.in/admincontrol/registered_projects/2','classificationNote':'Category derived only from explicit wording of project name. Registration does not confirm possession or unit availability.'}})
summary['hareraCityRecords']=len(records)
base='https://onemapdepts.gmda.gov.in/server/rest/services/TCP_Haryana/tcp_haryana_encroachement/MapServer/13'
try:
 query={'where':"UPPER(TOWN) LIKE '%GURGAON%' OR UPPER(TOWN) LIKE '%GURUGRAM%'",'outFields':'OBJECTID,Developer,TOWN,License_No,Case_No,PURPOSE,SECTOR_NO,Applicatio','outSR':'4326','f':'geojson','resultRecordCount':'2000','orderByFields':'OBJECTID'}
 boundary=json.loads(fetch('https://onemapdepts.gmda.gov.in/server/rest/services/onemap/Boundary_GMDA/MapServer/1/query?'+urlencode({'where':'1=1','outFields':'*','outSR':'4326','f':'geojson'}),'mcg-boundary.json',True))
 def in_ring(point,ring):
  x,y=point;inside=False
  for i in range(len(ring)):
   x1,y1=ring[i];x2,y2=ring[i-1]
   if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1:inside=not inside
  return inside
 def inside_city(point):
  for feature in boundary.get('features',[]):
   geo=feature['geometry'];polys=geo['coordinates'] if geo['type']=='MultiPolygon' else [geo['coordinates']]
   for polygon in polys:
    if in_ring(point,polygon[0]) and not any(in_ring(point,hole) for hole in polygon[1:]):return True
  return False
 offset=0;total=0;excluded=0
 while True:
  query['resultOffset']=str(offset);content=fetch(base+'/query?'+urlencode(query),f'gmda-town-{offset}.json',True);data=json.loads(content)
  if data.get('error'):raise ValueError(data['error'])
  features=data.get('features',[])
  for feature in features:
   a=feature['properties'];geometry=feature.get('geometry');purpose=a.get('PURPOSE') or 'Licensed colony';coords=[]
   def collect(item):
    if isinstance(item,list) and len(item)>=2 and isinstance(item[0],(int,float)):coords.append(item)
    elif isinstance(item,list):
     for child in item:collect(child)
   if geometry:collect(geometry.get('coordinates',[]))
   longitude=sum(c[0] for c in coords)/len(coords) if coords else None;latitude=sum(c[1] for c in coords)/len(coords) if coords else None
   if longitude is None or not inside_city((longitude,latitude)):
    excluded+=1;continue
   category='COMMERCIAL' if re.search(r'commercial|sco',purpose,re.I) else 'RESIDENTIAL' if re.search(r'housing|residential',purpose,re.I) else 'UNCLASSIFIED'
   records.append({'provider':'GMDA_TCP','externalId':str(a['OBJECTID']),'name':f"{purpose} — {a.get('Case_No') or a.get('License_No') or a['OBJECTID']}",'builderName':a.get('Developer'),'address':None,'sector':str(a.get('SECTOR_NO') or '') or None,'city':'Gurugram','category':category,'categoryEvidence':'SOURCE_PURPOSE','registrationNumber':a.get('License_No'),'registrationStatus':'LICENSE_RECORD','sourceUrl':base,'sourceFetchedAt':NOW,'sourceHash':hashlib.sha256(content).hexdigest(),'latitude':latitude,'longitude':longitude,'geometry':geometry,'coordinateSource':'GMDA_TCP_COLONY_GEOMETRY','metadata':{'caseNumber':a.get('Case_No'),'purpose':purpose,'town':a.get('TOWN'),'cityBoundarySource':'GMDA MCG Limit 2020 published layer','mapPointMeaning':'Representative point of official licensed-colony geometry; not an individual building entrance.'}});total+=1
  if len(features)<2000:break
  offset+=len(features)
 summary['gmdaCityColonies']=total;summary['gmdaOutsidePublishedCityBoundaryExcluded']=excluded
except Exception as error:summary['gmdaError']=str(error)
(ROOT/'directory.json').write_text(json.dumps({'fetchedAt':NOW,'scope':'GURUGRAM_CITY','summary':summary,'records':records},ensure_ascii=False,indent=2))
print(json.dumps(summary))
# OpenStreetMap augments named buildings/societies; retain ODbL attribution and original identity.
if (ROOT/'osm-named.json').exists():
 osmRaw=(ROOT/'osm-named.json').read_bytes();named=json.loads(osmRaw);added=0
 for element in named.get('elements',[]):
  tags=element.get('tags',{});point=element.get('center',element);lon=point.get('lon');lat=point.get('lat')
  if lon is None or lat is None or not inside_city((lon,lat)):continue
  building=tags.get('building');category='COMMERCIAL' if building in ['commercial','retail','office'] else 'RESIDENTIAL'
  records.append({'provider':'OSM','externalId':f"{element['type']}/{element['id']}",'name':tags['name'],'builderName':None,'address':', '.join(tags[key] for key in ['addr:housenumber','addr:street','addr:suburb'] if tags.get(key)) or None,'sector':tags.get('addr:suburb'),'city':'Gurugram','category':category,'categoryEvidence':'OSM_BUILDING_OR_LANDUSE_TAG','registrationNumber':None,'registrationStatus':'NOT_PROVIDED_BY_SOURCE','registrationUntil':None,'sourceUrl':f"https://www.openstreetmap.org/{element['type']}/{element['id']}",'sourceFetchedAt':NOW,'sourceHash':hashlib.sha256(osmRaw).hexdigest(),'latitude':lat,'longitude':lon,'geometry':None,'coordinateSource':'OPENSTREETMAP_GEOMETRY_CENTRE','metadata':{'attribution':'© OpenStreetMap contributors, ODbL 1.0','licenseUrl':'https://www.openstreetmap.org/copyright','cityBoundarySource':'GMDA MCG Limit 2020 published layer','mapPointMeaning':'Centre of source building/area geometry, not a verified entrance.','sourceBaseTimestamp':named.get('osm3s',{}).get('timestamp_osm_base')}});added+=1
 summary['osmNamedBuildingsAndSocieties']=added
 (ROOT/'directory.json').write_text(json.dumps({'fetchedAt':NOW,'scope':'GURUGRAM_CITY','summary':summary,'records':records},ensure_ascii=False,indent=2));print(json.dumps(summary))
