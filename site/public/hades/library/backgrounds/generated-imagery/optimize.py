#!/usr/bin/env python3
"""HADES REVIEW — evaluate translated, fixed overlays across all decoded frames.
Requires Pillow, numpy, ffmpeg. No logos are modified. Usage: optimize.py video light.png dark.png output_dir.
Both PNGs must be transparent and have the video aspect ratio; no upscaling of source footage.
"""
import argparse,json,subprocess
from pathlib import Path
import numpy as np
from PIL import Image

def lum(x):
    x=x/255.; x=np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)
    return x[...,0]*.2126+x[...,1]*.7152+x[...,2]*.0722

def optimize(video, light, dark, out):
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_streams','-of','json',str(video)]))['streams'][0]
    w,h=info['width'],info['height']; candidates=[]
    for tone,path in [('light',light),('dark',dark)]:
        with Image.open(path) as im:
            if 'A' not in im.getbands() or im.width*h != im.height*w: raise ValueError('RGBA with matching ratio required')
            im=im.convert('RGBA').resize((w,h),Image.Resampling.LANCZOS); box=im.getbbox()
            if not box: raise ValueError('Empty overlay')
            crop=im.crop(box); a=np.asarray(crop); rgb=a[:,:,:3].astype(np.int16)
        mask=(a[:,:,3]>=230)&(np.max(np.abs(rgb-[239,75,50]),axis=2)>12)
        yy,xx=np.nonzero(mask); fg=rgb[mask]; alpha=a[:,:,3][mask,None]/255.
        if not len(xx): raise ValueError('No measured text pixels')
        for anchor in ('left','right'):
            for height in (12,18,32,46,60,74):
                x=round(w*.08) if anchor=='left' else w-round(w*.08)-crop.width
                y=h-round(h*height/100)-crop.height
                if x<0 or y<0 or x+crop.width>w or y+crop.height>h: continue
                candidates.append(dict(tone=tone,anchor=anchor,bottom=height,x=x,y=y,crop=crop,xx=xx+x,yy=yy+y,fg=fg,alpha=alpha,rows=[]))
    if not candidates: raise ValueError('No placements fit')
    with subprocess.Popen(['ffmpeg','-v','error','-noautorotate','-i',str(video),'-map','0:v:0','-an','-f','rawvideo','-pix_fmt','rgb24','-fps_mode','passthrough','-'],stdout=subprocess.PIPE) as p:
        i=0
        while True:
            raw=p.stdout.read(w*h*3)
            if not raw: break
            if len(raw)!=w*h*3: raise ValueError('Incomplete frame')
            frame=np.frombuffer(raw,dtype=np.uint8).reshape(h,w,3)
            for c in candidates:
                bg=frame[c['yy'],c['xx']]; b=lum(bg); f=lum(c['fg']*c['alpha']+bg*(1-c['alpha'])); cr=(np.maximum(b,f)+.05)/(np.minimum(b,f)+.05)
                c['rows'].append((float(np.mean(cr>=4.5)*100),float(cr.min())))
            i+=1
        if p.wait(): raise RuntimeError('Decode failed')
    if not i: raise ValueError('No frames')
    def stats(c):
        arr=np.array(c['rows']); j=int(np.argmin(arr[:,0])); return {k:c[k] for k in ('tone','anchor','bottom','x','y')}|dict(worst_pct=float(arr[j,0]),worst_frame=j,mean_pct=float(arr[:,0].mean()),minimum=float(arr[:,1].min()),passing_frames=int(np.sum(arr[:,0]==100)))
    ranked=sorted(zip(candidates,map(stats,candidates)),key=lambda pair:(pair[1]['worst_pct'],pair[1]['mean_pct'],pair[1]['minimum']),reverse=True)
    best,s=ranked[0]; out=Path(out);out.mkdir(parents=True,exist_ok=True)
    png=Image.new('RGBA',(w,h));png.paste(best['crop'],(best['x'],best['y']));png.save(out/'optimized.REVIEW.png',optimize=True)
    result=dict(status='PUBLIC REVIEW',video=Path(video).name,width=w,height=h,frames=i,candidates=len(ranked),best=s,ranked=[v for _,v in ranked],limits='Fixed translated overlays; near-opaque non-vermilion pixels only; 4.5:1 SDR approximation; bottom is gap from lower edge of artwork, not text baseline; no device or print certification.')
    (out/'placement.REVIEW.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps({k:v for k,v in result.items() if k!='ranked'}),flush=True)
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('video');p.add_argument('light');p.add_argument('dark');p.add_argument('output_dir');a=p.parse_args();optimize(a.video,a.light,a.dark,a.output_dir)
