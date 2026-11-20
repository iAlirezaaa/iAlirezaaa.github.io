#!/usr/bin/env python3
"""HADES Library REVIEW: render editable site/public SVGs to real PNG, layered PSD, ZIP.
The pre-existing owner raster (sha256 pinned) provides the only identity mark; no vector tracing.
"""
from __future__ import annotations
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image, ImageDraw, ImageFont, ImageChops
import cairosvg
import base64, hashlib, io, json, re, shutil, subprocess, zipfile, math
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
SRC=ROOT/'public/hades/library/assets'
OUT=ROOT/'dist/hades/library'
CAT=ROOT/'public/hades/library/catalog.json'
MARK=ROOT/'public/hades/brand-kit/business-card/HADES_Original_Mark_Transparent_REVIEW.png'
ORIGINAL=ROOT/'public/hades/assets/IMG_7187(2).png'
EXPECTED_ORIGINAL='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
EXPECTED_MARK='8d3d0e1ac89660f8a1ed7e135d878dc6f223590f91dd7f9a7ad8dba47f00f164'
N='{http://www.w3.org/2000/svg}'
LAYERS=('background','pattern','logo','content','accent')
def check(condition,msg):
 if not condition:raise RuntimeError('HADES LIBRARY HOLD: '+msg)
def raster(src,target,width,height):
 cairosvg.svg2png(bytestring=src,write_to=str(target),output_width=width,output_height=height)
def render():
 check(hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()==EXPECTED_ORIGINAL,'source owner original SHA')
 mark=MARK.read_bytes(); check(hashlib.sha256(mark).hexdigest()==EXPECTED_MARK,'derived alpha SHA')
 entries=[x for x in json.loads(CAT.read_text(encoding='utf-8'))['items'] if not x.get('existing')]
 check(len(entries)==18 and len({x['id'] for x in entries})==18,'catalog item count')
 check(OUT.is_dir(),'dist/hades/library absent (run Vite build first)')
 (OUT/'assets').mkdir(parents=True,exist_ok=True)
 (OUT/'packs').mkdir(parents=True,exist_ok=True)
 engine=shutil.which('magick') or shutil.which('convert');check(engine,'ImageMagick missing (real layered PSD required)')
 previews=[]
 for i,item in enumerate(entries,1):
  stem=item['id']; w,h=int(item['w']),int(item['h'])
  source=SRC/(stem+'.svg'); check(source.is_file(),'missing SVG source '+stem)
  data=source.read_bytes()
  check(b'#EF4B32' in data and b'REVIEW' in data,'review/accent missing '+stem)
  check(b'<script' not in data and not re.search(rb'(?:href|src)=[\"\']https?://|url\(https?://',data,re.I),'unsafe/external SVG '+stem)
  for m in re.findall(rb'data:image/png;base64,([^"]+)',data):
   check(base64.b64decode(m)==mark,'embedded mark different from owner source '+stem)
  check(data.count(b'<image')<=1,'unexpected imagery '+stem)
  check(not re.search(rb'contact@|@example\\.|\\+1\\s?[0-9]{3}',data,re.I),'fake contact '+stem)
  png=OUT/'assets'/(stem+'.png');raster(data,png,w,h)
  rgb=Image.open(png).convert('RGB');check(rgb.size==(w,h),'wrong PNG '+stem)
  previews.append((item,rgb.copy()))
  psd_width=max(350,round(w*.55));psd_height=max(250,round(h*.55))
  flattened=OUT/'assets'/('.'+stem+'-composite.png')
  raster(data,flattened,psd_width,psd_height)
  part=[]
  for group in LAYERS:
   root=ET.fromstring(data)
   for n in list(root):
    if n.tag==N+'g' and n.get('id','').startswith('layer-') and n.get('id')!='layer-'+group:
     root.remove(n)
   layer=OUT/'assets'/('.'+stem+'-'+group+'.png')
   raster(ET.tostring(root,encoding='utf-8'),layer,psd_width,psd_height)
   part.append(layer)
  psd=OUT/'assets'/(stem+'.psd')
  subprocess.run([engine,str(flattened),*[str(p) for p in part],'-depth','8',str(psd)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  check(psd.read_bytes()[:4]==b'8BPS','invalid PSD '+stem)
  proof=OUT/'assets'/('.'+stem+'-proof.png')
  subprocess.run([engine,str(psd)+'[0]',str(proof)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  diff=ImageChops.difference(Image.open(flattened).convert('RGB'),Image.open(proof).convert('RGB'))
  extrema=diff.getextrema()
  peak=max(b for a,b in extrema)
  from PIL import ImageStat
  avg=sum(ImageStat.Stat(diff).mean)/3
  check(peak<=3 and avg<=0.10,f'PSD rendering delta on {stem}: peak={peak}, mean={avg:.4f}')
  for p in [flattened,proof,*part]:p.unlink()
  check(psd.stat().st_size>4096,'suspicious PSD '+stem)
  print(f'{i:02d}/18 {stem} PNG {w}x{h}; PSD {psd_width}x{psd_height} with five named layer groups, composite verified',flush=True)
 # One true current-run contact sheet from actual new asset PNGs.
 cw,ch,thumb_w,thumb_h=1700,1940,480,225
 board=Image.new('RGB',(cw,ch),'#0d0c0b')
 d=ImageDraw.Draw(board)
 try:
  ff=lambda s:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',s)
 except Exception:ff=lambda s:ImageFont.load_default()
 d.text((82,40),'HADES / COMPLETE EDITABLE ASSET LIBRARY',font=ff(30),fill='#EEE5D8')
 d.text((82,96),'18 NEW REVIEW / CONCEPT WORKING TEMPLATES · 3 CATEGORIES',font=ff(16),fill='#EF4B32')
 for idx,(item,rgb) in enumerate(previews):
  col=idx%3;row=idx//3
  x=62+col*552;y=155+row*280
  size=rgb.size
  ratio=min(thumb_w/size[0],thumb_h/size[1])
  sm=rgb.resize((round(size[0]*ratio),round(size[1]*ratio)),Image.Resampling.LANCZOS)
  board.paste(sm,(x+int((thumb_w-sm.width)/2),y))
  d.text((x,y+229),item['en'][:33],font=ff(15),fill='#D8CBBC')
  d.text((x,y+251),item['cat'].upper()+' / REVIEW',font=ff(11),fill='#A99B8C')
 d.text((78,1900),'Original logo source intact  /  signature #EF4B32 approved, supporting choices REVIEW',font=ff(14),fill='#BBAEA0')
 board.save(OUT/'HADES_Library_Contact_Sheet_REVIEW.png',optimize=True)
 # ZIP packs, including vector sources and raster/PSD outputs
 for cat in ('stationery','social','web'):
  zipfile_path=OUT/'packs'/('HADES_'+cat+'_REVIEW.zip')
  with zipfile.ZipFile(zipfile_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for item in entries:
    if item['cat']!=cat:continue
    stem=item['id']; z.write(SRC/(stem+'.svg'),arcname=stem+'.svg')
    for suff in ('.png','.psd'):z.write(OUT/'assets'/(stem+suff),arcname=stem+suff)
  with zipfile.ZipFile(zipfile_path) as z:check(z.testzip() is None,'invalid pack '+cat)
 # All formats for all new assets, full ZIP
 zpath=OUT/'HADES_Complete_Editable_Library_REVIEW.zip'
 with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for item in entries:
   stem=item['id'];z.write(SRC/(stem+'.svg'),arcname=item['cat']+'/'+stem+'.svg')
   for suffix in ('.png','.psd'):z.write(OUT/'assets'/(stem+suffix),arcname=item['cat']+'/'+stem+suffix)
  z.write(OUT/'HADES_Library_Contact_Sheet_REVIEW.png',arcname='CONTACT_SHEET.png')
  z.write(CAT,arcname='catalog.json')
 with zipfile.ZipFile(zpath) as z:check(z.testzip() is None,'invalid complete library ZIP')
 print('HADES library PASS: 18 source SVG, 18 real PNG, 18 layered PSD, 3 category ZIP + all ZIP; no original raster changed')
if __name__=='__main__':render()
