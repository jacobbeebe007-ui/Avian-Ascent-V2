# Endless Mode Scaling & Cadence

This document defines the intended Endless-mode progression behavior used by `js/core/game.js` and `js/systems/endless-map.js`.

## Core scaling contract

- Endless uses the same story-derived base scaling curve as Story battles.
- With the Endless node map active, combats scale as endless from the first map fight (not only after Stage 20).
- After Story completion (`Stage 20`) on legacy non-map endless, Endless applies an additional ramp to effective enemy level as endless battles increase.
- Enemy growth is intentionally **not capped at level 10** (or any Story-end cap). Endless scaling continues indefinitely.
- Difficulty multiplier (`DIFFICULTIES.*.mult`) scales **all** enemy combat stats (HP, ATK, MATK, DEF, MDEF, SPD, ACC, dodge).
- After player bird level ≥ 20 and enemy effective level ≥ 20, an extra **+5% all combat stats** ramp applies every 3 endless battles (`floor(endlessBattle / 3)` steps).

## Endless node map (STS-style)

Endless mode opens a branching black node map (`#screen-endless-map`) instead of auto-chaining fights.

### Flow

`choose path → (fight → nest reward) | rest | merchant | unknown → choose path`, forever.

- **Segments:** ~12 content floors + start + boss. After the segment boss reward, a new segment generates. No act end.
- **Room weights (non-boss):** Normal 53%, Elite 8%, Rest 12%, Merchant 5%, Unknown 22%.
- **Rest:** Grants a **30% Max HP shield** for the next combat (not HP heal). Stored as `pendingRestShieldPct`, applied after `resetForNewBattle`.
- **Merchant:** Opens Stork shop; exiting returns to the map.
- **Unknown:** Resolves on enter to Monster / Merchant / Treasure / Event (Grove), with STS-style rotating weights reset each segment.
- **Elite:** Map elite rooms use elite tier multipliers (random elite promotion remains disabled elsewhere).
- **Boss:** Always the single final node of a segment (not a fixed every-N cadence while the map is active).

### Disabled while map is active

- Post-battle free heal (`POST_BATTLE_HEAL_PCT_ENDLESS`)
- Cadence shops (`ENDLESS_SHOP_CADENCE`)
- Random ~10% Whispering Grove after fights (Grove only via Unknown → Event)

### Persistence

`G.endlessMap` (nodes, edges, current/visited, unknown table, pending rest shield, segment index) and `G.runSeed` are stored in the run save.

## Endless battle numbering

- On the node map, `endlessBattle` increments by 1 after each combat node is cleared.
- Legacy / helpers still expose:
  - `endlessBattle = stage - 20` when `stage > 20` via `getEndlessEffectiveBattleNumber` for older cadence math when the map is not active.

## Cadence rules (legacy / non-map fallback)

If Endless somehow runs without a map state:

- **Boss cadence:** every 20 endless battles (`20, 40, 60, ...`).
- **Shop cadence:** every 10 endless battles (`10, 20, 30, ...`).

With the map active, bosses are segment-end nodes and shops are Merchant (or Unknown→Merchant) nodes.

## Enemy roster & mutations (endless)

- Normal endless enemies are picked from `normalByLevel` at the player's bird level (±1 for variety), clamped 1–20.
- Boss endless enemies use `bossesByLevel` at the nearest boss tier (10 / 20 / 30) with effective level at player level or player level + 1.
- Map elites use elite tier stats; enemy mutations still mirror the player's equipped mutation **count** and tiers.

## Rewards (endless map / stage 21+)

- Each defeated enemy grants **1 heal** and **1 mutation** (2 drops per bird), via `buildEndlessClearRewardDrops`, when endless run rewards are active.
- Treasure rooms grant shinies + a mutation, then return to the map (no combat).

## Stage 20 semantics

- In Endless runs, `Stage 20` remains a checkpoint concept for legacy helpers; Duke Blakiston remains Story-only.
- Map-driven endless progression is tracked primarily by `endlessBattle` and segment index.

## Flow consistency with Story

- The level-up screen flow and reward flow are shared between Story and Endless.
- Endless map mode returns to `#screen-endless-map` after nest rewards / shop / grove / rest instead of auto-`loadStage()`.
