#!/usr/bin/env python3
"""HADES alpha sequence | PUBLIC REVIEW, not FINAL. Requires Pillow."""
import argparse, hashlib, io, json, zipfile
from pathlib import Path
from PIL import Image

def digest(data):
    return hashlib.sha256(data).hexdigest()

def keys_for(n):
    return (0, (n+2)//5, (4*n+2)//5, n-1)

def fraction(f, keys):
    _, a, b, last = keys
    if f <= a:
        return f, a
    if f <= b:
        return 1, 1
    return last-f, last-b

def export(source, manifest, output, fps, seconds):
    raw = source.read_bytes()
    entries = json.loads(manifest.read_text(encoding='utf-8'))
    matches = [e for e in entries if e['file'] == source.name]
    if len(matches) != 1 or matches[0]['sha256'] != digest(raw):
        raise ValueError('Source SHA-256 does not match supplied manifest')
    if fps not in (24,25,30) or seconds not in (3,5,8):
        raise ValueError('Unsupported timing')
    with Image.open(io.BytesIO(raw)) as decoded:
        if decoded.format != 'PNG' or decoded.mode != 'RGBA':
            raise ValueError('Expected native RGBA PNG')
        if decoded.size != (matches[0]['width'],matches[0]['height']):
            raise ValueError('Source dimensions mismatch')
        if decoded.size not in ((1920,1080),(1080,1920),(1080,1080)):
            raise ValueError('Unsupported dimensions')
        base = decoded.copy()
    if base.getchannel('A').getextrema() != (0,255):
        raise ValueError('Expected both transparent and opaque pixels')
    n = fps*seconds
    keys = keys_for(n)
    record = dict(status='PUBLIC REVIEW / NOT FINAL',source=source.name,
                  source_sha256=digest(raw),width=base.width,height=base.height,
                  fps=fps,duration_seconds=seconds,frame_count=n,end_exclusive=n,
                  keys=list(keys),alpha_mode='straight',interpolation='linear',frames=[])
    alpha = base.getchannel('A')
    cache = {}
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_STORED) as z:
        for f in range(n):
            p,q = fraction(f,keys)
            lut = tuple((v*p+q//2)//q for v in range(256))
            if lut not in cache:
                frame = base.copy()
                frame.putalpha(alpha.point(lut))
                buf = io.BytesIO()
                frame.save(buf,format='PNG',compress_level=6)
                cache[lut] = buf.getvalue()
            data = cache[lut]
            name = f'frames/frame_{f:04d}.png'
            z.writestr(name,data)
            record['frames'].append(dict(file=name,frame=f,opacity=p/q,sha256=digest(data)))
        z.writestr('manifest.REVIEW.json',json.dumps(record,indent=2)+'\n')
    return record

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=Path)
    p.add_argument('manifest',type=Path)
    p.add_argument('output',type=Path)
    p.add_argument('--fps',type=int,choices=[24,25,30],default=25)
    p.add_argument('--seconds',type=int,choices=[3,5,8],default=3)
    a = p.parse_args()
    r = export(a.source,a.manifest,a.output,a.fps,a.seconds)
    print(f"Wrote {r['frame_count']} native straight-alpha PNG frames: {a.output}")

if __name__ == '__main__':
    main()
