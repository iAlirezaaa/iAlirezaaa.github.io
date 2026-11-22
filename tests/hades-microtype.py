from pathlib import Path
import base64,hashlib,xml.etree.ElementTree as ET
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
r="library/backgrounds/section-cuts/microtype/";old=Path("hades/assets/IMG_7187(2).png").read_bytes()
assert hashlib.sha256(old).hexdigest()=="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
for n in ["HADES_Cantilever_Microtype_EN_REVIEW.svg","HADES_Cantilever_Microtype_FA_REVIEW.svg"]:
 data=(Path("hades")/r/n).read_bytes()
 assert data==(Path("site/public/hades")/r/n).read_bytes()
 tree=ET.fromstring(data);assert tree.attrib["viewBox"]=="0 0 1920 1080"
 image=list(tree.iter("{http://www.w3.org/2000/svg}image"));assert len(image)==1
 uri=image[0].attrib["{http://www.w3.org/1999/xlink}href"]
 assert base64.b64decode(uri.split(",",1)[1])==old
for p in ["index.html","fa/index.html","library/index.html","fa/library/index.html","brand-kit/logo-usage/index.html","fa/brand-kit/logo-usage/index.html",r+"index.html","fa/"+r+"index.html"]:
 assert (Path("hades")/p).read_bytes()==(Path("site/public/hades")/p).read_bytes(),p
class H(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(("127.0.0.1",8994),lambda *args,**kw:H(*args,directory=str(Path.cwd()),**kw))
Thread(target=server.serve_forever,daemon=True).start()
Path("hades-microtype-qa").mkdir(exist_ok=True)
with sync_playwright() as pw:
 br=pw.chromium.launch(headless=True)
 for lang in ["en","fa"]:
  for width in [320,390,430]:
   pg=br.new_page(viewport={"width":width,"height":810},device_scale_factor=1)
   url="http://127.0.0.1:8994/hades/"+("fa/" if lang=="fa" else "")+r
   assert pg.goto(url).status==200
   pg.wait_for_function("document.querySelector('#stage svg') !== null")
   assert pg.locator("#export").is_enabled(),(lang,width,pg.locator("#status").inner_text())
   assert not pg.evaluate("document.documentElement.scrollWidth>innerWidth+1")
   assert pg.locator("#mobile-title").evaluate("(e)=>parseFloat(getComputedStyle(e).fontSize)")>=20
   assert pg.locator("#mobile-caption").evaluate("(e)=>parseFloat(getComputedStyle(e).fontSize)")>=14
   pg.screenshot(path=f"hades-microtype-qa/{lang}_{width}.png",full_page=True)
   print("PASS",lang,width)
   pg.close()
 br.close()
server.shutdown()
