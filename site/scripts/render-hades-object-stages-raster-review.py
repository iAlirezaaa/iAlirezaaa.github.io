#!/usr/bin/env python3
"""Raster release of three protected HADES Object Stage SVG artboards, PUBLIC REVIEW."""
from __future__ import annotations
import hashlib
import json
import shutil
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from PIL import Image, ImageChops
import cairosvg

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "site/public/hades/library/object-stages"
MIRROR = ROOT / "hades/library/object-stages"
OUT = SOURCE / "raster"
DEST = MIRROR / "raster"
SIZES = {"16x9": (1920,1080), "9x16": (1080,1920), "1x1": (1080,1080)}
STEMS = {ratio: f"HADES_Object_Stage_{ratio}_REVIEW" for ratio in SIZES}
ZIP = "HADES_Object_Stages_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip"
MANIFEST = "HADES_Object_Stages_Raster_Manifest_REVIEW.json"
README = "README_REVIEW.txt"
CONTACT = "HADES_Object_Stages_Raster_Contact_REVIEW.png"

def checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def source_check():
    info = {}
    for ratio, dimensions in SIZES.items():
        name=STEMS[ratio]+".svg"
        a=(SOURCE/name).read_bytes()
        b=(MIRROR/name).read_bytes()
        assert a == b, f"source/deployed SVG mismatch: {name}"
        root=ET.fromstring(a)
        assert root.tag == "{http://www.w3.org/2000/svg}svg"
        assert (int(root.attrib["width"]),int(root.attrib["height"])) == dimensions
        assert b"PUBLIC REVIEW" in a and b"subject-placement-guide-hidden" in a
        assert b"<image" not in a and b"<script" not in a and b"http://" not in a.replace(b"http://www.w3.org/2000/svg",b"")
        info[name]={"sha256":checksum(a),"bytes":len(a),"dimensions":list(dimensions)}
    return info

def build():
    source_info=source_check()
    OUT.mkdir(parents=True, exist_ok=True)
    rendered={}
    thumbs=[]
    for ratio, (w,h) in SIZES.items():
        stem=STEMS[ratio]
        svg=(SOURCE/(stem+".svg")).read_bytes()
        path=OUT/(stem+".png")
        cairosvg.svg2png(bytestring=svg,write_to=str(path),output_width=w,output_height=h)
        with Image.open(path) as im:
            im.load()
            assert im.size==(w,h) and im.getbbox() is not None
            rgb=im.convert("RGB")
            # Reject blank/transparent frames and empty crop; the three designs have visible planes.
            assert rgb.getextrema()[0][1]-rgb.getextrema()[0][0]>20, stem
            rgb.save(OUT/(stem+".jpg"),format="JPEG",quality=94,subsampling=0,optimize=True)
            rgb.save(OUT/(stem+".webp"),format="WEBP",quality=93,method=6)
            thumb=rgb.copy();thumb.thumbnail((480,400))
            thumbs.append((ratio,thumb))
        for suffix in (".png",".jpg",".webp"):
            p=OUT/(stem+suffix)
            with Image.open(p) as test:
                test.load()
                assert test.size==(w,h),(p,test.size)
                assert test.mode in ("RGB","RGBA"),(p,test.mode)
            rendered[p.name]={"sha256":checksum(p.read_bytes()),"bytes":p.stat().st_size,"dimensions":[w,h]}
    # Contact sheet is a real derived raster, not generated architecture or logo.
    strip=Image.new("RGB",(1500,490),"#131211")
    positions=[(10,20),(510,20),(1010,20)]
    for (ratio,img),(x,y) in zip(thumbs,positions):
        strip.paste(img,(x+(480-img.width)//2,y+(420-img.height)//2))
    strip.save(OUT/CONTACT,optimize=True)
    c=OUT/CONTACT
    rendered[CONTACT]={"sha256":checksum(c.read_bytes()),"bytes":c.stat().st_size,"dimensions":[1500,490]}
    manifest={
      "collection":"HADES Architectural Object Stages / Raster Release",
      "status":"PUBLIC REVIEW — NOT FINAL",
      "approved_accent":"#EF4B32",
      "proposed_neutrals":{"Dark":"#131211","Mammoth Bone":"#E6D9C7","Charcoal":"#292723"},
      "source_exact_svg":source_info,
      "raster_outputs":rendered,
      "render_method":"CairoSVG SVG rasterization, Pillow high-quality JPEG/WebP encodes; no marks/subjects inserted",
      "open":["real 48/96px phone recognition","physical print and staging fit","authentic licensable Mikhak","owner FINAL approval"]
    }
    (OUT/MANIFEST).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    (OUT/README).write_text(
      "HADES ARCHITECTURAL OBJECT STAGES | PUBLIC REVIEW — NOT FINAL\n"
      "Three source-exact vector artboards: 1920x1080, 1080x1920, 1080x1080.\n"
      "Nine native-size raster files: PNG / JPEG quality 94 / WebP quality 93.\n"
      "No HADES mark is embedded or modified. For a white original mark over bone,\n"
      "add the unchanged owner file on a separate dark plaque; no redraw or invert.\n"
      "Neutral colors and typeface are proposed; only #EF4B32 owner-approved.\n"
      "Real handheld, physical print and Mikhak evidence OPEN. No FINAL claim.\n",encoding="utf8")
    files=[STEMS[r]+".svg" for r in SIZES]+sorted(rendered)+[MANIFEST,README]
    with zipfile.ZipFile(OUT/ZIP,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name in files:
            p=(SOURCE/name) if name.endswith(".svg") else (OUT/name)
            z.write(p,arcname=name)
    with zipfile.ZipFile(OUT/ZIP) as z:
        assert z.testzip() is None and sorted(z.namelist())==sorted(files)
    DEST.mkdir(parents=True,exist_ok=True)
    for p in OUT.iterdir():
        if p.is_file() and p.name!="HADES_Object_Stages_Hosted_HTTP_QA_REVIEW.json":
            shutil.copyfile(p,DEST/p.name)
            assert p.read_bytes()==(DEST/p.name).read_bytes()
    print(json.dumps({"result":"PASS","source_svgs":len(source_info),
      "raster_outputs":len(rendered),"bundle_files":len(files),
      "published_mirror_count":len(list(OUT.iterdir()))},ensure_ascii=False))

if __name__=="__main__":
    build()
