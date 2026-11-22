#!/usr/bin/env python3
"""Produce real Chromium-rendered, physical-A4 PDF/PNG from protected-source Portico SVGs. PUBLIC REVIEW."""
from pathlib import Path
import base64, hashlib, io, json, zipfile, xml.etree.ElementTree as ET
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
REL=Path('library/portico-studies/print-proof')
SRC=ROOT/'hades'/REL
DST=[ROOT/'hades'/REL,ROOT/'site/public/hades'/REL]
OWNER=ROOT/'hades/assets/IMG_7187(2).png'
OWNER_SHA='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
PREFIX='HADES_Portico_A4'
NS='{http://www.w3.org/2000/svg}'

def sha(data):return hashlib.sha256(data).hexdigest()
def guarded_svg(lang):
    raw=(SRC/f'{PREFIX}_Compare_{lang}_REVIEW.svg').read_bytes()
    assert sha(OWNER.read_bytes())==OWNER_SHA,'owner original changed'
    doc=ET.fromstring(raw)
    assert doc.attrib['width']=='210mm' and doc.attrib['height']=='297mm'
    images=list(doc.iter(NS+'image'))
    assert len(images)==2
    for im in images:
        u=im.attrib['href']
        assert base64.b64decode(u.partition(',')[2],validate=True)==OWNER.read_bytes()
    return raw

def write(name,data):
    for root in DST:
        p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    assert (DST[0]/name).read_bytes()==(DST[1]/name).read_bytes()
    return name

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def main():
    files={}
    server=ThreadingHTTPServer(('127.0.0.1',8996),lambda *a,**kw:Quiet(*a,directory=str(ROOT),**kw))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            for lang in ('EN','FA'):
                original=guarded_svg(lang)
                svgName=f'{PREFIX}_Compare_{lang}_REVIEW.svg'
                files[svgName]=original
                # A4 exact CSS geometry: 210mm x 297mm, unscaled. The nested source SVG is rendered with Chromium
                # so Persian receives browser shaping. CairoSVG's FA preview is not used as print evidence.
                url=f'http://127.0.0.1:8996/hades/{REL}/{svgName}'
                doc=f'''<!DOCTYPE html><html><head><meta charset="utf-8">
                <style>@page {{size:A4;margin:0}} html,body{{margin:0;padding:0;width:210mm;height:297mm}}
                img{{width:210mm;height:297mm;display:block}}</style></head><body>
                <img src="{url}" alt="HADES Portico A4 original source public review"></body></html>'''
                page=browser.new_page(viewport={'width':794,'height':1123},device_scale_factor=2)
                page.set_content(doc,wait_until='load',timeout=60000)
                page.locator('img').evaluate('(e)=>e.decode()')
                assert page.locator('img').evaluate('(e)=>e.naturalWidth > 0')
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                png=page.screenshot(full_page=True)
                pdf=page.pdf(width='210mm',height='297mm',print_background=True,
                             margin={'top':'0','bottom':'0','left':'0','right':'0'},
                             prefer_css_page_size=True)
                reader=PdfReader(io.BytesIO(pdf))
                assert len(reader.pages)==1,lang
                box=reader.pages[0].mediabox
                assert abs(float(box.width)-595.28)<1 and abs(float(box.height)-841.89)<1,(lang,box)
                pdfName=f'{PREFIX}_Print_{lang}_REVIEW.pdf'
                pngName=f'{PREFIX}_Chromium_{lang}_REVIEW.png'
                files[pdfName]=pdf;files[pngName]=png
                write(pdfName,pdf);write(pngName,png)
                print('PASS protected source Chromium A4',lang,'PDF',len(pdf),'PNG',len(png),'paper',float(box.width),float(box.height))
                page.close()
            browser.close()
    finally:
        server.shutdown()
    guide=('HADES Portico A4 Print and Phone Optical Specimens / PUBLIC REVIEW\n'
           'These are browser-rendered digital A4 outputs. Print at Actual Size 100%, measure the 50mm vector ruler with a real physical ruler; physical testing remains OPEN.\n'
           'Original owned logo PNG is embedded unchanged twice in the source SVGs. Only #EF4B32 is owner approved; neutrals and fonts proposals. No licensed Mikhak tested. No FINAL.\n'
           'Human 48/96 CSS px results must be separately recorded on the bilingual observation page.\n').encode()
    files['README_PRINT_REVIEW.txt']=guide
    manifest={'status':'PUBLIC REVIEW','generated_from':'Chromium A4 exact source SVGs','physical_print':'OPEN',
              'human_phone_48_96':'OPEN','mikhak_real':'OPEN','only_approved_color':'#EF4B32',
              'files':{name:{'sha256':sha(data),'bytes':len(data)} for name,data in sorted(files.items())}}
    mbytes=(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n').encode()
    mname=f'{PREFIX}_Binary_Manifest_REVIEW.json'
    write(mname,mbytes)
    files[mname]=mbytes
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for name,data in sorted(files.items()):z.writestr(name,data)
    zipdata=buf.getvalue()
    with zipfile.ZipFile(io.BytesIO(zipdata)) as z:
        assert z.testzip() is None and len(z.namelist())==len(files)
        for name in files:assert z.read(name)==files[name]
    zipname=f'{PREFIX}_Print_Pack_REVIEW.zip'
    write(zipname,zipdata)
    print('PASS ZIP bytes CRC',len(files),'pack',len(zipdata))
    for name in files:
        if name.startswith(PREFIX) and name.endswith('.svg'):
            assert files[name]==(SRC/name).read_bytes()
    print('PASS all generated binaries mirrored; no original logos touched')

if __name__=='__main__':main()
