#!/usr/bin/env python3
"""Render PUBLIC REVIEW exact-original mark-plate compositions; no logo master changes."""
from pathlib import Path
from io import BytesIO
import hashlib
import base64
import json
import zipfile
import xml.etree.ElementTree as ET
import cairosvg
from PIL import Image

BASE = Path("hades")
MIRROR = Path("site/public/hades")
REL = Path("library/backgrounds/quiet-courts/mark-plate/ratios")
OUT = REL / "raster"
SOURCE = [
    ("Still_Threshold_16x9", REL / "HADES_Still_Threshold_16x9_Original_Mark_PUBLIC_REVIEW.svg", (1920, 1080)),
    ("Bone_Interstice_9x16", Path("library/backgrounds/quiet-courts/mark-plate/HADES_Bone_Original_White_Mark_Detached_Plaque_PUBLIC_REVIEW.svg"), (1080, 1920)),
    ("Charcoal_Echelon_1x1", REL / "HADES_Charcoal_Echelon_1x1_Original_Mark_PUBLIC_REVIEW.svg", (1080, 1080)),
]
NAME = "HADES_Original_Mark_Plaques_3_Ratios_9_Rasters_PUBLIC_REVIEW"
ORIGINAL_SHA256 = "79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
original = (BASE / "assets/IMG_7187(2).png").read_bytes()
assert hashlib.sha256(original).hexdigest() == ORIGINAL_SHA256

data = {}
record = []
for key, rel, dimensions in SOURCE:
    source = (BASE / rel).read_bytes()
    assert b"PUBLIC REVIEW" in source, rel
    svg = ET.fromstring(source)
    assert (int(svg.get("width")), int(svg.get("height"))) == dimensions, rel
    imgs = svg.findall(".//{http://www.w3.org/2000/svg}image")
    assert len(imgs) == 1, (rel, len(imgs))
    href = imgs[0].get("href") or imgs[0].get("{http://www.w3.org/1999/xlink}href")
    assert href and "base64," in href, rel
    assert base64.b64decode(href.split("base64,", 1)[1]) == original, rel
    assert (MIRROR / rel).read_bytes() == source, rel
    png = cairosvg.svg2png(bytestring=source, output_width=dimensions[0], output_height=dimensions[1])
    rgba = Image.open(BytesIO(png)).convert("RGBA")
    assert rgba.size == dimensions, (key, rgba.size)
    # Opaque original architectural background, keep source logo embedded and untouched.
    rgb = Image.new("RGB", dimensions, "#161615")
    rgb.paste(rgba, mask=rgba.getchannel("A"))
    names = {}
    for ext in ("png", "jpg", "webp"):
        buffer = BytesIO()
        if ext == "png":
            rgb.save(buffer, format="PNG", optimize=True)
        elif ext == "jpg":
            rgb.save(buffer, format="JPEG", quality=96, subsampling=0, optimize=True)
        else:
            rgb.save(buffer, format="WEBP", lossless=True, method=6)
        blob = buffer.getvalue()
        im = Image.open(BytesIO(blob))
        im.load()
        assert im.size == dimensions and im.format.lower() in ("png", "jpeg", "webp")
        filename = f"HADES_{key}_Original_Mark_{dimensions[0]}x{dimensions[1]}_PUBLIC_REVIEW.{ext}"
        names[ext] = filename
        data[filename] = blob
        record.append({"file": filename, "format": ext, "width": dimensions[0], "height": dimensions[1],
                       "bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest()})
    record.append({"source_svg": rel.as_posix(), "sha256": hashlib.sha256(source).hexdigest(),
                   "original_owner_mark_sha256": ORIGINAL_SHA256})
    data[f"SOURCE_{key}_PUBLIC_REVIEW.svg"] = source

readme = """# HADES Original Mark / Detached Plaque Raster Pack — PUBLIC REVIEW

Three existing architectural source compositions in native 16:9, 9:16 and 1:1 dimensions. Each source SVG embeds the original owner-supplied white PNG **byte-identically** and places it on an independently designed dark plaque. The 9:16 SVG is reused; no background or logo is duplicated or redrawn.

Outputs: 3 source-composition SVG files + 3 PNG + 3 high-quality JPEG + 3 lossless WebP + JSON SHA-256 manifest. All renderings are *derivative raster applications*, not certified logo masters. Rasterization resamples source pixels; it does not alter the authoritative owner PNG or approve the composition.

Approved accent: #EF4B32 only. Dark, Bone and Charcoal supporting swatches and every placement remain PROPOSED / PUBLIC REVIEW. Print color, physical-phone micro-legibility and Mikhak licensing remain OPEN. Pattern02 is PRIVATE; Pattern03 is STOPPED. No private client material is included.

Source pages: /hades/library/backgrounds/quiet-courts/mark-plate/ratios/ (EN), /hades/fa/library/backgrounds/quiet-courts/mark-plate/ratios/ (FA).
"""
data["README_PUBLIC_REVIEW.md"] = readme.encode()
manifest = {
    "status": "PUBLIC REVIEW — not FINAL", "schema": "hades-mark-plate-raster-v1",
    "approved_accent": "#EF4B32", "other_palette_approved": False,
    "logo_source": "IMG_7187(2).png", "logo_original_sha256": ORIGINAL_SHA256,
    "native_image_dimensions": [[1920,1080],[1080,1920],[1080,1080]],
    "files": record, "real_device_recognition": "OPEN", "physical_print": "OPEN",
    "mikhak_genuine_font": "OPEN",
}
data["manifest.REVIEW.json"] = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode()
z = BytesIO()
with zipfile.ZipFile(z, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as pack:
    for filename, blob in sorted(data.items()):
        info = zipfile.ZipInfo(filename, (2026,11,23,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        pack.writestr(info, blob, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
data[NAME + ".zip"] = z.getvalue()
for relroot in (BASE, MIRROR):
    folder = relroot / OUT
    folder.mkdir(parents=True, exist_ok=True)
    for filename, blob in sorted(data.items()):
        (folder / filename).write_bytes(blob)
for filename, blob in data.items():
    assert (BASE / OUT / filename).read_bytes() == (MIRROR / OUT / filename).read_bytes()
    assert hashlib.sha256((BASE / OUT / filename).read_bytes()).digest() == hashlib.sha256(blob).digest()
print("PASS 3 SVG source exact-owner-raster, 9 decoded native-ratio rasters, mirrored ZIP and manifest")
