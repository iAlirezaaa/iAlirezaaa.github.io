#!/usr/bin/env python3
"""HADES motion render kit / PUBLIC REVIEW. Python 3.9+ and FFmpeg with libx264.
No upload, no audio, no logo. Only exact known original PNGs are accepted.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

FPS = 24
ASSETS = {
    'roots': ('obsidian_roots_in_vermilion_flow.png', '808a919b8cde4feb173fb02039be3b5f09401c46b23a2bfb218283234550e9e9'),
    'veil': ('vermilion_veil_among_obsidian_shards.png', 'fb5e60664e2163bc5c9fb9c89e409ca4ec81b07880b8ff8a99004a3fa52a266b'),
    'ink': ('vermilion_ribbon_in_charcoal_flow.png', '7c87c41efe72a89ed2e828a78629feb1eb6798e83c9d15606a4ccce985dbd123'),
    'ring': ('obsidian_ring_in_bone_toned_smoke.png', 'b776761b01544e5fab81ff1002cfc2b656f56339c44afafa809b7f2afc3f75f5'),
    'paper': ('vermilion_seal_on_obsidian_still_life.png', '5bfeeae2008ec0e32e0260e33a4498961bf7fbd084040f0bd21e9283f7c4e84d'),
}
# (width, height, (asset, frames, start scale, end/peak scale, loop))
PROFILES = {
    'landscape': (1280, 720, [('roots', 64, 1.02, 1.08, False), ('veil', 64, 1.03, 1.09, False), ('ink', 64, 1.02, 1.07, False)]),
    'portrait': (720, 1280, [('ring', 144, 1.00, 1.07, True)]),
    'square': (1080, 1080, [('paper', 144, 1.00, 1.05, True)]),
}

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def run(args):
    subprocess.run(args, check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('profile', choices=PROFILES)
    p.add_argument('--sources', required=True, type=Path, help='Folder containing original PNGs')
    p.add_argument('--output', required=True, type=Path, help='New MP4 output path')
    a = p.parse_args()
    if a.output.suffix.lower() != '.mp4':
        p.error('Output must end in .mp4')
    receipt = a.output.with_suffix('.json')
    if a.output.exists() or receipt.exists():
        p.error('Output or receipt already exists; choose a new name')
    for binary in ('ffmpeg', 'ffprobe'):
        if not shutil.which(binary):
            p.error(binary + ' is required')
    w, h, shots = PROFILES[a.profile]
    verified = {}
    for key, *_ in shots:
        name, expected = ASSETS[key]
        path = a.sources / name
        if not path.is_file() or digest(path) != expected:
            p.error('Missing or non-original PNG: ' + name)
        verified[key] = expected
    a.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='hades-motion-', dir=a.output.parent) as tmp:
        d = Path(tmp)
        for i, (key, frames, lo, hi, loop) in enumerate(shots):
            t = f'(on/{frames-1})'
            ease = f'(1-cos(2*PI*{t}))/2' if loop else f'({t}*{t}*(3-2*{t}))'
            z = f'{lo}+({hi-lo:.6f})*({ease})'
            vf = (f'scale={w*2}:{h*2}:force_original_aspect_ratio=increase:flags=lanczos,'
                  f'crop={w*2}:{h*2},zoompan=z=\'{z}\':x=\'iw/2-iw/zoom/2\':'
                  f'y=\'ih/2-ih/zoom/2\':d={frames}:s={w}x{h}:fps={FPS},setsar=1')
            run(['ffmpeg', '-v', 'error', '-i', str(a.sources / ASSETS[key][0]), '-vf', vf,
                 '-frames:v', str(frames), '-an', '-c:v', 'libx264', '-threads', '2',
                 '-crf', '18', '-pix_fmt', 'yuv420p', str(d / f'{i}.mp4')])
        (d / 'list.txt').write_text(''.join(f"file '{i}.mp4'\n" for i in range(len(shots))), encoding='utf-8')
        movie = d / 'render.mp4'
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '1', '-i', str(d / 'list.txt'),
             '-c', 'copy', '-movflags', '+faststart', str(movie)])
        run(['ffmpeg', '-v', 'error', '-i', str(movie), '-f', 'null', '-'])
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames',
            '-show_streams', '-of', 'json', str(movie)]))['streams']
        total = sum(s[1] for s in shots)
        if len(probe) != 1 or any(probe[0].get(k) != v for k, v in {
            'codec_name': 'h264', 'width': w, 'height': h, 'avg_frame_rate': '24/1',
            'nb_read_frames': str(total), 'pix_fmt': 'yuv420p'}.items()):
            raise RuntimeError('Unexpected rendered stream')
        data = {'status': 'PUBLIC REVIEW', 'profile': a.profile, 'width': w, 'height': h,
                'fps': FPS, 'frames': total, 'seconds': total / FPS, 'audio': False,
                'source_sha256': verified, 'output_sha256': digest(movie)}
        movie.rename(a.output)
        receipt.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(data, indent=2))


if __name__ == '__main__':
    main()
