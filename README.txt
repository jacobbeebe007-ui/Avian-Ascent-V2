Avian Ascent Refactored Project

Structure
- index.html (loads `/src/main.ts` under Vite; legacy order is js/bootstrap/load-order.json)
- css/main.css
- css/sprites.css
- css/battle.css
- css/shop.css
- css/ui.css
- js/bootstrap/load-order.json (canonical ordered list for legacy concat)
- js/core/game.js (large gameplay core; concatenated in prod as assets/avian-game.js)
- src/main.ts (ESM bootstrap: leaf globals on globalThis, then classic concat)
- src/data/*.js (leaf modules; extend here before legacy bundle)
- js/data/content.js
- js/systems/systems.js
- js/systems/shop.js
- js/systems/fixes.js
- js/ui/ui.js
- js/ui/sprites.js

Notes
- This is a real consolidation refactor from the split project zip.
- Legacy scripts share one browser global realm; they are concatenated without an outer IIFE so top-level `function foo()` stays on `window` for inline `onclick` handlers.
- `npm test` still parses source files under `js/` (including js/core/game.js), not the emitted bundle.

Local Run / Preview (Vite)
- Install once: `npm install`
- Dev server: `npm run dev` (default http://localhost:5173). Dev middleware serves `/__avian_legacy_game.js` built from the manifest (same order as the former nine `<script>` tags).
- Production build: `npm run build` → `dist/` including minified `assets/avian-game.js`, hashed `assets/index-*.js`, copied CSS/icons/manifest, and `sw.js`.
- Preview built output: `npm run preview` (binds `0.0.0.0`).
- Serving only the repo root with Python (`preview:static`) does not load the game unless you run `npm run build` first and serve `dist/` — index.html expects `/src/main.ts` resolution from Vite.

Mobile on same Wi-Fi
- Run `npm run dev -- --host 0.0.0.0` or `npm run preview` after a build; open `http://<LAN-ip>:<port>`.

Merge/CI quick check
- Run `npm test` before pushing/PR (needs Node.js).
- This validates JS parse and verifies every sprite path in CSS points to an existing file.


If GitHub says the merge is too complex
- This usually means the PR is very large or has overlapping edits with the base branch.
- Fix it locally instead of the web editor:
  1) `git fetch origin`
  2) `git checkout <your-branch>`
  3) `git rebase origin/main`  (or `git merge origin/main`)
  4) Resolve conflicts, then run `npm test`
  5) `git push --force-with-lease` (for rebase) or `git push` (for merge)
- If the PR is still too large, split it into smaller PRs (sprites/paths, gameplay, UI) so GitHub can evaluate checks and diffs reliably.

