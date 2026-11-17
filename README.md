# Hades III — Alireza Asgarpour / علیرضا عسگرپور

Official public website: **https://ialirezaaa.github.io/**

## Authentic original portfolio

This repository contains the original React/Vite website from the owner's private `Personal_Website`, including its floating frame, atlas, navigation, cursor effects, CSS, content and images. It replaces the earlier simplified one-page identity design without rewriting the UI.

**Canonical source code:** `site/` (not the old root-level static files).

## Deploy

`.github/workflows/portfolio.yml` builds `site/` with Node 22, checks lint, generates direct-entry HTML for the original React routes, and deploys `site/dist` via GitHub Pages.

GitHub Pages Settings → Pages → **Source: GitHub Actions** is the recommended configuration for this Vite-based app. The original temporary static fallback remains in the repository root for rollback, but **should not be used as the publishing source** once this workflow succeeds.

English: https://ialirezaaa.github.io/
Persian indexed alias with the same UI: https://ialirezaaa.github.io/fa/
Sitemap: https://ialirezaaa.github.io/sitemap.xml

The original private repository has not been changed. The visual design and React components are copied from it; changes are limited to SEO metadata, a Persian route alias, and public deployment machinery.
