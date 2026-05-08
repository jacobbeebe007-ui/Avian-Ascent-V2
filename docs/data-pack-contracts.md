# Data Pack Contracts

## Ability metadata parity contract

`scripts/ci-check.js` enforces a parity contract between:

- runtime ability templates: `Object.keys(ABILITY_TEMPLATES + ABILITY_TEMPLATES_EXTRA)` (sourced from `js/core/game.js`), and
- metadata entries: `Object.keys(ABILITY_PASSIVE_UPGRADE_PACK.ABILITY_DEFS)` (from `js/data/ability_passive_upgrade_pack.js`).

The report is categorized into:

- **missing metadata entries**: ability templates that do not have metadata,
- **orphan metadata entries**: metadata ids that do not map to any template,
- **required field gaps**: metadata entries missing any of `tags`, `role`, or `notes`.

## CI/dev behavior

- **Dev mode warning**: when `NODE_ENV` is not `production`, parity mismatches are printed as warnings.
- **Strict mode failure**: CI only fails when strict mode is explicitly enabled with either:
  - `CI_STRICT_PARITY=1`, or
  - `ABILITY_PARITY_STRICT=1`.

This allows incremental metadata backfilling while still supporting hard-gate validation in stricter pipelines.

## Ability family tree contract

- **Source of truth (runtime):** `FAMILY_EVOLUTION_BIRD_DATA` and related `*_SKILL_*` objects in [`js/core/game.js`](../js/core/game.js).
- **Portable graph:** [`js/data/ability_family_tree.js`](../js/data/ability_family_tree.js) is **generated** by `npm run gen:ability-tree` (see [`scripts/build-ability-family-tree.js`](../scripts/build-ability-family-tree.js)). It mirrors each bird’s `slotLayout`, `families`, `paths`, and tier `abilities` (plus optional `damageTypeProgression`, `tierNames`, `role` / `slotRole`).
- **Load order:** listed in [`js/bootstrap/load-order.json`](../js/bootstrap/load-order.json) (`gameShellScripts`) — the tree file is loaded immediately after [`ability_passive_upgrade_pack.js`](../js/data/ability_passive_upgrade_pack.js).
- **Runtime exposure:** after `initDataPacks()`, `G.dataPacks.abilityFamilyTree` holds a read-only slice (`version`, `sourceHint`, `birds`) when `globalThis.ABILITY_FAMILY_TREE` is present.

`scripts/ci-check.js` verifies every ability id referenced in the family tree exists in the merged **wired** id set: ability templates, `ACTIONS` keys, `*_SKILL_ACTION_OVERRIDES` keys, `registerAbilityAlias` new-ids, and Kiwi V2 bridge rows (`['kiwi_*', …]`). Alias chains are resolved the same way as other parity checks. It also reports **structural gaps** (empty `birdKey`, `familyId`, or `pathId`). In non-production `NODE_ENV`, mismatches are reported as warnings; with `CI_STRICT_PARITY=1` or `ABILITY_PARITY_STRICT=1`, they fail the check.
