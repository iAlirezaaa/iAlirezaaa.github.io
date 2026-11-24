from pathlib import Path
from playwright.sync_api import sync_playwright
import json, hashlib, urllib.request, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
root=Path('hades/library/backgrounds/quiet-courts/closing-cards/motion-safe/')
pages=[Path('hades/library/backgrounds/quiet-courts/closing-cards/motion-safe/architectural-motion/index.html'),Path('hades/fa/library/backgrounds/quiet-courts/closing-cards/motion-safe/architectural-motion/index.html')]
server=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch()
 for path in pages:
  assert path.read_bytes()==(Path('site/public')/path).read_bytes()
  lang='FA' if '/fa/' in str(path) else 'EN'
  for width in (320,390,430):
   page=browser.new_page(viewport={'width':width,'height':900},accept_downloads=True,reduced_motion='reduce')
   page.goto(f'http://127.0.0.1:{server.server_port}/'+str(path.parent)+'/')
   assert page.locator('html').get_attribute('dir')==('rtl' if lang=='FA' else 'ltr')
   assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
   for ratio in ('16x9','9x16','1x1'):
    page.select_option('#ratio',ratio);page.locator('#art').evaluate('(x)=>x.decode()')
    for t,a in [(0,'0%'),(.5,'50%'),(1,'100%'),(4,'100%'),(4.5,'50%'),(5,'0%')]:
     page.locator('#scrub').evaluate('(x,t)=>{x.value=t;x.dispatchEvent(new Event("input"))}',t)
     assert page.locator('#alpha').inner_text()==a
   page.select_option('#duration','3');page.click('#reset');page.click('#play');page.wait_for_timeout(300);page.click('#pause')
   t=float(page.locator('#scrub').input_value());assert .1<t<.8,t
   page.wait_for_timeout(100);assert float(page.locator('#scrub').input_value())==t
   with page.expect_download() as dl:page.click('#save')
   rec=json.loads(Path(dl.value.path()).read_text());assert rec['duration_seconds']==3 and rec['locale']==lang and rec['keyframes'][0]['opacity']==0 and rec['keyframes'][-1]['opacity']==0
   page.select_option('#duration','5');page.select_option('#ratio','16x9');page.locator('#art').evaluate('(x)=>x.decode()')
   if width==430:page.screenshot(path=f'motion-{lang}-430.png',full_page=True)
   page.close()
   print('PASS',lang,width,'3 ratios / 18 opacity samples / play pause / JSON')
 browser.close()
server.shutdown()
