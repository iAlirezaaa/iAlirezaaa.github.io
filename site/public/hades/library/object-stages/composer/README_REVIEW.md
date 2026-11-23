# HADES Architectural Object Stages · Subject Composer — PUBLIC REVIEW

A real client-side visual editor for all three existing original-source architectural object stages (16:9, 9:16, 1:1). EN and FA URLs are separate; one shared JS implementation. Users load a local **authorized** PNG/JPEG/WebP foreground, drag it or use x/y/width sliders, then export native-resolution composited PNG, editable-layer standalone SVG, or JSON position settings. Guides only appear in the live preview, not exported art.

**No automatic upload or network transmission of the selected subject file.** The only HTTP fetch is for the unchanged public stage SVG in this repository. JSON exports may embed private image bytes: do not publish them. This release includes no sample client media and no logo.
The output SVG embeds the exact unchanged background SVG inside an independent image layer; it is an application composition, **not** an official vector logo. Stage originals and the four source-logo manifest are never rewritten.

## QA checklist
- Source/published mirrors must have identical Git blob SHA for the two pages and shared script.
- Real Chromium FA/EN at 320, 390, 430 CSS px: no horizontal overflow, loaded stage, local file input, drag/slider, PNG and SVG downloads with dimensions and editable-subject image layer.
- Public hosted HTML/JS must independently return HTTP 200, appropriate MIME and SHA-256 equal to GitHub source bytes; an Actions build alone is not proof.
- **OPEN:** genuine held-phone checks, real printing, genuine licensed Mikhak, owner FINAL approval, actual rights clearance on user imagery.

Only #EF4B32 is approved. Dark / Bone / Charcoal are working proposals. Classic/Modern are coordinated, not separate brand marks. Pattern01 public REVIEW; Pattern02 PRIVATE; Pattern03 stopped.

## Sourced platform alignment — 2026-11-23 · PUBLIC REVIEW
New optional preview-only geometry outline and approximate subject photo-bounds base snap. Stage-specific polygon vertices are copied from the original three SVGs; no source files or original logos change. Editable true-size A4 bilingual SVG geometry card included. Guides excluded from both exported PNG and SVG. JSON view flags are restored and old setting JSON files remain supported.

**OPEN:** genuine physical 3D perspective/camera match, actual photos, physical print, native phone 48/96 px and Mikhak licensed source, owner FINAL. Only #EF4B32 approved, neutrals and fonts proposed.

Next: (1) full three-ratio actual Chromium export/JSON readback with public hosted SHA; (2) real device and physical print evaluation with documented observations.

## Local visible-alpha alignment — 2026-11-23 · PUBLIC REVIEW
Optional locally measured nontransparent subject bounds (max sample 768 px, alpha >=32/255) provide approximate silhouette-bottom-to-plinth alignment. The pre-existing rectangle snap is retained for opaque files. Optional dashed outline is preview-only and excluded from PNG/SVG exports. Bilingual controls, local privacy messaging, compatibility with older JSON and a [bilingual editable A4 optical guide](HADES_Alpha_Bounds_A4_FA_EN_REVIEW.svg) are included. This is not floor detection, optical calibration or approved production artwork. No original HADES logo/manifest/stage source modified.

OPEN: physical real-device/print calibration, genuine licensed Mikhak, owner FINAL. NEXT 1: real measurement log for phone 48/96px and A4 print. NEXT 2: optional threshold control only after UX evidence.

## Editable alpha-cutoff study — 2026-11-23 · PUBLIC REVIEW
The local editor now exposes a reversible 1–254/255 alpha-threshold slider (default 32) with immediate optical bbox recomputation. The chosen value persists in settings JSON; legacy JSON without the field falls back to 32. JPEG/opaque images still use photo-rectangle alignment. No per-pixel source image is transmitted. Print-ready [bilingual A4 comparison sheet](HADES_Alpha_Threshold_A4_FA_EN_REVIEW.svg) illustrates three cutoff cases with schematic transparent bands, **not** empirical measurements. Its 100-mm rule requires a real paper measurement. OPEN: real browser QA, independent HTTP SHA verification, phone/physical prints, genuine licensed Mikhak, FINAL.

NEXT: (1) execute Chromium alpha-cutoff/JSON roundtrip on FA/EN at 320/390/430px and independently verify hosted HTTPS SHA/MIME; (2) collect actual user-owned opaque/semi-transparent imagery tests and physical 100-mm print calibration without storing customer images.
