# Hades Realm · Atlas v3

An explorable Three.js atlas of Hades III’s public work. Live at
<https://ialirezaaa.github.io/HadesRealm/>.

The world is a way to find useful destinations: explore six districts, follow
three curated journeys, and save a personal collection of links. Choosing a
real destination lights its district’s paths and windows. No currency, waiting,
construction costs, or link locks exist in the atlas.

## Develop

Use Node.js 22.12+ (the publication workflows use Node 22).

```sh
npm ci
npm run dev
npm test
npm run build
```

Three.js, OrbitControls and Vite are pinned in the lockfile. Architecture and
terrain are native geometry, not a picture or video. The app needs no runtime
CDN, tracking service, API key, account or backend.

## Visitor journey

- Choose **Find inspiration**, **Make something**, or **Follow a learning path**.
  Each connects three real destinations and explains why they belong together.
- Select a district to inspect its links. Every destination is also available
  through a searchable directory, independently of camera and progress.
- Choose **Save** to keep a destination in the collection. Share the current
  selection as a URL or download a UTF-8 Markdown list.
- A received collection opens as a preview. Importing is an explicit action that
  adds saved destinations without replacing existing choices or marking links
  as opened.
- The footprint records distinct destination-selection events. It does not
  assert that an external page loaded, was read or was learned from. Repeated
  clicks do not create additional progress. Saving alone earns no open event.

The three small waystations are the footprint journal, collection and playable
archive. The citadel opens the journey selector. The original village’s visual
architecture is retained, now colored for Hades and responding to useful actions.

## Edit the atlas

- `src/atlas.json`: 35 unique public destinations, six districts and three
  journeys. Duplicate URLs retain multiple district memberships. Every entry
  has Persian/English titles and grounded summaries.
- `src/journey-state.js`: validated v3 state, meaningful progress, collection
  encoding/decoding and explicit merging. Pure functions; no network or DOM.
- `src/progress-store.js`: serialized browser storage, Web Locks and storage
  event synchronization. There are no passive writes or time-based rewards.
- `src/scene.js`: native geometry, camera, rendering, selection and lighting.
  `setLevels` accepts activity stages (1 unseen, 2 discovered, 3 link chosen).
  `setExplored` lights district routes. `setBuilt` places permanent waystations.
- `src/app.js`: bilingual interface, accessible actions, optional sound and
  collection export. External destination URLs are shipped public data, never
  read from a shared hash.
- `src/style.css`: responsive atlas interface and mobile sheets.

Signature vermilion `#EF4B32` follows the approved Hades accent. Warm dark,
charcoal and bone are drawn from the public neutral atlas. The original white
Hades mark is unchanged. Mikhak is self-hosted with its license/source notice.

## State and sharing

Progress: `hadesrealm.atlas.v3`; language: `hadesrealm.atlas.preferences.v3`.
The old village’s separate keys are never migrated or cleared. Sound starts off.

A mutation reads the current validated save, applies one visitor action and
writes only actual changes. Web Locks serialize that transaction across tabs
where supported. Without Web Locks, each action still reads current storage,
but simultaneous localStorage writes cannot be guaranteed atomic. Failed I/O
switches the current page to in-memory progress with a one-time notice. A reset
requires a separate confirmation and clears only the atlas state.

Shared collections use `#collection=v3:id-a,id-b` with strict catalogue ID
validation, a 64-ID limit and a 4096-character limit. Hashes contain public IDs,
not arbitrary URLs or scripts. Each share link is a snapshot, not a live synced
collection. Creating a share does not transmit browser progress to a server.

## Rendering and access

WebGL is primary, with native shading, soft shadows and animated atmosphere.
When WebGL is unavailable, Three.js SVGRenderer projects the same meshes and
camera with static atmosphere and no GPU effects. If both renderers fail, all
links remain accessible through the directory. SVG has no idle animation loop.
Device pixel ratio is capped and hidden documents pause. Reduced motion disables
ambient movement. No remote texture/font downloads are needed.

Map labels, directory links and all controls work with a keyboard. Escape closes
a panel; shortcuts are suppressed while typing. `1`–`6` open districts, `J`
journeys, `C` collection, `L` or `/` directory, `H` guide, and `R` resets the camera.
The HTML also contains a no-JavaScript directory of primary destinations.

## Preserved Village v2

- Play: <https://ialirezaaa.github.io/HadesRealm/archive/village-v2/>
- Complete source/build ZIP:
  <https://ialirezaaa.github.io/HadesRealm/archive/HadesRealm-Village-v2-backup.zip>
- Frozen branch: `archive/hadesrealm-village-v2-2026-11-28`
- Original commit: `ff5790cd6637cd6b12ecbb955a6bf53a254021a1`
- ZIP SHA-256:
  `dafee541cec07b30029c7a85af74452c3935135e390f4a0f812d82578f0b2dd6`

The ZIP preserves all 27 original tracked source/build files byte-for-byte.
The served archive adapts its title, canonical/Open Graph URLs and copied share
link, adds `noindex` metadata, and includes a return link. Its public
`SNAPSHOT.json` distinguishes original ZIP hashes from these adapted runtime
files. Do not regenerate or update the frozen ZIP.

Archive assets live in `public/archive/`, so the ordinary Vite build carries them
forward. Do not copy the entire root atlas back into its own archive.

## Repository publication

Editable source lives in `realm/`. Both existing publication workflows install,
test and build it, then replace `site/public/HadesRealm/` with `realm/dist/`
before building the portfolio. The static publisher mirrors that output to root
`HadesRealm/`. The archive is included automatically. Do not hand-edit generated
mirrors. Existing portfolio, blog/garden and brand publication remain in the same
workflows.

Vite’s relative base works under `/HadesRealm/` and the nested archive is an
independent prebuilt app. The portfolio validator checks the atlas’s standalone
canonical URL; its sitemap includes the atlas separately from the React shell.
