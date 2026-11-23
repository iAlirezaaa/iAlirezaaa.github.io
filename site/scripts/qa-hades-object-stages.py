#!/usr/bin/env python3
"""HADES Object Stages: exact vector/mirror and actual browser/hosted proof (REVIEW)."""
from pathlib import Path
import hashlib, xml.etree.ElementTree as ET, urllib.request, time
import http.server, socketserver, threading
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
public=root/'hades'
source=root/'site/public/hades'
art={'HADES_Object_Stage_16x9_REVIEW.svg':(1920,1080),'HADES_Object_Stage_9x16_REVIEW.svg':(1080,1920),'HADES_Object_Stage_1x1_REVIEW.svg':(1080,1080)}
pages=['library/object-stages/index.html','fa/library/object-stages/index.html']
nav=['index.html','fa/index.html','library/index.html','fa/library/index.html','brand-kit/logo-usage/index.html','fa/brand-kit/logo-usage/index.html','library/HADES_Library_Guide_EN.md','library/HADES_Library_Guide_FA.md']
items=['library/object-stages/'+a for a in art]+pages+nav+['library/catalog.json']
for rel in items:
    assert (public/rel).read_bytes()==(source/rel).read_bytes(), 'mirror '+rel
for n,dim in art.items():
    content=(public/'library/object-stages'/n).read_bytes()
    node=ET.fromstring(content)
    assert node.tag=='{http://www.w3.org/2000/svg}svg'
    assert (int(node.attrib['width']),int(node.attrib['height']))==dim
    assert b'id="subject-placement-guide-hidden" display="none"' in content
    assert b'PUBLIC REVIEW' in content and b'<image' not in content and b'<script' not in content
for rel in nav: assert 'object-stages/' in (public/rel).read_text()
print('PASS 3 SVG XML, dimensions, no invented mark; mirror, links and proposed review status',flush=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
import os
os.chdir(root)
server=socketserver.TCPServer(('127.0.0.1',8766),Quiet)
threading.Thread(target=server.serve_forever,daemon=True).start()
out=root/'hades-object-stage-chromium-qa'
out.mkdir(exist_ok=True)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for lang in ('en','fa'):
            for width in (320,390,430):
                page=browser.new_page(viewport={'width':width,'height':920},device_scale_factor=1)
                loc='/hades/fa/library/object-stages/' if lang=='fa' else '/hades/library/object-stages/'
                response=page.goto('http://127.0.0.1:8766'+loc,wait_until='networkidle')
                assert response and response.status==200
                assert page.locator('html').get_attribute('dir')==('rtl' if lang=='fa' else 'ltr')
                page.wait_for_function("Array.from(document.querySelectorAll('.item img')).length===3&&Array.from(document.querySelectorAll('.item img')).every(i=>i.complete&&i.naturalWidth>0)")
                assert page.evaluate('document.documentElement.scrollWidth')<=width+1,(lang,width)
                assert page.locator('a.file[download]').count()==3
                page.screenshot(path=str(out/f'HADES_Stages_{lang}_{width}_Chromium_REVIEW.png'),full_page=True)
                print('PASS Chromium',lang,width,'3 decoded vector images, no overflow',flush=True)
                page.close()
        browser.close()
finally:
    server.shutdown();server.server_close()
hosted=['library/object-stages/'+a for a in art]+pages+nav[:6]
for rel in hosted:
    content=(public/rel).read_bytes()
    expected=hashlib.sha256(content).digest()
    mime='image/svg+xml' if rel.endswith('.svg') else 'text/html'
    err=None
    for i in range(16):
        try:
            url='https://ialirezaaa.github.io/hades/'+rel+'?review='+str(i)
            req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','User-Agent':'HADES-Independent-Live-Check'})
            with urllib.request.urlopen(req,timeout=20) as res:
                body=res.read()
                found=res.headers.get('Content-Type','').split(';',1)[0].lower()
                assert res.status==200 and found==mime,(res.status,found,mime)
            assert hashlib.sha256(body).digest()==expected,'SHA bytes not current'
            print('PASS live HTTPS200 MIME SHA',rel,flush=True)
            err=None;break
        except Exception as e:
            err=e
            if i<15:time.sleep(12)
    if err:raise AssertionError(f'OPEN live site {rel}: {err}')
print('PASS 11/11 independent live 200/MIME/SHA',flush=True)
