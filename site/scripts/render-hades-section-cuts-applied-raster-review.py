#!/usr/bin/env python3
"""Build public REVIEW PNG/WebP proof exports from the EXISTING original-mark SVG covers.
This does not edit, transform, recolor or replace any owner logo input.
"""
from pathlib import Path
import base64, hashlib, io, json, re, zipfile
import xml.etree.ElementTree as ET
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"site/public/hades"
LIVE=ROOT/"hades"
DIR="library/backgrounds/section-cuts/applied-raster"
ORIGINAL_SHA="79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
SPECS=[
 ("HADES_Section_Cut_Cantilever_Applied_16x9_REVIEW",1920,1080,"16:9"),
 ("HADES_Section_Cut_Sunken_Gallery_Applied_9x16_REVIEW",1080,1920,"9:16"),
 ("HADES_Section_Cut_Suspended_Lintel_Applied_1x1_REVIEW",1080,1080,"1:1"),
]
def digest(data): return hashlib.sha256(data).hexdigest()
def mirror(path,data):
 for root in (SOURCE,LIVE):
  fp=root/path
  fp.parent.mkdir(parents=True,exist_ok=True)
  fp.write_bytes(data)
  assert fp.read_bytes()==data

def raster(image,format):
 buffer=io.BytesIO()
 if format=="PNG": image.save(buffer,"PNG",optimize=True)
 else: image.convert("RGB").save(buffer,"WEBP",quality=93,method=6)
 data=buffer.getvalue()
 with Image.open(io.BytesIO(data)) as check:
  check.verify()
 with Image.open(io.BytesIO(data)) as check:
  assert check.format==format and check.size==image.size
 return data

def main():
 assets={}
 records=[]
 originals=[]
 for stem,width,height,ratio in SPECS:
  relative="library/backgrounds/section-cuts/"+stem+".svg"
  raw=(SOURCE/relative).read_bytes()
  assert raw==(LIVE/relative).read_bytes(), "mirrored source missing: "+relative
  root=ET.fromstring(raw)
  assert root.tag=="{http://www.w3.org/2000/svg}svg"
  assert (int(root.get("width")),int(root.get("height")))==(width,height)
  images=[e for e in root.iter() if e.tag.split("}")[-1]=="image"]
  assert len(images)==1, "exactly one protected source image expected"
  href=images[0].get("{http://www.w3.org/1999/xlink}href") or images[0].get("href")
  assert href and href.startswith("data:image/png;base64,"), "no substitutions permitted"
  actual=base64.b64decode(href.split(",",1)[1],validate=True)
  assert digest(actual)==ORIGINAL_SHA, "embedded original-mark bytes changed"
  assert b"detached-plaque-and-editable-labels" in raw and b"#EF4B32" in raw
  assert b"REVIEW" in raw and b"Mikhak" in raw
  png=cairosvg.svg2png(bytestring=raw,output_width=width,output_height=height)
  with Image.open(io.BytesIO(png)) as img:
   image=img.convert("RGB")
  originals.append(image.copy())
  products=[]
  for fmt,extension,mime in [("PNG","png","image/png"),("WEBP","webp","image/webp")]:
   data=raster(image,fmt)
   path=DIR+"/"+stem+"."+extension
   mirror(path,data)
   assets[path.split(DIR+"/",1)[1]]=data
   products.append(dict(path=path,width=width,height=height,mime=mime,bytes=len(data),sha256=digest(data)))
  records.append(dict(source=relative,source_sha256=digest(raw),ratio=ratio,logo_sha256=digest(actual),exports=products))
  print("PASS applied original-mark",stem,ratio,"source png SHA",digest(actual),flush=True)
 contact=Image.new("RGB",(1600,900),"#131211")
 draw=ImageDraw.Draw(contact)
 try:font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",21)
 except OSError:font=ImageFont.load_default()
 draw.text((42,28),"HADES / APPLIED COVERS / PUBLIC REVIEW",fill="#E6D9C7",font=font)
 for i,(img,title) in enumerate(zip(originals,("CANTILEVER 16:9","SUNKEN GALLERY 9:16","SUSPENDED LINTEL 1:1"))):
  x=40+i*520
  thumb=img.copy()
  thumb.thumbnail((470,684),Image.Resampling.LANCZOS)
  contact.paste(thumb,(x+(470-thumb.width)//2,100+(684-thumb.height)//2))
  draw.text((x,812),title,fill="#E6D9C7",font=font)
 contact_data=raster(contact,"PNG")
 contact_path=DIR+"/HADES_Section_Cuts_Applied_Contact_REVIEW.png"
 mirror(contact_path,contact_data)
 assets[contact_path.split(DIR+"/",1)[1]]=contact_data
 manifest=dict(
  family="HADES Section Cuts / Applied Covers / PUBLIC REVIEW",
  status="PUBLIC REVIEW — not FINAL",approved_colour_only="#EF4B32",
  supporting_neutrals="PROPOSED",original_logo_sha256=ORIGINAL_SHA,
  provenance="CairoSVG/Pillow rasterisation of the existing 3 unchanged SVG compositions. The original PNG remains embedded byte-for-byte in each source SVG and on the detached dark plaque; these raster proofs do NOT replace original logo masters.",
  open=["physical phone 48/96px","measured A4 print","authentic Mikhak test","owner FINAL approval"],
  assets=records,
  contact=dict(path=contact_path,sha256=digest(contact_data),width=1600,height=900)
 )
 man_data=(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n").encode()
 manifest_path=DIR+"/HADES_Section_Cuts_Applied_Raster_Manifest_REVIEW.json"
 mirror(manifest_path,man_data)
 assets[manifest_path.split(DIR+"/",1)[1]]=man_data
 notes=("HADES SECTION CUTS / APPLIED COVERS — PUBLIC REVIEW\n"
 "Three existing unchanged vector covers rendered at 1920x1080, 1080x1920 and 1080x1080.\n"
 "Six full-size PNG/WebP files, a contact image and JSON SHA-256 manifest.\n"
 "Original embedded owner logo verified against SHA-256 "+ORIGINAL_SHA+".\n"
 "No original logo bytes or four-logo manifest modified. Detached dark plaque preserved.\n"
 "Only #EF4B32 is owner-approved; neutral swatches, typefaces and compositions remain REVIEW.\n"
 "No physical-phone, print or authentic-Mikhak pass claimed; no FINAL approval.\n").encode()
 assets["README_PUBLIC_REVIEW.txt"]=notes
 zip_buffer=io.BytesIO()
 with zipfile.ZipFile(zip_buffer,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zip_out:
  for name,data in sorted(assets.items()):
   info=zipfile.ZipInfo(name,(2026,11,22,0,0,0))
   info.compress_type=zipfile.ZIP_DEFLATED
   zip_out.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
 zip_data=zip_buffer.getvalue()
 with zipfile.ZipFile(io.BytesIO(zip_data)) as zin:
  assert zin.testzip() is None and len(zin.namelist())==len(assets)
  for key,expected in assets.items():assert zin.read(key)==expected
 kit_path=DIR+"/HADES_Section_Cuts_Applied_PNG_WEBP_Review_Pack.zip"
 mirror(kit_path,zip_data)
 print("PASS 3 source-authentic applied SVG renders, 6 raster images, 9-member ZIP",len(zip_data),digest(zip_data),flush=True)
if __name__=="__main__":main()
