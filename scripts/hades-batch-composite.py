from pathlib import Path
from tempfile import TemporaryDirectory
from io import BytesIO
import hashlib, json, zipfile, shutil
from PIL import Image
from playwright.sync_api import sync_playwright

base=Path('hades/library/backgrounds/quiet-courts/transitions')
pagepath=base/'composite-desk/index.html'
sources=[
 ('16x9',base/'HADES_Threshold_30_PNG_PUBLIC_REVIEW.zip'),
 ('9x16',base/'social-ratios/HADES_Lintel_9x16_30_PNG_PUBLIC_REVIEW.zip'),
 ('1x1',base/'social-ratios/HADES_Aperture_1x1_30_PNG_PUBLIC_REVIEW.zip')]
def sha(b): return hashlib.sha256(b).hexdigest()
with TemporaryDirectory() as tmp, sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(accept_downloads=True)
    page.goto(pagepath.resolve().as_uri())
    for loc in ('en','fa'):
        if loc=='fa': page.locator('#lang').click()
        for w in (320,390,430):
            page.set_viewport_size({'width':w,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('#batch').is_visible()
            print('viewport PASS',loc,w)
    page.locator('#lang').click()
    for ratio,source in sources:
        folder=Path(tmp)/ratio;folder.mkdir()
        with zipfile.ZipFile(source) as z:
            names=sorted(n for n in z.namelist() if n.endswith('.png'))
            assert len(names)==30
            data=[z.read(n) for n in names]
            for n,b in zip(names,data): (folder/Path(n).name).write_bytes(b)
        page.locator('#seq').set_input_files(sorted(str(x) for x in folder.glob('*.png')))
        page.wait_for_function('!document.querySelector("#batch").disabled',timeout=60000)
        for mode in ('composite','alpha'):
            page.locator('#batchMode').select_option(mode)
            with page.expect_download(timeout=90000) as dl: page.locator('#batch').click()
            out=folder/f'HADES_{ratio}_{mode}_30frames_REVIEW.zip'
            dl.value.save_as(out)
            with zipfile.ZipFile(out) as z:
                assert z.testzip() is None and len(z.namelist())==31
                m=json.loads(z.read('project.json'))
                assert m['cut']==[14,15] and m['fps']==24 and m['mode']==mode
                for i,item in enumerate(m['outputs']):
                    b=z.read(item['name'])
                    assert sha(b)==item['sha256'] and sha(data[i])==m['source']['sequence'][i]['sha256']
                    im=Image.open(BytesIO(b)).convert('RGBA')
                    assert list(im.size)==m['dimensions']
                    if mode=='alpha': assert b==data[i]
                    else: assert im.getchannel('A').getextrema()==(255,255)
                mf=folder/'project.json';mf.write_bytes(z.read('project.json'))
                page.locator('#relink').set_input_files(str(mf))
                page.wait_for_function('document.querySelector("#batchProgress").textContent.includes("matched")')
                m['source']['sequence'][0]['sha256']='0'*64;mf.write_text(json.dumps(m))
                page.locator('#relink').set_input_files(str(mf))
                page.wait_for_function('document.querySelector("#batchProgress").textContent.includes("mismatch")')
            if mode=='composite':
                for prefix in ('','site/public/'):
                    dest=Path(prefix)/pagepath.parent/out.name
                    shutil.copyfile(out,dest)
            print('batch PASS',ratio,mode,30)
    browser.close()
# Add discoverable links only after the actual files exist.
html=pagepath.read_text()
marker='<!-- batch-proof-links -->'
if marker not in html:
    links=marker+'<section><h2 data-en="Download sample composite sequences" data-fa="دانلود نمونه‌های کامپوزیت"></h2><p data-en="Synthetic proof colors only; no client media." data-fa="فقط رنگ‌های آزمایشی؛ بدون رسانهٔ مشتری."></p>'
    for ratio,_ in sources:
        name=f'HADES_{ratio}_composite_30frames_REVIEW.zip'
        links+=f'<p><a href="/hades/library/backgrounds/quiet-courts/transitions/composite-desk/{name}" download>{ratio} · ZIP · REVIEW</a></p>'
    links+='</section>'
    html=html.replace('</main>',links+'</main>',1)
for prefix in ('','site/public/'):
    for loc in ('','fa/'):
        path=Path(prefix)/'hades'/loc/'library/backgrounds/quiet-courts/transitions/composite-desk/index.html'
        path.write_text(html)
