"""Render the six previously reviewed chapter SVGs to native-size raster delivery files."""
import asyncio, base64, hashlib, json, shutil, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image
from playwright.async_api import async_playwright

root=Path('hades/library/backgrounds/quiet-courts/chapter-divider')
mirror=Path('site/public')/root
prefix='HADES_Quiet_Courts_Chapter_Divider_'
expected={
'EN_16x9':'bbe27e24d423d9d2111f9bb51d96c9245dd8cb09',
'EN_9x16':'15930e855c6055673189a1fa9d3ec155055ea989',
'EN_1x1':'4eae88ac10cb369d6fbc78fc18247a15aef969da',
'FA_16x9':'61477e7029dca0fe2e67adfabaf0f9404677590d',
'FA_9x16':'808d75b184cbd93204c2b0be9363151625095f85',
'FA_1x1':'d1b89537cd4f0018838ddd2260809124afa717fe'}
out=root/'raster'
pack='HADES_Chapter_Divider_6_SVG_18_Rasters_PUBLIC_REVIEW.zip'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dims(key):return (1920,1080) if '16x9' in key else (1080,1920) if '9x16' in key else (1080,1080)
original=Path('hades/assets/IMG_7187(2).png').read_bytes()
assert hashlib.sha256(original).hexdigest()=='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
async def main():
    out.mkdir(parents=True,exist_ok=True)
    records=[]
    async with async_playwright() as pw:
        b=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        for key,sha in sorted(expected.items()):
            name=prefix+key+'_PUBLIC_REVIEW'
            src=root/(name+'.svg')
            assert src.read_bytes()==(mirror/src.name).read_bytes()
            assert subprocess.check_output(['git','hash-object',str(src)],text=True).strip()==sha
            doc=ET.parse(src); ns={'s':'http://www.w3.org/2000/svg'}
            assert len(doc.findall('.//s:image',ns))==1
            assert base64.b64decode(doc.find('.//s:image',ns).attrib['href'].split(',')[1])==original
            width,height=dims(key)
            page=await b.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
            await page.goto('http://127.0.0.1:8782/'+str(src))
            await page.evaluate('document.fonts.ready')
            await page.screenshot(path=str(out/(name+'.png')),animations='disabled')
            await page.close()
            im=Image.open(out/(name+'.png')).convert('RGB')
            assert im.size==(width,height)
            im.save(out/(name+'.jpg'),quality=95,subsampling=0)
            im.save(out/(name+'.webp'),lossless=True,method=6)
            for ext in ('png','jpg','webp'):
                p=out/(name+'.'+ext)
                with Image.open(p) as check:
                    check.load(); assert check.size==(width,height)
                    if ext!='jpg':assert check.convert('RGB').tobytes()==im.tobytes()
                records.append({'file':p.name,'width':width,'height':height,'sha256':digest(p),'source_sha256':digest(src)})
            print('PASS',key,width,height,'PNG/WebP RGB exact; JPEG decoded')
        await b.close()
    (out/'manifest.REVIEW.json').write_text(json.dumps({'status':'PUBLIC REVIEW NOT FINAL','files':records},indent=2)+'\n')
    (out/'README.txt').write_text('HADES Quiet Courts chapter dividers. PUBLIC REVIEW only. Six editable SVGs plus native PNG, JPEG quality 95 4:4:4 and lossless WebP. Original raster mark unchanged in each SVG. Fonts and neutral colors proposed; Mikhak, physical phone and print OPEN. Only #EF4B32 approved.\n')
    with ZipFile(out/pack,'w',ZIP_DEFLATED) as z:
        for key in sorted(expected):
            f=root/(prefix+key+'_PUBLIC_REVIEW.svg');z.write(f,f.name)
        for f in sorted(out.iterdir()):
            if f.name!=pack:z.write(f,f.name)
    with ZipFile(out/pack) as z:assert z.testzip() is None and len(z.namelist())==26
    shutil.copytree(out,mirror/'raster',dirs_exist_ok=True)
    for lang in ('en','fa'):
        p=(Path('hades/fa')/Path(*root.parts[1:]) if lang=='fa' else root)/'index.html'
        src=p.read_text()
        assert 'id="native-raster-pack"' not in src
        url='/'+str(out)+'/'
        heading='دریافت بستهٔ رستر در اندازهٔ اصلی' if lang=='fa' else 'Native raster download pack'
        desc='شش SVG و ۱۸ تصویر؛ PNG و WebP بدون افت، JPEG با کیفیت ۹۵. تایپ و رنگ‌های خنثی پیشنهادی‌اند.' if lang=='fa' else 'Six SVGs and 18 native images: PNG, lossless WebP and quality-95 JPEG. Fonts and neutrals remain proposed.'
        links=''.join('<p><bdi>'+key+'</bdi> · '+' · '.join('<a href="'+url+prefix+key+'_PUBLIC_REVIEW.'+ext+'">'+ext.upper()+'</a>' for ext in ('png','jpg','webp'))+'</p>' for key in sorted(expected))
        section='<section id="native-raster-pack"><h2>'+heading+'</h2><p>'+desc+'</p><p><a href="'+url+pack+'">ZIP (26 files)</a> · <a href="'+url+'manifest.REVIEW.json">SHA-256 manifest</a></p>'+links+'</section>'
        assert '<div class="grid">' in src
        p.write_text(src.replace('<div class="grid">',section+'<div class="grid">',1))
        (Path('site/public')/p).write_bytes(p.read_bytes())
    async with async_playwright() as pw:
        b=await pw.chromium.launch(headless=True,args=['--no-sandbox'])
        for lang in ('en','fa'):
            for width in (320,390,430):
                page=await b.new_page(viewport={'width':width,'height':920})
                await page.goto('http://127.0.0.1:8782/hades/'+('fa/' if lang=='fa' else '')+'/'.join(root.parts[1:])+'/')
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                assert await page.locator('#native-raster-pack a').count()==20
                assert await page.locator('html').get_attribute('lang')==lang
                await page.close()
        await b.close()
    print('PASS 18 decoded files, ZIP CRC, six responsive Chromium sessions')
if __name__=='__main__':asyncio.run(main())
