# Hades III — Alireza Asgarpour / علیرضا عسگرپور

**Official site:** https://ialirezaaa.github.io/  
**فارسی:** https://ialirezaaa.github.io/fa/

This public repository publishes the **original** React/Vite design from the privately retained `Personal_Website`, including its floating frame, animated interactions, neural atlas, route navigation and original visual treatment. The public implementation keeps the approved English aesthetic and adds a full Persian-language presentation without replacing the design.

## Maintained source of truth

- `realm/` — pinned Git submodule of [iAlirezaaa/HadesRealm](https://github.com/iAlirezaaa/HadesRealm), the independent source/research repository for the Three.js underworld. Both publishers initialize the submodule; update its exact commit to release a new realm version.
- `site/src/` — production React components, original CSS and `localization.css` overrides.
- `site/src/i18n.js` — translated Persian UI copy, project summaries and the five official account links.
- `site/scripts/postbuild.mjs` — builds direct HTML for five English and five Persian routes, unique metadata, reciprocal `hreflang`, canonical links, JSON-LD and the sitemap.
- `site/scripts/validate-site.mjs` — checks language switching, translation coverage, sitemap, SEO metadata, asset paths and public account links.
- `garden/` — the original Eleventy Digital Garden template with Persian UI, publication filtering, local font assets and canonical note routes under `/fa/blog/notes/`. The older `/fa/garden/` content addresses redirect into the unified blog; its asset namespace remains compatible. See [راهنمای وبلاگ](garden/README-HADES.md).
- `site/scripts/garden-blog-content.mjs` — renders the existing approved Persian articles and topic directories through the same Digital Garden reading layout; article URLs and source content remain stable.
- `.github/workflows/static-publish.yml` — validates and publishes the Vite build to the `main` branch root, compatible with GitHub Pages branch publishing.
- `.github/workflows/portfolio.yml` — independent CI/build and optional Pages artifact deployment.
- Root-level `index.html`, `fa/`, `about/`, `work/`, `systems/`, `contact/`, `assets/` — **generated files**. Edit source in `site/` only.

### HadesRealm — independent world project

[Explore the world](https://ialirezaaa.github.io/HadesRealm/) · [Persian research codex](https://ialirezaaa.github.io/HadesRealm/codex/) · [Source, world bible and phased roadmap](https://github.com/iAlirezaaa/HadesRealm). The independent repository owns the 28-place / 35-character / 10-story research catalogue with five detailed main environments and six animated myths in release 4.2. This repository hosts its generated output at `HadesRealm/` and `site/public/HadesRealm/`; edit the independent source and update the `realm` pin, rather than editing these mirrors. The original [Village v2](https://ialirezaaa.github.io/HadesRealm/archive/village-v2/) and its [backup ZIP](https://ialirezaaa.github.io/HadesRealm/archive/HadesRealm-Village-v2-backup.zip) remain preserved.

### Persian cinematography encyclopedia

- [راهنمای تصویری جای دوربین و پرسپکتیو](https://ialirezaaa.github.io/fa/blog/notes/cinema/camera-position-before-lens/) · [بخش سینما](https://ialirezaaa.github.io/fa/blog/notes/cinema/)

### Local validation

```sh
cd site
npm ci
npm ci --prefix ../garden
npm run lint
npm run build
node scripts/postbuild.mjs
node scripts/validate-site.mjs
```

The private original is not modified by public updates. The previous simplified public profile remains safely preserved on the `backup/seo-landing-2026-11-17` branch; the pre-localization version is in `backup/pre-farsi-and-social-2026-11-17`.

## Official public profiles

- LinkedIn: https://ae.linkedin.com/in/ialirezaaa
- Instagram: https://www.instagram.com/hades.3rd/
- GitHub: https://github.com/iAlirezaaa
- Personal Telegram: https://t.me/Ialirezaaa
- News channel: https://t.me/AirisFeed

The news channel is a related publication, not the same person, so it is **not** included in `Person.sameAs`.

## Search Console — owner action still required

The public URLs, crawlable HTML, correct robots policy, `ProfilePage` structured data and sitemap have been generated. Google Search Console property ownership requires signing into the account which will own the property:

1. Open https://search.google.com/search-console/ and add the `URL-prefix` property `https://ialirezaaa.github.io/`.
2. If Google requests a file or HTML meta verification string, add that exact token/file to the public site's `site/public/` assets. Do not put authentication tokens or private account credentials in the repository.
3. Submit `https://ialirezaaa.github.io/sitemap.xml`; inspect `/` and `/fa/` and request indexing.

No indexing, rankings or Search Console ownership are guaranteed by publishing this repository.

## HADES Universe — public brand website

- [English site](https://ialirezaaa.github.io/hades/) · [وب‌سایت فارسی](https://ialirezaaa.github.io/hades/fa/)
- The original owner-supplied Classic and isolated mark are available for reference download, alongside bilingual public identity overviews and public GitHub project links.
- Private contract drafts, unpublished work and unapproved design materials are not published.
- Public site source: [`site/public/hades/`](site/public/hades/), mirrored into the `hades/` Pages path.

## HADES / editable stationery (REVIEW)
- [Working business card sources and downloads](https://ialirezaaa.github.io/hades/brand-kit/business-card/), [نسخهٔ فارسی](https://ialirezaaa.github.io/hades/fa/brand-kit/business-card/). Both sides have editable SVG, real PNG and layered PSD generated from source; published as REVIEW, not a print master. Future stationery objects are separate work items.

## B03 HADES — A4 letterhead working files
- [English](https://ialirezaaa.github.io/hades/brand-kit/letterhead/) · [فارسی](https://ialirezaaa.github.io/hades/fa/brand-kit/letterhead/) — two editable source SVGs and workflow-generated real PNG/PSD/ZIP review files.

## HADES — Categorized working asset library (REVIEW)
- [EN library](https://ialirezaaa.github.io/hades/library/) · [FA library](https://ialirezaaa.github.io/hades/fa/library/) — stationery, social, web, patterns and guides. 18 new editable source SVG + real PNG/PSD and downloadable category ZIP built/committed by GitHub Actions. Existing card, letterhead and Pattern01 retain their original pages.

## Threshold architecture backgrounds · additional REVIEW source (2026-11-21)
- 3 new editable artboards in 16:9, 9:16 and 1:1. [Bilingual gallery + pack](https://ialirezaaa.github.io/hades/library/backgrounds/), [FA](https://ialirezaaa.github.io/hades/fa/library/backgrounds/). Rendered PNG/JPEG/WebP produced from these SVG sources by the site build; *not* the earlier ImageGen 9-photo studies. All artwork REVIEW; neutral colours not approved.

## Architectural Strata REVIEW (2026-11-22)
- New grouped editable background SVGs: Strata Gallery (16:9), Strata Shaft (9:16), Strata Plinth (1:1). [EN backgrounds gallery](https://ialirezaaa.github.io/hades/library/backgrounds/#strata-review) · [FA](https://ialirezaaa.github.io/hades/fa/library/backgrounds/#strata-review). PNG/JPEG/WebP and ZIP are generated by CI only; do not describe them as hosted until binary GitHub and independent live HTTP proof. Four owner originals unchanged. Neutrals proposed; only #EF4B32 approved.

## HADES Contrast Studio / 2026-11-22 / REVIEW
- [English interactive studio](https://ialirezaaa.github.io/hades/library/tools/contrast-studio/) · [فارسی](https://ialirezaaa.github.io/hades/fa/library/tools/contrast-studio/) · 3 editable safe-field SVG overlays for 16:9, 9:16, 1:1. Original owner white raster is referenced unchanged, always on its own dark plate. Assets are REVIEW, not FINAL; hosting, real phone, micro and print checks remain separate.

## Original mark micro recognition bench · PUBLIC REVIEW (2026-11-22)
- [EN original-size optical bench](https://ialirezaaa.github.io/hades/brand-kit/logo-usage/micro-bench/) · [FA](https://ialirezaaa.github.io/hades/fa/brand-kit/logo-usage/micro-bench/). Original logo source unchanged, 48/96/400 CSS-pixel sampling, dark plaque on proposed bone backgrounds, local JSON observation export. Native phone/print/Mikhak remain OPEN.

## HADES Section Cuts — artwork-specific text placement / PUBLIC REVIEW (2026-11-22)
- [English editable placement editor](https://ialirezaaa.github.io/hades/library/backgrounds/section-cuts/placement/) · [ویرایشگر فارسی](https://ialirezaaa.github.io/hades/fa/library/backgrounds/section-cuts/placement/).
- Three source-faithful architectural SVG artboards, 16:9, 9:16 and 1:1. Change headline and subtitle, toggle guide overlays, export editable SVG. New tool is distinct from generic Contrast Studio safe zones.
- No new HADES mark. Logo reservation shows only a detached dark plate and written placeholder; insert **only the original owner PNG**, never redraw or recolor. Approved hue #EF4B32; neutral colors, typography and copy REVIEW, no FINAL.
- Source and deployed mirrors have been verified in GitHub. A separate [CI QA workflow](.github/workflows/hades-section-placement-qa.yml) covers real Chromium FA/EN mobile and independent live HTTPS checks; no hosted success claim until the run result is observed. Physical phone, printing and real Mikhak remain OPEN.

## HADES Light Gallery / 2026-11-22 / PUBLIC REVIEW
- [EN gallery](https://ialirezaaa.github.io/hades/library/light-gallery/) · [FA gallery](https://ialirezaaa.github.io/hades/fa/library/light-gallery/). Six standalone editable source-exact SVGs (3 aspect ratios × FA/EN), designed to avoid white original mark on white/bone: owner PNG unchanged on a detached charcoal plaque. No new logo, no generated mark. Only #EF4B32 approved. Device, printing, typography and real Mikhak remain OPEN.


## Light Gallery — A4 printable crop/export study (PUBLIC REVIEW, 2026-11-22)
- [English guide](https://ialirezaaa.github.io/hades/library/light-gallery/print-guide/) · [راهنمای فارسی](https://ialirezaaa.github.io/hades/fa/library/light-gallery/print-guide/). Editable standalone SVG EN/FA; true one-page A4 Chromium PDF EN/FA; raster proof PNG and CRC-checked ZIP. Original owner PNG unchanged and on independent dark plaques.
- [Real generated print bundle](https://ialirezaaa.github.io/hades/library/light-gallery/print-guide/HADES_Light_Gallery_A4_Print_Pack_REVIEW.zip) · [SHA manifest](https://ialirezaaa.github.io/hades/library/light-gallery/print-guide/HADES_Light_Gallery_A4_Print_Manifest_REVIEW.json). Only #EF4B32 approved; real phone and print physical checks remain OPEN.

## HADES Bookmark Gift Bands · PUBLIC REVIEW (2026-11-23)
- [English editable A4 band sheet](https://ialirezaaa.github.io/hades/library/bookmark-bands/) · [برگهٔ فارسی](https://ialirezaaa.github.io/hades/fa/library/bookmark-bands/).
- Four 130×32mm fold/cut bands per true A4 artboard, alternating Classic/Modern. Exact original PNG retained on dark plaques. No new mark. Only #EF4B32 approved.
- [6-browser and independent 4-URL hosted verification](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/45083761166). Real paper/phone, Mikhak and FINAL OPEN.

## Stage × Alpha single-panel inspector · PUBLIC REVIEW (2026-11-23)
- [EN panel inspector](https://ialirezaaa.github.io/hades/library/object-stages/composite-matrix/) · [FA](https://ialirezaaa.github.io/hades/fa/library/object-stages/composite-matrix/). Nine original canvas compositions now support keyboard-accessible single-panel viewing, 100–250% scrollable display zoom, readable bilingual captions and separate 500×340 native-panel PNG downloads. No originals/marks modified. Colors other than #EF4B32 remain proposals; native device, print and Mikhak OPEN.

## Quiet Courts — architectural SVG pack · PUBLIC REVIEW (2026-11-23)
[EN](https://ialirezaaa.github.io/hades/library/backgrounds/quiet-courts/) · [FA](https://ialirezaaa.github.io/hades/fa/library/backgrounds/quiet-courts/). Three standalone 16:9/9:16/1:1 architectural vector designs, proposed neutrals, true-contrast metadata, untouched original marks. No approved new logo; no raster pack promised for this release.

PUBLIC REVIEW raster release verified 2026-11-23: [14-file download](https://ialirezaaa.github.io/hades/library/backgrounds/quiet-courts/HADES_Quiet_Courts_3_SVG_9_Raster_PUBLIC_REVIEW.zip), [raster SHA-256 manifest](https://ialirezaaa.github.io/hades/library/backgrounds/quiet-courts/raster-manifest.REVIEW.json), [actual Chromium FA/EN mobile and independent live 9/9 HTTPS SHA-256 success](https://github.com/iAlirezaaa/iAlirezaaa.github.io/actions/runs/45206629043). No new logo; neutrals REVIEW.
