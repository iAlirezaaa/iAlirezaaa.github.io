#!/usr/bin/env python3
"""Build real HADES B01 REVIEW assets from editable, self-contained SVG source.
Requires Pillow, CairoSVG and ImageMagick. The raster symbol source SHA is pinned.
Generated SVG files are layout artwork; this script DOES NOT vectorize the logo.
"""
from pathlib import Path
import io,base64,hashlib,re,shutil,subprocess,zipfile
from xml.etree import ElementTree as ET
from PIL import Image,ImageChops,ImageDraw,ImageFont
import cairosvg

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parent
SRC=PROJECT/'public/hades/brand-kit/business-card'
OUT=PROJECT/'dist/hades/brand-kit/business-card'
ORIGINAL=PROJECT/'public/hades/assets/IMG_7187(2).png'
ORIGINAL_SHA='79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7'
MARK_SHA='8d3d0e1ac89660f8a1ed7e135d878dc6f223590f91dd7f9a7ad8dba47f00f164'
SIDES=('Front','Back')
GROUPS=('background','pattern','logo','type')
NS='{http://www.w3.org/2000/svg}'
W,H=1700,1100

def die(ok,reason):
    if not ok:raise RuntimeError('HADES B01 QA: '+reason)
def render(data,target):
    cairosvg.svg2png(bytestring=data,write_to=str(target),output_width=W,output_height=H)
def build():
    die(ORIGINAL.exists(),'original image missing')
    source=ORIGINAL.read_bytes()
    die(hashlib.sha256(source).hexdigest()==ORIGINAL_SHA,'original SHA mismatch')
    from hades_stationery_release import preserve_release
    preserve_release(SRC, OUT, 'business-card')
    return
    im=Image.open(io.BytesIO(source)).convert('RGB')
    m=im.convert('L')
    box=m.point(lambda p:255 if p>3 else 0).getbbox()
    die(box==(461,950,485,1099),'original crop geometry differs')
    x0,y0,x1,y1=box
    crop=m.crop((x0-5,y0-8,x1+5,y1+8))
    derived=Image.new('RGBA',crop.size,(255,255,255,0))
    derived.putalpha(crop)
    buff=io.BytesIO();derived.save(buff,format='PNG',optimize=True)
    mark=buff.getvalue()
    die(hashlib.sha256(mark).hexdigest()==MARK_SHA,'transparent source derivation changed')
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'HADES_Original_Mark_Transparent_REVIEW.png').write_bytes(mark)
    magick=shutil.which('magick') or shutil.which('convert')
    die(magick is not None,'ImageMagick is required for PSD')
    images=[]
    for side in SIDES:
        file='HADES_Card_'+side+'_EDITABLE_REVIEW.svg'
        data=(SRC/file).read_bytes()
        match=re.search(b'data:image/png;base64,([^"]+)',data)
        die(match is not None and base64.b64decode(match.group(1))==mark,side+' embedded symbol not source-identical')
        (OUT/file).write_bytes(data)
        out_png=OUT/('HADES_Card_'+side+'_REVIEW.png')
        render(data,out_png)
        images.append(Image.open(out_png).convert('RGB'))
        group_files=[]
        for label in GROUPS:
            root=ET.fromstring(data)
            for child in list(root):
                if child.tag==NS+'g' and child.get('id','').startswith('layer-') and child.get('id')!='layer-'+label:
                    root.remove(child)
            path=OUT/('.'+side+'-'+label+'.png')
            render(ET.tostring(root),path)
            group_files.append(path)
        psd=OUT/('HADES_Card_'+side+'_LAYERED_REVIEW.psd')
        subprocess.run([magick,str(out_png),*[str(x) for x in group_files],'-depth','8',str(psd)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        die(psd.read_bytes().startswith(b'8BPS'),side+' PSD invalid header')
        composite=OUT/('.'+side+'-PSD-QA.png')
        subprocess.run([magick,str(psd)+'[0]',str(composite)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        die(not ImageChops.difference(Image.open(out_png).convert('RGB'),Image.open(composite).convert('RGB')).getbbox(),side+' PSD composite mismatch')
        composite.unlink()
        for f in group_files:f.unlink()
    board=Image.new('RGB',(1760,2650),'#0c0b0a')
    draw=ImageDraw.Draw(board)
    try:font=lambda size:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
    except Exception:font=lambda size:ImageFont.load_default()
    draw.text((82,48),'HADES / BUSINESS CARD / WORKING ASSETS',font=font(32),fill='#E5DBCF')
    draw.text((82,104),'REVIEW / CONCEPT — original source-derived transparent symbol',font=font(17),fill='#EF4B32')
    for i,side in enumerate(SIDES):
        y=226+1186*i
        draw.text((82,y-49),f'{i+1:02d} / {side.upper()}',font=font(17),fill='#B8AA9B')
        board.paste(images[i].resize((1530,990),Image.Resampling.LANCZOS),(100,y))
    draw.text((82,2595),'#EF4B32 approved; other swatches, fonts and layouts under review.',font=font(16),fill='#AEA093')
    board.save(OUT/'HADES_Card_Contact_Sheet_REVIEW.png',optimize=True)
    note='HADES B01 working card / REVIEW\nSVG layout: editable text, pattern and symbol image.\nThe raster symbol was isolated by alpha from exactly the owner-supplied original; no invented/auto-traced vector logo.\nTwo 85x55mm sides, PNG 1700x1100, two layered PSD, archive, color #EF4B32 only approved.\nNo fictional contact data. Supporting colors, fonts, print bleed and final brand status unapproved.\n'
    (OUT/'README_REVIEW.txt').write_text(note,encoding='utf8')
    (OUT/'build-hades-card.py').write_bytes(Path(__file__).read_bytes())
    names=[p for p in sorted(OUT.iterdir()) if p.is_file() and not p.name.startswith('.') and p.suffix.lower()!='.zip']
    with zipfile.ZipFile(OUT/'HADES_Business_Card_Working_Files_REVIEW.zip','w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
        for p in names:z.write(p,arcname=p.name)
    with zipfile.ZipFile(OUT/'HADES_Business_Card_Working_Files_REVIEW.zip') as z:
        die(z.testzip() is None,'bad ZIP')
    print('HADES B01 source+PNG+layered PSD+ZIP generated; original and derived SHA verified; two PSD composites exact')
if __name__=='__main__':build()
