from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import hashlib, io, json, zipfile, shutil
BASE=Path('hades/library/backgrounds/quiet-courts/transitions')
OUT=BASE/'social-ratios'
OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(device_scale_factor=1)
    for kind,folder in [('Threshold',BASE),('Lintel',BASE/'lintel'),('Aperture',BASE/'aperture')]:
        for ratio,w,h in [('9x16',1080,1920),('1x1',1080,1080)]:
            names=[f'HADES_{kind}_{phase}{ratio}_PUBLIC_REVIEW.svg' for phase in (['IN_','OUT_'] if kind=='Threshold' else [''])]
            sources=[(folder/n).read_bytes() for n in names]
            manifest={'status':'PUBLIC REVIEW','transition':kind,'dimensions':[w,h],'fps':24,'frame_count':30,'cut_between':[14,15],'alpha':'straight','sources':{n:hashlib.sha256(s).hexdigest() for n,s in zip(names,sources)},'sha256':{}}
            dest=OUT/f'HADES_{kind}_{ratio}_30_PNG_PUBLIC_REVIEW.zip'
            page.set_viewport_size({'width':w,'height':h})
            areas=[]
            with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
                last=-1
                for n in range(30):
                    idx=int(n>=15) if kind=='Threshold' else 0
                    if idx!=last:
                        page.set_content('<style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style>'+sources[idx].decode())
                        page.evaluate('document.querySelector("svg").pauseAnimations()');last=idx
                    t=((n%15)+0.1)/24 if kind=='Threshold' else (n+.5)/24
                    page.evaluate('(t)=>document.querySelector("svg").setCurrentTime(t)',t)
                    im=Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert('RGBA')
                    assert im.size==(w,h)
                    a=im.getchannel('A');alpha=a.getextrema();areas.append(sum(i*v for i,v in enumerate(a.histogram())))
                    if n in (0,29):assert alpha==(0,0),(kind,ratio,n,alpha)
                    if n in (14,15):assert alpha==(255,255),(kind,ratio,n,alpha)
                    buf=io.BytesIO();im.save(buf,format='PNG');data=buf.getvalue();name=f'frame_{n:04}.png'
                    z.writestr(name,data);manifest['sha256'][name]=hashlib.sha256(data).hexdigest()
                assert areas[:15]==sorted(areas[:15]) and areas[15:]==sorted(areas[15:],reverse=True), (kind,ratio,areas)
                z.writestr('manifest.json',json.dumps(manifest,indent=2))
            with zipfile.ZipFile(dest) as z:
                assert len(z.namelist())==31 and z.testzip() is None
                for n,sha in manifest['sha256'].items():
                    data=z.read(n);assert hashlib.sha256(data).hexdigest()==sha
                    with Image.open(io.BytesIO(data)) as im: assert im.mode=='RGBA' and im.size==(w,h);im.load()
            shutil.copyfile(dest,Path('site/public')/dest)
            print('native PASS',kind,ratio,30)
    for folder in [OUT,Path('hades/fa/library/backgrounds/quiet-courts/transitions/social-ratios')]:
        path=folder/'index.html'; html=path.read_text()
        for kind in ['Threshold','Lintel','Aperture']:
            for ratio in ['9x16','1x1']:
                name=f'HADES_{kind}_{ratio}_30_PNG_PUBLIC_REVIEW.zip'
                marker=f'<!--PNG:{kind}:{ratio}-->'
                if marker in html:html=html.replace(marker,f'<a download href="/{OUT}/{name}">PNG ZIP · {ratio}</a>')
        html=html.replace('<!--PENDING-->','')
        path.write_text(html);shutil.copyfile(path,Path('site/public')/path)
        for width in [320,390,430]:
            page.set_viewport_size({'width':width,'height':844})
            page.goto(path.resolve().as_uri())
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert page.locator('a[download]').count()==6
            print('responsive PASS',path,width)
    browser.close()
