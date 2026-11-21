# Hades III

A local React/Vite portfolio for Alireza Asgarpour. Original code-built identity plate, a shared floating frame, a contextual navigation panel and an interactive neural atlas.

## Run

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173/. No public deployment is configured.

## Navigation

Right-click, click the footer navigation control, or press Ctrl/Cmd+K. Shift+F10 also opens the panel. Escape closes it; Tab and arrow keys move through its entries.

Routes: /, /about, /work, /systems, /contact.
The graph supports dragging, zoom buttons, keyboard node selection, a guided tour and related-node exploration. Project nodes link to /work?project=<id>.
The footer motion control pauses ambient animation. Reduced-motion system preferences are respected by default. A red dot and softly following ring replace the mouse cursor on fine-pointer devices; touch devices keep native behavior.

## Content and behavior

- src/data.js contains project records, graph nodes, connections and profile links.
- src/App.jsx contains the shared frame and page content.
- src/Navigation.jsx provides bounded context navigation with keyboard support.
- src/Atlas.jsx renders the interactive vector graph.
- src/Cursor.jsx tracks the pointer without triggering React renders on every move.
- src/experiences.css adds pointer feedback, staged entrances, ambient movement and the collaborations layout.
- src/App.css contains responsive styling, motion, reduced-motion handling and A4 print styles.
- The contact form prepares a draft. Sending happens through the visitor's mail client; no server-side delivery is implied.
- No remote font, image-generation service or account is required at runtime.

## Verify

```sh
npm run build
npm run lint
node scripts/verify.mjs
```

The browser verification script uses the local bundled Playwright installation by default. On another machine, set PLAYWRIGHT_PACKAGE to the absolute path of an installed playwright/package.json. Chrome must be installed and the local preview must be running on port 4173.

Production output is in dist/. A future static host needs an SPA fallback to index.html for direct route access. The development preview handles this automatically.

See design-qa.md for verification scope and content sourcing.
