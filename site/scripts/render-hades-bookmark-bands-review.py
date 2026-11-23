#!/usr/bin/env python3
"""HADES bookmark source-exact raster/PDF export. PUBLIC REVIEW, never FINAL."""
from __future__ import annotations
import base64
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path
from PIL import Image
import fitz
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "site/public/hades/library/bookmark-bands"
DEPLOYED = ROOT / "hades/library/bookmark-bands"
FOLDER = "raster"
OUT = SOURCE / FOLDER
LOGO_SHA = "79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7"
SVG_NAMES = [f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.svg" for lang in ("EN", "FA")]
PNG_NAMES = []
WEBP_NAMES = []
A4_PNG_NAMES = [f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.png" for lang in ("EN", "FA")]
A4_WEBP_NAMES = [f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.webp" for lang in ("EN", "FA")]
PDF_NAMES = [f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.pdf" for lang in ("EN", "FA")]
ZIP_NAME = "HADES_Bookmark_Bands_A4_PDF_PNG_WEBP_SVG_REVIEW.zip"
MANIFEST_NAME = "HADES_Bookmark_Bands_Raster_Manifest_REVIEW.json"
README_NAME = "README_REVIEW.txt"

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def assert_source_originals() -> dict:
    records = {}
    for name in SVG_NAMES:
        p = SOURCE / name
        raw = p.read_bytes()
        assert raw.lstrip().startswith(b"<svg") or raw.lstrip().startswith(b"<?xml"), name
        embedded = re.findall(rb"data:image/png;base64,([A-Za-z0-9+/=]+)", raw)
        assert embedded, f"Original owner mark missing from {name}"
        for b64 in embedded:
            assert sha(base64.b64decode(b64)) == LOGO_SHA, f"Owner image differs: {name}"
        records[name] = {"sha256": sha(raw), "original_owner_png_embeddings": len(embedded)}
    return records

def clean_output():
    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.iterdir():
        if p.is_file() and p.name.startswith(("HADES_Bookmark_", "HADES_Bookmarks_", "README_REVIEW")):
            p.unlink()

def run_browser():
    with sync_playwright() as engine:
        browser = engine.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        paper = browser.new_page(viewport={"width": 794, "height": 1123}, device_scale_factor=1)
        for lang in ("EN", "FA"):
            svg = (SOURCE / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.svg").read_bytes()
            uri = "data:image/svg+xml;base64," + base64.b64encode(svg).decode("ascii")
            html = (
                '<!doctype html><html lang="' + ("fa" if lang == "FA" else "en") +
                '"><head><meta charset="utf-8"><style>'
                '@page {size:210mm 297mm;margin:0}html,body{margin:0;padding:0;width:210mm;height:297mm;overflow:hidden}'
                'img{width:210mm;height:297mm;display:block;object-fit:contain}'
                'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>'
                '<body><img id="art" src="' + uri + '"></body></html>'
            )
            paper.set_content(html, wait_until="load")
            paper.locator("#art").evaluate("(el) => el.decode()")
            paper.screenshot(path=str(OUT / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.png"),
                             full_page=False, animations="disabled")
            with Image.open(OUT / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.png") as proof:
                assert proof.size == (794, 1123), (lang, proof.size)
                proof.convert("RGB").save(OUT / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.webp", "WEBP", quality=92, method=6)

            paper.pdf(path=str(OUT / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.pdf"),
                      width="210mm", height="297mm", print_background=True, prefer_css_page_size=True)
            doc = fitz.open(OUT / f"HADES_Bookmark_Bands_A4_{lang}_REVIEW.pdf")
            assert doc.page_count == 1, (lang, doc.page_count)
            box = doc[0].rect
            assert abs(box.width - 595.28) < 1 and abs(box.height - 841.89) < 1, (lang, box)
            pix = doc[0].get_pixmap(matrix=fitz.Matrix(0.6, 0.6), alpha=False)
            assert pix.width > 300 and pix.height > 400
            doc.close()
        browser.close()

def release(source_records):
    files = [*A4_PNG_NAMES, *A4_WEBP_NAMES, *PDF_NAMES]
    for name in files:
        assert (OUT / name).stat().st_size > 500, name
    records = {}
    for name in files + SVG_NAMES:
        path = (OUT / name) if name in files else SOURCE / name
        raw = path.read_bytes()
        records[name] = {"sha256": sha(raw), "bytes": len(raw)}
    manifest = {
        "title": "HADES Architectural Bookmark Bands / A4 FA & EN",
        "state": "PUBLIC REVIEW — NOT FINAL",
        "approved_signature_color": "#EF4B32",
        "supporting_colors_fonts": "PROPOSED ONLY",
        "original_owner_png_sha256": LOGO_SHA,
        "original_svg_provenance": source_records,
        "files": records,
        "open": ["physical phone recognition 48/96px", "A4 ruler measurement on paper",
                 "licensed authentic Mikhak", "owner FINAL authorization"]
    }
    (OUT / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / README_NAME).write_text(
        "HADES ARCHITECTURAL BOOKMARK BANDS — PUBLIC REVIEW (NOT FINAL)\n"
        "2 unchanged A4 editable SVG sheets with four 130 x 32 mm bands each.\n"
        "2 real one-page 210 x 297 mm Chromium PDF print proofs.\n"
        "2 PNG 794 x 1123 and 2 WebP 794 x 1123 print previews.\n"
        "Original owner isolated PNG remains embedded exactly in the source SVGs.\n"
        "PDF and raster are browser-rendered derivatives, not certified logo masters.\n"
        "Print at actual size/100 percent; measure the 50 mm ruler on real paper.\n"
        "Band fit, trim/overlap, physical 48/96 px phone, Mikhak and FINAL OPEN.\n"
        "Only #EF4B32 is approved; neutrals and typography are proposals.\n", encoding="utf-8"
    )
    names = SVG_NAMES + files + [MANIFEST_NAME, README_NAME]
    with zipfile.ZipFile(OUT / ZIP_NAME, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in names:
            archive.write((SOURCE / name) if name in SVG_NAMES else (OUT / name), arcname=name)
    with zipfile.ZipFile(OUT / ZIP_NAME) as archive:
        assert archive.testzip() is None
        assert sorted(archive.namelist()) == sorted(names)
    DEPLOYED.mkdir(parents=True, exist_ok=True)
    dest = DEPLOYED / FOLDER
    dest.mkdir(parents=True, exist_ok=True)
    for f in OUT.iterdir():
        if f.is_file():
            shutil.copy2(f, dest / f.name)
            assert (dest / f.name).read_bytes() == f.read_bytes(), f.name
    print(json.dumps({"status": "PASS", "source_logo_sha": LOGO_SHA,
                      "generated": len(names) + 1, "mirror_files": len(list(OUT.iterdir())),
                      "zip_bytes": (OUT / ZIP_NAME).stat().st_size}, ensure_ascii=False))

if __name__ == "__main__":
    originals = assert_source_originals()
    clean_output()
    run_browser()
    release(originals)
