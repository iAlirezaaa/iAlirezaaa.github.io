#!/usr/bin/env python3
"""HADES B03 A4 source-based SVG/PNG/PSD/ZIP exporter. NOT a logo vectorizer."""
from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image,ImageChops,ImageDraw,ImageFont
import cairosvg,io,hashlib,base64,re,shutil,subprocess,zipfile
HERE=Path(__file__).resolve().parent
PROJ=HERE.parent
SRC=PROJ/'public/hades/brand-kit/letterhead'
OUT=PROJ/'dist/hades/brand-kit/letterhead'
ORIG=PROJ/'public/hades/assets/IMG_7187(2).png'
OSHA='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
MSHA='8d3d0e1ac89660f8a1ed7e135d878dc6f223590f91dd7f9a7ad8dba47f00f164'
SSHA={'Dark':'405d489ba0a54080cd53e814b2a12772647a48c25e3bedecc8f304f6ebd7b148',
      'Light':'bde80fa8e47c2504b24efa2bbdc4fbbc59f4b14416e19cfe06f050a9ea758cff'}
NS='{http://www.w3.org/2000/svg}'
GROUPS=('background','pattern','logo','typography','accent')
def need(ok,what):
 if not ok:raise RuntimeError('HADES B03 HOLD: '+what)
def render(svg,path,w,h):
 cairosvg.svg2png(bytestring=svg,write_to=str(path),output_width=w,output_height=h)
def isolate(raw):
 im=Image.open(io.BytesIO(raw)).convert('L')
 b=im.point(lambda v:255 if v>3 else 0).getbbox()
 need(b==(461,950,485,1099),'original source shape changed')
 crop=im.crop((b[0]-5,b[1]-8,b[2]+5,b[3]+8))
 layer=Image.new('RGBA',crop.size,(255,255,255,0));layer.putalpha(crop)
 mem=io.BytesIO();layer.save(mem,format='PNG',optimize=True)
 return mem.getvalue()
def run():
 need(ORIG.is_file(),'original raster not present')
 orig=ORIG.read_bytes()
 need(hashlib.sha256(orig).hexdigest()==OSHA,'original raster SHA mismatch')
 alpha=isolate(orig)
 need(hashlib.sha256(alpha).hexdigest()==MSHA,'alpha derivation differed from previous vetted B01')
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/'HADES_Original_Mark_Transparent_REVIEW.png').write_bytes(alpha)
 engine=shutil.which('magick') or shutil.which('convert')
 need(engine is not None,'ImageMagick missing; cannot produce actual layered PSD')
 thumbs=[]
 for variant in ('Dark','Light'):
  stem='HADES_Letterhead_'+variant
  path=SRC/(stem+'_EDITABLE_REVIEW.svg')
  data=path.read_bytes()
  need(hashlib.sha256(data).hexdigest()==SSHA[variant],variant+' source SHA mismatch')
  need(b'#EF4B32' in data and b'REVIEW / CONCEPT' in data,'missing review status')
  if variant=='Dark':
   m=re.search(rb'data:image/png;base64,([^"]+)',data)
   need(m is not None and base64.b64decode(m.group(1))==alpha,'embedded mark mismatches source')
  else:
   need(b'<image' not in data,'light print variant must omit white mark, not recolor')
  (OUT/path.name).write_bytes(data)
  png=OUT/(stem+'_300dpi_REVIEW.png');render(data,png,2480,3508)
  rgb=Image.open(png).convert('RGB');need(rgb.size==(2480,3508),'invalid A4 raster')
  thumbs.append(rgb.resize((620,877),Image.Resampling.LANCZOS))
  psd_base=OUT/('.'+stem+'_150dpi.png');render(data,psd_base,1240,1754)
  gfiles=[]
  for g in GROUPS:
   root=ET.fromstring(data)
   for node in list(root):
    if node.tag==NS+'g' and node.attrib.get('id','').startswith('layer-') and node.attrib.get('id')!='layer-'+g:
     root.remove(node)
   dest=OUT/('.'+stem+'-'+g+'.png')
   render(ET.tostring(root),dest,1240,1754);gfiles.append(dest)
  psd=OUT/(stem+'_LAYERED_REVIEW.psd')
  subprocess.run([engine,str(psd_base),*[str(p) for p in gfiles],'-depth','8',str(psd)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  need(psd.read_bytes()[:4]==b'8BPS','invalid layered PSD')
  tmp=OUT/('.'+stem+'_composite.png')
  subprocess.run([engine,str(psd)+'[0]',str(tmp)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  need(ImageChops.difference(Image.open(psd_base).convert('RGB'),Image.open(tmp).convert('RGB')).getbbox() is None,'PSD flattened composite mismatch')
  for p in [*gfiles,psd_base,tmp]:p.unlink()
 board=Image.new('RGB',(1500,1170),'#0d0c0b')
 d=ImageDraw.Draw(board)
 try:font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
 except OSError:font=lambda n:ImageFont.load_default()
 d.text((64,36),'HADES / LETTERHEAD A4 / TWO CONTEXTS',font=font(28),fill='#E6DACE')
 d.text((64,85),'B03 REVIEW / CONCEPT — SOURCE IMAGE INTACT',font=font(15),fill='#EF4B32')
 for i,label in enumerate(('DARK CEREMONIAL','LIGHT PRINT-SAFE')):
  x=75 if i==0 else 820
  board.paste(thumbs[i],(x,174))
  d.text((x,1086),label,font=font(19),fill='#D7CBBC')
 d.text((75,1134),'Only vermilion #EF4B32 is an approved exact color. Fonts and neutrals proposed.',font=font(14),fill='#A89D92')
 board.save(OUT/'HADES_Letterhead_Contact_Sheet_REVIEW.png',optimize=True)
 (OUT/'README_REVIEW.txt').write_text('HADES B03 working A4 letterhead REVIEW/CONCEPT. Two contexts of one system. SVG text editable; 300dpi PNG 2480x3508; PSD 150dpi 1240x1754 with 5 independently selectable raster layers. Original mark is source-derived alpha, not a new logo; light omits it. No fictional contacts, no certified print colors, no final approval. Only #EF4B32 approved.\\n',encoding='utf8')
 (OUT/'build-hades-letterhead.py').write_bytes(Path(__file__).read_bytes())
 zpath=OUT/'HADES_Letterhead_Working_Files_REVIEW.zip'
 with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
  for p in sorted(OUT.iterdir()):
   if p.is_file() and not p.name.startswith('.') and p!=zpath:z.write(p,arcname=p.name)
 with zipfile.ZipFile(zpath) as z:need(z.testzip() is None,'zip CRC failed')
 print('HADES B03 PASS: 2 editable A4 SVG, 2x 300dpi PNG, 2x 150dpi layer-separated PSD, contact sheet and ZIP')
if __name__=='__main__':run()
