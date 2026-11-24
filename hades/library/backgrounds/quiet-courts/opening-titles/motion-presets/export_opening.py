#!/usr/bin/env python3
"""HADES opening motion: straight-alpha sequence. PUBLIC REVIEW, not FINAL."""
import argparse, hashlib, io, json, zipfile
from pathlib import Path
from PIL import Image
def sha(data): return hashlib.sha256(data).hexdigest()
def recipe(fps, seconds):
    n=fps*seconds; a=(20*n+50)//100; b=(85*n+50)//100
    def smooth(p,q): return (2*1000000*p*p*(3*q-2*p)+q**3)//(2*q**3)
    values=[smooth(f,a) if f<=a else 1000000 if f<=b else smooth(n-1-f,n-1-b) for f in range(n)]
    return dict(fps=fps,seconds=seconds,frame_count=n,end_exclusive=n,keys=[0,a,b,n-1],opacity_millionths=values)
def export(source, manifest, output, fps, seconds):
    if fps not in (24,25,30) or seconds not in (3,5,8): raise ValueError("Unsupported timing")
    raw=source.read_bytes(); entries=json.loads(manifest.read_text(encoding="utf-8"))["files"]
    matches=[e for e in entries if e["file"]==source.name]
    if len(matches)!=1 or matches[0]["sha256"]!=sha(raw): raise ValueError("Source hash mismatch")
    with Image.open(io.BytesIO(raw)) as d:
        if d.mode!="RGBA" or d.format!="PNG" or d.size!=(matches[0]["width"],matches[0]["height"]): raise ValueError("Expected verified RGBA PNG")
        base=d.copy()
    if base.size not in ((1920,1080),(1080,1920),(1080,1080)) or base.getchannel("A").getextrema()!=(0,255): raise ValueError("Expected native transparent art")
    r=recipe(fps,seconds); alpha=base.getchannel("A"); frames=[]; cache={}
    with zipfile.ZipFile(output,"x",compression=zipfile.ZIP_STORED) as z:
        for f,v in enumerate(r["opacity_millionths"]):
            lut=tuple((x*v+500000)//1000000 for x in range(256))
            if lut not in cache:
                frame=base.copy(); frame.putalpha(alpha.point(lut)); buf=io.BytesIO(); frame.save(buf,format="PNG"); cache[lut]=buf.getvalue()
            data=cache[lut]; name=f"frames/frame_{f:04d}.png";z.writestr(name,data);frames.append(dict(file=name,sha256=sha(data)))
        z.writestr("manifest.REVIEW.json",json.dumps(dict(status="PUBLIC REVIEW / NOT FINAL",source=source.name,source_sha256=sha(raw),alpha_mode="straight",**r,frames=frames),indent=2)+"\n")
    return r
if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("source",type=Path);p.add_argument("manifest",type=Path);p.add_argument("output",type=Path);p.add_argument("--fps",type=int,choices=[24,25,30],default=24);p.add_argument("--seconds",type=int,choices=[3,5,8],default=3);a=p.parse_args();print(export(a.source,a.manifest,a.output,a.fps,a.seconds)["frame_count"],"PNG frames")
