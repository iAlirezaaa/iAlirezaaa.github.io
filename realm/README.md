# Hades Realm

A playable, original 3D village that connects the public projects, writing, films,
and channels of Hades III. Live at <https://ialirezaaa.github.io/HadesRealm/>.

## Develop

Use Node.js 22.12+ (the repository's publication workflows use Node 22).

```sh
npm ci
npm run dev
npm test
npm run build
```

The app uses Three.js, OrbitControls and Vite. All architecture and terrain are
native geometry; the scene is not a picture or video. No external runtime CDN,
tracking service, API key, sign-in, or backend is required.

## Edit the world

- `src/realms.json`: the complete public link directory. Each item has English
  and Persian names, a verified HTTPS destination, and a category. All links
  remain available regardless of gameplay or rendering support.
- `src/scene.js`: island, buildings, atmosphere, selection, camera, and visible
  level/construction changes.
- `src/game.js`: deterministic resource production, storage, progression,
  construction costs, quests, validation, and offline accrual.
- `src/app.js`: bilingual interface, input, actions, sound, and browser storage.
- `src/style.css`: responsive HUD and mobile bottom sheets.

The unchanged Hades mark comes from the existing site's brand assets. Mikhak's
font license and source notice accompany the self-hosted font in `public/`.

## Play

Select a landmark to open its destinations and upgrades. Drag to orbit, scroll
or pinch to zoom, or right-drag to pan. The Forge produces embers; the Oracle
produces souls. Collect the bank, upgrade the seven landmarks to level 3, and
build a lantern, soul garden, or watchtower on each of the three free plots.
Seven quests reward actual exploration and construction. Cosmetic landmark
upgrades add architectural details; Forge, Oracle and Citadel upgrades also
increase the relevant production/storage.

Keyboard: `1`–`6` select realms, `B` opens Build, `Q` opens Quests, `L` opens All
links, `C` collects, `R` resets the camera, and `Escape` closes the panel. Shortcuts
are suppressed while typing. Sound is off until enabled by the visitor.

The simulation is local to each browser. It is a single-player village builder,
with no battles, accounts, purchases, or online multiplayer. Progress is stored
under `hadesrealm.village.v2`; preferences under `hadesrealm.preferences.v2`.
Production while away is capped at four hours and available storage. The help
panel's reset action requires an explicit second click. Clearing browser storage
also clears the village.

Action revisions and browser storage events prevent inactive tabs from rolling
back progress. Browsers supporting Web Locks serialize local actions across tabs;
other browsers use revision checks and last-writer reconciliation.

## Rendering and accessibility

WebGL is the primary renderer, with soft shadows and animated water, spirits,
flags, fire and smoke. A lightweight Three.js SVG renderer displays the same
geometry when WebGL is unavailable, with static atmosphere and no GPU effects.
If both renderers fail, the searchable directory remains available. Reduced
motion disables ambient movement. All map locations also have keyboard-focusable
label buttons. The links remain available through the directory, independently
of camera position. The HTML includes a no-JavaScript list of primary links.

## Publication in this repository

Editable source lives in `realm/`. Both existing publication workflows install,
test and build it, then copy `realm/dist/` into `site/public/HadesRealm/` before
the portfolio build. The static publisher mirrors that build to root
`HadesRealm/`. The existing portfolio, garden and brand-library publication
continues through the same workflow. Do not hand-edit the generated mirrors.

Vite's relative asset base allows the build to run under `/HadesRealm/`. The
portfolio validator checks that the standalone entry keeps its own canonical
URL, and the sitemap includes it as a separate page.
