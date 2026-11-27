#!/usr/bin/env python3
"""HADES PUBLIC REVIEW: full decoded-frame overlay contrast, not certification."""
import argparse, json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image


ORIENTATION_ERROR = ('Video has a display transform. Export it with orientation baked '
                     'into the pixels and no rotation or reflection metadata, then retry.')
IDENTITY_DISPLAY_MATRIX = [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]


def require_baked_orientation(info):
    for side_data in info.get('side_data_list', []):
        if side_data.get('side_data_type') != 'Display Matrix':
            continue
        try:
            values = [int(token) for line in side_data.get('displaymatrix', '').splitlines()
                      if line.strip() for token in line.split(':', 1)[1].split()]
        except (IndexError, ValueError):
            raise ValueError(ORIENTATION_ERROR) from None
        if values != IDENTITY_DISPLAY_MATRIX:
            raise ValueError(ORIENTATION_ERROR)
    rotate = info.get('tags', {}).get('rotate')
    if rotate is not None:
        try:
            is_identity_rotation = float(rotate) % 360 == 0
        except (TypeError, ValueError):
            is_identity_rotation = False
        if not is_identity_rotation:
            raise ValueError(ORIENTATION_ERROR)


def audit(video, overlay):
    info = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_streams','-of','json',str(video)]))['streams'][0]
    require_baked_orientation(info)
    w,h = info['width'],info['height']
    with Image.open(overlay) as im:
        has_alpha = 'A' in im.getbands() or (im.mode == 'P' and 'transparency' in im.info)
        if not has_alpha or im.width*h != im.height*w:
            raise ValueError('Use a transparent RGBA or indexed PNG overlay with the same aspect ratio.')
        im = im.convert('RGBA').resize((w,h),Image.Resampling.LANCZOS)
        a = np.asarray(im)
    rgb = a[:,:,:3].astype(np.int16)
    accent = np.max(np.abs(rgb-np.array([239,75,50])),axis=2)<=12
    mask = (a[:,:,3]>=230)&~accent
    if not mask.any(): raise ValueError('No near-opaque non-accent pixels.')
    alpha = a[:,:,3][mask,None]/255.
    fg = rgb[mask]
    def lum(x):
        x=x/255.; x=np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)
        return x@np.array([.2126,.7152,.0722])
    rows=[]
    with subprocess.Popen(['ffmpeg','-v','error','-noautorotate','-i',str(video),'-map','0:v:0','-an','-f','rawvideo','-pix_fmt','rgb24','-fps_mode','passthrough','-'],stdout=subprocess.PIPE) as p:
        while True:
            raw=p.stdout.read(w*h*3)
            if not raw: break
            if len(raw)!=w*h*3: raise ValueError('Incomplete decoded frame')
            bg=np.frombuffer(raw,dtype=np.uint8).reshape(h,w,3)[mask]
            b=lum(bg); f=lum(fg*alpha+bg*(1-alpha)); cr=(np.maximum(b,f)+.05)/(np.minimum(b,f)+.05)
            rows.append({'frame':len(rows),'pass_pct':round(float(np.mean(cr>=4.5)*100),3),'minimum':round(float(cr.min()),4),'all_pass':bool(np.all(cr>=4.5))})
        if p.wait(): raise RuntimeError('ffmpeg decode failed')
    if not rows: raise ValueError('No frames decoded')
    return {'status':'REVIEW','video':Path(video).name,'overlay':Path(overlay).name,'width':w,'height':h,'pixels_per_frame':int(mask.sum()),'frames':len(rows),'all_pass_frames':sum(r['all_pass'] for r in rows),'worst':min(rows,key=lambda r:r['pass_pct']),'results':rows,'limits':'Near-opaque non-accent overlay pixels only; fixed placement; SDR RGB approximation; no human/device or physical print approval.'}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('video');p.add_argument('overlay');p.add_argument('output'); args=p.parse_args()
    result=audit(args.video,args.overlay)
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print({k:v for k,v in result.items() if k!='results'})
