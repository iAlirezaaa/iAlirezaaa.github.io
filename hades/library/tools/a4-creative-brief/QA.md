# A4 Creative Brief — QA & use (2026-11-21)

Status: PUBLIC **REVIEW** source for a single HADES-owned A4 working document category, not print certification, not a new logo or approval to use it as FINAL.

## Files
- `index.html`: bilingual editable A4 on one page; EN/FA; JSON save/reopen with v1 schema and REVIEW-only import guard; print to PDF via browser; local optional TTF/OTF import without redistribution; overflow/HOLD guard and required-title check.
- `preview.svg`: exact same unmodified, embedded owner source raster in a **composition**, not a certified vector logo.
- `sample.en.json`: synthetic safe non-client data, importable v1 project, REVIEW.

## Source
Public owner-original `/hades/assets/IMG_7187(2).png` Git blob `ecb84e8808059ac515a90cc5e58653958d5636e7`; expected authoritative SHA-256 `79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7`. The source bytes remain unchanged; viewBox crop excludes blank background margins. One approved accent: #EF4B32. Neutral swatches and typography proposed.

## Automated static checks
- HTML contains exact public logo base64 without altering source bytes.
- Gallery: 28/28 matching 28 catalog items. Two mirrored website copies written from exactly the same in-memory source.
- Inputs have length ceilings; imported JSON validates keys, schema, REVIEW status, size and field lengths; `textContent` used instead of `innerHTML`.
- Print CSS declares A4 size 210 × 297 mm with no margins; automatic print is disabled on missing text and apparent overflow. Browser print must be manually confirmed for physical printer.

## Open verification gates
- Actual headless browser interaction and 320/390/430 responsive screenshots have **not yet run**. Actual printed PDF layout/color and actual font-face Mikhak verification **OPEN**. CDP/used fonts and physical iPhone print are **OPEN**.
- Public HTTPS response and `Content-Type` require independent HTTP check after Pages deployment; successful commit is not proof of public URL.
- Only original public logo is embedded. PRIVATE REVIEW Phase03 assets, Pattern02 and any Pattern03 were not transferred.

## Next two
1. Execute genuine Chromium E2E on new editor at 320/390/430px for FA/EN, JSON restore/reject and one-page PDF print; record actual used font and logo micro legibility.
2. Host separate tested A4 PDF and PNG/PSD proof binaries from the editor (if connector/build supports verified byte parity), after actual font and paper QA; keep them REVIEW, not FINAL.

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

## Verified external HTTPS PSD delivery — 2026-11-21
- [Independent GitHub Actions run 44856833473](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44856833473): THREE jobs **SUCCESS** (actual PSD build + source/site mirror, GitHub Pages deploy, external HTTP download).
- From a hosted external Ubuntu runner, HTTPS downloaded the live PSD file, recomputed SHA-256 and obtained **exact byte parity** with the GitHub-built and committed PSD: 28858b56976d9c7d9571689780c191cbcc724acb682316f02b0e39480fd0246d (2,193,655 bytes). Not merely a Pages build claim.
- The earlier [44856693376](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44856693376) external HTTP gate failed because the workflow had a stale expected hash after a layer-name change; the pinned hash was corrected and the **new full run passed**.
- This proves HTTPS bytes at the time of the test, NOT real iPhone visibility, actual font Mikhak, Photoshop text editability, physical paper approval or FINAL status; those remain **OPEN**.
