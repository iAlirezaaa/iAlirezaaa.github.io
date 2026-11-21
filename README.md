# Hades III — Alireza Asgarpour / علیرضا عسگرپور

**Official site:** https://ialirezaaa.github.io/  
**فارسی:** https://ialirezaaa.github.io/fa/

This public repository publishes the **original** React/Vite design from the privately retained `Personal_Website`, including its floating frame, animated interactions, neural atlas, route navigation and original visual treatment. The public implementation keeps the approved English aesthetic and adds a full Persian-language presentation without replacing the design.

## Maintained source of truth

- `site/src/` — production React components, original CSS and `localization.css` overrides.
- `site/src/i18n.js` — translated Persian UI copy, project summaries and the five official account links.
- `site/scripts/postbuild.mjs` — builds direct HTML for five English and five Persian routes, unique metadata, reciprocal `hreflang`, canonical links, JSON-LD and the sitemap.
- `site/scripts/validate-site.mjs` — checks language switching, translation coverage, sitemap, SEO metadata, asset paths and public account links.
- `.github/workflows/static-publish.yml` — validates and publishes the Vite build to the `main` branch root, compatible with GitHub Pages branch publishing.
- `.github/workflows/portfolio.yml` — independent CI/build and optional Pages artifact deployment.
- Root-level `index.html`, `fa/`, `about/`, `work/`, `systems/`, `contact/`, `assets/` — **generated files**. Edit source in `site/` only.

### Local validation

```sh
cd site
npm ci
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
