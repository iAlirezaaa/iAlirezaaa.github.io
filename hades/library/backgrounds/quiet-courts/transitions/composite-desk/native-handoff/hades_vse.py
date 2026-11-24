"""HADES VSE handoff / PUBLIC REVIEW. Blender 4.4+ target; native import OPEN."""
import argparse
import hashlib
import json
import struct
import sys
import zipfile
from pathlib import Path

NAMES = [f"frame_{i:04d}.png" for i in range(30)]
SIZES = {(1920, 1080), (1080, 1920), (1080, 1080)}


def inspect_bundle(path):
    with zipfile.ZipFile(path) as z:
        entries = z.infolist()
        if len(entries) != 31 or set(z.namelist()) != set(NAMES + ["project.json"]):
            raise ValueError("Expected exactly 30 numbered PNGs and project.json")
        if any(e.file_size > 20_000_000 for e in entries) or sum(e.file_size for e in entries) > 200_000_000:
            raise ValueError("Archive exceeds safety limits")
        p = json.loads(z.read("project.json"))
        size = tuple(p["dimensions"])
        if p["schema"] != "hades-batch-1" or p["fps"] != 24 or p["cut"] != [14, 15] or size not in SIZES or p["mode"] not in ("alpha", "composite"):
            raise ValueError("Unsupported project contract")
        outputs = p["outputs"]
        if len(outputs) != 30 or [o["name"] for o in outputs] != NAMES:
            raise ValueError("Invalid frame manifest")
        frames = []
        for name, record in zip(NAMES, outputs):
            data = z.read(name)
            if data[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" or len(data) < 33 or struct.unpack(">II", data[16:24]) != size:
                raise ValueError(f"Invalid PNG header or size: {name}")
            if hashlib.sha256(data).hexdigest() != record["sha256"]:
                raise ValueError(f"SHA-256 mismatch: {name}")
            frames.append(data)
        return p, frames


def timeline(p):
    channel = 2 if p["mode"] == "alpha" else 1
    return [{"file": name, "start": i + 1, "end_exclusive": i + 2, "channel": channel} for i, name in enumerate(NAMES)]


def build_blend(p, frames, out):
    import bpy
    if bpy.app.version < (4, 4, 0):
        raise RuntimeError("Blender 4.4+ required")
    scene = bpy.context.scene
    if scene.sequence_editor and len(scene.sequence_editor.strips):
        raise RuntimeError("Use --factory-startup; existing edit is not overwritten")
    out.mkdir(parents=True, exist_ok=False)
    media = out / "frames"
    media.mkdir()
    for name, data in zip(NAMES, frames):
        (media / name).write_bytes(data)
    scene.name = "HADES Transition REVIEW"
    scene.render.resolution_x, scene.render.resolution_y = p["dimensions"]
    scene.render.resolution_percentage = 100
    scene.render.fps, scene.render.fps_base = 24, 1.0
    scene.frame_start, scene.frame_end = 1, 30
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    editor = scene.sequence_editor_create()
    for item in timeline(p):
        strip = editor.strips.new_image(item["file"], str(media / item["file"]), item["channel"], item["start"])
        strip.frame_final_duration = 1
        strip.blend_type = "ALPHA_OVER"
        if (strip.frame_final_start, strip.frame_final_end) != (item["start"], item["end_exclusive"]):
            raise RuntimeError("Unexpected strip timing")
    scene.timeline_markers.new("CUT A / B", frame=16)
    scene.frame_set(16)
    target = out / "HADES_Transition_REVIEW.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(target), relative_remap=False)
    for strip in editor.strips:
        strip.directory = "//frames/"
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    (out / "project.json").write_text(json.dumps(p, indent=2), encoding="utf-8")
    return target


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--out", type=Path)
    a = parser.parse_args(args)
    p, frames = inspect_bundle(a.bundle)
    print(json.dumps({"status": "REVIEW", "dimensions": p["dimensions"], "fps": 24, "cut_blender_frame": 16, "mode": p["mode"], "timeline": timeline(p)}, indent=2))
    if not a.check_only:
        if not a.out:
            parser.error("--out is required for native build")
        print(build_blend(p, frames, a.out.resolve()))


if __name__ == "__main__":
    main()
