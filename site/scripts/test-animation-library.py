import json, pathlib, subprocess, time, zipfile
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[2]
site=root/'site'
dist=site/'dist'
out=site/'animation-evidence'
out.mkdir(exist_ok=True)
inv=json.loads((root/'garden/docs/animation-source-inventory.json').read_text())
notes=root/'garden/src/site/notes/انیمیشن'
assets=root/'garden/src/site/img/user/animation'
with zipfile.ZipFile(out/'hades-animation-fa.zip','w',zipfile.ZIP_DEFLATED) as z:
    # The downloadable reference collection follows its source inventory, not
    # every original lesson that may later share the Animation folder.
    collection = [root/'garden/src/site/notes'/entry['note_file'] for entry in inv['inventory']]
    assert all(f.parent == notes and f.is_file() for f in collection)
    assert len({f.name for f in collection}) == len(collection)
    for f in sorted(collection):
        z.writestr(f.name,f.read_text().replace('/img/user/animation/','images/'))
    for f in sorted(assets.glob('*.svg')): z.write(f,'images/'+f.name)
    z.write(root/'garden/docs/animation-source-inventory.json','source-inventory.json')
with zipfile.ZipFile(out/'hades-animation-fa.zip') as z:
    assert z.testzip() is None and len(z.namelist())==51
server=subprocess.Popen(['python','-m','http.server','8767','--bind','127.0.0.1','--directory',str(dist)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        browser=p.chromium.launch()
        results=[]
        for width in [320,390,430,1440]:
            page=browser.new_page(viewport={'width':width,'height':900})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            for slug in ['','principles/','ball-1/','storyboards/','walk-cycle/','camera-shots/','adobe-animate/']:
                url='http://127.0.0.1:8767/fa/blog/notes/animation/'+slug
                res=page.goto(url,wait_until='networkidle')
                assert res.status==200,(url,res.status)
                assert page.locator('html').get_attribute('dir')=='rtl'
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'),(width,url,'overflow')
                for img in page.locator('.animation-study-figure img').all():
                    img.scroll_into_view_if_needed()
                    img.evaluate("(el)=>{el.loading='eager';return el.decode()}")
                    assert img.evaluate('(el)=>el.naturalWidth>0 && el.naturalHeight>0')
                assert not errors,(width,url,errors)
                if slug in ['', 'ball-1/', 'storyboards/']:
                    page.evaluate('window.scrollTo(0,0)')
                    page.screenshot(path=str(out/f'{slug.strip("/") or "index"}-{width}.png'),full_page=True)
                results.append({'width':width,'page':slug,'http':200,'images':page.locator('.animation-study-figure img').count()})
            page.close()
        browser.close()
    (out/'animation-browser-results.json').write_text(json.dumps(results,indent=2))
    print('PASS browser: 28 page/viewport cases; ZIP contains 27 notes, 23 SVGs and source inventory')
finally:
    server.terminate();server.wait()
