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
  strong=diff.convert('L').point(lambda v:255 if v>8 else 0)
  strong_fraction=strong.histogram()[255]/float(psd_width*psd_height)
  check(peak<=32 and avg<=0.22 and strong_fraction<=0.015,
      f'PSD composite differs excessively for {stem}: max={peak}, mean={avg:.4f}, >8 fraction={strong_fraction:.5f}')
  print(f'  PSD composite delta: peak={peak}, mean={avg:.4f}, >8 fraction={strong_fraction:.5f}',flush=True)
  for p in [flattened,proof,*part]:p.unlink()
  check(psd.stat().st_size>4096,'suspicious PSD '+stem)
  print(f'{i:02d}/18 {stem} PNG {w}x{h}; PSD {psd_width}x{psd_height} with five named layer groups, composite quantitatively bounded',flush=True)
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
 # Render four separate, owner-REVIEW architectural SVG backgrounds into real standalone PNG.
 # This is not Pattern 03, a logo redraw, or ImageGen-raster parity.
 bg_source=ROOT/'public/hades/library/backgrounds/assets'
 bg_dist=OUT/'backgrounds/assets'
 bg_dist.mkdir(parents=True,exist_ok=True)
 backgrounds={
  'HADES_Obsidian_Vault_16x9_REVIEW':(1920,1080),
  'HADES_Mammoth_Plaster_16x9_REVIEW':(1920,1080),
  'HADES_Basalt_Axis_9x16_REVIEW':(1080,1920),
  'HADES_Skeletal_Slab_1x1_REVIEW':(1080,1080),
  'HADES_Threshold_Portico_16x9_REVIEW':(1920,1080),
  'HADES_Threshold_Passage_9x16_REVIEW':(1080,1920),
  'HADES_Threshold_Court_1x1_REVIEW':(1080,1080),
  'HADES_Quiet_Loggia_16x9_REVIEW':(1920,1080),
  'HADES_Bone_Pier_9x16_REVIEW':(1080,1920),
  'HADES_Charcoal_Courtyard_1x1_REVIEW':(1080,1080),
  'HADES_Aperture_Loggia_16x9_REVIEW':(1920,1080),
  'HADES_Aperture_Vestibule_9x16_REVIEW':(1080,1920),
  'HADES_Aperture_Court_1x1_REVIEW':(1080,1080),
  'HADES_Strata_Gallery_16x9_REVIEW':(1920,1080),
  'HADES_Strata_Shaft_9x16_REVIEW':(1080,1920),
  'HADES_Strata_Plinth_1x1_REVIEW':(1080,1080),
 }
 for name,(w,h) in backgrounds.items():
  vector=bg_source/(name+'.svg')
  check(vector.is_file(),'missing background vector '+name)
  body=vector.read_bytes()
  check(b'<svg' in body and b'REVIEW' in body and b'#EF4B32' in body,'background source drift '+name)
  check(b'<image' not in body and b'<script' not in body,'unexpected image or script in background '+name)
  pngbytes=cairosvg.svg2png(bytestring=body,output_width=w,output_height=h)
  generated=bg_source/(name+'.png')
  generated.write_bytes(pngbytes)
  (bg_dist/(name+'.png')).write_bytes(pngbytes)
  rendered=Image.open(generated)
  check(rendered.size==(w,h) and rendered.mode in ('RGB','RGBA'),'background raster preflight '+name)
  check(hashlib.sha256(generated.read_bytes()).digest()==hashlib.sha256((bg_dist/(name+'.png')).read_bytes()).digest(),'background source/build mismatch '+name)
  if name.startswith(('HADES_Threshold_', 'HADES_Quiet_', 'HADES_Bone_', 'HADES_Charcoal_', 'HADES_Aperture_', 'HADES_Strata_')):
   rgb=rendered.convert('RGB')
   for ext,format,options in (('jpg','JPEG',{'quality':91,'subsampling':0,'optimize':True}),('webp','WEBP',{'quality':88,'method':6})):
    target=bg_source/(name+'.'+ext)
    rgb.save(target,format=format,**options)
    (bg_dist/(name+'.'+ext)).write_bytes(target.read_bytes())
    with Image.open(target) as checked:
     check(checked.format==format and checked.size==(w,h),'background JPEG/WebP decode preflight '+name)
    check(target.stat().st_size>3000,'unexpected tiny compressed background '+name)
 # Downloadable ZIP: only the three new, public SVG-derived Threshold compositions.
 # Never include the earlier conversation-only photographic studies.
 pack=bg_source.parent/'HADES_Threshold_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip'
 with zipfile.ZipFile(pack,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for item in ('HADES_Threshold_Portico_16x9_REVIEW','HADES_Threshold_Passage_9x16_REVIEW','HADES_Threshold_Court_1x1_REVIEW'):
   for ext in ('svg','png','jpg','webp'):
    z.write(bg_source/(item+'.'+ext),arcname='assets/'+item+'.'+ext)
  z.write(bg_source.parent/'threshold-manifest.REVIEW.json',arcname='threshold-manifest.REVIEW.json')
 with zipfile.ZipFile(pack) as z:
  check(z.testzip() is None and len(z.namelist())==13,'Threshold pack ZIP integrity')
 (bg_dist.parent/pack.name).write_bytes(pack.read_bytes())
 # Second independent PUBLIC REVIEW background family. This is not a logo or a repeatable pattern.
 quiet_pack=bg_source.parent/'HADES_Quiet_Spaces_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip'
 with zipfile.ZipFile(quiet_pack,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for item in ('HADES_Quiet_Loggia_16x9_REVIEW','HADES_Bone_Pier_9x16_REVIEW','HADES_Charcoal_Courtyard_1x1_REVIEW'):
   for ext in ('svg','png','jpg','webp'):
    z.write(bg_source/(item+'.'+ext),arcname='assets/'+item+'.'+ext)
  z.write(bg_source.parent/'quiet-spaces-manifest.REVIEW.json',arcname='quiet-spaces-manifest.REVIEW.json')
 with zipfile.ZipFile(quiet_pack) as z:
  check(z.testzip() is None and len(z.namelist())==13,'Quiet Spaces ZIP integrity')
 (bg_dist.parent/quiet_pack.name).write_bytes(quiet_pack.read_bytes())
 # Third standalone geometric architecture family, no logo and no private pattern transfer.
 apertures=bg_source.parent/'HADES_Apertures_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip'
 with zipfile.ZipFile(apertures,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for item in ('HADES_Aperture_Loggia_16x9_REVIEW','HADES_Aperture_Vestibule_9x16_REVIEW','HADES_Aperture_Court_1x1_REVIEW'):
   for ext in ('svg','png','jpg','webp'):
    z.write(bg_source/(item+'.'+ext),arcname='assets/'+item+'.'+ext)
  z.write(bg_source.parent/'apertures-manifest.REVIEW.json',arcname='apertures-manifest.REVIEW.json')
 with zipfile.ZipFile(apertures) as z:
  check(z.testzip() is None and len(z.namelist())==13,'Apertures ZIP integrity')
 (bg_dist.parent/apertures.name).write_bytes(apertures.read_bytes())
 # Architectural Strata background family: independent geometry; no logos, no private pattern files.
 strata_pack=bg_source.parent/'HADES_Strata_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip'
 with zipfile.ZipFile(strata_pack,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for item in ('HADES_Strata_Gallery_16x9_REVIEW','HADES_Strata_Shaft_9x16_REVIEW','HADES_Strata_Plinth_1x1_REVIEW'):
   for ext in ('svg','png','jpg','webp'):
    z.write(bg_source/(item+'.'+ext),arcname='assets/'+item+'.'+ext)
  z.write(bg_source.parent/'strata-manifest.REVIEW.json',arcname='strata-manifest.REVIEW.json')
 with zipfile.ZipFile(strata_pack) as z:
  check(z.testzip() is None and len(z.namelist())==13,'Strata ZIP integrity')
 (bg_dist.parent/strata_pack.name).write_bytes(strata_pack.read_bytes())
 # Separate logo-application plate (NOT an eleventh standalone background): render a real PNG from the fully embedded original raster sources.
 # The embedded JPEG/PNG bytes must EXACTLY match unchanged owner originals; no crop is applied to files, only a proposed viewport.
 contrast_name='HADES_Original_Logo_Dark_Plate_Contrast_16x9_REVIEW'
 contrast_svg=bg_source/(contrast_name+'.svg')
 contrast_bytes=contrast_svg.read_bytes()
 check(b'REVIEW' in contrast_bytes and b'#EF4B32' in contrast_bytes,'contrast sheet REVIEW/accent missing')
 check(b'<script' not in contrast_bytes,'contrast sheet script not permitted')
 ET.fromstring(contrast_bytes)
 for mime,filename in (('jpeg','B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg'),('png','IMG_7187(2).png')):
  found=re.findall(rb'data:image/'+mime.encode()+rb';base64,([A-Za-z0-9+/=]+)',contrast_bytes)
  check(len(found)==1,'exactly one embedded '+mime+' owner original expected')
  actual=base64.b64decode(found[0],validate=True)
  expected=(ROOT/'public/hades/assets'/filename).read_bytes()
  check(actual==expected,'contrast source original mismatch '+filename)
 contrast_png=bg_source/(contrast_name+'.png')
 contrast_png.write_bytes(cairosvg.svg2png(bytestring=contrast_bytes,output_width=1600,output_height=900))
 (bg_dist/(contrast_name+'.png')).write_bytes(contrast_png.read_bytes())
 with Image.open(contrast_png) as proof:
  proof.load()
  check(proof.size==(1600,900) and proof.format=='PNG','contrast PNG decode/size failed')
 check(hashlib.sha256(contrast_png.read_bytes()).digest()==hashlib.sha256((bg_dist/(contrast_name+'.png')).read_bytes()).digest(),'contrast PNG byte parity')
 print('HADES contrast plate PASS: exact embedded JPEG/PNG source bytes, SVG XML, real 1600x900 PNG and source/dist mirror',flush=True)
 print('HADES backgrounds PASS: 16 SVG/PNG mirrored pairs; Threshold, Quiet Spaces, Apertures each 3×JPEG/WebP and real downloadable ZIP',flush=True)

if __name__=='__main__':render()
