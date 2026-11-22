#!/usr/bin/env python3
"""HADES Section Cuts raster publisher. Only public standalone geometry; no logo files."""
from pathlib import Path
import io, hashlib, json, zipfile, xml.etree.ElementTree as ET
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"site/public/hades/library/backgrounds"
PUBLISHED=ROOT/"hades/library/backgrounds"
STEMS=[
 ("HADES_Section_Cut_Cantilever_16x9_REVIEW",1920,1080,"16:9"),
 ("HADES_Section_Cut_Sunken_Gallery_9x16_REVIEW",1080,1920,"9:16"),
 ("HADES_Section_Cut_Suspended_Lintel_1x1_REVIEW",1080,1080,"1:1"),
]
MANIFEST="section-cuts/Section_Cuts_Raster_Release_REVIEW.json"
KIT="section-cuts/HADES_Section_Cuts_3_Ratios_SVG_PNG_JPEG_WEBP_REVIEW.zip"
CONTACT="section-cuts/HADES_Section_Cuts_Raster_Contact_REVIEW.png"

def sha(data): return hashlib.sha256(data).hexdigest()
def mirrored(relative, data):
    for directory in (SOURCE,PUBLISHED):
        path=directory/relative
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data)
        assert path.read_bytes()==data,relative
def encode(image, ext):
    sink=io.BytesIO()
    if ext=="png": image.save(sink,"PNG",optimize=True)
    if ext=="jpg": image.convert("RGB").save(sink,"JPEG",quality=92,subsampling=0,progressive=True)
    if ext=="webp": image.convert("RGB").save(sink,"WEBP",quality=90,method=6)
    result=sink.getvalue()
    with Image.open(io.BytesIO(result)) as check:
        check.verify()
    with Image.open(io.BytesIO(result)) as check:
        assert check.size==image.size and check.format=={"png":"PNG","jpg":"JPEG","webp":"WEBP"}[ext]
    return result

def main():
    output={}; records=[]; rendered=[]
    for stem,w,h,ratio in STEMS:
        name="assets/"+stem+".svg"
        svg=(SOURCE/name).read_bytes()
        assert svg==(PUBLISHED/name).read_bytes(),("mirror SVG",name)
        root=ET.fromstring(svg)
        assert root.tag=="{http://www.w3.org/2000/svg}svg"
        assert int(root.get("width"))==w and int(root.get("height"))==h
        forbidden=(b"<script",b"<image",b"data:image",b"http://",b"https://",b"xlink:href")
        assert not any(token in svg.lower() for token in forbidden),"standalone SVG policy"
        assert b"REVIEW" in svg and b"#EF4B32" in svg and b"No HADES logo" in svg
        original_png=cairosvg.svg2png(bytestring=svg,output_width=w,output_height=h)
        with Image.open(io.BytesIO(original_png)) as im:
            rgb=im.convert("RGB")
        rendered.append(rgb.copy())
        output[name]=svg
        imgs=[]
        for ext,mime in [("png","image/png"),("jpg","image/jpeg"),("webp","image/webp")]:
            data=encode(rgb,ext)
            relative="assets/"+stem+"."+ext
            mirrored(relative,data)
            output[relative]=data
            imgs.append({"path":relative,"mime":mime,"width":w,"height":h,"bytes":len(data),"sha256":sha(data)})
        records.append({"source":name,"source_sha256":sha(svg),"ratio":ratio,"width":w,"height":h,"renders":imgs})
        print("PASS",stem,ratio,"PNG/JPEG/WebP",flush=True)
    # A real raster contact sheet, not a conceptual reconstruction.
    width,height=1600,900
    sheet=Image.new("RGB",(width,height),"#131211")
    draw=ImageDraw.Draw(sheet)
    try: font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",21)
    except OSError: font=ImageFont.load_default()
    draw.text((46,29),"HADES  /  SECTION CUTS  /  PUBLIC REVIEW",fill="#E6D9C7",font=font)
    labels=("CANTILEVER  /  16:9","SUNKEN GALLERY  /  9:16","SUSPENDED LINTEL  /  1:1")
    for i,(image,label) in enumerate(zip(rendered,labels)):
        x=46+i*519
        box=Image.new("RGB",(474,708),"#292723")
        thumb=image.copy()
        thumb.thumbnail((456,678),Image.Resampling.LANCZOS)
        box.paste(thumb,((474-thumb.width)//2,(708-thumb.height)//2))
        sheet.paste(box,(x,96))
        draw.text((x,818),label,fill="#E6D9C7",font=font)
    preview=encode(sheet,"png")
    mirrored(CONTACT,preview)
    output[CONTACT]=preview
    manifest={
      "family":"HADES Architectural Section Cuts",
      "status":"PUBLIC REVIEW — not FINAL",
      "approved_colour_only":"#EF4B32",
      "proposed_neutrals":{"dark":"#131211","mammoth_bone":"#E6D9C7","charcoal":"#292723"},
      "provenance":"Deterministic CairoSVG/Pillow renders from the three public standalone SVG artworks, not ImageGen photos or old conversation rasters",
      "original_logo_policy":"NO LOGO included. All four original marks and their manifest remain unchanged.",
      "assets":records,
      "contact_sheet":{"path":CONTACT,"width":width,"height":height,"bytes":len(preview),"sha256":sha(preview)}
    }
    data=(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n").encode("utf-8")
    mirrored(MANIFEST,data);output[MANIFEST]=data
    output["README_PUBLIC_REVIEW.txt"]=(
      "HADES Section Cuts | PUBLIC REVIEW | 2026-11-22\n"
      "Three independent original vectors, three native-size PNG/JPEG/WebP groups, one contact sheet, JSON manifest.\n"
      "Only vermilion #EF4B32 is owner-approved; all supporting neutrals and design layouts are PROPOSED.\n"
      "No original logo is inside these backgrounds. Never redraw, recolor or trace the original.\n"
      "For any original white logo over a light field, use the unchanged original on a SEPARATE dark plaque.\n"
      "Not FINAL. Real-phone recognition, physical A4 print and genuine Mikhak tests remain OPEN.\n"
    ).encode("utf-8")
    kit=io.BytesIO()
    with zipfile.ZipFile(kit,"w") as z:
        for name,value in sorted(output.items()):
            item=zipfile.ZipInfo(name,(2026,11,22,0,0,0))
            item.compress_type=zipfile.ZIP_DEFLATED
            item.external_attr=0o644<<16
            z.writestr(item,value,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    binary=kit.getvalue()
    with zipfile.ZipFile(io.BytesIO(binary)) as z:
        assert z.testzip() is None and len(z.namelist())==len(output)
        for name,value in output.items(): assert z.read(name)==value
    mirrored(KIT,binary)
    print("PASS 9 raster files + contact + manifest +",len(output),"-entry ZIP",len(binary),"bytes",sha(binary),flush=True)

if __name__=="__main__": main()
