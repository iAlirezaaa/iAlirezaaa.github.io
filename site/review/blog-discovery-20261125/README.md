# Unified blog discovery — REVIEW

The blog now has one catalogue for six articles and six published notes. The former Garden lives inside `/fa/blog/notes/`; old Garden URLs remain compatibility redirects. This revision improves the existing unified blog rather than creating another destination.

## Shipped source changes

- One shared taxonomy: three sections (`خوانش پژوهش`, `ابزارها و کد`, `مبانی و مفاهیم`), fifteen prominent subjects, and sixteen working subject URLs including the retained `paper-explainer` compatibility subject.
- Editorial article lead, cover cards, short metadata, grouped subject cards and integrated notes.
- Persian/Arabic/English query normalization; combined kind/section/subject filters; newest, shortest and title ordering; result counts, empty/reset states and URL-restored filters.
- Full-text search excerpts preserve word boundaries and exclude navigation/JSON-LD. One Escape closes search and restores the opener's focus.
- Shared restrained motion, no delayed content access, reduced-motion CSS and no-JavaScript catalogue fallback.
- Exact `#EF4B32` brand indicators/focus. Small links use readable neutral text instead of inherited red variants. Neutral colours, typography and layout remain REVIEW.

The editable implementation is in `site/scripts/blog-taxonomy.mjs`, `site/scripts/garden-blog-content.mjs`, `garden/src/site/scripts/blog-explorer.js` and `garden/src/site/styles/user/_blog-discovery.scss`. Build with the existing Vite/Eleventy process; generated HTML is published by the existing workflow.

## Actual evidence

`before-light-1280.jpg` and `before-light-390.jpg` show the published baseline. `after-light-1280.jpg`, `after-light-390.jpg` and `after-dark-390.jpg` show the actual locally built page in Chromium at matching viewport widths. They are browser captures, not mockups. The light mobile image includes the real keyboard focus ring.

The final build source digest is `4665c6f9272a954aa2ca207f7a23fb31e442287efde16d019bd3e657ed404305`. `browser-observations.json` distinguishes final observations from observations made before the last colour/Escape corrections.

| Check | Observed result |
| --- | --- |
| Actual Chromium widths | 320, 390, 430, 1280; no horizontal overflow on the index |
| Themes and font | Light/dark; actual Mikhak face loaded, original WOFF2/OFL validated |
| Navigation reduction | Directory sidebars removed; one optional menu; no repeated reading-progress/byline on the index |
| Desktop index heading | 42.24 px baseline → 35.2 px; mobile final 26.4 px |
| Discovery | 6 articles + 6 notes; 3 sections; exact subject counts |
| Search | Arabic-form `ديـفيوژن`, English `RIFE`, combined filters, empty result, reset focus and URL/reload tested |
| Ordering | Shortest article order observed as 3, 3, 3, 3, 5, 13 minutes |
| Keyboard | Visible focus, menu Escape, single search Escape and focus return verified |
| Application console | No application errors in the captured log; browser-extension metadata errors excluded |
| Build and static gates | 42 RTL pages, 1382 local references, preserved article prose/schema/URLs, 466 HADES checks |
| Focused tests | 15 Node tests and 15 file-tree Vitest tests passed |

Text contrast is calculated from actual observed CSS colours in the JSON record. The bright brand colour is used for indicators and focus, not small body text.

## Explicitly OPEN

- Runtime reduced-motion emulation: the browser's organization policy blocks DevTools. No bypass was attempted. CSS support is present; this is not a runtime pass claim.
- Physical mobile devices and physical printing.
- Production CLS/LCP measurement. Reserved filter space and dimensioned covers are implemented; no fabricated performance score is reported.
- Deployment and independent public HTTP are verified after merge, separately from this local QA record. See the PR and the private operations log for the final release result.

Four original logos and their manifest are unchanged. No private brand documents, Pattern02, stopped Pattern03 or customer data are part of this evidence.

## Next two changes

1. Refine the shared article reading layout, mobile contents panel and code-copy feedback against a real article.
2. Build coherent topic learning paths and improve knowledge-map navigation within the blog.
