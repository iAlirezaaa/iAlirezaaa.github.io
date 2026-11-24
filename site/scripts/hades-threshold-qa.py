from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io, zipfile, hashlib, json, math, sys, time, urllib.request, shutil
root=Path("hades/library/backgrounds/quiet-courts/transitions")
fa=Path("hades/fa/library/backgrounds/quiet-courts/transitions")
mirror=Path("site/public")
sample="HADES_Threshold_30_PNG_PUBLIC_REVIEW.zip"
svgzip="HADES_Threshold_6_SVG_PUBLIC_REVIEW.zip"
assets=sorted(root.glob("*.svg"))
pages=[root/"index.html",fa/"index.html"]
nav=[Path("hades")/prefix/suffix for prefix in ("","fa") for suffix in ("index.html","library/index.html","brand-kit/logo-usage/index.html","library/backgrounds/quiet-courts/index.html")]
def digest(x): return hashlib.sha256(x).hexdigest()
def check():
    assert len(assets)==6
    for path in assets+pages+[root/svgzip]+nav:
        assert path.read_bytes()==(mirror/path).read_bytes(),path
    with zipfile.ZipFile(root/svgzip) as z:
        assert z.testzip() is None and set(z.namelist())=={a.name for a in assets}
        for a in assets: assert z.read(a.name)==a.read_bytes()
    for p in nav:
        assert "hades-architectural-threshold-review" in p.read_text()
    print("PASS: source/publish mirrors, eight navigation pages, actual SVG ZIP CRC and bytes")
def render():
    frames={}
    with sync_playwright() as pw:
        b=pw.chromium.launch()
        for a in assets:
            phase,ratio=a.name.split("_")[2:4]
            w,h={"16x9":(1920,1080),"9x16":(1080,1920),"1x1":(1080,1080)}[ratio]
            page=b.new_page(viewport={"width":w,"height":h},device_scale_factor=1)
            page.set_content("<style>html,body{margin:0;background:transparent}svg{display:block}</style>"+a.read_text())
            page.evaluate("document.querySelector('svg').pauseAnimations()")
            for i in range(15):
                page.evaluate('(t)=>document.querySelector("svg").setCurrentTime(t)',i/24+0.00001)
                t=i/14 if phase=="IN" else 1-i/14
                p=t*t*(3-2*t)
                for side,sign in [("left",-1),("right",1)]:
                    actual=page.evaluate("(s)=>document.querySelector('#'+s).transform.animVal.getItem(0).matrix.e",side)
                    assert abs(actual-math.floor(sign*w*(1-p)+.5))<.1,(a,i,side,actual)
                if i in (0,14) or ratio=="16x9":
                    raw=page.screenshot(omit_background=True)
                    im=Image.open(io.BytesIO(raw)).convert("RGBA")
                    buf=io.BytesIO();im.save(buf,format="PNG");raw=buf.getvalue()
                    assert im.mode=="RGBA" and im.size==(w,h)
                    ext=im.getchannel("A").getextrema()
                    if i in (0,14): assert ext==((0,0) if (i==0)==(phase=="IN") else (255,255)),(a,i,ext)
                    if ratio=="16x9": frames[i+(0 if phase=="IN" else 15)]=raw
            page.close()
        for path in pages:
            for width in (320,390,430):
                page=b.new_page(viewport={"width":width,"height":900})
                page.set_content(path.read_text())
                page.wait_for_selector("#stage svg")
                assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                assert page.locator("html").get_attribute("dir")==("rtl" if path==pages[1] else "ltr")
                for ratio in ("16x9","9x16","1x1"):
                    page.select_option("#ratio",ratio)
                    for f in (0,14,15,29):
                        page.locator("#seek").evaluate("(e,f)=>{e.value=f;e.dispatchEvent(new Event('input'))}",f)
                        v=page.locator("#left").get_attribute("transform")
                        assert (v=="translate(0 0)")== (f in (14,15)),(path,width,ratio,f,v)
                page.close()
        b.close()
    assert len(frames)==30
    with zipfile.ZipFile(root/sample,"w",zipfile.ZIP_DEFLATED) as z:
        manifest={}
        for i,raw in sorted(frames.items()):
            name=f"HADES_Threshold_{i:04}.png"
            z.writestr(name,raw);manifest[name]=digest(raw)
        z.writestr("manifest.json",json.dumps({"fps":24,"frames":30,"size":[1920,1080],"cut_between":[14,15],"alpha":"straight","sha256":manifest},indent=2))
    with zipfile.ZipFile(root/sample) as z:
        assert z.testzip() is None and len(z.namelist())==31
        m=json.loads(z.read("manifest.json"))
        for name,sha in m["sha256"].items():
            raw=z.read(name);assert digest(raw)==sha
            im=Image.open(io.BytesIO(raw));im.load();assert im.size==(1920,1080) and im.mode=="RGBA"
    shutil.copyfile(root/sample,mirror/root/sample)
    for path in pages:
        link='<p id="threshold-native-sample"><a download href="/'+str(root/sample)+'">'+("دانلود ۳۰ تصویر شفاف PNG · ۲۴ فریم‌برثانیه" if path==pages[1] else "Download 30 transparent PNG frames · 24 fps")+'</a></p>'
        s=path.read_text()
        if 'id="threshold-native-sample"' not in s: s=s.replace("</main>",link+"</main>")
        path.write_text(s);(mirror/path).write_text(s)
    print("PASS: 180 animated transform samples, 12 full/empty alpha endpoints, 6 mobile viewports, 30 decoded native RGBA images and ZIP")
def hosted():
    paths=assets+pages+[root/svgzip,root/sample]+nav
    for attempt in range(15):
        failures=[]
        for path in paths:
            url="https://ialirezaaa.github.io/"+str(path).removesuffix("index.html")
            try:
                req=urllib.request.Request(url+"?threshold-proof="+str(int(time.time())),headers={"User-Agent":"HADES-public-QA/1","Cache-Control":"no-cache"})
                with urllib.request.urlopen(req,timeout=15) as r:
                    mime=r.headers.get_content_type()
                    expected={".svg":"image/svg+xml",".html":"text/html",".zip":"application/zip"}[path.suffix]
                    if r.status!=200 or mime!=expected or digest(r.read())!=digest(path.read_bytes()): raise ValueError("status/mime/hash mismatch "+mime)
                print("HTTP 200 MIME SHA256 PASS",url)
            except Exception as e: failures.append((url,str(e)))
        if not failures:
            print("Independent public verification",len(paths),"/",len(paths),"PASS");return
        print("OPEN",attempt+1,failures,flush=True);time.sleep(25)
    raise SystemExit("Hosted verification failed")
if __name__=="__main__":
    if sys.argv[1]=="local": check();render();check()
    elif sys.argv[1]=="hosted": hosted()
    else: raise SystemExit("use local or hosted")
