# HADES Contrast Studio / public REVIEW / 2026-11-22

## Deliverables
- Localized self-contained HTML/CSS/JS composition workbench: EN and FA.
- Three grouped transparent safe-area guide SVGs: 1920×1080, 1080×1920, 1080×1080.
- Reuses *existing* published architectural sources rather than replacing them.
- Loads owner original `/hades/assets/IMG_7187(2).png` directly as `img` inside an independent dark plate. Does not redraw/recolor/invert/crop source pixels; no original files or original manifest edited.
- User can edit specimen copy, select 3 background families / 3 aspect ratios, toggle guides and source logo, save REVIEW JSON settings, and Print / Save PDF using browser.
- Only #EF4B32 approved. Neutral hex codes and safe margins are proposals. No FINAL.

## Checks actually performed
- Git tree includes mirrored `site/public/hades/` and `hades/` byte-identical text for all changed assets.
- Source code generated with no inline script eval and textContent used for user text; mapping points to existing known asset names.
- 3 SVGs have explicit namespaces, viewBox, title, description, separated groups and transparent backgrounds.
- All EN/FA paths linked from homepage, both libraries and original-logo usage guides.
- GitHub blob readback and publish status must be checked separately after commit.

## OPEN / not falsely certified
- 320/390/430 CSS px real Chromium *run* and screenshot review.
- Real printed proof and native phone micro-legibility.
- Real authorized Mikhak installation; system fallback is not font proof.
- Independently hosted HTTP 200, MIME and source-byte match for all studio page and SVG paths.
- Owner visual acceptance. Logo originals, manifest, Pattern02 private and Pattern03 stopped.

## Executable browser suite added
- `tests/hades-contrast-studio.cjs` serves actual committed `hades/` assets over local HTTP.
- `.github/workflows/hades-contrast-studio-qa.yml` launches real Chromium, 320/390/430px in FA and EN, checks 3 ratio switches, logo plaque, original raster load, JSON controls, print CSS visibility, SVG downloads and horizontal overflow.
- Passing results are NOT claimed until a GitHub Actions run actually concludes SUCCESS; hosted Pages HTTP is separate.

## Additional independent hosted proof harness
- `tests/hades-contrast-studio-hosted.cjs`: performs real HTTPS GET for 10 paths including all 3 SVG overlays, both localized HTML pages, owner raster, both libraries, both original-logo guides.
- Requires HTTP 200, correct MIME and SHA-256 body equality with committed `hades/` bytes. Retry while Pages catches up, fail on any persistent mismatch. Only an actual successful run certifies this check.
- `.github/workflows/hades-contrast-studio-hosted-qa.yml` starts on source build completion and has a direct push/dispatch trigger. No equality claim from git commit alone.
