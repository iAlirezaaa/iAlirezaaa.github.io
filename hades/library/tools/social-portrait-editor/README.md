# HADES social portrait editor — PUBLIC REVIEW

One self-contained HTML tool. Open `index.html` in a browser, edit EN/FA fields, optionally import an image you are permitted to use, and export a full-size 1080×1350 PNG. Default text is example copy, **not** an approved slogan. The official owner-source `IMG_7187(2).png` is embedded byte-for-byte via its original base64 content; never reconstructed as a vector, recolored, redrawn or cropped. Upstream source SHA-256: `79867ef2cea0777a277df45a2754ea012ff552d466963f8cb831e5940a5cafb7`. Public Git blob: `ecb84e8808059ac515a90cc5e58653958d5636e7`.

## Release boundary
REVIEW only. Only #EF4B32 and one Classic/Modern identity are owner-approved; sample neutrals, fonts, typography and layout need sign-off. Actual Mikhak has not been loaded; browser fallback is not font QA. The micro original may be recognizable but its internal letters are not certified legible. No private Phase03 materials, rights, client information, Pattern02, Pattern03, new logo, Higgsfield or final certified SVG master included. This is a public site-specific new tool, not a copy of a private working file.

## Technical checks
- Native HTML canvas size 1080x1350. Mobile controls use 16px inputs and single-column fallback <=780px; 320/390/430 browser viewport proofs must still be run and marked OPEN until tested.
- Export guarded on logo load and nonempty/overflow-checked text. Long unbreakable words fail closed. Photo import remains local, only PNG/JPEG/WebP <=12MB. No network requests, telemetry or remote upload.
- Embedded owner original matches canonical public blob; original assets and manifest are not modified. The logo is intentionally small; no claim its embedded micro-lettering passes phone recognition.

## Next QA (OPEN)
1. Actual Chromium/Firefox 320px / 390px / 430px / 1080px overflow and bilingual copy-paste tests; exported PNG decode and exact 1080×1350 dimensions.
2. Test real Mikhak (if available and licensed), compare actual used font, evaluate HADES mark at micro scale, and approve actual text before publication on social accounts.

Private GitHub has separate original-referenced social portrait REVIEW draft; don't conflate that private source with this publicly built editor. Website templates and existing asset packs are preserved.
