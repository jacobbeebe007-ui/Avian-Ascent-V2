# Equipment & Bird Balance v0.3 Migration (equipmentV2)

Working doc for the migration from the 11-slot Mutation system + 364-row bespoke bird
kits to the workbook v0.3 fantasy equipment system (8 slots, 240 items, 40 families,
64 shared skill templates, six action sources), plus the full 52-bird rebalance.

Source of truth: `Newest Avian_Ascent_Master_Equipment_and_Bird_Balance_v0.3.xlsx`
(default path: `~/Documents/Avian Ascent/Avian Workbooks/`, overridable via
`AA_EQUIPMENT_WORKBOOK`). Priority of truth: Confirmed workbook rules > explicit
migration requirements > current code behaviour > Working Draft workbook rules.

Full plan: see the Equipment System Migration Plan (13 phases, PR-1 … PR-13).
This doc records the pieces the repo needs long-term: the phase ledger, the
Working-Draft decision log, and the Phase-13 legacy-identifier kill list.

---

## Phase ledger

| Phase | PR | Scope | Status |
| --- | --- | --- | --- |
| 0 | — | Freeze & inventory: baseline `npm test`, tag `pre-equipment-v2-migration`, this doc | done |
| 1 | PR-1 | `import-equipment-workbook.mjs` + inert `js/data/equipment/*` + `combat-config.js` + `verify-equipment-content.mjs` | pending |
| 2 | PR-2 | `Avian.flags.equipmentV2` + config-driven formulas (/50 StatMod, EN 4/6 bands, 40% pen cap, crit caps, damaging-hit-only meter) | pending |
| 3 | PR-3 | `js/systems/equipment.js`: 8-slot loadout, hand/class validation, inventory, ledger rollup | pending |
| 4a | PR-4a | Equipment actions/effects runtime — Core v0.2 families | pending |
| 4b | PR-4b | Expanded v0.3 families + Minor/Moderate/Major tier engine + strongest-applies stacking | pending |
| 5 | PR-5 | Six action sources, Basic Attack inheritance + Natural Strike, paired techniques, 2H A/B, ultimate gating | pending |
| 6 | PR-6 | v0.3 bird stats/passives/innate utilities/class perks (Duke boss-override preserved) | pending |
| 7 | PR-7 | Equipment drops in nest/shop/grove/forge, rarity tables, orange-uniqueness config | pending |
| 8 | PR-8 | Enemy 8-slot loadouts from Reference Loadouts + AI action selection | pending |
| 9 | PR-9 | Six-slot action bar, equipment Nest UI, tooltips, hotkeys 1–6 | pending |
| 10 | PR-10 | Save schema v13, pre-release reset shim, backup key, load-time loadout validation | pending |
| 11 | PR-11 | `Avian.debug.simulateDuel/simulateRun`, run-balance matrix, telemetry export | pending |
| 12 | PR-12 | Flip `equipmentV2` default on, internal playtest, config-only tuning | pending |
| 13 | PR-13 | Excise mutation system, legacy kits/tiers, flag, shims; grep assertions | pending |

## Phase 0 baseline (recorded 2026-07-22)

- Baseline commit: `99dfad6` ("Endless mode Vert"), tagged `pre-equipment-v2-migration`.
- `npm test` = bundle + ci-check + verify-combat-damage-formula + test-aspects + smoke.
- The baseline suite had five pre-existing failures unrelated to this migration, fixed
  as part of Phase 0 so every later phase can be gated on a green suite:
  1. `verify-test-map-catalog` — `js/data/maps/manifest.json` and `finch-burrow.json`
     were committed with a UTF-8 BOM that broke `JSON.parse`. BOMs stripped.
  2. `verify-map-forge-encounter` — `grantForgeClearRewards` had no `savedEggs`
     reward type. Added (mirrors `goldenGoose` handling).
  3. `verify-workbook-abilities` — parser bugs: the legacy master workbook's
     "Bird Ability List" sheet has no ID column (the old `'id'` header fallback
     substring-matched "Ailment / **Rider**"), and skill-tree ids were read with a
     regex that no longer matches the generated JSON format. Rewritten to evaluate
     the generated file and match on ability names. Cooldown drift (52 legacy S6/S7
     abilities whose "2 turns"/"Ultimate Meter: 100" cells were dropped to 0 by
     `sync-mutation-trees-from-workbook.mjs`'s `Number('2 turns') → 0` parse) is
     reported warn-only: those kits are deleted wholesale in Phase 13.
  4. ci-check globals baseline — 38 intentional pre-existing globals (combat
     formulas constants, ailment engine helpers, etc.) were never baselined.
     Regenerated `scripts/.globals-baseline.json` (68 names).
  5. ci-check data-action lint — map-forge registers its actions via
     `Object.assign(global.Avian.actions, {...})`, which the lint didn't scan.
     Lint extended to parse bulk `Object.assign(Avian.actions, {...})` blocks.
  6. `verify-combat-damage-formula` — two stale expectations from before curved
     two-decimal damage rounding (`roundCurvedDamage`) landed. Tests updated to
     the current intended behaviour (2-decimal damage, 2-decimal recoil).

## Decision log (Working Draft / Open Decisions)

Every unresolved numeric lives in `js/data/combat-config.js` (Phase 1) so tuning
never touches system code. Status values: OPEN (needs sign-off), DEFAULTED
(shipping the plan's default until overridden), RESOLVED.

| # | Decision | Default shipped | Status |
| --- | --- | --- | --- |
| D1 | Save strategy: pre-release reset vs full refund migration [Phase 10] | Labelled pre-release reset; meta stores preserved; backup key + compensation | DEFAULTED |
| D2 | Ultimate source selection when multiple Gold/Orange qualify [Phase 5] | Auto-pick when unique; pre-combat picker when multiple (`ultimateSourceItemId`) | DEFAULTED |
| D3 | Feather/card-tier progression role once 7-slot kits are gone [Phase 6/7] | OPEN — blocks feather-gating removal design | OPEN |
| D4 | Choose-at-use effects (Opening Verse ATK/MATK; Convergence of Six aspect) [Phase 4] | Auto-rule: bird's higher stat / main-hand aspect; choice UI deferred | DEFAULTED |
| D5 | Guard numeric definition (Crushing Peck, Skyfall Anvil, Knight passives) [Phase 4] | Config `PLAYTEST` value; keep current `gainGuarded` semantics | DEFAULTED |
| D6 | Code-only `frostGuard`/`emberGuard`/`toxicResistance` post-upgrade windows [Phase 4] | Keep behind config until playtest verdict | DEFAULTED |
| D7 | Chilled: remove EN-regen reduction (workbook says SPD only) [Phase 4] | Remove EN-regen effect when `equipmentV2` on | DEFAULTED |
| D8 | Utility meter awards: R-ULT-001 says damaging hits only [Phase 2] | Utilities award 0 meter when `equipmentV2` on | DEFAULTED |
| D9 | Enemy gear: exact Reference Loadouts vs randomised family pools [Phase 8] | Reference loadouts + small seeded variance | DEFAULTED |
| D10 | Bird-card "mutation" naming in `js/meta/` (unrelated card mechanic) [Phase 13] | Keep as-is; out of scope | DEFAULTED |
| D11 | `orangeUniqueness` acquisition mode [Phase 7] | `'perRun'` (config switch: none/perRun/perInventory) | DEFAULTED |
| D12 | Class-equipment restriction mode [Phase 3] | `'hard'` (matches Loadout Builder CLASS CONFLICT) | DEFAULTED |
| D13 | /50 StatMod curve constants (divisor, 0.80–1.60 clamps, class references) [Phase 2] | Workbook draft values behind flag; tune from Damage-Lab sims | DEFAULTED |

## Legacy identifiers that must disappear (Phase 13 grep assertions)

Asserted absent from `js/` and `index.html` (docs history exempt) once the excise
PR lands:

- Slot keys/labels as equipment slots: `leftWing`, `rightWing`, `leftFoot`,
  `rightFoot`, `beak`, `syrinx`, `chest`, `plumage`, `eyes`, `head`, `tail`;
  the mutation `SLOT_LABELS` map.
- Item/system ids: `MUT-` item prefix, `mutationInventory`, `equippedMutations`,
  `mutationIds`, `mutationsPackVersion`, `Avian.mutations`, `Avian.mutationEffects`,
  `rollEnemyMutations`, `MUTATION_SHOP_COSTS`, `OW_MUTATION_BANDS`,
  `grantGroveGearMutation`.
- Removed stats: `lightAttackDmgPct`, `mediumAttackDmgPct`, `heavyAttackDmgPct`,
  `physicalAilment`, `magicAilment`, gear `ailmentChances`, gear `multiHitDmgPct`.
- Legacy tiers: `grand`, `epic`, `legendary` (and debuff aliases `crippling`,
  `ruinous`, `fatal`) as tier keys; the 6/8/12/18/25 tables;
  `combat-stat-magnitudes` tier maps.
- Bird-kit ids: the `_FAMILY_S` ability id pattern, `startAbilities`,
  `slotAbilities`, `abilitySlotCount`, `skillSlots` feather gating.
- Exceptions (keep): `mutationHistory` / bird-card "mutation" in `js/meta/` is the
  unrelated card-upgrade mechanic. "Incinerate" already has zero occurrences —
  the assertion still lands so it can never return (Scorched is the confirmed name).

## Rollback

- Phases 2–11 are inert with `Avian.flags.equipmentV2` off — single-line rollback.
- Phase 12 rollback = flip the default flag.
- Phase 13 rollback = git revert of the excise PR (kept as one revertible PR).
- Any rollback re-runs `npm run bundle` (bundle is checked in).
- Tag `pre-equipment-v2-migration` marks the last pre-migration commit.
