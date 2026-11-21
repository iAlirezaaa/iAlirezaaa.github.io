# HADES public social portrait composer — actual browser QA (REVIEW)

Run: [44845352143](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44845352143), concluded **success** on 2026-11-21.
Test head: `ca8eea8e3c5f52f85dedd2b7adca191aca841508`. Source editor head before record: `ecdd9260e62c389be02ac513e61f3740448c3e78`.

## Actual results
- Chromium 141, Playwright 1.56.1 on Ubuntu 24.04 runner.
- **320px, 390px, 430px:** 3/3 runs; horizontal scroll 0px; 16px editable input.
- In each viewport: selected Persian; changed heading and description; **downloaded** a JSON project, reset all fields, imported JSON and verified Persian text recovered.
- Exported actual PNG in each viewport, decoded PNG magic and IHDR: **1080×1350**. These PNGs are browser test outputs, **not final approved social publication masters**.
- Negative tests: a project forged as `status=FINAL` rejected; a single excessively long unbreakable text string disabled export.
- Screenshots and `results.json` are **real CI artifact files** under run [44845352143](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/44845352143), artifact ID `14682457615`. Public site repository does not currently host these screenshot binaries as Pages downloads.
- Initial failures were **real and corrected**: unsupported Ubuntu 26.04 runner for Playwright 1.56.1 (run 44845076676); asynchronous import expectation raced the browser file reader (run 44845234200). Final test source and mirrored release source passed in run 44845352143.

## Limitations / release
- Public HTTPS page/download **HTTP 200 / Content-Type** unverified from independent external network; GitHub Actions deployment success does not substitute for this.
- Actual licensed **Mikhak** render, real iPhone, source-logo inner lettering at micro scale, source-styled print and owner asset approval are **OPEN**.
- No photo data or private source image stored in portable JSON. Site uses existing byte-identical public isolated owner raster; image/vector mark unchanged.
- All layouts remain REVIEW; no FINAL approval, no actual social post, no private Pattern02 publication and no Pattern03.
