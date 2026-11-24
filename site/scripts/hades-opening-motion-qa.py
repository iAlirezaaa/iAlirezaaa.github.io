import base64,hashlib,io,json,mimetypes,re,shutil,sys,time,urllib.parse,urllib.request,zipfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
base=Path("hades/library/backgrounds/quiet-courts/opening-titles")
dest=base/"motion-presets"
fa=Path("hades/fa/library/backgrounds/quiet-courts/opening-titles/motion-presets")
sys.path.insert(0,str(dest.resolve()))
from export_opening import export,recipe
def sha(x):return hashlib.sha256(x).hexdigest()
def files():
    out=[x for x in dest.iterdir() if x.is_file()]+[fa/"index.html",base/"index.html",fa.parent/"index.html"]
    for x in out:assert x.read_bytes()==(Path("site/public")/x).read_bytes(),x
    return out
def local():
    assert json.loads((dest/"opening-presets.REVIEW.json").read_text())["presets"]==[recipe(f,s) for f in (24,25,30) for s in (3,5,8)]
    r=recipe(25,5)
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for svg in sorted(dest.glob("*.svg")):
            source=svg.read_text()
            assert sha(base64.b64decode(re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)",source).group(1)))=="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
            page=browser.new_page();page.set_content(source)
            page.evaluate('document.querySelector("svg").pauseAnimations()')
            for i in range(125):
                v=page.evaluate('(t)=>{const s=document.querySelector("svg");s.setCurrentTime(t);return Number(getComputedStyle(s.querySelector("#opening-motion")).opacity)}',(i+.5)/25)
                assert abs(v-r["opacity_millionths"][i]/1000000)<1.1e-6,(svg,i,v)
            page.close()
        def route(route):
            x=Path(urllib.parse.urlsplit(route.request.url).path.lstrip("/"))
            if x.is_dir():x=x/"index.html"
            if x.is_file():route.fulfill(status=200,body=x.read_bytes(),content_type=mimetypes.guess_type(x)[0] or "application/octet-stream")
            else:route.fulfill(status=404,body="Not found")
        for loc in (dest,fa):
            for width in (320,390,430):
                page=browser.new_page(viewport={"width":width,"height":900})
                page.route("https://hades.test/**",route);errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
                page.goto("https://hades.test/"+str(loc)+"/")
                page.locator("#art").evaluate("el=>el.decode()")
                assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"),(loc,width)
                for ratio in ("9x16","1x1","16x9"):
                    page.locator("#ratio").select_option(ratio)
                    page.locator("#play").click()
                    page.locator("#art").evaluate("el=>el.decode()")
                    assert ratio in page.locator("#art").get_attribute("src") and "Opening_Motion" in page.locator("#art").get_attribute("src")
                    page.locator("#still").click()
                    assert "Architectural_Opening" in page.locator("#art").get_attribute("src")
                page.emulate_media(reduced_motion="reduce");page.locator("#play").click()
                assert "Architectural_Opening" in page.locator("#art").get_attribute("src") and not errors,errors
                for a in page.locator("a[href]").all():
                    x=Path(a.get_attribute("href").lstrip("/"));assert x.is_file() or (x/"index.html").is_file(),x
                print("PASS browser",loc,width);page.close()
        browser.close()
    print("PASS 750 SVG frame checkpoints and nine recipes; mirrors",len(files()))
def binary():
    src=base/"raster/HADES_Architectural_Opening_EN_16x9_PUBLIC_REVIEW.png"
    manifest=base/"raster/HADES_Opening_Native_Manifest_REVIEW.json"
    sample=dest/"HADES_Opening_Motion_EN_16x9_24fps_3s_PUBLIC_REVIEW.zip"
    pack=dest/"HADES_Opening_Motion_6_SVG_PUBLIC_REVIEW.zip"
    sample.unlink(missing_ok=True)
    r=export(src,manifest,sample,24,3)
    with Image.open(src) as original,zipfile.ZipFile(sample) as z:
        assert z.testzip() is None and len(z.namelist())==73
        m=json.loads(z.read("manifest.REVIEW.json"));assert m["source_sha256"]==sha(src.read_bytes())
        alpha=original.getchannel("A");rgb=original.convert("RGB").tobytes()
        for row,v in zip(m["frames"],r["opacity_millionths"]):
            raw=z.read(row["file"]);assert sha(raw)==row["sha256"]
            with Image.open(io.BytesIO(raw)) as im:
                assert im.mode=="RGBA" and im.size==original.size and im.convert("RGB").tobytes()==rgb
                assert im.getchannel("A").tobytes()==alpha.point([(x*v+500000)//1000000 for x in range(256)]).tobytes()
    with zipfile.ZipFile(pack,"w",compression=zipfile.ZIP_DEFLATED) as z:
        for x in sorted(dest.glob("*.svg"))+[dest/"opening-presets.REVIEW.json",dest/"export_opening.py"]:z.write(x,x.name)
    with zipfile.ZipFile(pack) as z:assert z.testzip() is None and len(z.namelist())==8
    for x in (sample,pack):shutil.copy2(x,Path("site/public")/x)
    for loc in (dest,fa):
        x=loc/"index.html";html=x.read_text()
        if 'id="motion-pack"' not in html:
            t1="دانلود بسته شش SVG متحرک" if loc==fa else "Download six animated SVGs"
            t2="نمونه ۷۲ فریم PNG شفاف" if loc==fa else "72-frame transparent PNG sample"
            html=html.replace("<small>",f'<p id="motion-pack"><a download href="/{pack}">{t1}</a> · <a download href="/{sample}">{t2}</a></p><small>',1);x.write_text(html)
        shutil.copy2(x,Path("site/public")/x)
    print("PASS 72 native straight-alpha frames and eight-member pack")
def hosted():
    for attempt in range(24):
        try:
            for x in files():
                req=urllib.request.Request("https://ialirezaaa.github.io/"+str(x),headers={"Cache-Control":"no-cache","User-Agent":"HADES QA"})
                with urllib.request.urlopen(req,timeout=20) as res:
                    assert res.status==200
                    ct=res.headers.get_content_type()
                    if x.suffix==".svg":assert ct=="image/svg+xml",ct
                    if x.suffix==".zip":assert ct in ("application/zip","application/x-zip-compressed","application/octet-stream"),ct
                    if x.suffix!=".html":assert ct!="text/html",ct
                    assert sha(res.read())==sha(x.read_bytes()),x
            print("PASS independent HTTP 200 MIME SHA256",len(files()));return
        except Exception as e:print("retry",attempt,str(e));time.sleep(20)
    raise RuntimeError("Independent public access not confirmed")
if __name__=="__main__":{"local":local,"binary":binary,"hosted":hosted}[sys.argv[1]]()
