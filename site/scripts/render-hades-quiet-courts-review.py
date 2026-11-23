"""HADES Quiet Courts — byte-identical PUBLIC REVIEW raster release, never a logo generator."""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET
import zipfile

import cairosvg
from PIL import Image

ROOT = Path("site/public/hades/library/backgrounds/quiet-courts")
DEPLOY = Path("hades/library/backgrounds/quiet-courts")
SPECS = [
    ("HADES_Still_Threshold_16x9_REVIEW", (1920, 1080)),
    ("HADES_Bone_Interstice_9x16_REVIEW", (1080, 1920)),
    ("HADES_Charcoal_Echelon_1x1_REVIEW", (1080, 1080)),
]
ACCENT = "#EF4B32"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_mirrored(rel: str, data: bytes) -> None:
    for base in (ROOT, DEPLOY):
        dest = base / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)


def archive(entries: dict[str, bytes]) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(entries):
            info = zipfile.ZipInfo(name, (2026, 11, 23, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, entries[name])
    return out.getvalue()


def main() -> None:
    payloads = {}
    descriptions = []
    for stem, size in SPECS:
        rel_svg = "assets/" + stem + ".svg"
        svg = (ROOT / rel_svg).read_bytes()
        assert svg == (DEPLOY / rel_svg).read_bytes(), rel_svg
        tree = ET.fromstring(svg)
        assert tree.attrib.get("width") == str(size[0])
        assert tree.attrib.get("height") == str(size[1])
        assert b"PUBLIC REVIEW" in svg and ACCENT.encode() in svg, stem
        assert b"IMG_7187" not in svg and b"<image" not in svg
        payloads[rel_svg] = svg
        png = cairosvg.svg2png(bytestring=svg, output_width=size[0], output_height=size[1])
        with Image.open(io.BytesIO(png)) as im:
            im.load()
            assert im.size == size
            rgb = im.convert("RGB")
            assert len(set(rgb.resize((48, 48)).getdata())) > 7, stem
            formats = {"png": png}
            jpg = io.BytesIO()
            rgb.save(jpg, format="JPEG", quality=94, subsampling=0, optimize=True)
            formats["jpg"] = jpg.getvalue()
            webp = io.BytesIO()
            rgb.save(webp, format="WEBP", lossless=True, method=6)
            formats["webp"] = webp.getvalue()
        for ext, data in formats.items():
            rel = "assets/" + stem + "." + ext
            with Image.open(io.BytesIO(data)) as check:
                check.load()
                assert check.size == size
                assert check.format.lower() == {"jpg":"jpeg"}.get(ext, ext)
            write_mirrored(rel, data)
            payloads[rel] = data
            descriptions.append({"file": rel, "width": size[0], "height": size[1],
                                 "bytes": len(data), "sha256": digest(data)})
            print("RENDER PASS", rel, len(data), digest(data), flush=True)

    readme = (
        "HADES Quiet Courts / PUBLIC REVIEW / 2026-11-23\n"
        "Three independent architecture SVGs and nine native-resolution raster exports.\n"
        "Only #EF4B32 approved. Neutrals and typography proposed.\n"
        "Four owner logo originals and their manifest are untouched.\n"
        "On light backgrounds, an original white mark belongs on a separate dark plate.\n"
        "Physical phone, print, real Mikhak, FINAL: OPEN.\n"
    ).encode()
    payloads["README.txt"] = readme
    release = {
        "status": "PUBLIC REVIEW",
        "approved_accent": ACCENT,
        "binary_source": "Identical published standalone SVG masters via CairoSVG/Pillow",
        "derivatives": descriptions,
        "all_original_svg_sha256": {
            rel: digest(data) for rel, data in payloads.items() if rel.endswith(".svg")
        },
        "open": ["Physical handset", "Physical printing", "Licensed Mikhak", "Owner FINAL"],
    }
    manifest = (json.dumps(release, ensure_ascii=False, indent=2) + "\n").encode()
    payloads["raster-manifest.REVIEW.json"] = manifest
    write_mirrored("raster-manifest.REVIEW.json", manifest)
    zip_name = "HADES_Quiet_Courts_3_SVG_9_Raster_PUBLIC_REVIEW.zip"
    package = archive(payloads)
    write_mirrored(zip_name, package)
    with zipfile.ZipFile(io.BytesIO(package)) as z:
        assert len(z.namelist()) == 14, z.namelist()
        for name in z.namelist():
            assert z.read(name) == payloads[name], name
    for item in descriptions:
        rel = item["file"]
        assert (ROOT / rel).read_bytes() == (DEPLOY / rel).read_bytes()
    print("RELEASE PASS 3 SVG + 9 RASTER + MANIFEST + README = 14 ZIP entries",
          "ZIP_SHA256", digest(package), flush=True)


if __name__ == "__main__":
    main()
