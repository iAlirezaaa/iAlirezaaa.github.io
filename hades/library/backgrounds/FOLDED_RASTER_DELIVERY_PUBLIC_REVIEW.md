# HADES Folded Spaces — raster delivery | PUBLIC REVIEW

This release pipeline renders three existing standalone architectural backgrounds into nine genuine raster files (3 PNG, 3 JPEG, 3 WebP) and one 14-item ZIP (3 SVG, 9 raster, manifest, README). Outputs are **new reproducible CairoSVG/Pillow derivatives**; do not mistake them for the nine earlier conversation-only image bytes.

Run `python3 site/scripts/render-hades-folded-raster-review.py` after installing CairoSVG and Pillow. The GitHub workflow safely generates and commits binary assets into both `site/public/hades/` and `hades/` without touching original logo files. Checks: SVG XML/geometry, raster decode, correct dimensions, mirrored byte equality, ZIP CRC/readback, SHA256 manifest.

**Approval:** Only accent #EF4B32 is approved. Neutral colors and designs are proposals. No original owner logo or source manifest is opened or changed. All files remain REVIEW, never FINAL.

**OPEN until separately observed:** successful workflow-created asset commit and GitHub readback; independent hosted Pages HTTP 200/MIME/SHA for all 11 binary/manifest/ZIP addresses; bilingual gallery links; physical print; genuine 48/96px native-phone micro recognition; genuine licensed Mikhak; owner FINAL.

**Two next actions:** (1) Verify GitHub binary commit, source/deploy parity and live exact-byte download. (2) Add approved-for-public-REVIEW links to both FA/EN galleries, library, guides, and private CONTENT_INDEX with six real mobile viewport checks.
