# HADES — Presentation Covers, publicly verifiable QA (REVIEW)

- Public downloads: [Classic EN SVG](HADES_Presentation_Cover_Classic_EN_REVIEW.svg) · [Modern FA SVG](HADES_Presentation_Cover_Modern_FA_REVIEW.svg) · [gallery](index.html).
- Public kit source commit: https://github.com/iAlirezaaa/iAlirezaaa.github.io/commit/b1e5cc97e36fc0bafaa6382716ac63b765b5e419
- Independently recorded source + live QA: https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44904859563
- **6/6 actual Chromium local-HTTP tests PASS**: both exact checkout mirror pages × 320/390/430px, no horizontal overflow, both SVG assets decoded, both download controls returned byte-exact files.
- **8/8 real public GitHub Pages HTTPS PASS**: actual HTTP 200, MIME and SHA-256 parity for SVGs, HTML, README, EN/FA libraries and both logo guides, checked against the GitHub source files.
- Real original SVG data: Classic SHA-256 `d90be0d10dc6d15c11fe4131e717738571c56baaaad3438247f194be0655a100`; Modern SHA-256 `e3082fa3bc3b22a8a5c8d6aebe1f441724fecfa00311f5547cc0046a5af14c29`. Neither source is an original logo master.
- **Prior failure disclosed:** first Chromium workflow (44904760673) failed because browser download events on file:// URLs did not fire; HTTP-server test committed in bb0244d fixed this and re-ran PASS.
- **OPEN:** native phone/projector typography, actual legally available Mikhak rendering, physical proof, factual copy/rights and explicit owner FINAL signoff.
- Only #EF4B32 is an approved color. Other shades and fonts remain layout proposals; four original logos and their manifest remain untouched. Public Pattern01 REVIEW; Pattern02 private; Pattern03 stopped.
