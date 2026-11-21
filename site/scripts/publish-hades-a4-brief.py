#!/usr/bin/env python3
"""Publish source-locked synthetic A4 PDF/PNG REVIEW assets to both public site trees.
No owner logo original, PRIVATE REVIEW file, or font is modified or distributed.
"""
import argparse, hashlib, json, shutil
from pathlib import Path
import fitz
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    a=argparse.ArgumentParser()
    a.add_argument('--root',type=Path,default=Path.cwd())
    a.add_argument('--proofs',type=Path,required=True)
    args=a.parse_args()
    root=args.root.resolve()
    source=args.proofs.resolve()/'brief-390-fa-A4-REVIEW.pdf'
    assert source.is_file(),'Missing actual Chromium PDF proof'
    d=fitz.open(source)
    assert len(d)==1,'Expected one A4 page'
    page=d[0]
    assert abs(page.rect.width-595)<1 and abs(page.rect.height-842)<1,'Wrong page dimensions'
    bitmap=page.get_pixmap(matrix=fitz.Matrix(300/72,300/72),alpha=False)
    assert 2478<=bitmap.width<=2482 and 3507<=bitmap.height<=3510,'Unexpected 300dpi pixel dimensions'
    names={'pdf':'HADES_A4_Creative_Brief_FA_Example_REVIEW.pdf','png':'HADES_A4_Creative_Brief_FA_Example_300dpi_REVIEW.png'}
    dirs=[]
    for prefix in ('hades','site/public/hades'):
        folder=root/prefix/'library/tools/a4-creative-brief'
        html=folder/'index.html'
        assert html.is_file() and b'REVIEW' in html.read_bytes() and b'data:image/png;base64' in html.read_bytes()
        shutil.copyfile(source,folder/names['pdf'])
        bitmap.save(folder/names['png'])
        dirs.append(folder)
    for name in names.values(): assert sha(dirs[0]/name)==sha(dirs[1]/name),'Mirror bytes unequal'
    meta={'status':'REVIEW','source':'actual Chromium synthetic A4 PDF proof','print_approval':'NOT_GRANTED','font':'Linux fallback, Mikhak not verified',
          'original_logo':'Public owner original embedded in HTML unchanged, not a vector master',
          'pdf':{'filename':names['pdf'],'sha256':sha(dirs[0]/names['pdf']),'bytes':(dirs[0]/names['pdf']).stat().st_size,'pages':1,'size':'A4'},
          'png':{'filename':names['png'],'sha256':sha(dirs[0]/names['png']),'bytes':(dirs[0]/names['png']).stat().st_size,'pixels':[bitmap.width,bitmap.height],'dpi':300},
          'source_html_sha256':sha(dirs[0]/'index.html')}
    data=json.dumps(meta,ensure_ascii=False,indent=2)+'\n'
    for p in dirs:(p/'binary-manifest.review.json').write_text(data,encoding='utf-8')
    assert sha(dirs[0]/'binary-manifest.review.json')==sha(dirs[1]/'binary-manifest.review.json')
    print(json.dumps({'status':'PASS_PUBLIC_REVIEW_BINARIES','pdf':meta['pdf'],'png':meta['png']}))
if __name__=='__main__': main()
