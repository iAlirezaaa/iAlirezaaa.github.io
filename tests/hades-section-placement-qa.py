from pathlib import Path
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
NS='{http://www.w3.org/2000/svg}'
root=Path.cwd()
spec=[
('HADES_Cantilever_Text_Placement_16x9_REVIEW.svg','HADES_Section_Cut_Cantilever_16x9_REVIEW.svg',1920,1080),
('HADES_Sunken_Text_Placement_9x16_REVIEW.svg','HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW.svg',1080,1920),
('HADES_Lintel_Text_Placement_1x1_REVIEW.svg','HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW.svg',1080,1080)]
for name,base,w,h in spec:
    rel='library/backgrounds/section-cuts/placement/'+name
    data=(root/'hades'/rel).read_bytes()
    assert data==(root/'site/public/hades'/rel).read_bytes(),rel
    d=ET.fromstring(data)
    assert (int(d.attrib['width']),int(d.attrib['height']))==(w,h)
    assert d.find(".//*[@id='editable-title']") is not None
    assert d.find(".//*[@id='editable-subtitle']") is not None
    assert d.find(".//*[@id='guide-overlay']") is not None
    original=d.find(".//*[@id='unchanged-source-architecture']")
    src=ET.fromstring((root/'hades/library/backgrounds/assets'/base).read_bytes())
    assert len(original)==len(list(src)),name
    for i,child in enumerate(src):
        if child.tag not in (NS+'title',NS+'desc',NS+'metadata'):
            assert ET.tostring(original[i-3])==ET.tostring(child),name
    assert d.find('.//'+NS+'image') is None,'no logo source embedded'
    print('PASS static art',name,w,h)
for rel in ['library/backgrounds/section-cuts/placement/index.html','fa/library/backgrounds/section-cuts/placement/index.html',
'library/backgrounds/section-cuts/placement/README.md','index.html','fa/index.html','library/index.html','fa/library/index.html',
'library/backgrounds/index.html','fa/library/backgrounds/index.html',
'library/backgrounds/section-cuts/index.html','fa/library/backgrounds/section-cuts/index.html',
'brand-kit/logo-usage/index.html','fa/brand-kit/logo-usage/index.html']:
    assert (root/'hades'/rel).read_bytes()==(root/'site/public/hades'/rel).read_bytes(),'MIRROR '+rel
Path('hades-placement-qa').mkdir(exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
srv=ThreadingHTTPServer(('127.0.0.1',8893),lambda *a,**kw:Handler(*a,directory=str(root),**kw))
Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for lang in ['en','fa']:
        for width in [320,390,430]:
            page=browser.new_page(viewport={'width':width,'height':800},accept_downloads=True)
            url='http://127.0.0.1:8893/hades/'+('fa/' if lang=='fa' else '')+'library/backgrounds/section-cuts/placement/'
            r=page.goto(url,wait_until='load')
            assert r.status==200
            page.locator('#art').evaluate('(o)=>new Promise((resolve,reject)=>{if(o.contentDocument?.documentElement){resolve();return;}o.addEventListener("load",resolve,{once:true});setTimeout(()=>reject("timeout"),15000);})')
            assert page.locator('#art').evaluate('(o)=>o.contentDocument?.getElementById("editable-title")?.textContent==="SECTION / SPACE"')
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),f'overflow {lang} {width}'
            page.locator('#headline').fill('SAMPLE TITLE')
            assert page.locator('#art').evaluate('(o)=>o.contentDocument?.getElementById("editable-title")?.textContent==="SAMPLE TITLE"')
            with page.expect_download() as dl:
                page.locator('#export').click()
            download=dl.value
            assert download.suggested_filename.endswith('_EDITED_REVIEW.svg')
            download.save_as(str(Path('hades-placement-qa')/(lang+'-'+str(width)+'-edit.svg')))
            ET.parse(Path('hades-placement-qa')/(lang+'-'+str(width)+'-edit.svg'))
            for k in [1,2]:
                page.locator('#ratio').select_option(str(k))
                page.locator('#art').evaluate('(o)=>new Promise((resolve,reject)=>{if(o.contentDocument?.getElementById("editable-title")){resolve();return;}o.addEventListener("load",resolve,{once:true});setTimeout(()=>reject("timeout"),15000);})')
                assert page.locator('#art').evaluate('(o)=>o.contentDocument?.getElementById("editable-title")!=null')
            page.screenshot(path=f'hades-placement-qa/{lang}-{width}-REVIEW.png',full_page=True)
            print('PASS REAL CHROMIUM',lang,width,'3 ratio views, edit and downloaded SVG')
            page.close()
    browser.close()
srv.shutdown()
