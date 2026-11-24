from pathlib import Path
import base64, hashlib, json, re, shutil, zipfile, io
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path('hades/library/backgrounds/quiet-courts/closing-cards/motion-safe')
mirror=Path('site/public')/root
fa=Path('hades/fa')/Path(*root.parts[1:])/'index.html'
out=root/'raster'
out.mkdir(exist_ok=True)
sources=sorted(root.glob('HADES_Motion_Safe_Closing_*_PUBLIC_REVIEW.svg'))
assert len(sources)==6
sha=lambda b:hashlib.sha256(b).hexdigest()
records=[]
with sync_playwright() as p:
 browser=p.chromium.launch()
 for f in sources:
  raw=f.read_bytes()
  assert raw==(mirror/f.name).read_bytes()
  assert sha(base64.b64decode(re.search(rb'data:image/png;base64,([A-Za-z0-9+/=]+)',raw)[1]))=='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
  w,h=map(int,re.search(rb'width="(\d+)" height="(\d+)"',raw).groups())
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.set_content('<style>html,body{margin:0}svg{display:block}</style>'+raw.decode())
  page.evaluate('document.fonts.ready')
  boxes=page.locator('text').evaluate_all('(xs)=>xs.map(x=>{let b=x.getBBox();return [b.x,b.y,b.width,b.height]})')
  assert all(x>=w*.1-1 and y>=h*.1-1 and x+b<=w*.9+1 and y+c<=h*.9+1 for x,y,b,c in boxes),(f,boxes)
  png=out/f.with_suffix('.png').name
  page.screenshot(path=str(png),omit_background=True)
  page.close()
  with Image.open(png) as im:
   assert im.mode=='RGBA' and im.size==(w,h) and im.getpixel((0,0))[3]==0 and im.getchannel('A').getextrema()==(0,255)
  for a in (f,png): records.append(dict(file=a.name,sha256=sha(a.read_bytes()),width=w,height=h))
  print('PASS native alpha and text bounds',f.name)
 for path in (root/'index.html',fa):
  html=path.read_text()
  for f in sources:
   url='/'+str(f)
   html=html.replace('src="'+url+'"','src="data:image/svg+xml;base64,'+base64.b64encode(f.read_bytes()).decode()+'"')
  for width in (320,390,430):
   page=browser.new_page(viewport={'width':width,'height':900})
   page.set_content(html)
   assert page.locator('img').count()==6
   page.locator('img').evaluate_all('(xs)=>Promise.all(xs.map(x=>x.decode()))')
   assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
   assert page.locator('html').get_attribute('dir')==('rtl' if path==fa else 'ltr')
   page.close()
   print('PASS responsive',path,width)
 browser.close()
(out/'manifest.REVIEW.json').write_text(json.dumps(records,indent=2)+'\n')
(out/'README.txt').write_text('PUBLIC REVIEW / NOT FINAL. Six SVG sources and six native transparent PNGs. Only #EF4B32 approved. 10% title-safe is proposed. Platform overlay, phone, print, actual Mikhak and editing application import OPEN.\n')
archive=out/'HADES_Motion_Safe_6_SVG_6_PNG_PUBLIC_REVIEW.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for f in sources+sorted(out.glob('*.png'))+[out/'manifest.REVIEW.json',out/'README.txt']: z.write(f,f.name)
with zipfile.ZipFile(archive) as z: assert z.testzip() is None and len(z.namelist())==14
(mirror/'raster').mkdir(exist_ok=True)
for f in out.iterdir(): shutil.copyfile(f,mirror/'raster'/f.name)
for path in (root/'index.html',fa):
 html=path.read_text()
 html=re.sub(r'<!-- raster-delivery:start -->.*?<!-- raster-delivery:end -->','',html,flags=re.S)
 fa_page=path==fa
 links='<!-- raster-delivery:start --><section><h2>'+('دریافت خروجی شفاف' if fa_page else 'Transparent PNG downloads')+'</h2><p><a download href="/'+str(archive)+'">ZIP · 6 SVG + 6 PNG · REVIEW</a> · <a href="/'+str(out/'manifest.REVIEW.json')+'">SHA-256</a></p>'
 for f in sorted(out.glob('*.png')): links+='<p><a download href="/'+str(f)+'">'+f.name.replace('HADES_Motion_Safe_Closing_','').replace('_PUBLIC_REVIEW.png','')+' · PNG</a></p>'
 links+='</section><!-- raster-delivery:end -->'
 html=html.replace('</main>',links+'</main>')
 path.write_text(html)
 (Path('site/public')/path).write_text(html)
print('PASS 6 native RGBA PNGs, 6 responsive gallery sessions, 14-entry ZIP')
