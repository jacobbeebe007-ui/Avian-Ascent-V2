# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Avian Ascent — Blakiston's Court is a **fully static, client-side browser game**. There is **no backend, API, or database**. Source JS under `js/` is concatenated (no bundler/IIFE) so top-level functions stay on `window` for inline `onclick` handlers in `index.html`. See `README.txt` for the authoritative structure/workflow.

### Bundle (non-obvious gotcha)
`js/avian-game.bundle.js` is **generated** by `node scripts/build-bundle.js` (zero-deps, ~instant) and **committed** — `index.html` loads it, and GitHub Pages (avianascent.com) deploys the repo root with no build step. After editing any source file in `js/` (or cached shell CSS/HTML), rebuild and **commit the bundle, `js/avian-game.bundle.hash`, and `sw.js` together**. If the bundle is missing you'll get an alert: "js/avian-game.bundle.js is missing". Source-only PRs leave the live site on the old Nest/combat JS.
- `npm run dev` (Vite) regenerates the bundle in-memory on **every request** via middleware, so no manual rebuild is needed while using the dev server.
- `file://`, `npm run preview:static`, GitHub Pages, and the Playwright smoke test all use the committed (or freshly built) bundle.

### Run (dev)
- `npm run dev -- --host 0.0.0.0` → Vite dev server on port **5173** (open `/index.html`). This is the recommended dev workflow (auto-reload).
- Player entry flow: title "TAKE FLIGHT" → hub "BEGIN ASCENT" → pick a bird → "TAKE FLIGHT" → Mission Map → encounter → combat.

### Test / lint
- `npm test` runs the full CI chain (`build-bundle` → `ci-check` → many `verify-*.mjs` → `test-aspects` → Playwright `smoke`). It builds the bundle itself, so no separate build step is needed first.
- The `smoke` step uses Playwright and needs the Chromium browser binary (installed by the startup update script via `npx playwright install chromium`).
- There is **no separate linter/formatter** configured; `npm test` is the validation gate (JS parse checks + CSS sprite-path existence).
