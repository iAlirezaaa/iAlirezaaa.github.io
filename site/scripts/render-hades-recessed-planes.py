from pathlib import Path
import hashlib, io, json, shutil, zipfile
import cairosvg
from PIL import Image
root=Path('hades/library/backgrounds/recessed-planes')
src=Path('site/public')/root
specs={'counterlight':(1920,1080),'blind-stair':(1080,1920),'offset-chamber':(1080,1080)}
rows=[]
for name,size in specs.items():
    svg=root/(name+'.svg')
    assert svg.read_bytes()==(src/svg.name).read_bytes()
    img=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.read_bytes()))).convert('RGB')
    assert img.size==size
    for ext,opts in [('png',{}),('jpg',{'quality':94,'subsampling':0}),('webp',{'quality':95})]:
        out=root/(name+'.'+ext)
        img.save(out,**opts)
        with Image.open(out) as check:
            check.load(); assert check.size==size
        shutil.copyfile(out,src/out.name)
    for ext in ('svg','png','jpg','webp'):
        p=root/(name+'.'+ext)
        rows.append(dict(file=p.name,width=size[0],height=size[1],sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
    print('RASTER PASS',name,size,flush=True)
manifest=root/'manifest.REVIEW.json'
manifest.write_text(json.dumps({'status':'PUBLIC REVIEW','assets':rows},indent=2)+'\n')
shutil.copyfile(manifest,src/manifest.name)
bundle=root/'HADES_Recessed_Planes_PUBLIC_REVIEW.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
    for name in [x['file'] for x in rows]+[manifest.name]:
        info=zipfile.ZipInfo(name,(2026,11,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,(root/name).read_bytes())
with zipfile.ZipFile(bundle) as z:
    assert z.testzip() is None and len(z.namelist())==13
shutil.copyfile(bundle,src/bundle.name)
for locale in ('en','fa'):
    page=Path('hades/library/backgrounds/recessed-planes/index.html' if locale=='en' else 'hades/fa/library/backgrounds/recessed-planes/index.html')
    text=page.read_text()
    if 'id="raster-downloads"' not in text:
        for name in specs:
            needle=f'<a href="/hades/library/backgrounds/recessed-planes/{name}.svg" download>SVG</a>'
            assert text.count(needle)==1
            text=text.replace(needle,needle+''.join(f'<a href="/hades/library/backgrounds/recessed-planes/{name}.{ext}" download>{label}</a>' for ext,label in [('png','PNG'),('jpg','JPEG'),('webp','WebP')]))
        text=text.replace('</header>','</header><p id="raster-downloads"><a href="/hades/library/backgrounds/recessed-planes/'+bundle.name+'" download>ZIP · 3 SVG + 9 raster · REVIEW</a> · <a href="/hades/library/backgrounds/recessed-planes/'+manifest.name+'">SHA-256</a></p>')
        page.write_text(text)
    shutil.copyfile(page,Path('site/public')/page)
print('ZIP PASS',len(rows),hashlib.sha256(bundle.read_bytes()).hexdigest(),flush=True)
