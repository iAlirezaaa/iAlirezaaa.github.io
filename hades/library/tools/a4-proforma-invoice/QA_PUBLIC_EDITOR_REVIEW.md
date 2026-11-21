# QA — online A4 pro forma editor / REVIEW / 2026-11-21

## Implemented
- FA/EN live fields and A4 print-only page, up to five rows, calculated subtotal, optional percentage and total.
- JSON export/import, rejecting unapproved FINAL state; browser DOM uses textContent for dynamic data.
- SHA-256 check of original public raster; unverified image blocks print; no logo redraw, recolor or substitution.
- New HTML, JSON sample and docs added identically to BOTH site trees; linked from both language libraries and catalog.

## Executed local browser proof (source-locked)
- [Chromium run 44880712831](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44880712831): 6/6 checked-out source/page route cases at 320/390/430px PASS, original JPEG bytes pass WebCrypto SHA-256, working JSON roundtrip and forged FINAL rejection, arithmetic sample 2 × 15 with optional 10% => 33.00 USD, guarded print and actual 1-page A4 PDF.
- [Binary sample PDF](HADES_A4_Proforma_Sample_PUBLIC_REVIEW.pdf) and [actual 390px screenshot](HADES_A4_Proforma_390px_Actual_Chromium_PUBLIC_REVIEW.png) published to mirrored site paths with matched Git blob checks. PDF contains synthetic SAMPLE fixtures, not real clients.
- These are actual Chromium localhost browser proofs. Independent deployed github.io HTTP and physical device were not tested.

## OPEN — remaining gates
- External live github.io HTTP check and hosted-source WebCrypto parity (local checked-out HTTP tested PASS).
- Physical printer proof and 14mm source-emblem micro-legibility; A4 Chromium PDF locally tested PASS.
- Mikhak real used-font evidence; this editor uses fallback Tahoma/Arial and does not distribute Mikhak.
- Independent HTTP 200 for published URL (if external verification is blocked, Git SHA and Actions are not substitute).

All public resources retain REVIEW labels; Pattern01 remains public REVIEW, Pattern02 PRIVATE REVIEW, Pattern03 hold.
