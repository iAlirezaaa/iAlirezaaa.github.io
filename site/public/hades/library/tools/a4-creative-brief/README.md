# HADES A4 Creative Brief — public REVIEW working category

Page: https://ialirezaaa.github.io/hades/library/tools/a4-creative-brief/

Offline standalone HTML supports EN/FA edits, local JSON save/import, A4 print to PDF and optional locally imported font. Preview SVG contains an exact owner-supplied raster inside its composition; it is not an official vector logo. ViewBox simply crops blank original raster margins in an application context. Includes a synthetic example project.

HTML and SVG are mirrored under `hades/` and `site/public/hades/`. This does **not** copy any private Phase03 file. No FINAL, physical print approval, certified vector master, Mikhak font distribution, or private Pattern02.

## Verified hosted binaries and delivery — 2026-11-21
- [Actual, real synthetic A4 PDF](/hades/library/tools/a4-creative-brief/HADES_A4_Creative_Brief_FA_Example_REVIEW.pdf) — one page, 67,487 bytes, Git blob `f76593af9fc5dbc901256a861e3bc08c8a960300`; source PNG embedded logo unchanged. Browser/PDF font uses Linux fallback, NOT Mikhak.
- [Actual 300dpi PNG](/hades/library/tools/a4-creative-brief/HADES_A4_Creative_Brief_FA_Example_300dpi_REVIEW.png) — 2479×3508, 154,058 bytes, Git blob `7adb40433e6e5cda1445fa9312526c165871617b`.
- [Binary checksum manifest](/hades/library/tools/a4-creative-brief/binary-manifest.review.json) — Git blob `c119cea43728a6bee3a6063a01f179ab3dbb33a3`.
- GitHub binary readback: all three files present in `hades/` and `site/public/hades/` with identical Git blobs in each pair, commit `9ede1f8fdd4c75e571f71bb17495c7428c0997c9` (GitHub Actions uploader).
- Full Chromium 320/390/430 browser test plus public HTTPS HTML/SVG/JSON and source mirror checks PASS, workflow [44851720626](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44851720626). Independent LIVE HTTP checks for the binary PDF/PNG added to workflow now; their result must be checked, not presumed.
- These are review proofs, NOT FINAL or printer-approved. Layered PSD is not certified, Mikhak actual use, crop/bleed, micro original lettering and physical paper/iPhone reviews remain OPEN. No private Phase03 file, original logo redraw or Pattern02 published.

## 2026-11-21 — Real nine-layer raster PSD (REVIEW)
- [Direct PSD download](/hades/library/tools/a4-creative-brief/HADES_A4_Creative_Brief_FA_Layered_REVIEW.psd) at 2479×3508 pixels, 9 **raster** layers, RLE Photoshop PSD v1, 2,193,655 bytes. Site source and publication mirror are the same exact Git blob `60de60f50b0cccffd4367c4c9ccb9a9cb89dc034`.
- [PSD build manifest](/hades/library/tools/a4-creative-brief/psd-manifest.review.json): SHA-256 `28858b56976d9c7d9571689780c191cbcc724acb682316f02b0e39480fd0246d`; the source PNG SHA-256 was locked to `ea0ec218ff67953e5734f94da95f96228f4ea0835c65117efa4568b139ecae36`. The generated composite was pixel-identical to the original print PNG, tested with Pillow and ImageMagick locally. The GitHub Actions builder tested the 9-layer manifest and both mirror paths.
- Source-locked builder: [script](https://github.com/iAlirezaaa/iAlirezaaa.github.io/blob/main/scripts/brand/build-hades-a4-psd.py). Raster text remains uneditable in PSD: use the [working HTML editor](/hades/library/tools/a4-creative-brief/) for text. Print shop/paper, real Mikhak, original micro-lettering and owner approval still OPEN. **Not a vector logo, not FINAL.**
- Release/deployment and hosted HTTP results must be checked separately; a Git blob or successful local render is not a live HTTP receipt.
