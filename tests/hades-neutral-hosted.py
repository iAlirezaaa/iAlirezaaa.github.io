#!/usr/bin/env python3
"""Independently GET public Pages and compare actual bytes, HTTP, MIME to exact source. Not a build test."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import quote
import hashlib,json,time,sys
ROOT=Path(__file__).resolve().parent.parent
FILES={
 "library/neutral-atlas/index.html":"text/html",
 "fa/library/neutral-atlas/index.html":"text/html",
 "library/neutral-atlas/HADES_Neutral_Atlas_A4_REVIEW.svg":"image/svg+xml",
 "library/neutral-atlas/HADES_Neutral_Atlas_Tokens_REVIEW.json":"application/json",
 "index.html":"text/html",
 "fa/index.html":"text/html",
 "library/index.html":"text/html",
 "fa/library/index.html":"text/html",
 "brand-kit/logo-usage/index.html":"text/html",
 "fa/brand-kit/logo-usage/index.html":"text/html",
}
BASE="https://ialirezaaa.github.io/hades/"
OUT=ROOT/"hades-neutral-atlas-hosted-QA";OUT.mkdir(exist_ok=True)
rows=[];failure=[]
for rel,mime in FILES.items():
 try:
  source=(ROOT/"site/public/hades"/rel).read_bytes()
  served=(ROOT/"hades"/rel).read_bytes()
  assert source==served,"GitHub source/served mismatch"
  expected=hashlib.sha256(served).hexdigest()
  url=BASE+quote(rel,safe="/")
  success=False
  for attempt in range(6):
   try:
    req=Request(url,headers={"User-Agent":"HADES-Atlas-Live-Audit/1.0","Cache-Control":"no-cache"})
    with urlopen(req,timeout=25) as res:
     status=res.status;data=res.read();typ=res.headers.get_content_type()
    actual=hashlib.sha256(data).hexdigest()
    if status==200 and typ==mime and actual==expected:
     success=True;break
   except Exception as e:
    error=str(e)
   time.sleep(12)
  row={"path":rel,"status":status if 'status' in locals() else None,"mime":typ if 'typ' in locals() else None,"expected_mime":mime,"sha_equal":success,"expected_sha256":expected}
  rows.append(row)
  if not success:failure.append(rel)
 except Exception as e:failure.append(rel);rows.append({"path":rel,"error":str(e)})
(OUT/"report.json").write_text(json.dumps({"pass_count":len(FILES)-len(failure),"total":len(FILES),"failures":failure,"rows":rows},indent=2))
print(f"Independent LIVE HTTP MIME SHA: {len(FILES)-len(failure)}/{len(FILES)}")
if failure:print("OPEN / FAILED:",failure);sys.exit(1)
