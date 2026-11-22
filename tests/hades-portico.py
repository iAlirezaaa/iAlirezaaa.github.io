from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import xml.etree.ElementTree as ET
import base64,hashlib
from playwright.sync_api import sync_playwright

r=Path("hades/library/portico-studies")
p=Path("hades/assets/IMG_7187(2).png").read_bytes()
assert hashlib.sha256(p).hexdigest()=="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
def verify_svg(data):
 root=ET.fromstring(data)
 assert root.attrib["viewBox"]=="0 0 1080 1080",root.attrib
 logos=list(root.iter("{http://www.w3.org/2000/svg}image"))
 assert len(logos)==1
 uri=logos[0].attrib.get("href",logos[0].attrib.get("{http://www.w3.org/1999/xlink}href",""))
 assert uri.startswith("data:image/png;base64,")
 assert base64.b64decode(uri.split(",",1)[1])==p
 for key in ["title","sub","subtitle"]:
  assert any(el.attrib.get("data-edit")==key for el in root.iter())
for mode in ["Classic","Modern"]:
 for lang in ["EN","FA"]:
  name=f"HADES_Portico_{mode}_{lang}_REVIEW.svg"
  data=(r/name).read_bytes()
  assert data==(Path("site/public")/r/name).read_bytes()
  verify_svg(data)
for name in ["library/portico-studies/index.html","fa/library/portico-studies/index.html",
             "index.html","fa/index.html","library/index.html","fa/library/index.html",
             "brand-kit/logo-usage/index.html","fa/brand-kit/logo-usage/index.html"]:
 left=(Path("hades")/name).read_bytes()
 assert left==(Path("site/public/hades")/name).read_bytes(),name
 assert b"portico-studies" in left
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(("127.0.0.1",8995),lambda *a,**kw:Quiet(*a,directory=str(Path.cwd()),**kw))
Thread(target=server.serve_forever,daemon=True).start()
out=Path("hades-portico-qa");out.mkdir(exist_ok=True)
with sync_playwright() as pw:
 br=pw.chromium.launch(headless=True)
 for lang in ["en","fa"]:
  for width in [320,390,430]:
   page=br.new_page(viewport={"width":width,"height":840},accept_downloads=True)
   target=f"http://127.0.0.1:8995/hades/{'fa/' if lang=='fa' else ''}library/portico-studies/"
   assert page.goto(target).status==200
   page.wait_for_selector("#artboard svg",timeout=12000)
   for mode in ["classic","modern"]:
    page.locator("#mode").select_option(mode)
    page.wait_for_function("""m=>document.querySelector('#artboard svg title')?.textContent.toLowerCase().includes(m)""",mode)
    assert page.locator("#export").is_enabled(),(lang,width,mode,page.locator("#message").inner_text())
    assert not page.evaluate("document.documentElement.scrollWidth>innerWidth+1"),(lang,width,mode,"horizontal overflow")
    assert page.locator("#compTitle").evaluate("(el)=>parseFloat(getComputedStyle(el).fontSize)")>=20
    assert page.locator("#compSubtitle").evaluate("(el)=>parseFloat(getComputedStyle(el).fontSize)")>=14
    page.screenshot(path=str(out/f"{lang}_{width}_{mode}.png"),full_page=True)
    page.locator("#title").fill("W"*50)
    assert page.locator("#export").is_disabled(),(lang,width,mode,"long text wrongly passed")
    page.locator("#title").fill("HADES" if lang=="en" else "هادس")
    assert page.locator("#export").is_enabled(),(lang,width,mode,"recovery failed")
    with page.expect_download() as event:
     page.locator("#export").click()
    file=out/f"export_{lang}_{width}_{mode}.svg"
    event.value.save_as(str(file))
    verify_svg(file.read_bytes())
    print("PASS",lang,width,mode,"real Chromium, SVG export, exact source image")
   page.close()
 br.close()
server.shutdown()
