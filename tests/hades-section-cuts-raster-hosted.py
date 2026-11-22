"""Independent HADES Section Cuts hosted audit: actual HTTP/MIME/SHA; not just build status."""
from pathlib import Path
import hashlib, urllib.request, time, zipfile, json
from io import BytesIO
stem=("HADES_Section_Cut_Cantilever_16x9_REVIEW","HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW","HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW")
base="library/backgrounds/"
files=[(base+"assets/"+s+"."+e,{"svg":"image/svg+xml","png":"image/png","jpg":"image/jpeg","webp":"image/webp"}[e]) for s in stem for e in ("svg","png","jpg","webp")]
files.extend((base+"section-cuts/"+f,m) for f,m in [("HADES_Section_Cuts_Raster_Contact_REVIEW.png","image/png"),("Section_Cuts_Raster_Release_REVIEW.json","application/json"),("HADES_Section_Cuts_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip","zip")])
files.extend((p,"text/html") for p in ("library/backgrounds/section-cuts/index.html","fa/library/backgrounds/section-cuts/index.html","library/backgrounds/index.html","fa/library/backgrounds/index.html","library/index.html","fa/library/index.html","brand-kit/logo-usage/index.html","fa/brand-kit/logo-usage/index.html","index.html","fa/index.html"))
assert len(files)==25
report=[]
for rel,mime in files:
 a=(Path("site/public/hades")/rel).read_bytes()
 b=(Path("hades")/rel).read_bytes()
 assert a==b,("source/served mismatch",rel)
 digest=hashlib.sha256(a).hexdigest()
 for attempt in range(1,18):
  try:
   target=rel[:-10] if rel.endswith("/index.html") else rel
   url="https://ialirezaaa.github.io/hades/"+target+"?sha="+digest[:12]+"&try="+str(attempt)
   req=urllib.request.Request(url,headers={"User-Agent":"HADES-Section-Cuts-Live-REVIEW","Cache-Control":"no-cache"})
   with urllib.request.urlopen(req,timeout=17) as response:
    data=response.read();status=response.status;actual=response.headers.get("Content-Type","").split(";")[0].strip().lower()
   assert status==200,(status,rel)
   assert hashlib.sha256(data).hexdigest()==digest,(rel,"deployed SHA mismatch")
   if mime=="zip":assert actual in ("application/zip","application/x-zip-compressed","application/octet-stream"),actual
   elif mime=="application/json":assert "json" in actual,actual
   else:assert mime==actual,(rel,mime,actual)
   if rel.endswith(".zip"):
    with zipfile.ZipFile(BytesIO(data)) as z:assert z.testzip() is None and len(z.namelist())==15
   if rel.endswith("Release_REVIEW.json"):
    x=json.loads(data);assert len(x["assets"])==3 and all(len(t["renders"])==3 for t in x["assets"])
   report.append({"path":rel,"status":status,"mime":actual,"bytes":len(data),"sha256":digest})
   print("PASS HTTP 200 MIME SHA",len(report),"/25",rel,flush=True)
   break
  except Exception as exc:
   print("OPEN",attempt,rel,str(exc)[:110],flush=True)
   if attempt==17:raise
   time.sleep(4)
Path("section-cuts-raster-hosted-QA").mkdir(exist_ok=True)
Path("section-cuts-raster-hosted-QA/results_REVIEW.json").write_text(json.dumps(report,indent=2),encoding="utf8")
print("PASS 25 real hosted URLs; physical print/phone/Mikhak/FINAL remain OPEN")
