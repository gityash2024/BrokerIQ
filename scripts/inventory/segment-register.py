#!/usr/bin/env python3
"""Build source-backed review candidates. OCR observations never imply VERIFIED status.
Inputs/outputs are private directories; no broker data belongs in this repository.
Each page is covered, including uncertain rows and pages with no reliable house anchors.
"""
import argparse, hashlib, json, re
from pathlib import Path
from PIL import Image

HOUSE = re.compile(r'^\s*[([]?\s*([A-Ca-c]?[\s-]?\d{1,5}[A-Za-z]?)\s*[)\]>:\-]?\s*$')
JOINED = re.compile(r'^\s*[([]?\s*([A-Ca-c]?[\s-]?\d{1,4}[A-Za-z]?)\s*[>\-→]+')

def candidates(page):
    boxes=page['boxes']; margin=page.get('marginBoxes',[])
    # v1 Apple Vision ROI geometry was relative to its ROI. Raw observations stay unchanged.
    if margin and any(b['x']>.22 for b in margin):
        margin=[{**b,'x':b['x']*.22,'y':.10+b['y']*.875,'width':b['width']*.22,'height':b['height']*.875} for b in margin]
    found=[]
    for box in boxes+margin:
        if box['x']>.135 or not .09<box['y']<.96: continue
        m=HOUSE.match(box['text']) or JOINED.match(box['text'])
        if not m: continue
        label=m[1].strip().upper().replace(' ','')
        if not re.search(r'\d',label) or len(re.sub(r'\D','',label))>5:continue
        found.append({'label':label,'y':box['y'],'box':box})
    found.sort(key=lambda b:b['y']);anchors=[]
    for a in found:
        if anchors and abs(a['y']-anchors[-1]['y'])<.018:
            anchors[-1]['labels'].add(a['label']);continue
        anchors.append({'y':a['y'],'labels':{a['label']}})
    # Include all unanchored top/tail content; ambiguous segments are not dropped.
    if not anchors:return [{'start':.09,'end':.98,'houseNo':None,'warnings':['No reliable house-column anchors; review the full page.']}]
    result=[]
    if anchors[0]['y']>.14:result.append({'start':.09,'end':anchors[0]['y']-.006,'houseNo':None,'warnings':['Unanchored content before first house; check for a separate entry.']})
    for i,a in enumerate(anchors):
        result.append({'start':max(.09,a['y']-.01),'end':anchors[i+1]['y']-.01 if i+1<len(anchors) else .98,'houseNo':next(iter(a['labels'])) if len(a['labels'])==1 else None,'warnings':(['House-number OCR disagrees: '+', '.join(sorted(a['labels']))] if len(a['labels'])>1 else [])+['Handwriting transcription requires visual review.']})
    return result

def run(root):
    source=json.loads((root/'source.json').read_text());entries=[];pages=[]
    annotations=json.loads((root/'annotations.json').read_text()) if (root/'annotations.json').exists() else {}
    for number in range(1,source['pages']+1):
        page=json.loads((root/f'page-{number:03}.json').read_text());image=Image.open(root/f'page-{number:03}.png');segments=candidates(page)
        header=annotations.get('headers',{}).get(str(number),{})
        for row,segment in enumerate(segments,1):
            boxes=[b for b in page['boxes'] if segment['start']<=b['y']+b['height']/2<segment['end']]
            boxes.sort(key=lambda b:(round((b['y']+b['height']/2)/.013),b['x']))
            raw='\n'.join(b['text'] for b in boxes);key=f'p{number:03}-r{row:03}'
            crop=f'crops/{key}.png';(root/'crops').mkdir(exist_ok=True)
            image.crop((0,int(segment['start']*image.height),image.width,int(segment['end']*image.height))).save(root/crop)
            entry={'entryKey':key,'pageNo':number,'rowNo':row,'bbox':{'x':0,'y':segment['start'],'width':1,'height':segment['end']-segment['start']},'crop':crop,'rawText':raw,'ocr':{'boxes':boxes,'houseCandidate':segment['houseNo'],'localityEvidence':header},'reviewState':'NEEDS_REVIEW','warnings':segment['warnings'],'extracted':[]}
            entries.append(entry)
        pages.append({'pageNo':number,'image':f'page-{number:03}.png','sha256':hashlib.sha256((root/f'page-{number:03}.png').read_bytes()).hexdigest(),'segments':len(segments),'header':header,'visualReview':'PENDING'})
    result={'source':source,'pages':pages,'entries':entries,'status':'CANDIDATES_ONLY'}
    (root/'segmented.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'pages':len(pages),'sourceSegments':len(entries),'status':result['status']}))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('private_directory',type=Path);run(parser.parse_args().private_directory)
