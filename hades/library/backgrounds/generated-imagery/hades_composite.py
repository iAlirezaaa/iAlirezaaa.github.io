#!/usr/bin/env python3
"""HADES PUBLIC REVIEW: render a silent six-second native title composite."""
import argparse, hashlib, json, subprocess, tempfile
from pathlib import Path

PROFILES = {
    'landscape': (1280, 720, -26, 'bed6c87fa443d754e28a067786fb1e606812b0132c2c6bad75c07be71d82eb83'),
    'portrait': (720, 1280, 0, '1dd271dbe36d968671dc541561c2941639ff1fa1493e7ebe5baae8bedf330af5'),
}

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def probe(p):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_streams','-of','json',str(p)]))['streams'][0]

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('profile', choices=PROFILES)
    for key in ('footage','title','output'):
        p.add_argument(key, type=Path)
    a = p.parse_args()
    w,h,dx,expected = PROFILES[a.profile]
    receipt = a.output.with_suffix('.json')
    if a.output.suffix.lower() != '.mp4' or a.output.exists() or receipt.exists():
        p.error('Choose a new MP4 and receipt path')
    if sha(a.title) != expected:
        p.error('Native title SHA-256 mismatch')
    v = probe(a.footage)
    if (v['width'],v['height'],v['avg_frame_rate'],v['r_frame_rate']) != (w,h,'24/1','24/1') or int(v.get('nb_read_frames',0)) < 144:
        p.error('Footage must be matching dimensions, 24 fps and at least 144 decoded frames')
    source_hash = sha(a.footage)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=a.output.parent) as tmp:
        out = Path(tmp)/'proof.mp4'
        filt = f'[1:v]format=rgba,fade=t=in:s=12:n=12:alpha=1,fade=t=out:s=108:n=12:alpha=1[t];[0:v]setpts=PTS-STARTPTS[v];[v][t]overlay=x={dx}:y=0:format=auto,format=yuv420p[o]'
        subprocess.run(['ffmpeg','-v','error','-filter_complex_threads','1','-i',str(a.footage),'-loop','1','-framerate','24','-i',str(a.title),'-filter_complex',filt,'-map','[o]','-an','-r','24','-fps_mode','cfr','-frames:v','144','-c:v','libx264','-threads','2','-crf','18','-movflags','+faststart',str(out)],check=True)
        q = probe(out)
        if (q['width'],q['height'],q['avg_frame_rate'],q['nb_read_frames']) != (w,h,'24/1','144'):
            raise RuntimeError('Unexpected output stream')
        if sha(a.title)!=expected or sha(a.footage)!=source_hash:
            raise RuntimeError('Input changed during export')
        data = dict(status='PUBLIC REVIEW',profile=a.profile,frames=144,fps=24,translation_px=[dx,0],title_sha256=expected,footage_sha256=source_hash,output_sha256=sha(out),contrast='OPEN',audio=False)
        out.rename(a.output)
        receipt.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')

if __name__ == '__main__':
    main()
