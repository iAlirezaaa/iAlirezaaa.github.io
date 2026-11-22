# QA — Portico Studies — 2026-11-22

- Source reviewed against owner-confirmed HADES brand architecture, original four-logo manifest, approved #EF4B32 and Classic/Modern dual-mode intent.
- Four original raster logo files and their manifest are untouched. SVGs embed only the previously public owner original white isolated PNG as an unmodified base64 image, on a detached dark plaque.
- Static source checks in creation code: 4 SVG sources, 2 bilingual standalone HTML editors, matching mirrored paths, no autotrace/recolor/monogram.
- Actual browser tests at 320/390/430, functional export, live Pages HTTP200/MIME/SHA: OPEN until independently observed.
- Physical A4, actual phone 48/96px recognition, real installed Mikhak: OPEN. FINAL: not approved.

## Real Chromium optical screenshot correction
Initial observed Chromium pass found the embedded white owner original nearly invisible because source had 900px-wide black margins around a 22px-wide fine mark. Corrected only the **display viewport** via nested SVG cropping of blank source margins (source-space viewBox 402 911 140 230, verified original mark ink bbox 462..483 × 951..1097). Kept original PNG data URI byte-for-byte exactly as before; no raster edit, recolor, redraw, autotrace, new logo, or clip of mark ink. The viewport is a REVIEW application decision, not an approved master crop. Rerun hosted and Chromium evidence after correction.

## Actual screenshot visual inspection follow-up
The real 390 CSS px Chromium screenshots after safe original-margin viewBox reveal the owner original clearly, but exposed a *real RTL SVG anchor bug*: Persian text extended to the artboard edge in Classic and overlapped the structural block in Modern. Changed Persian SVG text-anchor from end to start under RTL direction, and moved the Modern Persian editorial folio to a right-anchored layout position. Added getBBox measured ink-bound assertions for all text nodes to the real Chromium QA. No changes to owner image bytes. Await rerun proof.
