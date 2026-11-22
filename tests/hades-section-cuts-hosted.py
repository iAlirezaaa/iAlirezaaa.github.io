#!/usr/bin/env python3
"""Independent live Pages HTTP 200/MIME/SHA256 test for Section Cuts. Does NOT infer release from git push."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import quote
import hashlib,json,time,sys,xml.etree.ElementTree as ET,zipfile,io
ROOT=Path(__file__).resolve().parent.parent
FILES={
"library/backgrounds/section-cuts/index.html":"text/html",
"fa/library/backgrounds/section-cuts/index.html":"text/html",
"library/backgrounds/section-cuts/HADES_Section_Cuts_3_SVG_Editable_PUBLIC_REVIEW.zip":"application/zip",
"library/backgrounds/assets/HADES_Section_Cut_Cantilever_16x9_REVIEW.svg":"image/svg+xml",
"library/backgrounds/assets/HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW.svg":"image/svg+xml",
"library/backgrounds/assets/HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW.svg":"image/svg+xml",
"index.html":"text/html","fa/index.html":"text/html",
"library/index.html":"text/html","fa/library/index.html":"text/html",
"library/backgrounds/index.html":"text/html","fa/library/backgrounds/index.html":"text/html",
"brand-kit/logo-usage/index.html":"text/html","fa/brand-kit/logo-usage/index.html":"text/html",
"library/neutral-atlas/index.html":"text/html","fa/library/neutral-atlas/index.html":"text/html"
}
out=ROOT/"hades-section-cuts-hosted-QA";out.mkdir(exist_ok=True)
rows=[];fails=[]
for rel,mime in FILES.items():
 source=(ROOT/"site/public/hades"/rel).read_bytes()
 mirrored=(ROOT/"hades"/rel).read_bytes()
 assert source==mirrored, "mirror mismatch "+rel
 if rel.endswith(".svg"):
  root=ET.fromstring(source); assert root.tag.endswith("svg"), "svg invalid "+rel
 sha=hashlib.sha256(source).hexdigest()
 url="https://ialirezaaa.github.io/hades/"+quote(rel,safe="/")
 result={"path":rel,"url":url,"sha256":sha,"expected_mime":mime}
 ok=False
 for i in range(7):
  try:
   with urlopen(Request(url,headers={"User-Agent":"HADES-SectionCuts-IndependentQA","Cache-Control":"no-cache"}),timeout=22) as r:
    data=r.read();status=r.status;ctype=r.headers.get_content_type()
   result.update(status=status,mime=ctype,actual_sha256=hashlib.sha256(data).hexdigest())
   if status==200 and (ctype==mime or (rel.endswith(".zip") and ctype=="application/x-zip-compressed")) and hashlib.sha256(data).hexdigest()==sha:
    if rel.endswith(".zip"):
     with zipfile.ZipFile(io.BytesIO(data)) as archive:
      assert archive.testzip() is None,"ZIP CRC failure"
      assert len(archive.namelist())==5,"ZIP entry count"
      assert len([n for n in archive.namelist() if n.endswith(".svg")])==3,"SVG entry count"
    ok=True;break
  except Exception as ex:result["error"]=str(ex)
  time.sleep(10)
 result["pass"]=ok;rows.append(result)
 if not ok:fails.append(rel)
(out/"report.json").write_text(json.dumps({"status":"PASS" if not fails else "OPEN/FAIL","total":len(FILES),"passed":len(FILES)-len(fails),"failed":fails,"rows":rows},ensure_ascii=False,indent=2))
print("LIVE SECTION CUTS HTTPS MIME SHA",len(FILES)-len(fails),"/",len(FILES))
if fails:print("OPEN",fails);sys.exit(1)
