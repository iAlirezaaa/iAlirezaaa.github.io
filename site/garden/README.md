# HADES blog garden / گاردن بلاگ
PUBLIC REVIEW — a GitHub-backed Obsidian-compatible Markdown knowledge graph, not an installation of the official Digital Garden publishing service.

## Workflow
1. Open `site/garden/` as an Obsidian vault (or place it within your local vault and sync via Git).
2. Create Markdown notes under `notes/` with frontmatter `dg-publish: true` and `public: true` for intentional publication.
3. Link notes with `[[slug]]` or `[[slug|label]]`. A link never automatically publishes a private note.
4. `node site/scripts/build-garden.mjs` updates `site/public/fa/garden/graph.json`. The site postbuild regenerates dist's graph.
5. Push Markdown through your ordinary GitHub workflow, triggering the Pages build. Do not publish source private vaults or API keys.

The official Obsidian Digital Garden plugin usually uses its own Eleventy template. This bridge reads compatible frontmatter and wikilinks directly in the existing Vite/GitHub Pages site; it is not a direct login or live synchronization with the plugin. External fonts need network access: Estedad and Vazirmatn with system fallback. Mikhak is not loaded or tested.
