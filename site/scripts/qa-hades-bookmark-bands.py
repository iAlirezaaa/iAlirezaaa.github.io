#!/usr/bin/env python3
"""HADES A4 bookmark bands: origin, mirror, real Chromium and hosted HTTP QA."""
from __future__ import annotations
import base64, hashlib, http.server, json, re, threading, time, urllib.request, functools
from pathlib import Path
from xml.etree import ElementTree as ET
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/"site/public/hades"
DEP=ROOT/"hades"
OUT=ROOT/"hades-band-review-screenshots"
OUT.mkdir(exist_ok=True)
NAMES=[f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.svg" for lang in ("EN","FA")]
ORIGINAL_SHA="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
paths=[f"library/bookmark-bands/{n}" for n in NAMES]+["library/bookmark-bands/index.html","fa/library/bookmark-bands/index.html","index.html","fa/index.html","library/index.html","fa/library/index.html","brand-kit/logo-usage/index.html","fa/brand-kit/logo-usage/index.html","library/bookmarks/index.html","fa/library/bookmarks/index.html"]
for p in paths:
    assert (SRC/p).read_bytes()==(DEP/p).read_bytes(),p
    assert (SRC/p).stat().st_size>1000,p
for name in NAMES:
    raw=(SRC/"library/bookmark-bands"/name).read_bytes()
    root=ET.fromstring(raw)
    assert root.attrib["width"]=="210mm" and root.attrib["height"]=="297mm",name
    b64s=re.findall(rb'data:image/png;base64,([A-Za-z0-9+/=]+)',raw)
    assert len(b64s)==1,(name,len(b64s))
    assert hashlib.sha256(base64.b64decode(b64s[0])).hexdigest()==ORIGINAL_SHA,name
    assert len(re.findall(rb'<use href="#owner-mark"',raw))==4,name
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(SRC.parent))
httpd=http.server.ThreadingHTTPServer(("127.0.0.1",0),Handler)
threading.Thread(target=httpd.serve_forever,daemon=True).start()
base=f"http://127.0.0.1:{httpd.server_address[1]}"
checks=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
        for lang in ("EN","FA"):
            route="/hades/"+("fa/" if lang=="FA" else "")+"library/bookmark-bands/"
            for width in (320,390,430):
                page=browser.new_page(viewport={"width":width,"height":900},device_scale_factor=1)
                errors=[]
                page.on("pageerror",lambda e:errors.append(str(e)))
                response=page.goto(base+route,wait_until="networkidle")
                assert response and response.status==200,(lang,width)
                page.locator("figure img").evaluate("(e) => e.decode()")
                data=page.evaluate("""() => ({
                    scroll:document.documentElement.scrollWidth,inner:innerWidth,
                    lang:document.documentElement.lang,dir:document.documentElement.dir,
                    loaded:[...document.images].every(i=>i.complete&&i.naturalWidth>0),
                    svgs:[...document.querySelectorAll('a[href$=".svg"]')].length
                })""")
                assert data["scroll"]<=width+1,(lang,width,data)
                assert data["loaded"] and data["svgs"]>=2,data
                assert data["lang"].lower()==lang.lower() and data["dir"]==("rtl" if lang=="FA" else "ltr"),data
                assert not errors,errors
                page.screenshot(path=str(OUT/f"HADES_Bands_{lang}_{width}_REVIEW.png"),full_page=True)
                checks.append({"lang":lang,"width":width,"status":"PASS","scroll":data["scroll"]})
                page.close()
        browser.close()
finally:
    httpd.shutdown()
assert len(checks)==6
(OUT/"qa.json").write_text(json.dumps(checks,indent=2)+"\n")
print("CHROMIUM 6/6 PASS",checks)
# The GET below is independent of Git blob writes or CI build results.
import os
if os.environ.get("HADES_QA_LOCAL_ONLY") == "1":
    print("LOCAL 6/6 Chromium & immutable-logo/source-mirror QA passed; hosted check delegated to post-commit step")
    raise SystemExit(0)

verified=[]
for rel in paths:
    local=(DEP/rel).read_bytes()
    url="https://ialirezaaa.github.io/hades/"+rel
    errors=[]
    for attempt in range(16):
        try:
            req=urllib.request.Request(url+"?hades-review=20261123",headers={"Cache-Control":"no-cache","User-Agent":"HADES-Independent-Pages-QA"})
            with urllib.request.urlopen(req,timeout=20) as response:
                code=response.status
                data=response.read()
                mime=response.headers.get("Content-Type","").split(";")[0].lower()
            assert code==200
            assert hashlib.sha256(data).digest()==hashlib.sha256(local).digest(),"SHA mismatch"
            assert mime in (("image/svg+xml",) if rel.endswith(".svg") else ("text/html",)) , mime
            verified.append({"path":rel,"http":code,"mime":mime,"sha256":hashlib.sha256(local).hexdigest()})
            break
        except Exception as e:
            errors.append(str(e))
            time.sleep(5)
    else:
        raise RuntimeError(f"Live HTTP not confirmed {rel}: {errors[-3:]}")
print(json.dumps({"status":"PASS PUBLIC REVIEW NOT FINAL","browser":checks,"http_checks":verified},ensure_ascii=False))
