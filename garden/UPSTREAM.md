# Digital Garden upstream and local integration

This folder vendors the actual website template from
[oleeskild/digitalgarden](https://github.com/oleeskild/digitalgarden), used by
[oleeskild/obsidian-digital-garden](https://github.com/oleeskild/obsidian-digital-garden).
The upstream MIT license is retained in `LICENSE`.

The template was imported on 2026-11-24 UTC. The pinned upstream revision is
`6f961b793e9c4713c4790b6f1199d9fa2a38583e`. HADES-specific changes add the Persian reading interface,
same-origin `/fa/garden/` deployment, shared `/fa/blog/` article routes, local
Mikhak font, and an explicit publication stage before Eleventy runs.

## Publication contract

- `garden/src/site/notes/` is the plugin-compatible source directory.
- YAML frontmatter and the plugin's JSON frontmatter are accepted.
- Only the boolean `dg-publish: true` publishes a note. A string `"true"`, an
  unmarked note, `public: false`, or `draft: true` does not publish.
- Linking a note never publishes the target. Only media referenced by admitted
  notes is copied from `src/site/img/user/` into the publication stage.
- Original source files are not rewritten by the build. A disposable staging
  directory contains only allowed note content and generated public blog notes.
- Native graph/search/filetree features run against that staging directory.

## Obsidian connection

In Digital Garden's GitHub settings, use the existing owner/repository and set
the advanced **Content base directory** field to `garden`. The plugin writes
notes to `garden/src/site/notes/`, images to `garden/src/site/img/user/`, and
public appearance settings to `garden/.env`. Credentials stay in Obsidian;
never commit access tokens into this repository. This repository setup does not
install or authenticate the plugin on a user's device.

## Builds

Install with `npm ci --prefix garden` and the portfolio's usual dependency
installation. The site's `postbuild.mjs` builds the garden and blog together.
The garden's `npm run build` also builds its published notes standalone into
`garden/dist/fa/garden/`. `node --test garden/scripts/publishing.test.mjs`
checks publication filtering, Persian aliases and Unicode headings, code
literal preservation, and same-origin route prefixing.

The original Eleventy templates and plugin slots are retained. Upstream template
updates should be reviewed as a pull request because they may touch local
Persian overrides and the staging gate.

## Output contract

- `/fa/garden/graph.json` keeps the native Digital Garden graph schema.
- `/fa/garden/searchIndex.json` is the searchable published-note index.
- `/fa/garden/manifest.json` provides normalized note metadata, directed links,
  indexable URLs, a deterministic source digest, and SHA-256 hashes of generated
  output. It contains no source bodies from unpublished notes.
