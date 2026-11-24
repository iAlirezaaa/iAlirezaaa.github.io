"""HADES two-shot VSE builder / PUBLIC REVIEW. Requires hades_vse.py beside this file."""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from hades_vse import inspect_bundle, build_blend


def plate(path, size):
    if path.stat().st_size > 20_000_000:
        raise ValueError('Plate exceeds 20 MB')
    data = path.read_bytes()
    if len(data) < 33 or data[:16] != b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' or struct.unpack('>II', data[16:24]) != size:
        raise ValueError('Use PNG stills matching the exact project dimensions')
    return data


def plan(p, a, b):
    if p['mode'] != 'alpha':
        raise ValueError('Use an alpha batch ZIP, not a flattened composite')
    return {'status': 'PUBLIC REVIEW', 'fps': 24, 'dimensions': p['dimensions'], 'cut_frame': 16,
            'plates': [{'file': name, 'start': start, 'end_exclusive': end, 'channel': 1,
                        'sha256': hashlib.sha256(data).hexdigest()}
                       for name, start, end, data in [('shot_a.png', 1, 16, a), ('shot_b.png', 16, 31, b)]],
            'overlay': {'channel': 2, 'start': 1, 'end_exclusive': 31}}


def build(p, frames, a, b, out, manifest):
    import bpy
    bpy.context.preferences.filepaths.save_version = 0
    target = build_blend(p, frames, out)
    scene = bpy.context.scene
    editor = scene.sequence_editor
    folder = out / 'plates'
    folder.mkdir()
    for rec, data in zip(manifest['plates'], (a, b)):
        file = folder / rec['file']
        file.write_bytes(data)
        img = bpy.data.images.load(str(file), check_existing=False)
        if tuple(img.size) != tuple(p['dimensions']):
            raise ValueError('Blender could not decode plate at expected dimensions')
        bpy.data.images.remove(img)
        strip = editor.strips.new_image(rec['file'], str(file), 1, rec['start'])
        strip.frame_final_duration = rec['end_exclusive'] - rec['start']
        strip.blend_type = 'ALPHA_OVER'
        if (strip.frame_final_start, strip.frame_final_end) != (rec['start'], rec['end_exclusive']):
            raise RuntimeError('Unexpected plate timing')
        strip.directory = '//plates/'
    bpy.ops.wm.save_as_mainfile(filepath=str(target), relative_remap=False)
    (out / 'two_shot_plan.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    return target


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('shot_a', type=Path)
    parser.add_argument('shot_b', type=Path)
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--out', type=Path)
    opt = parser.parse_args(args)
    p, frames = inspect_bundle(opt.bundle)
    a, b = (plate(x, tuple(p['dimensions'])) for x in (opt.shot_a, opt.shot_b))
    manifest = plan(p, a, b)
    print(json.dumps(manifest, indent=2))
    if not opt.check_only:
        if not opt.out:
            parser.error('--out is required for native build')
        print(build(p, frames, a, b, opt.out.resolve(), manifest))


if __name__ == '__main__':
    main()
