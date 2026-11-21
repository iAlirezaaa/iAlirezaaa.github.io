#!/usr/bin/env python3
"""Build a genuine layered raster PSD from HADES's exact existing A4 PNG REVIEW.
No logo redraw, fonts, vectorization, new product identity, or FINAL claim."""
from pathlib import Path
import argparse, hashlib, json, struct
from PIL import Image, ImageChops

DIVIDERS=[0,675,1020,1500,1950,2400,2850,3265,3508]
NAMES=[
"01 Original logo and identity header (raster)",
"02 Project title and vermilion rule (raster)",
"03 Purpose and outcome (raster)",
"04 Audience and context (raster)",
"05 Deliverables (raster)",
"06 Constraints and decisions (raster)",
"07 Next action (raster)",
"08 Footer REVIEW label (raster)"]
EXPECTED_PNG_SHA256="ea0ec218ff67953e5734f94da95f96228f4ea0835c65117efa4568b139ecae36"
def u16(n): return struct.pack(">H",n)
def s16(n): return struct.pack(">h",n)
def u32(n): return struct.pack(">I",n)
def s32(n): return struct.pack(">i",n)
def packbits(row):
    n=len(row);out=bytearray();i=0
    while i<n:
        run=1
        while i+run<n and run<128 and row[i+run]==row[i]:run+=1
        if run>=3:
            out.extend((257-run,row[i]));i+=run;continue
        start=i;i+=run
        while i<n and i-start<128:
            r=1
            while i+r<n and r<128 and row[i+r]==row[i]:r+=1
            if r>=3 or i-start+r>128:break
            i+=r
        out.append(i-start-1);out.extend(row[start:i])
    return bytes(out)
def channel(data,w,h):
    assert len(data)==w*h
    rows=[packbits(data[y*w:(y+1)*w]) for y in range(h)]
    assert all(0<len(row)<65536 for row in rows)
    return u16(1)+b"".join(u16(len(row)) for row in rows)+b"".join(rows)
def name_chunk(name):
    b=name.encode("ascii","replace")[:255];chunk=bytes([len(b)])+b
    return chunk+b"\0"*((-len(chunk))%4)
def layer(name,rgba,top,bottom):
    w,h=rgba.size
    assert bottom-top==h
    data=[channel(im.tobytes(),w,h) for im in rgba.split()]
    description=b"".join(s16(id)+u32(len(b)) for id,b in zip((0,1,2,-1),data))
    extras=u32(0)+u32(0)+name_chunk(name)
    record=(s32(top)+s32(0)+s32(bottom)+s32(w)+u16(4)+description+
            b"8BIM"+b"norm"+bytes([255,0,0,0])+u32(len(extras))+extras)
    return record,b"".join(data)
def build(png,output,manifest):
    source_sha=hashlib.sha256(png.read_bytes()).hexdigest()
    if source_sha!=EXPECTED_PNG_SHA256:
        raise SystemExit(f"FAIL CLOSED: source PNG changed: {source_sha}")
    image=Image.open(png).convert("RGB");w,h=image.size
    assert (w,h)==(2479,3508) and DIVIDERS[-1]==h
    background_color=image.getpixel((0,0))
    assert image.getpixel((0,h-1))==image.getpixel((w-1,0))==background_color
    strips=[]
    for name,start,end in zip(NAMES,DIVIDERS[:-1],DIVIDERS[1:]):
        rgba=image.crop((0,start,w,end)).convert("RGBA")
        delta=ImageChops.difference(rgba.convert("RGB"),Image.new("RGB",rgba.size,background_color))
        rgba.putalpha(delta.convert("L").point(lambda n:255 if n else 0))
        strips.append((name,start,end,rgba))
    background=Image.new("RGBA",(w,h),background_color+(255,))
    merged=background.copy()
    for _,start,_,rgba in strips:
        tmp=Image.new("RGBA",(w,h));tmp.paste(rgba,(0,start))
        merged=Image.alpha_composite(merged,tmp)
    assert ImageChops.difference(merged.convert("RGB"),image).getbbox() is None, "Layer parity failed"
    ordered=list(reversed(strips))+[("00 Proposed paper base (raster)",0,h,background)]
    records=[];payloads=[]
    for name,start,end,rgba in ordered:
        record,payload=layer(name,rgba,start,end)
        records.append(record);payloads.append(payload)
    info=s16(len(ordered))+b"".join(records)+b"".join(payloads)
    if len(info)%2:info+=b"\0"
    mask=u32(len(info))+info+u32(0)
    rows=[]
    for plane in image.split():
        raw=plane.tobytes()
        rows.extend(packbits(raw[y*w:(y+1)*w]) for y in range(h))
    assert all(0<len(row)<65536 for row in rows)
    flattened=u16(1)+b"".join(u16(len(row)) for row in rows)+b"".join(rows)
    header=b"8BPS"+u16(1)+b"\0"*6+u16(3)+u32(h)+u32(w)+u16(8)+u16(3)
    data=header+u32(0)+u32(0)+u32(len(mask))+mask+flattened
    output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(data)
    report={
      "status":"REVIEW","file":output.name,"source_png":png.name,
      "source_png_sha256":source_sha,"psd_sha256":hashlib.sha256(data).hexdigest(),
      "psd_bytes":len(data),"width":w,"height":h,"layer_count":len(ordered),
      "layers":[item[0] for item in ordered],"exact_pixel_composite_parity":True,
      "source_logo":"unchanged embedded source PNG pixels; not vectorized",
      "limits":["raster text; edit text in existing HTML editor","supporting palette proposed",
                "Mikhak genuine font/render OPEN","micro-logo readability OPEN",
                "physical A4 printer and owner signoff OPEN","not FINAL"]
    }
    manifest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,indent=2))
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--png",required=True,type=Path)
    parser.add_argument("--out",required=True,type=Path)
    parser.add_argument("--manifest",required=True,type=Path)
    a=parser.parse_args()
    build(a.png,a.out,a.manifest)
