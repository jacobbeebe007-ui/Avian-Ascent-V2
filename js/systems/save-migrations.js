/* Avian Ascent — save schema migrations.
 *
 * Adds an explicit `schemaVersion` field to the persisted save blob so
 * we can ship balance / shape changes without having to bump the
 * AVIAN_OW_KEYS.SAVE localStorage key (which silently nukes player runs).
 *
 * Add a new migration when you need to:
 *   - Rename or move a field on the save blob.
 *   - Default-fill a new field that downstream code now requires.
 *   - Drop a removed field cleanly.
 *
 * To add a migration:
 *   1. Bump SAVE_SCHEMA_VERSION to N+1.
 *   2. Push `{ from: N, to: N+1, fn: (save) => mutateAndReturn(save) }`.
 *   3. Update docs/save-versioning.md with the human-readable note.
 *
 * Migrations run in order from `save.schemaVersion ?? 0` up to the current
 * SAVE_SCHEMA_VERSION on every load. They MUST be idempotent: a save can
 * be opened, migrated, and re-saved repeatedly.
 *
 * Loaded BEFORE js/core/game.js by js/bootstrap/load-order.json so
 * `loadSaveData()` can call `globalThis.runSaveMigrations` synchronously.
 */
(function () {
  'use strict';

  /** Bump when adding a migration. */
  var TARGET = 7;

  /** Combat-pack version stamp surfaced on the save blob. Wipes attached when
   *  this changes so legacy ability/perk/family state never bleeds into a run. */
  var COMBAT_PACK_VERSION = '2026.05-combat-rewrite';
  var MUTATIONS_PACK_VERSION = '2026.05-mutations-v3';

  /** @type {Array<{from:number,to:number,fn:(save:any)=>any,note?:string}>} */
  var migrations = [
    {
      from: 0,
      to: 1,
      note: 'baseline chain for saves missing schemaVersion',
      fn: function (save) {
        return save;
      },
    },
    {
      from: 1,
      to: 2,
      note: 'clear mirrored skillSlots so family-evolution catalogs rebuild on load',
      fn: function (save) {
        if (save.player && save.player.familyEvolutionState && Array.isArray(save.player.familyEvolutionState.skillSlots)) {
          delete save.player.familyEvolutionState.skillSlots;
        }
        return save;
      },
    },
    {
      from: 2,
      to: 3,
      note: 'combat rewrite: wipe ability/perk/family run state; new content is sourced from Avian.data.combatPack at runtime. Currency, unlocks, cosmetics preserved.',
      fn: function (save) {
        if (!save) return save;
        // Preserve persistent meta (currency, unlocks, cosmetics, codex shells)
        // by wiping only the run/player-combat fields below.
        if (save.player && typeof save.player === 'object') {
          var p = save.player;
          p.abilities = [];
          p.mainAttackId = null;
          p.classPerks = [];
          p.endlessRewards = [];
          delete p.passiveEvolutionBonuses;
          if (p.passive && typeof p.passive === 'object') {
            // Drop old auto-attached passive blob; combat-pack-boot rebinds at load.
            delete p.passive;
          }
          delete p.familyEvolutionState;
          delete p.skillSlotState;
          delete p.skillSlots;
        }
        // Drop volatile shop snapshot — pool generator now rolls from shop-pool.
        delete save._shopSnapshots;
        delete save.shopSnapshots;
        // Record combat-pack version so future migrations can detect a refresh.
        save.combatPackVersion = COMBAT_PACK_VERSION;
        // Surface a one-shot notice for the UI layer.
        save._combatRewriteNoticePending = true;
        return save;
      },
    },
    {
      from: 3,
      to: 4,
      note: 'mutations equipment: init inventory/equipped slots; clear legacy endless run-modifier flags',
      fn: function (save) {
        if (!save || !save.player) return save;
        var p = save.player;
        p.mutationInventory = Array.isArray(p.mutationInventory) ? p.mutationInventory : [];
        p.equippedMutations = p.equippedMutations && typeof p.equippedMutations === 'object' ? p.equippedMutations : null;
        p.endlessRewards = [];
        var legacyMutFlags = ['mutBloodMoon', 'mutVenomSeason', 'mutGaleTempo', 'mutArcOverload', 'mutHuntersCruelty', 'mutIronSky', 'mutSuddenFlight', 'mutDarkChorus', 'mutRazorInstinct', 'mutLongWar'];
        for (var i = 0; i < legacyMutFlags.length; i++) delete p[legacyMutFlags[i]];
        save.mutationsPackVersion = MUTATIONS_PACK_VERSION;
        return save;
      },
    },
    {
      from: 4,
      to: 5,
      note: 'mutated feather + ability vault: init player.mutatedFeatherCount and player.abilityInventory',
      fn: function (save) {
        if (!save || !save.player) return save;
        var p = save.player;
        p.mutatedFeatherCount = Math.max(0, Math.floor(Number(p.mutatedFeatherCount) || 0));
        p.abilityInventory = Array.isArray(p.abilityInventory) ? p.abilityInventory : [];
        return save;
      },
    },
    {
      from: 5,
      to: 6,
      note: 'combat consumables: init player.combatItems (3 Fresh Water default)',
      fn: function (save) {
        if (!save || !save.player) return save;
        var p = save.player;
        if (!p.combatItems || typeof p.combatItems !== 'object') {
          p.combatItems = { freshWater: 3, sugarWater: 0, honeyWater: 0 };
        } else {
          p.combatItems.freshWater = Math.max(0, Math.min(3, Math.floor(Number(p.combatItems.freshWater) || 0)));
          p.combatItems.sugarWater = Math.max(0, Math.min(2, Math.floor(Number(p.combatItems.sugarWater) || 0)));
          p.combatItems.honeyWater = Math.max(0, Math.min(1, Math.floor(Number(p.combatItems.honeyWater) || 0)));
        }
        return save;
      },
    },
    {
      from: 6,
      to: 7,
      note: 'master bird list: map legacy class ids (striker/singer/etc.) to knight/rogue/mage/siren/inquisitor/bard',
      fn: function (save) {
        if (!save || !save.player) return save;
        var map = {
          striker: 'rogue', singer: 'mage', predator: 'inquisitor', trickster: 'bard', tank: 'knight', bruiser: 'knight',
          support: 'mage', vanguard: 'knight', defender: 'knight', skirmisher: 'rogue', assassin: 'rogue',
        };
        var p = save.player;
        if (p.class) {
          var raw = String(p.class).toLowerCase().split(/\s+/)[0];
          if (map[raw]) p.class = map[raw];
        }
        return save;
      },
    },
  ];

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, debug: {} });
  if (!Avian.systems) Avian.systems = Object.create(null);

  Avian.systems.SAVE_SCHEMA_VERSION = TARGET;
  Avian.systems.COMBAT_PACK_VERSION = COMBAT_PACK_VERSION;
  Avian.systems.MUTATIONS_PACK_VERSION = MUTATIONS_PACK_VERSION;

  /**
   * Apply ordered migrations until the save is at the current schema version.
   * Returns the migrated save (mutated in place); returns null on failure
   * so callers can treat the save as corrupt.
   */
  Avian.systems.runSaveMigrations = function runSaveMigrations(save) {
    if (!save || typeof save !== 'object') return save;
    var v = Number(save.schemaVersion);
    if (!Number.isFinite(v) || v < 0) v = 0;
    while (v < TARGET) {
      var step = null;
      for (var i = 0; i < migrations.length; i++) {
        if (migrations[i].from === v) { step = migrations[i]; break; }
      }
      if (!step) {
        try { console.warn('[save] no migration from v' + v + ' to v' + TARGET + '; assuming forward-compatible.'); } catch (_e) {}
        v = TARGET;
        break;
      }
      try {
        var next = step.fn(save);
        save = (next && typeof next === 'object') ? next : save;
        v = step.to;
      } catch (err) {
        try { console.error('[save] migration v' + step.from + '→v' + step.to + ' failed:', err); } catch (_e) {}
        return null;
      }
    }
    save.schemaVersion = TARGET;
    return save;
  };

  /** Convenience for tests / debug: list migration steps in order. */
  Avian.systems.listSaveMigrations = function listSaveMigrations() {
    return migrations.map(function (m) { return { from: m.from, to: m.to, note: m.note || '' }; });
  };
})();
