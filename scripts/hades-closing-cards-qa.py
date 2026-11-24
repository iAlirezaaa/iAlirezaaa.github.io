from pathlib import Path
import base64, hashlib, re, time, urllib.request, xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import zipfile, io
base=Path('hades/library/backgrounds/quiet-courts/closing-cards')
fa=Path('hades/fa/library/backgrounds/quiet-courts/closing-cards')
proof=Path('closing-proof'); proof.mkdir(exist_ok=True)
files=list(base.glob('*.svg'))+[base/'index.html',fa/'index.html']
assert len(files)==8
navs=['hades/index.html','hades/fa/index.html','hades/library/index.html','hades/fa/library/index.html','hades/brand-kit/logo-usage/index.html','hades/fa/brand-kit/logo-usage/index.html','hades/downloads/HADES_Public_Overview_EN.md','hades/downloads/HADES_Public_Overview_FA.md']
for p in files+[Path(n) for n in navs]:
    assert p.read_bytes()==(Path('site/public')/p).read_bytes()
    if str(p) in navs: assert 'closing-cards/' in p.read_text()
    if p.suffix=='.svg':
        ET.parse(p)
        data=re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)',p.read_text()).group(1)
        assert hashlib.sha256(base64.b64decode(data)).hexdigest()=='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
server=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for lang,p in [('en',base),('fa',fa)]:
        for w in (320,390,430):
            page=browser.new_page(viewport={'width':w,'height':900})
            page.goto(f'http://127.0.0.1:{server.server_port}/{p}/',wait_until='networkidle')
            assert page.locator('html').get_attribute('lang')==lang
            assert page.locator('html').get_attribute('dir')==('rtl' if lang=='fa' else 'ltr')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('img').count()==6
            assert page.locator('img').evaluate_all('(imgs)=>imgs.every(i=>i.complete&&i.naturalWidth===Number(i.getAttribute("width"))&&i.naturalHeight===Number(i.getAttribute("height")))')
            page.screenshot(path=str(proof/f'{lang}-{w}.png'),full_page=True)
            page.close()
    for f in sorted(base.glob('*.svg')):
        svg=ET.parse(f).getroot()
        w,h=int(svg.attrib['width']),int(svg.attrib['height'])
        page=browser.new_page(viewport={'width':w,'height':h})
        page.goto(f'http://127.0.0.1:{server.server_port}/{f}')
        boxes=page.locator('#editable-credits text').evaluate_all('(els)=>els.map(e=>{const b=e.getBBox();return [b.x,b.y,b.width,b.height]})')
        assert all(x>=0 and x+ww<=w and y>=0 and y+hh<=h for x,y,ww,hh in boxes)
        page.screenshot(path=str(proof/(f.stem+'.png')))
        page.close()
    browser.close()
print('PASS 6 Chromium responsive checks; embedded source SHA and mirrors')
old=base.parent/'chapter-divider'
files+=sorted((old/'raster').iterdir())+[old/'index.html',Path('hades/fa')/Path(*old.parts[1:])/'index.html']
allowed={'.svg':{'image/svg+xml'},'.html':{'text/html'},'.png':{'image/png'},'.jpg':{'image/jpeg'},'.webp':{'image/webp'},'.zip':{'application/zip','application/x-zip-compressed'},'.json':{'application/json'},'.txt':{'text/plain'}}
for n in range(12):
    errors=[]; results=[]
    for p in files:
        try:
            with urllib.request.urlopen('https://ialirezaaa.github.io/'+str(p)+'?closing-proof='+str(n),timeout=10) as r:
                data=r.read()
                assert r.status==200 and r.headers.get_content_type() in allowed[p.suffix]
                assert hashlib.sha256(data).digest()==hashlib.sha256(p.read_bytes()).digest()
                if p.suffix=='.zip':
                    with zipfile.ZipFile(io.BytesIO(data)) as z: assert z.testzip() is None and len(z.namelist())==26
                results.append(f'{p} HTTP 200 {r.headers.get_content_type()} SHA256 PASS')
        except Exception as e: errors.append(f'{p}: {e!r}')
    (proof/'http.txt').write_text('\n'.join(results+errors))
    if not errors: break
    time.sleep(12)
assert not errors,errors
print('PASS independent live HTTP 200 MIME SHA256',len(files))
