# Hades III — Alireza Asgarpour / علیرضا عسگرپور

**Official website:** https://ialirezaaa.github.io/  
**Persian search profile:** https://ialirezaaa.github.io/fa/

This public site is an exact-design copy of the owner's original private `Personal_Website` React/Vite application, not the simplified static landing page. It preserves the original floating frame, context navigation, neural atlas, animations, cursor, typography, page composition, content, and source assets.

## Authoritative source and deployment

- **`site/`** — canonical React/Vite source derived from the private original.
- **`index.html`, `assets/`, `about/`, `work/`, `systems/`, `contact/`, `fa/`, `404.html`** — production-built static files generated from `site/` for GitHub Pages.
- **`.github/workflows/static-publish.yml`** — automatically builds, lints and syncs the production files to the `main` root after source changes.
- **`.github/workflows/portfolio.yml`** — also builds and deploys a GitHub Pages artifact for the same original source; Pages may use this via Source: GitHub Actions.
- **`backup/seo-landing-2026-11-17` branch** — previous simplified public version, retained only for rollback.

This setup supports both existing Pages branch deployment from `main / (root)` and a custom GitHub Actions deployment. The public website source of truth is **`site/`**; do not edit generated `assets/` or top-level HTML directly because the next build will replace them.

## Search

- Public sitemap: https://ialirezaaa.github.io/sitemap.xml
- Crawler policy: https://ialirezaaa.github.io/robots.txt
- Bilingual aliases and official social URLs are present in `site/index.html` via structured data.
- `/fa/` uses **the exact original UI** but localized search metadata; the interactive interface itself remains English, matching the owner's original website.

The original private repository was not modified. Only the public copy adds deployment, SEO metadata and the `/fa/` route alias.
