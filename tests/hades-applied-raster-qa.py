#!/usr/bin/env python3
"""Source+hosted HADES Applied Covers REVIEW audit. No false physical tests."""
from pathlib import Path
import sys,io,hashlib,json,zipfile,urllib.request,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
ROOT=Path(__file__).resolve().parents[1]
REL="library/backgrounds/section-cuts/applied-raster/"
FILENAMES=[
 "HADES_Section_Cut_Cantilever_Applied_16x9_REVIEW",
 "HADES_Section_Cut_Sunken_Gallery_Applied_9x16_REVIEW",
 "HADES_Section_Cut_Suspended_Lintel_Applied_1x1_REVIEW"]
ARTIFACTS=[REL+n+"."+ext for n in FILENAMES for ext in ["png","webp"]]
ARTIFACTS+=[REL+"HADES_Section_Cuts_Applied_Contact_REVIEW.png",
 REL+"HADES_Section_Cuts_Applied_Raster_Manifest_REVIEW.json",
 REL+"HADES_Section_Cuts_Applied_PNG_WEBP_Review_Pack.zip",
 REL+"index.html","fa/"+REL+"index.html"]
OUT=ROOT/"hades-applied-raster-qa"
OUT.mkdir(exist_ok=True)
def digest(data): return hashlib.sha256(data).hexdigest()
def validate_source():
 from PIL import Image
 man=json.loads((ROOT/"hades"/REL/"HADES_Section_Cuts_Applied_Raster_Manifest_REVIEW.json").read_text())
 assert man["original_logo_sha256"]=="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
 assert len(man["assets"])==3
 for path in ARTIFACTS:
  a=(ROOT/"hades"/path).read_bytes()
  b=(ROOT/"site/public/hades"/path).read_bytes()
  assert a==b,("mirror",path)
  if path.endswith((".png",".webp")):
   with Image.open(io.BytesIO(a)) as img:img.verify()
 for record in man["assets"]:
  for output in record["exports"]:
   src=(ROOT/"hades"/output["path"]).read_bytes()
   assert digest(src)==output["sha256"]
 zipdata=(ROOT/"hades"/REL/"HADES_Section_Cuts_Applied_PNG_WEBP_Review_Pack.zip").read_bytes()
 with zipfile.ZipFile(io.BytesIO(zipdata)) as z:
  assert z.testzip() is None and len(z.namelist())==9
 print("PASS 11 mirrored source paths + exact PNG/WebP dimensions, manifest and 9-member ZIP",flush=True)
def browser():
 from playwright.sync_api import sync_playwright
 class Handler(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 server=ThreadingHTTPServer(("127.0.0.1",8879),lambda *a,**kw:Handler(*a,directory=str(ROOT),**kw))
 Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(headless=True)
   for lang in ["en","fa"]:
    for width in [320,390,430]:
     page=browser.new_page(viewport={"width":width,"height":820})
     suffix=("fa/" if lang=="fa" else "")+REL
     response=page.goto("http://127.0.0.1:8879/hades/"+suffix,wait_until="load")
     assert response.status==200
     page.locator(".image img").first.wait_for(state="visible")
     details=page.locator(".image img").evaluate_all("(nodes)=>nodes.map(img=>({ok:img.complete && img.naturalWidth>0,w:img.naturalWidth,h:img.naturalHeight}))")
     assert len(details)==3 and all(x["ok"] for x in details),details
     assert [(x["w"],x["h"]) for x in details]==[(1920,1080),(1080,1920),(1080,1080)]
     assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),("overflow",lang,width)
     assert page.locator('a[href$=".png"]').count()>=4
     assert page.locator('a[href$=".webp"]').count()==3
     assert page.locator('a[href$=".svg"]').count()==3
     assert page.locator("html").get_attribute("dir")==("rtl" if lang=="fa" else "ltr")
     page.screenshot(path=str(OUT/(f"{lang}-{width}-actual-REVIEW.png")),full_page=True)
     print("PASS real Chromium",lang,width,flush=True)
     page.close()
   browser.close()
 finally:server.shutdown()
def hosted():
 records=[]
 base="https://ialirezaaa.github.io/hades/"
 # Pages deployment can lag Git; poll a reliable binary sentinel first.
 sentinel=REL+"HADES_Section_Cuts_Applied_PNG_WEBP_Review_Pack.zip"
 expected=(ROOT/"hades"/sentinel).read_bytes()
 for attempt in range(18):
  try:
   req=urllib.request.Request(base+sentinel,headers={"User-Agent":"HADES-Applied-Review-Independent-Audit","Cache-Control":"no-cache"})
   with urllib.request.urlopen(req,timeout=25) as r:
    got=r.read();status=r.status
   if status==200 and got==expected:break
  except Exception:pass
  time.sleep(15)
 else:raise AssertionError("PUBLIC HOSTED OPEN: ZIP was not byte-identical to latest Git HEAD")
 for rel in ARTIFACTS:
  req=urllib.request.Request(base+rel,headers={"User-Agent":"HADES-Applied-Review-Independent-Audit","Cache-Control":"no-cache"})
  with urllib.request.urlopen(req,timeout=30) as r:
   data=r.read();mime=r.headers.get("Content-Type","").split(";")[0];status=r.status
  expected=(ROOT/"hades"/rel).read_bytes()
  allowed=(
   {"image/png"} if rel.endswith(".png") else
   {"image/webp"} if rel.endswith(".webp") else
   {"text/html"} if rel.endswith(".html") else
   {"application/json","text/plain"} if rel.endswith(".json") else
   {"application/zip","application/x-zip-compressed","application/octet-stream"})
  okay=status==200 and data==expected and mime in allowed
  records.append({"path":rel,"status":status,"mime":mime,"sha256":digest(data),"expected_sha256":digest(expected),"pass":okay})
  print("PASS LIVE" if okay else "FAIL LIVE",rel,status,mime,flush=True)
  if not okay:break
 (OUT/"hosted-report.json").write_text(json.dumps(records,indent=2))
 assert len(records)==len(ARTIFACTS) and all(r["pass"] for r in records),"hosted HTTP/MIME/SHA OPEN"
 print("PASS independent live HTTPS",len(records),"URLs",flush=True)
if __name__=="__main__":
 validate_source()
 if "--browser" in sys.argv:browser()
 if "--hosted" in sys.argv:hosted()
