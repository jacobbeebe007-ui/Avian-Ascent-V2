# game.js Architecture After Step 7

## Module map (new / moved)

| Module | Responsibility |
|--------|----------------|
| `js/core/game-helpers.js` | Combat number formatting, reward tiers, bird class resolution, encounter HTML escape |
| `js/debug/agent-debug.js` | Agent session debug ring buffer (`_agentDbgLog`) |
| `js/debug/telemetry.js` | Run telemetry persistence, highscore board, `onRunEnd` hook |
| `js/legacy/game-compat.js` | Legacy global alias registration (`Avian.legacy.exposeLegacyGlobals`) |
| `js/ui/combat-stats-modal.js` | Stats & Details modal, hover cards, stat grids |
| `js/ui/combat-bars.js` | HP / EN / protection bar rendering |
| `js/ui/combat-status.js` | Status badges and battle ailment symbols |
| `js/ui/combat-enemy-telegraph.js` | Enemy intent telegraph chips |
| `js/ui/combat-hud.js` | `refreshBattleUI`, energy orbs, `renderAllCombatUI` |
| `js/ui/combat-actions.js` | Action tray and combat item row rendering |
| `js/systems/build-nest-state.js` | Build Nest unlock gate (`avian_buildnest_unlocked`) |
| `js/systems/build-nest-forge-runtime.js` | Forge slot tier/star helpers and tier-star enemy builder |
| `js/ui/reward-screen.js` | Post-battle reward screen, nest shake, confirm flow |
| `js/ui/shop-compare.js` | Stork shop gear compare tooltips |
| `js/systems/shop-cadence.js` | Grey/boss shop visit scheduling after battles |
| `js/systems/story-overworld-progress.js` | Overworld progress normalization and stage clear |
| `js/systems/story-overworld-bridge.js` | Overworld return intent, enemy list normalization |
| `js/systems/story-stage-flow.js` | `advanceStage`, `continueStageTransitionAfterRewards` |

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
js/systems/build-nest-state.js
js/core/game-helpers.js
js/core/game.js
js/systems/build-nest-forge-runtime.js
js/systems/story-overworld-progress.js
js/systems/story-overworld-bridge.js
js/systems/story-stage-flow.js
js/systems/shop-cadence.js
js/debug/telemetry.js
js/ui/combat-stats-modal.js
…
js/ui/reward-screen.js
js/ui/shop-compare.js
js/ui/combat-bars.js
js/ui/combat-status.js
js/ui/combat-enemy-telegraph.js
js/ui/combat-hud.js
js/ui/combat-actions.js
… enemy AI / systems …
js/legacy/game-compat.js
```

## Known legacy compatibility

- Top-level `function foo()` declarations remain for concatenated shell + `globalThis` aliases
- `game-compat.js` re-exposes helpers if load order omits a global
- Dove sprite patch IIFE at top of `game.js`

## Remaining technical debt (non-blocking)

| Area | Status |
|------|--------|
| Combat UI rendering in game.js | ✅ Phase 3 (`js/ui/combat-*.js`) |
| Build Nest unlock + forge encounter runtime | ✅ Phase 4 (`js/systems/build-nest-*.js`; editor remains in `map-forge.js`) |
| Reward/shop orchestration | ✅ Phase 5 (`reward-screen.js`, `shop-compare.js`, `shop-cadence.js`) |
| Story flow extraction | ✅ Phase 6 (`story-overworld-*.js`, `story-stage-flow.js`) |
| Combat setup / controller | ⬜ Phases 7–8 |
| `ABILITY_TEMPLATES` inline block | ⬜ Deferred (high coupling) |

## Metrics

Run `node scripts/report-game-js-size.mjs` for current line counts.

Regenerate audit: `node scripts/generate-game-js-audit.mjs`
