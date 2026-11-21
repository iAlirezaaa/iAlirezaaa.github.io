# Executable GitHub Actions Chromium QA · REVIEW
`site/scripts/qa-hades-proforma.mjs` is a Playwright browser regression for both public-site mirrors at 320, 390 and 430 CSS pixels, original JPEG decoding plus WebCrypto SHA check, FA form, totals, JSON roundtrip, forged FINAL denial, and genuine one-page Chromium A4 PDF. It saves screenshots, JSON, PDF and results as a GitHub Actions artifact. Runs on push to the pro forma files or manual dispatch. Workflow `hades-proforma-qa.yml`.

A green job means the checked-out site source works **locally at HTTP localhost**; it is not an independent public github.io HTTP deployment receipt, a real phone, Mikhak or physical printing result. Never infer owner design signoff or FINAL from these checks.
