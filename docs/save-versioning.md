# Save versioning

## Why

The localStorage key (`AVIAN_OW_KEYS.SAVE = 'avianAscent_save_v2'`) is the
bucket the save blob lives in. Bumping it silently throws away every
player's run. We used to bump it whenever the save *shape* changed, which
is a lot of needlessly nuked runs.

Phase 6 adds an in-blob `schemaVersion` field plus an ordered migration
runner so we can change the shape without changing the bucket.

## Files

- [`js/systems/save-migrations.js`](../js/systems/save-migrations.js) —
  defines `SAVE_SCHEMA_VERSION` and the ordered migrations array. Loaded
  before `js/core/game.js` so the migration helper is available when
  `loadSaveData()` runs.
- [`js/core/game.js`](../js/core/game.js) — `saveRun()` stamps
  `schemaVersion` on every write; `loadSaveData()` runs migrations on
  every read.

## When to bump SAVE_SCHEMA_VERSION (vs the bucket key)

Bump `SAVE_SCHEMA_VERSION` when you change save shape:

- New required field. Default it in a migration.
- Renamed field. Move old → new in a migration.
- Removed field. Delete it in a migration.

Bump the bucket key (`avianAscent_save_v2` → `_v3`) only when migrations
are genuinely impossible (e.g. catastrophic data corruption from a past
release that we can't fix forward). This is rare; default to a migration.

## Adding a migration

1. Open [`js/systems/save-migrations.js`](../js/systems/save-migrations.js).
2. Bump `TARGET` (also exposed as `SAVE_SCHEMA_VERSION`) by one.
3. Append an entry to the `migrations` array:

   ```js
   {
     from: 1, to: 2, note: 'add ui.actionQueueVisible default',
     fn: function (save) {
       save.ui = save.ui || {};
       if (typeof save.ui.actionQueueVisible !== 'boolean') {
         save.ui.actionQueueVisible = true;
       }
       return save;
     },
   },
   ```

4. Migrations MUST be idempotent (running a migration twice on the same
   save is a no-op) and MUST mutate-and-return the save.
5. Run the per-phase ritual:

   ```bash
   node scripts/build-bundle.js
   node --check js/avian-game.bundle.js
   node scripts/ci-check.js
   node scripts/smoke.js
   ```

6. Manually verify: open the game with an existing save (e.g. from a
   previous build), confirm it still loads cleanly.

## Failure handling

If a migration `fn` throws, `runSaveMigrations` returns `null` and
`loadSaveData` treats the save as corrupt (the player ends up at the
splash screen with no run to continue). This is preferable to silently
loading a half-migrated blob.

## Inspecting the migration chain

In dev tools:

```js
Avian.systems.listSaveMigrations()
// → [{ from: 0, to: 1, note: 'baseline chain…' }, { from: 1, to: 2, note: 'clear skillSlots…' }]
Avian.systems.SAVE_SCHEMA_VERSION
// → 2
```

## v2 migration

- Clears `player.familyEvolutionState.skillSlots` when migrating from schema v1 so every bird re-seeds from the new family-evolution catalogs instead of legacy mirrored flat slots.

## v4 migration

- Initializes `player.mutationInventory` and `player.equippedMutations` for the slot-based mutations/equipment system.
- Clears legacy Endless run-modifier flags (`mutBloodMoon`, etc.) and `endlessRewards`.
- Stamps `mutationsPackVersion` on the save blob.

## v8 migration

- Wipes `player.mutationInventory` and `player.equippedMutations` when upgrading from schema v7.
- Required because the mutation gear overhaul replaces all item IDs, splits wing/feet into left/right slots, and bumps `mutationsPackVersion` to `2026.06-mutations-v4`.
- Players keep their run progress; only equipped gear and stored mutation inventory are reset.

## v9 migration

- Wipes `player.mutationInventory` and `player.equippedMutations` when upgrading from schema v8.
- Required because Grey–Gold mutation IDs change from `MT####` to `MUT-####` in `2026.06-mutations-v5` (Orange `MT####` items are retained).
- Players keep run progress; only mutation inventory and equipped loadouts reset.

## v10 migration

- Wipes `player.mutationInventory` and `player.equippedMutations` when upgrading from schema v9.
- Required because the mutation catalog moves to slot-coded `MUT-LW-001` IDs, includes 33 workbook Orange items, and bumps `mutationsPackVersion` to `2026.06-mutations-v6` (legacy `MT####` orange items removed).
- Players keep run progress; only mutation inventory and equipped loadouts reset.

## v13 migration (equipment v0.3 — Phase 10)

- **Labelled pre-release reset** for mutation-era runs (`mutationsPackVersion` present, no `equipmentPackVersion` / `equipmentV2`).
- Does **not** map mutations → equipment. The run ends gracefully; meta stores are untouched.
- Before reset: one-time backup of the pre-migration blob to `avianAscent_save_v2_backup_pre_v13`.
- Compensation: Shiny Objects equal to the sell value of wiped mutation inventory (half `MUTATION_SHOP_COSTS` per tier) plus a starter stipend (`EQUIPMENT_V2_STARTER_STIPEND`, currently 30). Recorded on `avianAscent_meta_v1.equipmentV2Migration` for the next Flight.
- Saves that already carry `equipmentV2: true` + `equipmentPackVersion` migrate forward without a reset.
- New saves stamp `equipmentV2` (from the runtime flag) and `equipmentPackVersion: '2026.07-equipment-v0.3'` when the flag is on.
- When `equipmentV2` is on at load, `ensurePlayerEquipmentState` + `sanitizeEquipmentLoadout` validate the loadout: unknown item ids are removed with compensation; wrong-slot items are unequipped to inventory; 2H main + offHand conflicts clear offHand.

## v14 migration (Affinity Arsenal v0.6)

- Soft migration: stamps `affinityArsenalV06`, `affinityArsenalPackVersion`, and updated `equipmentPackVersion: '2026.07-affinity-arsenal-v0.6'`.
- Normalizes bird/player Aspect ids through Affinity aliases when `normalizeAffinityId` is available.
- Does **not** wipe equipment loadouts (pre-release reset was v13 only).
- Working Draft combat knobs live in `js/data/combat-config.js`.

## v15 migration (off-hand absorbs Shields)

- Moves legacy `player.equipment.shield` into `offHand` when empty; otherwise into `equipmentInventory`.
- Deletes the dedicated `shield` loadout key (7-slot loadout: helmet, armour, mainHand, offHand, anklets, necklace).
- Off-hand accepts Shields and any 1H weapon; Shields may remain equipped with a two-handed main.

Verification: `node scripts/verify-save-migration.mjs`
