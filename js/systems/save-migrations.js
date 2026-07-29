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
  var TARGET = 18;

  /** Combat-pack version stamp surfaced on the save blob. Wipes attached when
   *  this changes so legacy ability/perk/family state never bleeds into a run. */
  var COMBAT_PACK_VERSION = '2026.07-flat-abilities';
  var MUTATIONS_PACK_VERSION = '2026.06-mutations-v6';
  var EQUIPMENT_PACK_VERSION = '2026.07-equipment-v1.3-basic-starting-weapons';
  var AFFINITY_ARSENAL_PACK_VERSION = '2026.07-weapon-first-v0.9';
  var EQUIPMENT_LOOT_PACK_VERSION = '2026.07-equipment-v1.3-basic-starting-weapons';
  var WEAPON_FIRST_PACK_VERSION = '2026.07-weapon-first-v0.9';
  var EQUIPMENT_V12_PACK_VERSION = '2026.07-equipment-v1.2-restoration';
  var EQUIPMENT_V13_PACK_VERSION = '2026.07-equipment-v1.3-basic-starting-weapons';
  var SAVE_BACKUP_KEY_PRE_V13 = 'avianAscent_save_v2_backup_pre_v13';
  var EQUIPMENT_V2_STARTER_STIPEND = 30;
  var MUTATION_SELL_COSTS = { white: 16, green: 28, blue: 44, purple: 64, gold: 96, orange: 140 };

  function mutationSellPrice(tier) {
    var raw = String(tier || 'white').toLowerCase();
    var key = raw === 'grey' ? 'white' : raw;
    return Math.max(1, Math.floor((MUTATION_SELL_COSTS[key] || MUTATION_SELL_COSTS[raw] || 20) / 2));
  }

  function lookupMutationItem(itemId) {
    if (!itemId) return null;
    var id = String(itemId);
    var tierMatch = id.match(/-(white|green|blue|purple|gold|orange|grey)$/i);
    if (tierMatch) return { tier: tierMatch[1].toLowerCase() };
    if (/^MUT-/i.test(id)) return { tier: 'green' };
    return { tier: 'white' };
  }

  function needsEquipmentV2PreReleaseReset(save) {
    if (!save || typeof save !== 'object') return false;
    if (save.equipmentV2 === true && save.equipmentPackVersion) return false;
    if (save.mutationsPackVersion && !save.equipmentPackVersion) return true;
    if (!save.equipmentV2 && save.mutationsPackVersion) return true;
    var p = save.player;
    if (!p || typeof p !== 'object') return false;
    if (save.equipmentV2 === true) return false;
    if (Array.isArray(p.mutationInventory) && p.mutationInventory.length) return true;
    var eq = p.equippedMutations;
    if (eq && typeof eq === 'object') {
      for (var slot in eq) {
        if (!Object.prototype.hasOwnProperty.call(eq, slot)) continue;
        var arr = eq[slot];
        if (!Array.isArray(arr)) continue;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i]) return true;
        }
      }
    }
    if (p.mutationInventory !== undefined || p.equippedMutations !== undefined) return true;
    return !save.equipmentPackVersion;
  }

  function computeMutationEraCompensation(save) {
    var total = 0;
    var p = save && save.player;
    if (!p) return 0;
    var seen = Object.create(null);
    function addItemId(id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      var item = lookupMutationItem(id);
      if (item) total += mutationSellPrice(item.tier);
    }
    var inv = p.mutationInventory || [];
    for (var i = 0; i < inv.length; i++) {
      var entry = inv[i];
      addItemId(typeof entry === 'string' ? entry : (entry && entry.itemId));
    }
    var eq = p.equippedMutations || {};
    for (var slot in eq) {
      if (!Object.prototype.hasOwnProperty.call(eq, slot)) continue;
      var arr = eq[slot];
      if (!Array.isArray(arr)) continue;
      for (var j = 0; j < arr.length; j++) addItemId(arr[j]);
    }
    return total;
  }

  function writePreV13BackupOnce(rawJson) {
    try {
      var ls = globalThis.localStorage;
      if (!ls || typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') return false;
      if (ls.getItem(SAVE_BACKUP_KEY_PRE_V13)) return false;
      ls.setItem(SAVE_BACKUP_KEY_PRE_V13, rawJson);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function grantEquipmentV2MigrationCompensation(compensation, migrationResult) {
    var amt = Math.max(0, Math.floor(Number(compensation) || 0));
    try {
      var key = globalThis.FORTUNE_META_KEY || 'avianAscent_meta_v1';
      var ls = globalThis.localStorage;
      if (!ls || typeof ls.getItem !== 'function' || typeof ls.setItem !== 'function') return amt;
      var meta = {};
      try { meta = JSON.parse(ls.getItem(key) || '{}'); } catch (_e2) { meta = {}; }
      if (!meta || typeof meta !== 'object') meta = {};
      meta.equipmentV2Migration = {
        pendingShinyCompensation: amt,
        inventorySellValue: Math.max(0, Math.floor(Number(migrationResult && migrationResult.inventorySellValue) || 0)),
        stipend: Math.max(0, Math.floor(Number(migrationResult && migrationResult.stipend) || 0)),
        note: String((migrationResult && migrationResult.note) || ''),
        migratedAt: Date.now(),
        schemaVersion: TARGET,
        packVersion: EQUIPMENT_PACK_VERSION,
      };
      ls.setItem(key, JSON.stringify(meta));
    } catch (_e3) { /* noop */ }
    return amt;
  }

  function buildPreReleaseResetTombstone(save) {
    var sellValue = computeMutationEraCompensation(save);
    var stipend = EQUIPMENT_V2_STARTER_STIPEND;
    var compensation = sellValue + stipend;
    var note = 'Your mutation-era run was ended for the Equipment v0.3 pre-release update. '
      + 'Meta progress was kept. Shiny Object compensation (' + compensation + '🌟) is saved for your next Flight.';
    var migrationResult = {
      reset: true,
      inventorySellValue: sellValue,
      stipend: stipend,
      compensation: compensation,
      note: note,
    };
    grantEquipmentV2MigrationCompensation(compensation, migrationResult);
    return {
      schemaVersion: TARGET,
      equipmentV2: false,
      _equipmentV2PreReleaseReset: true,
      _equipmentV2MigrationResult: migrationResult,
    };
  }

  function stampEquipmentSaveFields(save) {
    if (!save || typeof save !== 'object') return save;
    var flagOn = !!(globalThis.Avian && globalThis.Avian.flags && globalThis.Avian.flags.equipmentV2);
    save.equipmentV2 = !!flagOn;
    if (flagOn) {
      save.equipmentPackVersion = EQUIPMENT_PACK_VERSION;
      save.affinityArsenalPackVersion = AFFINITY_ARSENAL_PACK_VERSION;
    } else {
      delete save.equipmentPackVersion;
      delete save.affinityArsenalPackVersion;
    }
    return save;
  }

  function stampAffinityArsenalFields(save) {
    if (!save || typeof save !== 'object') return save;
    save.affinityArsenalV06 = true;
    save.equipmentLootV07 = true;
    save.affinityArsenalPackVersion = AFFINITY_ARSENAL_PACK_VERSION;
    save.equipmentPackVersion = EQUIPMENT_PACK_VERSION;
    save.equipmentLootPackVersion = EQUIPMENT_LOOT_PACK_VERSION;
    /* Soft-migrate aspect display aliases; keep legacy ids on birds. */
    if (save.player && save.player.aspect && Avian.affinity && typeof Avian.affinity.normalize === 'function') {
      save.player.aspect = Avian.affinity.normalize(save.player.aspect) || save.player.aspect;
    }
    return save;
  }

  function stampEquipmentLootV07Fields(save) {
    if (!save || typeof save !== 'object') return save;
    stampAffinityArsenalFields(save);
    save.equipmentLootV07 = true;
    save.equipmentLootPackVersion = EQUIPMENT_LOOT_PACK_VERSION;
    return save;
  }

  function stampWeaponFirstV09Fields(save) {
    if (!save || typeof save !== 'object') return save;
    stampEquipmentSaveFields(save);
    save.affinityArsenalV06 = true;
    save.equipmentLootV07 = false;
    save.weaponFirstV09 = true;
    save.affinityArsenalPackVersion = AFFINITY_ARSENAL_PACK_VERSION;
    save.equipmentPackVersion = EQUIPMENT_PACK_VERSION;
    save.equipmentLootPackVersion = EQUIPMENT_LOOT_PACK_VERSION;
    save.weaponFirstPackVersion = WEAPON_FIRST_PACK_VERSION;
    return save;
  }

  function stampEquipmentV12Fields(save) {
    if (!save || typeof save !== 'object') return save;
    stampWeaponFirstV09Fields(save);
    save.equipmentV12 = true;
    save.equipmentPackVersion = EQUIPMENT_V12_PACK_VERSION;
    save.equipmentLootPackVersion = EQUIPMENT_V12_PACK_VERSION;
    save.equipmentV12PackVersion = EQUIPMENT_V12_PACK_VERSION;
    return save;
  }

  function stampEquipmentV13Fields(save) {
    if (!save || typeof save !== 'object') return save;
    stampEquipmentV12Fields(save);
    save.equipmentV13BasicStartingWeapons = true;
    save.equipmentPackVersion = EQUIPMENT_V13_PACK_VERSION;
    save.equipmentLootPackVersion = EQUIPMENT_V13_PACK_VERSION;
    save.equipmentV13PackVersion = EQUIPMENT_V13_PACK_VERSION;
    return save;
  }

  function grantClassStartingWeapon(save) {
    var p = save && save.player;
    if (!p || typeof p !== 'object') return save;
    if (!p.equipment || typeof p.equipment !== 'object') {
      p.equipment = {
        helmet: null,
        armour: null,
        mainHand: null,
        offHand: null,
        ankletL: null,
        ankletR: null,
        necklace: null,
      };
    }
    if (p.equipment.mainHand) return save;
    var classId = String(p.class || '').toLowerCase();
    var map = {
      mage: 'WPN-B01',
      siren: 'WPN-B01',
      knight: 'WPN-B02',
      brute: 'WPN-B02',
      bard: 'WPN-B03',
      rogue: 'WPN-B04',
      inquisitor: 'WPN-B05',
    };
    if (map[classId]) p.equipment.mainHand = map[classId];
    return save;
  }

  function wipePlayerEquipmentLoadout(save) {
    var p = save && save.player;
    if (!p || typeof p !== 'object') return save;
    p.equipmentInventory = [];
    p.equipment = {
      helmet: null,
      armour: null,
      mainHand: null,
      offHand: null,
      ankletL: null,
      ankletR: null,
      necklace: null,
    };
    delete p.ultimateSourceItemId;
    delete p._equipmentMechanics;
    delete p._equipmentPct;
    return save;
  }

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
    {
      from: 7,
      to: 8,
      note: 'mutation gear v4: wipe inventory/equipped loadouts; new split slots and MT catalog',
      fn: function (save) {
        if (!save || !save.player) return save;
        save.player.mutationInventory = [];
        save.player.equippedMutations = null;
        save.mutationsPackVersion = '2026.06-mutations-v4';
        return save;
      },
    },
    {
      from: 8,
      to: 9,
      note: 'mutation gear v5: new MUT catalog for grey–gold tiers; wipe equipped/inventory loadouts',
      fn: function (save) {
        if (!save || !save.player) return save;
        save.player.mutationInventory = [];
        save.player.equippedMutations = null;
        save.mutationsPackVersion = MUTATIONS_PACK_VERSION;
        return save;
      },
    },
    {
      from: 9,
      to: 10,
      note: 'mutation gear v6: slot-coded MUT catalog with orange tier; wipe equipped/inventory loadouts',
      fn: function (save) {
        if (!save || !save.player) return save;
        save.player.mutationInventory = [];
        save.player.equippedMutations = null;
        save.mutationsPackVersion = MUTATIONS_PACK_VERSION;
        return save;
      },
    },
    {
      from: 10,
      to: 11,
      note: 'flat abilities: remove mutated feathers, ability vault, and family evolution upgrades',
      fn: function (save) {
        if (!save || !save.player) return save;
        var p = save.player;
        delete p.mutatedFeatherCount;
        delete p.abilityInventory;
        delete p.familyEvolutionState;
        save.combatPackVersion = COMBAT_PACK_VERSION;
        return save;
      },
    },
    {
      from: 11,
      to: 12,
      note: 'remap legacy *_F{n}_L1_BASE ability ids to combat-pack canonical ids',
      fn: function (save) {
        if (!save || !save.player) return save;
        var aliases = (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.combatPack && globalThis.Avian.data.combatPack.abilityAliases) || {};
        function remapId(id) {
          var s = String(id || '');
          return aliases[s] || s;
        }
        var p = save.player;
        if (p.mainAttackId) p.mainAttackId = remapId(p.mainAttackId);
        if (Array.isArray(p.abilities)) {
          p.abilities.forEach(function (ab) {
            if (ab && ab.id) ab.id = remapId(ab.id);
          });
        }
        var fes = p.familyEvolutionState;
        if (fes && Array.isArray(fes.skillSlots)) {
          fes.skillSlots.forEach(function (slot) {
            if (!slot) return;
            if (slot.abilityId) slot.abilityId = remapId(slot.abilityId);
            if (slot.familyId) slot.familyId = remapId(slot.familyId);
          });
        }
        return save;
      },
    },
    {
      from: 12,
      to: 13,
      note: 'equipment v0.3: labelled pre-release reset for mutation-era runs; stamp equipmentV2/equipmentPackVersion',
      fn: function (save) {
        if (!save) return save;
        if (needsEquipmentV2PreReleaseReset(save)) {
          return buildPreReleaseResetTombstone(save);
        }
        return stampEquipmentSaveFields(save);
      },
    },
    {
      from: 13,
      to: 14,
      note: 'affinity arsenal v0.6: stamp pack versions + affinity aliases; soft migrate aspect ids',
      fn: function (save) {
        if (!save) return save;
        stampEquipmentSaveFields(save);
        return stampAffinityArsenalFields(save);
      },
    },
    {
      from: 14,
      to: 15,
      note: 'equipment loot v0.7 + merge legacy equipment.shield into offHand',
      fn: function (save) {
        if (!save || typeof save !== 'object') return save;
        stampEquipmentSaveFields(save);
        stampEquipmentLootV07Fields(save);
        var p = save.player;
        if (p && typeof p === 'object' && p.equipment && typeof p.equipment === 'object') {
          var eq = p.equipment;
          if (Object.prototype.hasOwnProperty.call(eq, 'shield')) {
            var shieldId = eq.shield;
            delete eq.shield;
            if (shieldId) {
              if (!eq.offHand) {
                eq.offHand = shieldId;
              } else {
                if (!Array.isArray(p.equipmentInventory)) p.equipmentInventory = [];
                p.equipmentInventory.push(shieldId);
              }
            }
          }
        }
        return save;
      },
    },
    {
      from: 15,
      to: 16,
      note: 'weapon-first v0.9: wipe hybrid % equipment; stamp weaponFirst pack; species Base Health + Dexterity',
      fn: function (save) {
        if (!save || typeof save !== 'object') return save;
        wipePlayerEquipmentLoadout(save);
        stampWeaponFirstV09Fields(save);
        return save;
      },
    },
    {
      from: 16,
      to: 17,
      note: 'equipment v1.2: Armour/Magic Armour/Fortify/Ward catalogue; wipe EQ-* loadouts',
      fn: function (save) {
        if (!save || typeof save !== 'object') return save;
        wipePlayerEquipmentLoadout(save);
        stampEquipmentV12Fields(save);
        return save;
      },
    },
    {
      from: 17,
      to: 18,
      note: 'equipment v1.3: grant class Basic starting weapons when mainHand empty',
      fn: function (save) {
        if (!save || typeof save !== 'object') return save;
        grantClassStartingWeapon(save);
        stampEquipmentV13Fields(save);
        return save;
      },
    },
  ];

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, debug: {} });
  if (!Avian.systems) Avian.systems = Object.create(null);

  Avian.systems.SAVE_SCHEMA_VERSION = TARGET;
  Avian.systems.COMBAT_PACK_VERSION = COMBAT_PACK_VERSION;
  Avian.systems.MUTATIONS_PACK_VERSION = MUTATIONS_PACK_VERSION;
  Avian.systems.EQUIPMENT_PACK_VERSION = EQUIPMENT_PACK_VERSION;
  Avian.systems.AFFINITY_ARSENAL_PACK_VERSION = AFFINITY_ARSENAL_PACK_VERSION;
  Avian.systems.EQUIPMENT_LOOT_PACK_VERSION = EQUIPMENT_LOOT_PACK_VERSION;
  Avian.systems.WEAPON_FIRST_PACK_VERSION = WEAPON_FIRST_PACK_VERSION;
  Avian.systems.EQUIPMENT_V12_PACK_VERSION = EQUIPMENT_V12_PACK_VERSION;
  Avian.systems.EQUIPMENT_V13_PACK_VERSION = EQUIPMENT_V13_PACK_VERSION;
  Avian.systems.SAVE_BACKUP_KEY_PRE_V13 = SAVE_BACKUP_KEY_PRE_V13;
  Avian.systems.EQUIPMENT_V2_STARTER_STIPEND = EQUIPMENT_V2_STARTER_STIPEND;
  Avian.systems.needsEquipmentV2PreReleaseReset = needsEquipmentV2PreReleaseReset;
  Avian.systems.computeMutationEraCompensation = computeMutationEraCompensation;
  Avian.systems.writePreV13BackupOnce = writePreV13BackupOnce;
  Avian.systems.grantEquipmentV2MigrationCompensation = grantEquipmentV2MigrationCompensation;
  Avian.systems.stampEquipmentSaveFields = stampEquipmentSaveFields;
  Avian.systems.stampAffinityArsenalFields = stampAffinityArsenalFields;
  Avian.systems.stampEquipmentLootV07Fields = stampEquipmentLootV07Fields;
  Avian.systems.stampWeaponFirstV09Fields = stampWeaponFirstV09Fields;
  Avian.systems.stampEquipmentV12Fields = stampEquipmentV12Fields;
  Avian.systems.stampEquipmentV13Fields = stampEquipmentV13Fields;
  Avian.systems.grantClassStartingWeapon = grantClassStartingWeapon;

  Avian.systems.maybeBackupPreV13Save = function maybeBackupPreV13Save(rawJson, parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    var v = Number(parsed.schemaVersion);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v >= TARGET) return false;
    if (!needsEquipmentV2PreReleaseReset(parsed)) return false;
    return writePreV13BackupOnce(rawJson);
  };

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
