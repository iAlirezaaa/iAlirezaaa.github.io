#!/usr/bin/env python3
"""Chromium Light Gallery export: PUBLIC REVIEW, protected original logo (unchanged)."""
import base64,hashlib,io,json,pathlib,xml.etree.ElementTree as ET,zipfile
from PIL import Image,ImageOps,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'hades/library/light-gallery'
TARGET=SOURCE/'raster'
EXPECTED='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
SIZES={'16x9':(1920,1080),'9x16':(1080,1920),'1x1':(1080,1080)}
def hash_bytes(b):return hashlib.sha256(b).hexdigest()
def verify_svg(path,size):
 raw=path.read_bytes();node=ET.fromstring(raw)
 assert tuple(int(node.attrib[x]) for x in ('width','height'))==size,path
 pictures=[x for x in node.iter() if x.tag.endswith('}image')]
 assert len(pictures)==1,path
 href=pictures[0].attrib.get('href') or pictures[0].attrib.get('{http://www.w3.org/1999/xlink}href')
 assert href.startswith('data:image/png;base64,'),path
 exact=base64.b64decode(href.split(',',1)[1],validate=True)
 assert hash_bytes(exact)==EXPECTED,('Original logo was modified',path)
 assert b'REVIEW' in raw and b'#EF4B32' in raw
 return hash_bytes(raw)
def publish():
 TARGET.mkdir(parents=True,exist_ok=True)
 entries=[];thumbs=[]
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(headless=True,args=['--no-sandbox'])
  for ratio,size in SIZES.items():
   for lang in ('EN','FA'):
    name=f'HADES_Light_Gallery_{ratio}_{lang}_REVIEW'
    svg=SOURCE/(name+'.svg')
    svg_sha=verify_svg(svg,size)
    page=browser.new_page(viewport={'width':size[0],'height':size[1]},device_scale_factor=1)
    markup='<!doctype html><html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style></head><body>'+svg.read_text(encoding='utf8')+'</body></html>'
    page.set_content(markup,wait_until='load')
    page.wait_for_function("document.querySelector('svg') && [...document.querySelectorAll('image')].every(n=>n.href.baseVal.startsWith('data:'))")
    screenshot=page.screenshot(full_page=False,animations='disabled')
    page.close()
    im=Image.open(io.BytesIO(screenshot)).convert('RGB')
    assert im.size==size,(name,im.size,size)
    if lang=='EN':thumbs.append((ratio,im.copy()))
    for fmt in ('png','jpg','webp'):
     f=TARGET/(name+'.'+fmt)
     opts=({'format':'PNG','optimize':True} if fmt=='png' else {'format':'JPEG','quality':92,'subsampling':0,'optimize':True} if fmt=='jpg' else {'format':'WEBP','quality':90,'method':6})
     im.save(f,**opts)
     with Image.open(f) as check:
      check.load();assert check.size==size
      assert check.format=={'png':'PNG','jpg':'JPEG','webp':'WEBP'}[fmt]
     entries.append({'filename':f.name,'format':fmt,'ratio':ratio,'language':lang,'dimensions':size,'bytes':f.stat().st_size,'sha256':hash_bytes(f.read_bytes()),'source_svg_sha256':svg_sha})
    print('PASS',name,'Chromium exact original logo, PNG/JPEG/WebP decoded',flush=True)
  browser.close()
 contact=TARGET/'HADES_Light_Gallery_Contact_REVIEW.png'
 sheet=Image.new('RGB',(1600,930),'#131211');d=ImageDraw.Draw(sheet)
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 font=ImageFont.truetype(fontpath,20) if pathlib.Path(fontpath).exists() else ImageFont.load_default()
 d.text((60,40),'HADES / LIGHT GALLERY / PUBLIC REVIEW',fill='#E6D9C7',font=font)
 for (ratio,im),(x,y,w,h) in zip(thumbs,[(65,110,435,590),(550,110,440,590),(1040,110,495,590)]):
  tile=Image.new('RGB',(w,h),'#292723')
  tn=ImageOps.contain(im,(w-25,h-30),Image.Resampling.LANCZOS)
  tile.paste(tn,((w-tn.width)//2,(h-tn.height)//2));sheet.paste(tile,(x,y))
  d.text((x,720),ratio+' / original artwork',fill='#E6D9C7',font=font)
 d.rectangle((65,795,1535,798),fill='#EF4B32')
 d.text((65,826),'#EF4B32 approved / neutrals proposed / not FINAL',fill='#E6D9C7',font=font)
 sheet.save(contact,optimize=True)
 manifest=TARGET/'HADES_Light_Gallery_Raster_Manifest_REVIEW.json'
 payload={'status':'PUBLIC REVIEW / NOT FINAL','accent_approved':'#EF4B32','neutrals':'PROPOSED','owner_original_sha256':EXPECTED,'render':'actual Chromium / Pillow','files':entries,'contact_sha256':hash_bytes(contact.read_bytes()),'OPEN':['on-device 48/96px readability','real A4 print','actual licensed Mikhak','owner FINAL']}
 manifest.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 readme=TARGET/'README.md'
 readme.write_text('# Light Gallery raster / PUBLIC REVIEW\n\n18 genuine PNG/JPEG/WebP exports (3 ratios × 2 languages × 3 formats) from six previously published original-logo SVGs. Protected original PNG is verified before rendering; it is not altered, recolored, traced or redrawn.\n\n#EF4B32 is the only approved color. Neutrals and typography are proposed. Actual smartphone/physical print/Mikhak/FINAL remain OPEN. See JSON manifest for SHA256.\n',encoding='utf8')
 package=TARGET/'HADES_Light_Gallery_6_Ratios_Languages_PNG_JPEG_WEBP_REVIEW.zip'
 items=[TARGET/x['filename'] for x in entries]+[contact,manifest,readme]
 items += [SOURCE/f'HADES_Light_Gallery_{ratio}_{lang}_REVIEW.svg' for ratio in SIZES for lang in ('EN','FA')]
 with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for item in items:z.write(item,arcname=item.name)
 with zipfile.ZipFile(package) as z:
  assert z.testzip() is None and len(z.namelist())==27
 for file in TARGET.iterdir():
  if file.is_file():
   mirror=ROOT/'site/public'/file.relative_to(ROOT)
   mirror.parent.mkdir(parents=True,exist_ok=True)
   mirror.write_bytes(file.read_bytes())
   assert mirror.read_bytes()==file.read_bytes()
 print('PASS 18 rasters, 27 ZIP members, source/deploy byte mirrors',package.stat().st_size,flush=True)
if __name__=='__main__':publish()
