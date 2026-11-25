# Reader tools — PUBLIC REVIEW · 2026-11-25

Source-only change: compact native mobile contents disclosure and per-code-block copy toolbar. Existing sidebar TOC, URLs, articles, notes, progress, and figure viewer are retained. No logo or manifest changes.

Component test using real Chromium with set_content at 320/390/430/1280 CSS px: no document overflow, code LTR in RTL fixture, keyboard activation, native disclosure, simulated clipboard receives exact code text, simulated clipboard denial selects original code, reduced-motion fixture scroll behavior and print-media toolbar hiding, zero page errors. This is an isolated component fixture with fallback font, not a full generated article render. Actual clipboard permission, live article, actual Mikhak, full build, CI, physical print/device, actual before/after page screenshots and independent public HTTP remain OPEN. Local HTTP navigation was blocked by administrator policy; no bypass attempted.

Next: (1) validate generated pages in CI and actual browser before merge, verify live HTTP afterwards; (2) refine related-reading pathways and active section affordance.
