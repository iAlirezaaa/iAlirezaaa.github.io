#!/usr/bin/env python3
"""Real Chromium QA for the REVIEW bilingual card editor. No fonts/assets fabricated."""
import asyncio, hashlib, json, os, pathlib, socket, subprocess, sys, time
from PIL import Image, ImageOps, ImageDraw, ImageFont
import fitz
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'hades-card-browser-proof'
OUT.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:8123/hades/brand-kit/business-card/micro-editor/'
ORIGINAL = ROOT / 'site/public/hades/assets/B3424A5B-3375-4244-806C-EF9EAA60BDD1.jpeg'
EXPECTED = 'c2189cba968543ed9e86389660d79cd1f031ad87be00eaa65d3b57f8ac0b6d2d'

async def main():
    assert ORIGINAL.is_file(), 'Exact published original is missing'
    assert hashlib.sha256(ORIGINAL.read_bytes()).hexdigest() == EXPECTED, 'Owner original SHA drift'
    proc = subprocess.Popen([sys.executable, '-m', 'http.server', '8123', '--bind', '127.0.0.1', '--directory', str(ROOT/'site/public')], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    data = []
    screenshots=[]
    try:
        for _ in range(50):
            try:
                with socket.create_connection(('127.0.0.1', 8123),timeout=0.4): break
            except OSError: await asyncio.sleep(0.12)
        else: raise RuntimeError('Server failed to bind')
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            for w in [320,390,430]:
                page = await browser.new_page(viewport={'width':w, 'height':800}, device_scale_factor=1, accept_downloads=True)
                response = await page.goto(URL,wait_until='networkidle')
                assert response.status == 200
                info = await page.evaluate('''() => ({
                    sw:document.documentElement.scrollWidth, vw:innerWidth, 
                    naturalWidth:document.getElementById("original").naturalWidth,
                    loadedMikhak:document.fonts.check('12px "Mikhak Local"','متن')
                })''')
                assert info['sw'] <= info['vw']+1, ('Overflow',w,info)
                assert info['naturalWidth'] == 1254, ('Original not decoded',w,info)
                await page.locator('#en').fill('HADES WORKING CARD')
                await page.locator('#fa').fill('نمونهٔ فارسی هادس')
                await page.locator('#role').fill('Creative direction')
                await page.locator('#contact').fill('hello@example.com')
                await page.locator('#reference').fill('HADES / TEST')
                assert await page.locator('#out-fa').inner_text() == 'نمونهٔ فارسی هادس'
                async with page.expect_download() as item: await page.locator('#save').click()
                project = await item.value
                project_file = OUT / ('project-'+str(w)+'.json')
                await project.save_as(project_file)
                restored = json.loads(project_file.read_text('utf-8'))
                assert restored['schema']=='hades-card-review-v1' and restored['status']=='REVIEW'
                await page.locator('#en').fill('REPLACED')
                await page.locator('#project').set_input_files({'name':'card.json','mimeType':'application/json','buffer':project_file.read_bytes()})
                await page.wait_for_function("() => document.getElementById('out-en').textContent === 'HADES WORKING CARD'", timeout=10000)
                invalid = dict(restored,status='FINAL')
                await page.locator('#project').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
                await page.wait_for_function("() => document.getElementById('status').textContent.includes('HOLD')", timeout=10000)
                exported = {}
                for side in ['front','back']:
                    async with page.expect_download(timeout=15000) as done:
                        await page.locator('#'+side+'png').click()
                    dl = await done.value
                    out = OUT / (side+'-'+str(w)+'.png')
                    await dl.save_as(out)
                    with Image.open(out) as im:
                        assert im.format=='PNG' and im.size == (1004,650), (side,w,im.size)
                    exported[side] = out.name
                shot=OUT / ('browser-'+str(w)+'.png')
                await page.screenshot(path=str(shot),full_page=True)
                screenshots.append(shot)
                if w==390:
                    blob=await page.pdf(prefer_css_page_size=True,print_background=True)
                    (OUT/'HADES_Card_85x55_2side_REVIEW.pdf').write_bytes(blob)
                    d=fitz.open(stream=blob,filetype='pdf')
                    assert len(d)==2, ('Expected two physical pages',len(d))
                    dims=[(round(x.rect.width,2),round(x.rect.height,2)) for x in d]
                    for width_pt,height_pt in dims: 
                        assert abs(width_pt-85*72/25.4)<1.5 and abs(height_pt-55*72/25.4)<1.5, dims
                # Real, upstream-font browser proof: no font binary is attached or committed.
                local_font = pathlib.Path('/tmp/HADES_Mikhak-Regular.ttf')
                assert local_font.is_file() and local_font.stat().st_size > 70000, 'Real Mikhak source not downloaded'
                await page.locator('#fontfile').set_input_files(str(local_font))
                await page.wait_for_function("() => document.getElementById('status').textContent.includes('Mikhak LOADED')",timeout=20000)
                face_status = await page.evaluate("""() => [...document.fonts].filter(f=>f.family==='Mikhak Local').map(f=>f.status)""")
                assert 'loaded' in face_status, ('FontFace not loaded',w,face_status)
                cdp=await page.context.new_cdp_session(page)
                await cdp.send('DOM.enable')
                await cdp.send('CSS.enable')
                dom=await cdp.send('DOM.getDocument')
                node=await cdp.send('DOM.querySelector',{'nodeId':dom['root']['nodeId'],'selector':'#out-fa'})
                await page.wait_for_function("() => getComputedStyle(document.getElementById('out-fa')).fontFamily.toLowerCase().includes('mikhak local')",timeout=10000)
                await page.evaluate("""async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }""")
                families=[]
                for _ in range(30):
                    fonts=await cdp.send('CSS.getPlatformFontsForNode',{'nodeId':node['nodeId']})
                    families=[f['familyName'] for f in fonts['fonts']]
                    if any('mikhak' in name.lower() for name in families):break
                    await page.wait_for_timeout(200)
                assert any('mikhak' in name.lower() for name in families), ('Font was loaded but glyph rendering fell back despite repaint',w,families)
                await page.screenshot(path=str(OUT/('browser-mikhak-'+str(w)+'.png')),full_page=True)
                async with page.expect_download(timeout=15000) as item:
                    await page.locator('#backpng').click()
                downloaded=await item.value
                mikhak_png=OUT/('back-mikhak-'+str(w)+'.png')
                await downloaded.save_as(mikhak_png)
                with Image.open(mikhak_png) as im:
                    assert im.format=='PNG' and im.size==(1004,650)
                data.append(dict(width=w,overflow=False,logo_natural_width=info['naturalWidth'],mikhak={'actual_used_families':families,'ttf_sha256':hashlib.sha256(local_font.read_bytes()).hexdigest(),'browser_loaded':True,'not_finally_approved':True},saved_json=True,reopened_json=True,rejected_final=True,front_png=exported['front'],back_png=exported['back'],mikhak_back_png=mikhak_png.name,screenshot=shot.name))
                await page.close()
            await browser.close()
        images=[]
        for path in screenshots:
            im=Image.open(path).convert('RGB')
            scaled=im.resize((360, round(im.height*360/im.width)),Image.Resampling.LANCZOS)
            images.append(scaled)
        h=max(x.height for x in images)
        canvas=Image.new('RGB',(3*380+40,h+120),'#11100f')
        draw=ImageDraw.Draw(canvas)
        draw.text((25,20),'HADES · 320 / 390 / 430 CSS px · CHROMIUM · REVIEW',fill='#f0e5d6')
        for i,(im,w) in enumerate(zip(images,[320,390,430])):
            canvas.paste(im,(20+380*i,70));draw.text((20+380*i,canvas.height-35),str(w)+'px / real browser',fill='#dbcfc1')
        canvas.save(OUT/'HADES_Card_Chromium_320_390_430_INLINE_REVIEW.png')
        summary={'status':'PASS — real Chromium 320/390/430 with locally loaded upstream Mikhak and no physical print certification','original_sha256':EXPECTED,'results':data,'paper_pdf':'HADES_Card_85x55_2side_REVIEW.pdf','not_tested':['micro-logo internal character legibility','physical card printer','owner typeface approval']}
        (OUT/'results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(summary,ensure_ascii=False,indent=2))
    finally:
        proc.terminate()
        try: proc.wait(timeout=4)
        except subprocess.TimeoutExpired: proc.kill()

if __name__=='__main__':
    asyncio.run(main())
