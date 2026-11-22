#!/usr/bin/env python3
"""HADES Folded Spaces PUBLIC REVIEW binary renderer. Does not read or touch any owner logo."""
import io,json,hashlib,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
import cairosvg
from PIL import Image
R=Path(__file__).resolve().parents[2]
A=R/'site/public/hades/library/backgrounds'; B=R/'hades/library/backgrounds'
SPEC=[('HADES_Folded_Arcade_16x9_REVIEW',1920,1080,'16:9'),('HADES_Bone_Lightwell_9x16_REVIEW',1080,1920,'9:16'),('HADES_Charcoal_Alcove_1x1_REVIEW',1080,1080,'1:1')]
MAN='Folded_Spaces_Raster_Release_REVIEW.json'
ZIP='HADES_Folded_Spaces_Raster_and_SVG_3_Ratios_REVIEW.zip'
def sha(x):return hashlib.sha256(x).hexdigest()
def mirror(path,data):
 for root in (A,B):
  file=root/path;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data)
  assert file.read_bytes()==data
def valid(data,fmt,w,h):
 with Image.open(io.BytesIO(data)) as image:image.verify()
 with Image.open(io.BytesIO(data)) as image:assert image.size==(w,h) and image.format==fmt
def run():
 archive={};records=[]
 for stem,w,h,ratio in SPEC:
  svg=(A/'assets'/(stem+'.svg')).read_bytes()
  assert svg==(B/'assets'/(stem+'.svg')).read_bytes()
  root=ET.fromstring(svg)
  assert root.tag=='{http://www.w3.org/2000/svg}svg' and int(root.get('width'))==w and int(root.get('height'))==h
  assert b'REVIEW' in svg and b'#EF4B32' in svg and b'<script' not in svg.lower()
  assert b'https://' not in svg.lower() and b'xlink:href' not in svg.lower()
  archive['assets/'+stem+'.svg']=svg
  raw=cairosvg.svg2png(bytestring=svg,output_width=w,output_height=h)
  valid(raw,'PNG',w,h); rgb=Image.open(io.BytesIO(raw)).convert('RGB')
  images=[]
  for ext,fmt,mime,kw in [('png','PNG','image/png',{'optimize':True}),('jpg','JPEG','image/jpeg',{'quality':92,'subsampling':0,'progressive':True}),('webp','WEBP','image/webp',{'quality':90,'method':6})]:
   o=io.BytesIO();rgb.save(o,format=fmt,**kw);data=o.getvalue();valid(data,fmt,w,h)
   name=stem+'.'+ext;mirror('assets/'+name,data);archive['assets/'+name]=data
   images.append({'filename':name,'mime':mime,'width':w,'height':h,'sha256':sha(data),'bytes':len(data)})
  records.append({'source_svg':stem+'.svg','source_sha256':sha(svg),'ratio':ratio,'images':images})
  print('PASS',stem,w,h,'SVG and three real decoded rasters',flush=True)
 manifest={'family':'HADES Folded Spaces','status':'PUBLIC REVIEW, not FINAL','approved_accent_only':'#EF4B32','neutrals':'PROPOSED','raster_provenance':'New reproducible CairoSVG/Pillow renders of published vectors, NOT byte-identical to earlier conversation derivatives','logos_and_original_manifest':'UNTOUCHED','assets':records}
 m=(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode();mirror(MAN,m);archive[MAN]=m
 archive['README_PUBLIC_REVIEW.txt']=b'HADES FOLDED SPACES | PUBLIC REVIEW | SVG + PNG + JPEG + WEBP\nOnly #EF4B32 approved; all neutrals proposed. Not FINAL.\nNo logos included. New renders, not prior conversation raster bytes.\n'
 output=io.BytesIO()
 with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in sorted(archive.items()):
   entry=zipfile.ZipInfo(name,(2026,11,22,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
   entry.external_attr=0o644<<16;z.writestr(entry,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
 result=output.getvalue()
 with zipfile.ZipFile(io.BytesIO(result)) as z:
  assert z.testzip() is None and sorted(z.namelist())==sorted(archive)
  assert all(z.read(k)==v for k,v in archive.items())
 mirror(ZIP,result)
 print('PASS 9 real rasters, all GitHub mirrors, 14-file ZIP',len(result),sha(result),flush=True)
if __name__=='__main__':run()
