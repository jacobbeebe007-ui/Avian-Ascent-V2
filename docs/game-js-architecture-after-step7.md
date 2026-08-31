# game.js Architecture After Step 7

## Module map (new / moved)

| Module | Responsibility |
|--------|----------------|
| `js/core/game-helpers.js` | Combat number formatting, reward tiers, bird class resolution, encounter HTML escape |
| `js/debug/agent-debug.js` | Agent session debug ring buffer (`_agentDbgLog`) |
| `js/debug/telemetry.js` | Run telemetry persistence, highscore board, `onRunEnd` hook |
| `js/legacy/game-compat.js` | Legacy global alias registration (`Avian.legacy.exposeLegacyGlobals`) |

## game.js remaining responsibilities

- Game bootstrap and `G` state container
- `registerGameModule` / `runModuleHook` orchestration
- Combat turn loop and battle completion
- Nest / shop / reward screen orchestration (UI rendering still largely inline)
- Story / overworld / endless flow coordination
- Save/load entry points
- `ABILITY_TEMPLATES` boot population (large inline block — deferred)
- Legacy global exports for HTML `data-action` and dynamic handlers

## Major namespaces

- `Avian.helpers` — pure formatting and tier/class helpers
- `Avian.debug.telemetry` — telemetry API surface
- `Avian.debug.agentLog` — development logging
- `Avian.legacy` — compatibility shims
- `Avian.actions` — routable UI actions (event-router)
- `Avian.systems.*` — domain systems (unchanged ownership)

## Global browser API

See `docs/global-ui-api.md` for the `data-action` registry. Critical globals preserved:

`roundCombatDamage`, `roundCombatStat`, `rollCombatSpread`, `applyFractionalHp`, `dodgeBonusFromSpeed`, `normalizeRewardTier`, `resolveFinalClass`, `getTelemetrySummary`, `registerGameModule`, `G`, `openNest`, `startGame`, etc.

## State owners

| State | Owner |
|-------|-------|
| `G` combat/run fields | `game.js` (migrate incrementally) |
| Telemetry runs | `js/debug/telemetry.js` + localStorage |
| Build Nest draft | `js/world/map-forge.js` |
| Story run progress | `js/systems/story-run-state.js` |
| Combat breakdown log | `js/systems/combat-breakdown.js` |

## Load-order overview

```
… data / systems …
js/debug/agent-debug.js
js/core/game-helpers.js
js/core/game.js
js/debug/telemetry.js
… post-game systems / UI …
js/legacy/game-compat.js
```

## Known legacy compatibility

- Top-level `function foo()` declarations remain for concatenated shell + `globalThis` aliases
- `game-compat.js` re-exposes helpers if load order omits a global
- Dove sprite patch IIFE at top of `game.js`

## Remaining technical debt (non-blocking)

| Area | Status |
|------|--------|
| Combat UI rendering in game.js | 🔁 Needs revisit (Phase 3) |
| Build Nest beyond map-forge.js | 🔁 Needs revisit (Phase 4) |
| Reward/shop orchestration | ⬜ Phase 5 |
| Story flow extraction | ⬜ Phase 6 |
| Combat setup / controller | ⬜ Phases 7–8 |
| `ABILITY_TEMPLATES` inline block | ⬜ Deferred (high coupling) |

## Metrics

Run `node scripts/report-game-js-size.mjs` for current line counts.

Regenerate audit: `node scripts/generate-game-js-audit.mjs`
