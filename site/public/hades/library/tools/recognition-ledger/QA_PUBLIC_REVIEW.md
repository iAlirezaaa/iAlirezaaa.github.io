# HADES Recognition Ledger — PUBLIC REVIEW QA

Updated: 2026-11-21
Public tool: https://ialirezaaa.github.io/hades/library/tools/recognition-ledger/
Status: **REVIEW, not FINAL**

## Delivered
- `index.html` — editable FA/EN two-card award and jury evidence board, live preview, SVG/JSON download, print-to-A4 layout. No third-party library, no new logo.
- `HADES_Recognition_Award_Classic_EN_REVIEW.svg` — editable 1600×900 award/press citation sample.
- `HADES_Recognition_Jury_Modern_FA_REVIEW.svg` — editable 1600×900 jury citation sample, separate from award.
- Linked from both language libraries, both language logo guides, and both home download sections. Catalog now contains 37 entries, matching 37 cards in each library.

## Confirmed
- Both source trees contain byte-identical paired files (readback using GitHub's stored Git blob hashes).
- Both SVG sources are well-formed XML and rendered locally with real Inkscape. The first FA rendering exposed a genuine RTL overflow; it was corrected by changing the text anchor and adjusting the background vertical rule. The final FA footer was changed to safe English REVIEW metadata after a second render revealed clipping.
- Static SVGs are byte-identical to the exact SVGs locally rendered, verified with Git blob SHA-1.
- The exact published HTML's inline JavaScript was parsed with a JavaScript function constructor without syntax error.
- The 37 catalog items and both language library card counts agree.

## OPEN — DO NOT CLAIM AS PASSED
- Local Chromium navigation to both `file://` and `http://127.0.0.1` was BLOCKED_BY_ADMINISTRATOR in the current container. An exact-repository Playwright test and GitHub Actions workflow were committed, but successful jobs and 320/390/430 outcomes have **not** yet been independently observed.
- Public deployed HTTPS byte matching and actual hosted link opening are **not verified** in this run; both direct website and raw GitHub requests were blocked. A dedicated hosted QA job is registered, but a job configuration/commit is not a successful live check.
- Real iPhone/Android, licensed authentic Mikhak (not fallback), projector viewing, physical A4 print and final owner approval are untested.
- The publisher's full IBNA article was not accessible. Award rank/category/year/story title and the exact jury section remain OPEN. No specific official certificate or source attribution is supplied. These are sample templates for two **separate** roles; any personalized copy must pass evidentiary review.

## Brand safeguards
- HADES = realm, HADES THE THIRD = its maker/ruler in a fictional personal narrative; independent products keep their identities.
- #EF4B32 alone is approved. Neutral samples, layout and fallback fonts are proposals.
- No redrawn, retraced, recolored, generated or substitute logo. Four supplied originals and their checksum manifest were not changed.
- Pattern01 PUBLIC REVIEW, Pattern02 PRIVATE, Pattern03 STOPPED; no Higgsfield, no private client data.

## Two next actions
1. Inspect and fix the committed workflow's real six mobile-layout/browser tests and seven live HTTPS byte parity checks; independently inspect hosted editor on 320/390/430px.
2. Verify exact literary award and separate jury-section records from IBNA/organizer, then prepare owner-approved, narrow FA/EN evidence copy and run licensed font/physical-print preflight before any FINAL claim.
