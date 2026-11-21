# HADES transparent lower-third title kit · PUBLIC REVIEW QA

Date: 2026-11-21. **Status: REVIEW, NOT FINAL.**

## Files that are actually live

- [FA/EN HTML editor](https://ialirezaaa.github.io/hades/library/tools/lower-third/)
- [Classic EN 1920×1080 editable transparent SVG](https://ialirezaaa.github.io/hades/library/tools/lower-third/HADES_LowerThird_16x9_Classic_EN_REVIEW.svg)
- [Modern FA 1080×1920 editable transparent SVG](https://ialirezaaa.github.io/hades/library/tools/lower-third/HADES_LowerThird_9x16_Modern_FA_REVIEW.svg)

## Executed evidence — not inferred from a commit

- [GitHub Actions run 44930838547](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44930838547) on commit `63ec2a89d89fcec705e9b4978c6e18cbfb329e90`: **both jobs SUCCESS**.
- **Chromium 6/6:** source files served over HTTP in both mirrors (`hades/` and `site/public/hades/`) × 320/390/430px; live EN/FA editing, 16:9/9:16 download SVG, REVIEW JSON, forged FINAL rejection, excessive title overflow gate and no page horizontal overflow; actual browser screenshots in Actions artifact.
- **Deployed GitHub Pages independent HTTPS 11/11:** GET HTTP 200, expected MIME types and SHA-256 byte-for-byte equality to both GitHub source paths (editor, two SVGs, README, EN/FA libraries, EN/FA logo guides, EN/FA home, public catalog). Direct Web-tool retrieval may be environment-limited; this Actions check used real HTTPS.
- A separate **actual Inkscape local raster check** caught Persian `text-anchor=end` placing text outside the panel. Corrected RTL anchor to `start` in the source SVG and live editor before the successful run. Source SVG bytes visually rendered with Inkscape and Git blob hashes matched the uploaded source.
- Previous [44930561179](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44930561179), [44930693494](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44930693494) and [44930792354](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44930792354) failed due to a local test HTTP directory route, duplicate SVG/text input ID, and/or pre-fix RTL version. Failures were corrected; the success receipt above belongs to the corrected source.

## Boundaries / OPEN

- Only exact accent `#EF4B32` approved; supporting neutrals and typefaces are proposed.
- No Mikhak file was loaded or tested. Browser fallback is **not** an Mikhak proof.
- The HADES owner-original logo files are not embedded, modified, traced, recolored or replaced in this tool. No maker credit for independent products.
- Platform title-safe 10% lines are preview heuristics only, not a certified broadcast or social safe area. Real iPhone/Android input, Premiere/Resolve/After Effects import, native-size micro-legibility, real installed/licensed Mikhak and owner final authorization are OPEN.
- Pattern01 public REVIEW; Pattern02 private; Pattern03 stopped. No Higgsfield.

Next 1: test real-device export and video-editor import, with screenshots. Next 2: verify authorized typography/print + owner artwork and usage approval before any FINAL.
