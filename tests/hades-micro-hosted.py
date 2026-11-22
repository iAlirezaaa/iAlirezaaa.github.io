#!/usr/bin/env python3
"""Independent live HTTPS vs Git checkout (not a Pages build-only check)."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
from urllib.error import HTTPError, URLError
import hashlib, json, mimetypes, sys, time
ROOT=Path(__file__).resolve().parent.parent
FILES=[
("brand-kit/logo-usage/micro-bench/index.html","text/html"),
("fa/brand-kit/logo-usage/micro-bench/index.html","text/html"),
("index.html","text/html"),
("fa/index.html","text/html"),
("library/index.html","text/html"),
("fa/library/index.html","text/html"),
("brand-kit/logo-usage/index.html","text/html"),
("fa/brand-kit/logo-usage/index.html","text/html"),
("assets/IMG_7187(2).png","image/png"),
("assets/B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg","image/jpeg"),
]
BASE="https://ialirezaaa.github.io/hades/"
OUT=ROOT/"hades-micro-hosted-QA";OUT.mkdir(exist_ok=True)
def check():
    rows=[]
    for rel,mime in FILES:
        local=(ROOT/"hades"/rel).read_bytes()
        source=(ROOT/"site/public/hades"/rel).read_bytes()
        if local!=source:raise ValueError("mirror mismatch "+rel)
        url=BASE+quote(rel,safe="/")
        req=Request(url,headers={"User-Agent":"HADES-Independent-Review-QA/1.0","Cache-Control":"no-cache"})
        with urlopen(req,timeout=25) as response:
            code=response.status; served=response.read()
            actualmime=response.headers.get_content_type()
        good=(code==200 and actualmime==mime and hashlib.sha256(served).digest()==hashlib.sha256(local).digest())
        rows.append({"url":url,"http":code,"mime":actualmime,"expected_mime":mime,"bytes":len(served),"sha256":hashlib.sha256(served).hexdigest(),"match":good})
        print(("PASS" if good else "FAIL"),code,actualmime,rel,"sha256",rows[-1]["sha256"])
        if not good:raise AssertionError("host byte/MIME failure "+rel)
    return rows
last=None
for attempt in range(1,9):
    try:
        data=check()
        result={"status":"PASS","date":"2026-11-22","checks":len(data),"independent_live_http":True,"items":data}
        (OUT/"HADES_Micro_Hosted_10_URL_REVIEW.json").write_text(json.dumps(result,indent=2))
        print("PASS LIVE",len(data),"/",len(FILES))
        sys.exit(0)
    except Exception as exc:
        last=str(exc)
        print("RETRY",attempt,"of 8:",last,flush=True)
        if attempt<8:time.sleep(20)
(OUT/"HADES_Micro_Hosted_OPEN.json").write_text(json.dumps({"status":"OPEN","reason":last,"checks_target":len(FILES)},indent=2))
raise SystemExit("Independent live check not yet confirmed: "+last)
