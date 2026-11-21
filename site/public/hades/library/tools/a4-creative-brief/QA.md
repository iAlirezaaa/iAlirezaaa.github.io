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
