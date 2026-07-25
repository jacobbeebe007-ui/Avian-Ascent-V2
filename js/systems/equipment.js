/* Avian Ascent — Equipment v0.3 Runtime (Phase 3)
 *
 * 7-slot loadout (offHand holds 1H weapons or Shields), inventory, validation, stat ledger rollup.
 * Gated by Avian.flags.equipmentV2; mutations keep owning stats when flag is off.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var equipment = Avian.equipment || Object.create(null);

  var SLOT_ORDER = [
    'helmet', 'armour', 'mainHand', 'offHand', 'ankletL', 'ankletR', 'necklace',
  ];

  var FLAT_STAT_MAP = {
    dodgePct: 'dodge',
    critChancePct: 'critChance',
    physicalPenPct: 'armorPen',
    magicPenPct: 'magicPen',
  };

  /* Core item mods: v0.7 hybrid flat + percentage. Pct values stored as percent numbers. */
  var CORE_PCT_TO_LEDGER = {
    hpPct: 'hp',
    atkPct: 'atk',
    defPct: 'def',
    matkPct: 'matk',
    mdefPct: 'mdef',
    spdPct: 'spd',
  };
  var CORE_FLAT_TO_LEDGER = {
    hpFlat: 'hp',
    atkFlat: 'atk',
    defFlat: 'def',
    matkFlat: 'matk',
    mdefFlat: 'mdef',
    spdFlat: 'spd',
  };

  var ITEM_PCT_TO_LEDGER = {
    physicalDamagePct: 'physDamagePct',
    magicDamagePct: 'magicDamagePct',
    aspectDamagePct: 'aspectDamagePct',
    critDamagePct: 'critDamagePct',
    healingPowerPct: 'healingPowerPct',
    shieldStrengthPct: 'shieldStrengthPct',
  };

  var EQUIPMENT_PCT_KEYS = [
    'hp', 'atk', 'def', 'matk', 'mdef', 'spd',
    'physDamagePct', 'magicDamagePct', 'aspectDamagePct', 'critDamagePct',
    'healingPowerPct', 'shieldStrengthPct',
  ];

  function isEquipmentV2() {
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function slotsDef() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.slots) || null;
  }

  function itemsCatalog() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.items) || null;
  }

  function combatConfig() {
    return (Avian.data && Avian.data.combatConfig) || null;
  }

  function getSlotOrder() {
    var sd = slotsDef();
    if (sd && Array.isArray(sd.slotOrder) && sd.slotOrder.length) return sd.slotOrder.slice();
    var cfg = combatConfig();
    if (cfg && Array.isArray(cfg.equipmentSlots) && cfg.equipmentSlots.length) return cfg.equipmentSlots.slice();
    return SLOT_ORDER.slice();
  }

  function createEmptyLoadout() {
    var out = Object.create(null);
    var order = getSlotOrder();
    for (var i = 0; i < order.length; i++) out[order[i]] = null;
    return out;
  }

  function getItem(id) {
    var cat = itemsCatalog();
    if (!cat || !id) return null;
    return cat[id] || null;
  }

  function getPlayerClassId(player) {
    if (!player) return null;
    if (player.class) return String(player.class).toLowerCase();
    var bk = player.birdKey;
    if (bk && typeof BIRDS !== 'undefined' && BIRDS[bk] && BIRDS[bk].class) {
      return String(BIRDS[bk].class).toLowerCase();
    }
    return null;
  }

  function parseClassRestriction(req) {
    if (!req || req === 'Any') return null;
    return String(req).split('/').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  }

  function itemAllowedForPlayer(item, classIdOptional) {
    if (!item) return false;
    var cls = classIdOptional != null
      ? String(classIdOptional).toLowerCase()
      : getPlayerClassId(typeof G !== 'undefined' ? G.player : null);
    var familyName = item.family || null;
    if (familyName === 'Talon Dagger') familyName = 'Dagger Pinion';

    /* v0.6 weapon-access table overrides catalogue classRestriction where present. */
    var access = Avian.data && Avian.data.equipment && Avian.data.equipment.weaponAccess;
    if (access && familyName && access[familyName] && access[familyName].classAccess) {
      var allowed = access[familyName].classAccess;
      if (Array.isArray(allowed) && allowed.indexOf('any') < 0) {
        if (!cls) return false;
        return allowed.indexOf(cls) >= 0;
      }
    }

    var families = Avian.data && Avian.data.equipment && Avian.data.equipment.families;
    var fam = families && familyName ? families[familyName] || families[item.family] : null;
    if (fam && fam.classAccess && fam.classAccess !== 'Any') {
      var famParts = parseClassRestriction(fam.classAccess);
      if (famParts && famParts.length) {
        if (!cls) return false;
        return famParts.indexOf(cls) >= 0;
      }
    }

    var req = item.classRestriction;
    if (!req || req === 'Any') return true;
    if (!cls) return false;
    var parts = parseClassRestriction(req);
    return parts.indexOf(cls) >= 0;
  }

  function classRestrictionMode() {
    var cfg = combatConfig();
    var mode = cfg && cfg.classRestrictionMode;
    return mode || 'hard';
  }

  function slotMeta(slotKey) {
    var sd = slotsDef();
    return (sd && sd.slots && sd.slots[slotKey]) || null;
  }

  function isShieldItem(item) {
    return !!(item && String(item.slot || '') === 'Shield');
  }

  function isOneHandedWeaponItem(item) {
    return !!(item && String(item.slot || '') === 'Weapon' && (Number(item.hands) || 0) === 1);
  }

  function slotAcceptsItem(slotKey, item) {
    if (!item || !slotKey) return false;
    var meta = slotMeta(slotKey);
    if (!meta) return false;
    /* Off-hand absorbs Shields and any 1H weapon; dedicated shield slot removed. */
    if (slotKey === 'offHand') {
      if (isShieldItem(item) && (Number(item.hands) || 0) === 0) return true;
      if (isOneHandedWeaponItem(item)) return true;
      return false;
    }
    if (item.slot !== meta.accepts) return false;
    return true;
  }

  /** Migrate legacy `equipment.shield` into offHand (or inventory if occupied). */
  function migrateLegacyShieldSlot(player) {
    if (!player || !player.equipment || typeof player.equipment !== 'object') return false;
    var eq = player.equipment;
    if (!Object.prototype.hasOwnProperty.call(eq, 'shield')) return false;
    var shieldId = eq.shield;
    delete eq.shield;
    if (!shieldId) return true;
    if (!eq.offHand) {
      eq.offHand = shieldId;
    } else if (Array.isArray(player.equipmentInventory)) {
      player.equipmentInventory.push(shieldId);
    } else {
      player.equipmentInventory = [shieldId];
    }
    return true;
  }

  function isEquipLockedDuringBattle() {
    if (typeof isStoryBattleNestEquipLocked === 'function') return isStoryBattleNestEquipLocked();
    return false;
  }

  function ensurePlayerEquipmentState(player) {
    if (!player) return null;
    if (!player.equipment || typeof player.equipment !== 'object') {
      player.equipment = createEmptyLoadout();
    } else {
      migrateLegacyShieldSlot(player);
      var order = getSlotOrder();
      for (var i = 0; i < order.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(player.equipment, order[i])) {
          player.equipment[order[i]] = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(player.equipment, 'shield')) {
        delete player.equipment.shield;
      }
    }
    if (!Array.isArray(player.equipmentInventory)) player.equipmentInventory = [];
    return player;
  }

  function findInventoryIndex(player, itemId) {
    if (!player || !itemId) return -1;
    var inv = player.equipmentInventory || [];
    for (var i = 0; i < inv.length; i++) {
      if (inv[i] === itemId) return i;
    }
    return -1;
  }

  function addToInventory(player, itemId) {
    ensurePlayerEquipmentState(player);
    var item = getItem(itemId);
    if (!itemId || !item) return false;
    player.equipmentInventory.push(itemId);
    if (Avian.equipmentLoot && typeof Avian.equipmentLoot.markRunUnlockedEquipmentRarity === 'function') {
      Avian.equipmentLoot.markRunUnlockedEquipmentRarity(globalThis.G, item.rarity);
    }
    return true;
  }

  function removeFromInventory(player, itemId) {
    var idx = findInventoryIndex(player, itemId);
    if (idx < 0) return false;
    player.equipmentInventory.splice(idx, 1);
    return true;
  }

  function capTrackedStatValue(statKey, value) {
    var v = Number(value) || 0;
    if (statKey === 'critChance') return Math.max(0, Math.min(100, v));
    if (statKey === 'armorPen' || statKey === 'magicPen') return Math.max(0, Math.min(95, v));
    return Math.max(0, v);
  }

  function rollupEquipmentItem(item, flatOut, pctOut, mechOut) {
    if (!item || !item.stats) return;
    var s = item.stats;
    for (var rawKey in s) {
      if (!Object.prototype.hasOwnProperty.call(s, rawKey)) continue;
      var val = Number(s[rawKey]) || 0;
      if (!val) continue;
      var coreFlatLedger = CORE_FLAT_TO_LEDGER[rawKey];
      if (coreFlatLedger) {
        flatOut[coreFlatLedger] = (flatOut[coreFlatLedger] || 0) + val;
        continue;
      }
      var coreLedger = CORE_PCT_TO_LEDGER[rawKey];
      if (coreLedger) {
        /* Item stores percent numbers (4.09 → +4.09%); progression expects fractions. */
        pctOut[coreLedger] = (pctOut[coreLedger] || 0) + val / 100;
        continue;
      }
      var ledgerKey = FLAT_STAT_MAP[rawKey];
      if (ledgerKey) {
        flatOut[ledgerKey] = (flatOut[ledgerKey] || 0) + val;
        continue;
      }
      var pctLedger = ITEM_PCT_TO_LEDGER[rawKey];
      if (pctLedger) {
        pctOut[pctLedger] = (pctOut[pctLedger] || 0) + val;
        if (mechOut) {
          if (rawKey === 'physicalDamagePct') mechOut.physicalDamageUpPct = (mechOut.physicalDamageUpPct || 0) + val;
          else if (rawKey === 'magicDamagePct') mechOut.magicDamageUpPct = (mechOut.magicDamageUpPct || 0) + val;
          else if (rawKey === 'critDamagePct') mechOut.critDamageBonusPct = (mechOut.critDamageBonusPct || 0) + val;
          else if (rawKey === 'aspectDamagePct') mechOut.aspectDamagePct = (mechOut.aspectDamagePct || 0) + val;
          else if (rawKey === 'healingPowerPct') mechOut.healingPowerPct = (mechOut.healingPowerPct || 0) + val;
          else if (rawKey === 'shieldStrengthPct') mechOut.shieldStrengthPct = (mechOut.shieldStrengthPct || 0) + val;
        }
      }
    }
  }

  function sumEquippedEquipment(player) {
    ensurePlayerEquipmentState(player);
    var flat = Object.create(null);
    var pct = Object.create(null);
    var mech = Object.create(null);
    var eq = player.equipment || {};
    var order = getSlotOrder();
    for (var i = 0; i < order.length; i++) {
      var id = eq[order[i]];
      if (!id) continue;
      rollupEquipmentItem(getItem(id), flat, pct, mech);
    }
    return { stats: flat, pct: pct, mechanics: mech };
  }

  function rollupEquipmentStats(player) {
    var roll = sumEquippedEquipment(player);
    var L = (typeof ensureStatLedger === 'function') ? ensureStatLedger(player) : null;
    if (L) {
      L.fromEquipment = Object.assign({}, roll.stats);
      L.fromEquipmentPct = Object.assign({}, roll.pct);
    }
    player._equipmentMechanics = roll.mechanics;
    return roll;
  }

  function canEquip(player, itemId, slotKey) {
    var item = getItem(itemId);
    if (!item || !player) return { ok: false, reason: 'invalid' };
    ensurePlayerEquipmentState(player);
    if (isEquipLockedDuringBattle()) return { ok: false, reason: 'battle_locked' };
    if (findInventoryIndex(player, itemId) < 0) return { ok: false, reason: 'not_in_inventory' };
    var sk = slotKey;
    if (!sk) return { ok: false, reason: 'no_slot' };
    if (!slotAcceptsItem(sk, item)) return { ok: false, reason: 'wrong_slot' };
    var mode = classRestrictionMode();
    if (mode === 'hard' && !itemAllowedForPlayer(item, getPlayerClassId(player))) {
      return { ok: false, reason: 'class_restricted' };
    }
    var eq = player.equipment;
    if (sk === 'offHand') {
      var mainId = eq.mainHand;
      var mainItem = mainId ? getItem(mainId) : null;
      /* 2H main blocks off-hand weapons, but Shields may stay equipped. */
      if (mainItem && (Number(mainItem.hands) || 0) === 2 && !isShieldItem(item)) {
        return { ok: false, reason: 'two_handed_main' };
      }
    }
    return { ok: true, reason: null };
  }

  function unequip(player, slotKey) {
    ensurePlayerEquipmentState(player);
    if (isEquipLockedDuringBattle()) return false;
    var eq = player.equipment;
    if (!eq || !slotKey) return false;
    var id = eq[slotKey];
    if (!id) return false;
    eq[slotKey] = null;
    addToInventory(player, id);
    if (isEquipmentV2()) reapplyPlayerStatsFromSources(player);
    return true;
  }

  function equip(player, itemId, slotKey) {
    var check = canEquip(player, itemId, slotKey);
    if (!check.ok) return false;
    ensurePlayerEquipmentState(player);
    var eq = player.equipment;
    var sk = slotKey;
    var item = getItem(itemId);
    if (sk === 'mainHand' && item && (Number(item.hands) || 0) === 2 && eq.offHand) {
      var offItem = getItem(eq.offHand);
      if (!isShieldItem(offItem)) unequip(player, 'offHand');
    }
    var displaced = eq[sk];
    removeFromInventory(player, itemId);
    if (displaced) addToInventory(player, displaced);
    eq[sk] = itemId;
    if (isEquipmentV2()) reapplyPlayerStatsFromSources(player);
    return true;
  }

  function validateLoadout(player) {
    ensurePlayerEquipmentState(player);
    var eq = player.equipment;
    var order = getSlotOrder();
    var issues = [];
    for (var i = 0; i < order.length; i++) {
      var sk = order[i];
      var id = eq[sk];
      if (!id) continue;
      var item = getItem(id);
      if (!item) {
        eq[sk] = null;
        issues.push({ slot: sk, action: 'remove_invalid_id', itemId: id });
        continue;
      }
      if (!slotAcceptsItem(sk, item)) {
        addToInventory(player, id);
        eq[sk] = null;
        issues.push({ slot: sk, action: 'unequip_wrong_slot', itemId: id });
      }
    }
    var mainItem = eq.mainHand ? getItem(eq.mainHand) : null;
    if (mainItem && (Number(mainItem.hands) || 0) === 2 && eq.offHand) {
      var offItem = getItem(eq.offHand);
      if (!isShieldItem(offItem)) {
        var offId = eq.offHand;
        eq.offHand = null;
        addToInventory(player, offId);
        issues.push({ slot: 'offHand', action: 'unequip_two_handed_conflict', itemId: offId });
      }
    }
    return issues;
  }

  function defaultEquipmentSellPrice(itemOrRarity) {
    var loot = Avian.data && Avian.data.equipment && Avian.data.equipment.loot;
    var costs = (loot && loot.shopCosts) || { grey: 15, green: 28, blue: 44, purple: 64, gold: 96, orange: 200 };
    var key = typeof itemOrRarity === 'string'
      ? normalizeEquipmentRarity(itemOrRarity)
      : normalizeEquipmentRarity(itemOrRarity && itemOrRarity.rarity);
    return Math.max(1, Math.floor((costs[key] || 20) / 2));
  }

  function sanitizeEquipmentLoadout(player, opts) {
    opts = opts || {};
    ensurePlayerEquipmentState(player);
    var getSellPrice = typeof opts.getSellPrice === 'function'
      ? opts.getSellPrice
      : function (item) { return defaultEquipmentSellPrice(item); };
    var defaultInvalidPrice = Math.max(1, Math.floor(Number(opts.defaultInvalidSellPrice) || 8));
    var compensation = 0;
    var removed = [];
    var inv = player.equipmentInventory || [];
    var cleanInv = [];
    for (var ii = 0; ii < inv.length; ii++) {
      var invId = inv[ii];
      var invItem = getItem(invId);
      if (!invItem) {
        compensation += defaultInvalidPrice;
        removed.push({ where: 'inventory', itemId: invId, reason: 'invalid_id' });
        continue;
      }
      if (opts.removeUnmappable && !findEquipSlotForItem(player, invId)) {
        compensation += getSellPrice(invItem);
        removed.push({ where: 'inventory', itemId: invId, reason: 'unmappable' });
        continue;
      }
      cleanInv.push(invId);
    }
    player.equipmentInventory = cleanInv;
    var issues = validateLoadout(player);
    for (var j = 0; j < issues.length; j++) {
      var iss = issues[j];
      if (iss.action === 'remove_invalid_id') {
        compensation += defaultInvalidPrice;
        removed.push({ where: iss.slot, itemId: iss.itemId, reason: 'invalid_id' });
      }
    }
    return { issues: issues, removed: removed, compensation: compensation };
  }

  function findReferenceLoadout(classId, rarity) {
    var list = Avian.data && Avian.data.equipment && Avian.data.equipment.referenceLoadouts;
    if (!Array.isArray(list)) return null;
    var cls = String(classId || '').toLowerCase();
    var rar = String(rarity || 'grey').toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (row && String(row.class || '').toLowerCase() === cls && String(row.rarity || '').toLowerCase() === rar) {
        return row;
      }
    }
    return null;
  }

  function reapplyPlayerStatsFromSources(player) {
    if (!isEquipmentV2()) return;
    if (!player || !player.stats) return;
    ensurePlayerEquipmentState(player);
    validateLoadout(player);
    var prevMaxHp = Math.max(1, Number(player.stats.maxHp) || Number(player.stats.hp) || 1);
    var prevHp = Math.max(0, Number(player.stats.hp) || prevMaxHp);
    var hpRatio = prevMaxHp > 0 ? Math.max(0, Math.min(1, prevHp / prevMaxHp)) : 1;
    var wasFullHp = prevHp >= prevMaxHp;
    var L = (typeof ensureStatLedger === 'function') ? ensureStatLedger(player) : null;
    var base = (L && L.birdBaseline) ? L.birdBaseline : null;
    if (!base || !Object.keys(base).length) {
      var bd = (typeof BIRDS !== 'undefined' && BIRDS[player.birdKey]) ? BIRDS[player.birdKey] : null;
      base = bd && bd.stats
        ? (typeof cloneStatLedgerSlice === 'function' ? cloneStatLedgerSlice(bd.stats) : Object.assign({}, bd.stats))
        : Object.assign({}, player.stats);
    }
    var keys = (typeof STAT_LEDGER_TRACKED_KEYS !== 'undefined')
      ? STAT_LEDGER_TRACKED_KEYS
      : ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance', 'armorPen', 'magicPen'];
    var fromLevel = (L && L.fromLevel) ? L.fromLevel : {};
    var fromUpgrades = (L && L.fromUpgrades) ? L.fromUpgrades : {};
    var fromCardTier = (L && L.fromCardTier) ? L.fromCardTier : {};
    var eqRoll = sumEquippedEquipment(player);
    player._equipmentMechanics = eqRoll.mechanics;
    var fromEquipment = Object.assign({}, eqRoll.stats);
    var cfg = combatConfig();
    var useProg = !!(cfg && cfg.affinityArsenalV06 && Avian.birdProgression
      && typeof Avian.birdProgression.computeFinalStats === 'function');

    if (useProg) {
      var className = getPlayerClassId(player) || player.class || 'rogue';
      var level = Math.max(1, Number(player.level) || Number(player.birdLevel) || 1);
      var totalStars = Math.max(0, Number(player.totalStars) || Number(player.stars) || Number(player.cardStars) || 0);
      var tier = player.progressionTier || player.cardTier || player.equipmentTier || 'grey';
      /* Core equipment: flat after tier, then % (R-PROG-005). Chance/pen flats stay on eqRoll.stats. */
      var developedBase = {
        hp: (Number(base.maxHp) || Number(base.hp) || 0)
          + (Number(fromLevel.maxHp) || 0) + (Number(fromUpgrades.maxHp) || 0)
          + (Number(fromCardTier.maxHp) || 0),
        atk: (Number(base.atk) || 0) + (Number(fromLevel.atk) || 0) + (Number(fromUpgrades.atk) || 0)
          + (Number(fromCardTier.atk) || 0),
        def: (Number(base.def) || 0) + (Number(fromLevel.def) || 0) + (Number(fromUpgrades.def) || 0)
          + (Number(fromCardTier.def) || 0),
        matk: (Number(base.matk) || 0) + (Number(fromLevel.matk) || 0) + (Number(fromUpgrades.matk) || 0)
          + (Number(fromCardTier.matk) || 0),
        mdef: (Number(base.mdef) || 0) + (Number(fromLevel.mdef) || 0) + (Number(fromUpgrades.mdef) || 0)
          + (Number(fromCardTier.mdef) || 0),
        spd: (Number(base.spd) || 0) + (Number(fromLevel.spd) || 0) + (Number(fromUpgrades.spd) || 0)
          + (Number(fromCardTier.spd) || 0),
      };
      var equipmentFlat = {
        hp: Number(eqRoll.stats.hp) || 0,
        atk: Number(eqRoll.stats.atk) || 0,
        def: Number(eqRoll.stats.def) || 0,
        matk: Number(eqRoll.stats.matk) || 0,
        mdef: Number(eqRoll.stats.mdef) || 0,
        spd: Number(eqRoll.stats.spd) || 0,
      };
      /* Flats already folded into developedBase; pass zeros for level/star tables to avoid double-count
       * when fromLevel already mirrors legacy growth. Prefer workbook tables when fromLevel empty. */
      var hasLegacyLevel = Object.keys(fromLevel).some(function (k) { return Number(fromLevel[k]) > 0; });
      var result = Avian.birdProgression.computeFinalStats({
        base: hasLegacyLevel ? developedBase : {
          hp: (Number(base.maxHp) || Number(base.hp) || 0),
          atk: (Number(base.atk) || 0),
          def: (Number(base.def) || 0),
          matk: (Number(base.matk) || 0),
          mdef: (Number(base.mdef) || 0),
          spd: (Number(base.spd) || 0),
        },
        className: className,
        level: hasLegacyLevel ? 1 : level,
        totalStars: hasLegacyLevel ? 0 : totalStars,
        tier: tier,
        equipmentFlat: equipmentFlat,
        equipmentPct: eqRoll.pct || {},
      });
      var ledger = result.ledger || {};
      player.stats.maxHp = capTrackedStatValue('maxHp', ledger.hp || ledger.maxHp || player.stats.maxHp);
      player.stats.atk = capTrackedStatValue('atk', ledger.atk != null ? ledger.atk : player.stats.atk);
      player.stats.def = capTrackedStatValue('def', ledger.def != null ? ledger.def : player.stats.def);
      player.stats.matk = capTrackedStatValue('matk', ledger.matk != null ? ledger.matk : player.stats.matk);
      player.stats.mdef = capTrackedStatValue('mdef', ledger.mdef != null ? ledger.mdef : player.stats.mdef);
      player.stats.spd = capTrackedStatValue('spd', ledger.spd != null ? ledger.spd : player.stats.spd);
      /* Preserve chance stats from flat path (Evasion / Critical / pens). Precision is action-owned. */
      ['dodge', 'critChance', 'armorPen', 'magicPen'].forEach(function (ck) {
        var flat = (Number(fromLevel[ck]) || 0) + (Number(fromUpgrades[ck]) || 0)
          + (Number(fromCardTier[ck]) || 0) + (Number(eqRoll.stats[ck]) || 0);
        player.stats[ck] = capTrackedStatValue(ck, (Number(base[ck]) || 0) + flat);
      });
      /* Evasion permanent cap 20%. */
      var evaCap = (cfg.evasion && cfg.evasion.permanentCapPct != null) ? Number(cfg.evasion.permanentCapPct) : 20;
      if (player.stats.dodge != null) player.stats.dodge = Math.min(evaCap, Number(player.stats.dodge) || 0);
    } else {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var flat = (Number(fromLevel[k]) || 0) + (Number(fromUpgrades[k]) || 0)
          + (Number(fromCardTier[k]) || 0) + (Number(eqRoll.stats[k]) || 0);
        var v = (Number(base[k]) || 0) + flat;
        player.stats[k] = capTrackedStatValue(k, v);
      }
    }
    if (L) {
      L.fromEquipment = fromEquipment;
      L.fromEquipmentPct = Object.assign({}, eqRoll.pct);
    }
    if (player.stats.maxHp != null) {
      var nextMaxHp = Math.max(1, Number(player.stats.maxHp) || 1);
      player.stats.hp = wasFullHp ? nextMaxHp : Math.max(1, Math.min(nextMaxHp, Math.round(nextMaxHp * hpRatio)));
    }
    if (typeof normalizeCombatStats === 'function') normalizeCombatStats(player.stats);
  }

  var ACCESSORY_SLOTS = ['helmet', 'ankletL', 'ankletR', 'necklace'];

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeedString(str) {
    var h = 2166136261;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function normalizeEquipmentRarity(raw) {
    var r = String(raw || 'grey').toLowerCase();
    if (r === 'white') return 'grey';
    if (r === 'grand' || r === 'epic') return 'gold';
    if (r === 'legendary') return 'orange';
    return r;
  }

  function getEnemyClassId(enemy) {
    if (!enemy) return 'rogue';
    if (enemy.isBoss) {
      var id = String(enemy.id || enemy.rosterId || '').toLowerCase();
      var bk = String(enemy.birdKey || '').toLowerCase();
      if (id.indexOf('duke') >= 0 || bk.indexOf('duke') >= 0) return 'duke';
    }
    if (typeof resolveFinalClass === 'function') {
      return resolveFinalClass(enemy.enemyClass || enemy.class || '', enemy.birdKey || '');
    }
    var cls = enemy.enemyClass || enemy.class;
    if (cls) return String(cls).toLowerCase();
    return getPlayerClassId(enemy) || 'rogue';
  }

  function mapEnemyTierToRarityBand(tier, rng) {
    var t = String(tier || 'normal').toLowerCase();
    var pick = function (arr) { return arr[Math.floor(rng() * arr.length)]; };
    if (['grey', 'green', 'blue', 'purple', 'gold', 'orange'].indexOf(t) >= 0) {
      return normalizeEquipmentRarity(t);
    }
    if (t === 'boss' || t === 'lieutenant') return pick(['gold', 'orange']);
    if (t === 'elite' || t === 'strong') return pick(['blue', 'purple']);
    return pick(['grey', 'green']);
  }

  function cloneLoadoutEquipment(ref) {
    var out = createEmptyLoadout();
    if (!ref || !ref.equipment) return out;
    for (var sk in ref.equipment) {
      if (!Object.prototype.hasOwnProperty.call(ref.equipment, sk)) continue;
      if (sk === 'shield') continue;
      out[sk] = ref.equipment[sk] || null;
    }
    /* Legacy workbook rows stored Shields under `shield`; fold into offHand. */
    if (!out.offHand && ref.equipment.shield) out.offHand = ref.equipment.shield;
    return out;
  }

  function listAccessoryAlternatives(slotKey, rarity, currentItemId) {
    var cat = itemsCatalog();
    if (!cat) return [];
    var meta = slotMeta(slotKey);
    if (!meta && slotKey !== 'offHand') return [];
    var rar = normalizeEquipmentRarity(rarity);
    var out = [];
    for (var id in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, id)) continue;
      var item = cat[id];
      if (!item) continue;
      if (!slotAcceptsItem(slotKey, item)) continue;
      if (normalizeEquipmentRarity(item.rarity) !== rar) continue;
      if (id === currentItemId) continue;
      out.push(id);
    }
    return out;
  }

  function applyLoadoutVariance(equipmentMap, rarity, opts) {
    opts = opts || {};
    if (opts.variance === false) return equipmentMap;
    var seed = opts.seed != null ? Number(opts.seed) : null;
    if (seed == null) return equipmentMap;
    var rng = mulberry32(seed >>> 0 || 1);
    if (rng() > 0.5) return equipmentMap;
    var slots = ACCESSORY_SLOTS.filter(function (sk) { return equipmentMap[sk]; });
    if (!slots.length) return equipmentMap;
    var slotKey = slots[Math.floor(rng() * slots.length)];
    var current = equipmentMap[slotKey];
    var alts = listAccessoryAlternatives(slotKey, rarity, current);
    if (!alts.length) return equipmentMap;
    var next = Object.assign({}, equipmentMap);
    next[slotKey] = alts[Math.floor(rng() * alts.length)];
    return next;
  }

  function computeLoadoutSeed(enemy, opts) {
    opts = opts || {};
    if (opts.seed != null) return Number(opts.seed) >>> 0;
    return hashSeedString([
      enemy.id || enemy.rosterId || enemy.birdKey || enemy.name || 'enemy',
      enemy.enemyClass || enemy.class || '',
      opts.rarity || opts.tier || '',
      opts.stage || '',
      opts.slotIndex || '',
    ].join('|'));
  }

  /** Prefer combat pieces first when filling a partial kit. */
  var STORY_FILL_SLOT_PRIORITY = [
    'mainHand', 'armour', 'helmet', 'necklace', 'offHand', 'ankletL', 'ankletR',
  ];

  function shouldSkipOffHandFill(eq) {
    var mainId = eq && eq.mainHand;
    var mainItem = mainId ? getItem(mainId) : null;
    /* Only skip when 2H main would block weapons; Shields still fill offHand. */
    return !!(mainItem && (Number(mainItem.hands) || 0) === 2);
  }

  function pickReferenceItemForSlotAllowingShieldWith2H(classId, slotKey, rarity, eq) {
    if (slotKey !== 'offHand' || !shouldSkipOffHandFill(eq)) {
      return pickReferenceItemForSlot(classId, slotKey, rarity);
    }
    /* Prefer a Shield of this rarity when mainHand is two-handed. */
    var rar = normalizeEquipmentRarity(rarity);
    var ref = findReferenceLoadout(classId, rar);
    if (ref && ref.equipment) {
      var cand = ref.equipment.offHand || ref.equipment.shield || null;
      var candItem = cand ? getItem(cand) : null;
      if (candItem && isShieldItem(candItem) && normalizeEquipmentRarity(candItem.rarity) === rar) {
        return cand;
      }
    }
    var cat = itemsCatalog();
    if (!cat) return null;
    for (var itemId in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, itemId)) continue;
      var it = cat[itemId];
      if (!it || !isShieldItem(it)) continue;
      if (normalizeEquipmentRarity(it.rarity) !== rar) continue;
      if (!itemAllowedForPlayer(it, classId)) continue;
      if (!slotAcceptsItem('offHand', it)) continue;
      return itemId;
    }
    return null;
  }

  var RARITY_RANK = {
    grey: 1, green: 2, blue: 3, purple: 4, gold: 5, orange: 6,
  };

  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function resolveStoryEquipmentRecipe(opts) {
    opts = opts || {};
    if (opts.recipe && typeof opts.recipe === 'object') return opts.recipe;
    if (opts.stage == null) return null;
    if (typeof globalThis.getStoryEnemyEquipmentRecipe === 'function') {
      return globalThis.getStoryEnemyEquipmentRecipe(opts.stage);
    }
    return null;
  }

  function buildStoryRarityBag(recipe, rng) {
    if (!recipe) return [];
    if (Array.isArray(recipe.bag)) {
      return recipe.bag.map(normalizeEquipmentRarity);
    }
    var count = Math.max(0, Math.floor(Number(recipe.count)) || 0);
    var bag = [];
    var remaining = count;
    var fixed = recipe.fixed || null;
    if (fixed) {
      Object.keys(fixed).forEach(function (rar) {
        var n = Math.max(0, Math.floor(Number(fixed[rar])) || 0);
        for (var i = 0; i < n; i++) bag.push(normalizeEquipmentRarity(rar));
        remaining -= n;
      });
    }
    var mix = Array.isArray(recipe.mix) && recipe.mix.length
      ? recipe.mix.map(normalizeEquipmentRarity)
      : ['grey'];
    /* Guarantee each mix rarity appears at least once when the pool is large enough. */
    for (var m = 0; m < mix.length && remaining > 0; m++) {
      bag.push(mix[m]);
      remaining--;
    }
    while (remaining > 0) {
      bag.push(mix[Math.floor(rng() * mix.length)]);
      remaining--;
    }
    return bag;
  }

  function dominantRarityFromBag(bag) {
    if (!bag || !bag.length) return 'grey';
    var best = bag[0];
    var bestRank = RARITY_RANK[best] || 0;
    for (var i = 1; i < bag.length; i++) {
      var r = bag[i];
      var rank = RARITY_RANK[r] || 0;
      if (rank > bestRank) {
        best = r;
        bestRank = rank;
      }
    }
    return best;
  }

  function pickReferenceItemForSlot(classId, slotKey, rarity) {
    var rar = normalizeEquipmentRarity(rarity);
    var ref = findReferenceLoadout(classId, rar);
    if (ref && ref.equipment) {
      var fromRef = ref.equipment[slotKey] || (slotKey === 'offHand' ? ref.equipment.shield : null);
      if (fromRef) {
        var refItem = getItem(fromRef);
        if (refItem && slotAcceptsItem(slotKey, refItem)) return fromRef;
      }
    }
    var fallbacks = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
    for (var i = 0; i < fallbacks.length; i++) {
      if (fallbacks[i] === rar) continue;
      ref = findReferenceLoadout(classId, fallbacks[i]);
      if (!ref || !ref.equipment) continue;
      var id = ref.equipment[slotKey] || (slotKey === 'offHand' ? ref.equipment.shield : null);
      if (!id) continue;
      var item = getItem(id);
      if (item && normalizeEquipmentRarity(item.rarity) === rar && slotAcceptsItem(slotKey, item)) return id;
    }
    var cat = itemsCatalog();
    if (!cat) return null;
    for (var itemId in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, itemId)) continue;
      var it = cat[itemId];
      if (!it) continue;
      if (normalizeEquipmentRarity(it.rarity) !== rar) continue;
      if (!itemAllowedForPlayer(it, classId)) continue;
      if (!slotAcceptsItem(slotKey, it)) continue;
      return itemId;
    }
    return null;
  }

  function rollStoryRecipeLoadout(enemy, opts, recipe) {
    var classId = getEnemyClassId(enemy);
    var seed = computeLoadoutSeed(enemy, Object.assign({}, opts, {
      rarity: 'story',
      tier: 'story',
    }));
    var rng = mulberry32(seed);
    var bag = buildStoryRarityBag(recipe, rng);
    shuffleInPlace(bag, rng);
    var eq = createEmptyLoadout();
    if (!bag.length) {
      return {
        equipment: eq,
        rarity: 'grey',
        referenceClass: classId,
        totals: null,
        seed: seed,
        recipe: recipe,
        filledCount: 0,
      };
    }
    var bagIdx = 0;
    for (var i = 0; i < STORY_FILL_SLOT_PRIORITY.length && bagIdx < bag.length; i++) {
      var slotKey = STORY_FILL_SLOT_PRIORITY[i];
      var rarity = bag[bagIdx];
      var itemId = pickReferenceItemForSlotAllowingShieldWith2H(classId, slotKey, rarity, eq);
      if (!itemId) continue;
      eq[slotKey] = itemId;
      bagIdx++;
    }
    var filledCount = 0;
    for (var sk in eq) {
      if (Object.prototype.hasOwnProperty.call(eq, sk) && eq[sk]) filledCount++;
    }
    var rarityOut = dominantRarityFromBag(bag);
    var mixed = false;
    for (var b = 1; b < bag.length; b++) {
      if (bag[b] !== bag[0]) { mixed = true; break; }
    }
    if (!mixed && opts.variance !== false) {
      eq = applyLoadoutVariance(eq, rarityOut, { seed: seed + 17, variance: true });
    }
    var ref = findReferenceLoadout(classId, rarityOut);
    return {
      equipment: eq,
      rarity: rarityOut,
      referenceClass: classId,
      totals: ref && ref.totals ? ref.totals : null,
      seed: seed,
      recipe: recipe,
      filledCount: filledCount,
    };
  }

  var RARITY_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

  function countEquippedPieces(player) {
    if (!player || !player.equipment || typeof player.equipment !== 'object') return 0;
    var order = getSlotOrder();
    var n = 0;
    for (var i = 0; i < order.length; i++) {
      if (player.equipment[order[i]]) n++;
    }
    return n;
  }

  function modalEquippedRarity(player) {
    if (!player || !player.equipment) return 'grey';
    var order = getSlotOrder();
    var counts = Object.create(null);
    var total = 0;
    for (var i = 0; i < order.length; i++) {
      var id = player.equipment[order[i]];
      if (!id) continue;
      var item = getItem(id);
      if (!item) continue;
      var rar = normalizeEquipmentRarity(item.rarity);
      counts[rar] = (counts[rar] || 0) + 1;
      total++;
    }
    if (!total) return 'grey';
    var best = 'grey';
    var bestN = -1;
    var bestRank = -1;
    for (var r = 0; r < RARITY_ORDER.length; r++) {
      var key = RARITY_ORDER[r];
      var c = counts[key] || 0;
      if (c > bestN || (c === bestN && (RARITY_RANK[key] || 0) > bestRank)) {
        best = key;
        bestN = c;
        bestRank = RARITY_RANK[key] || 0;
      }
    }
    return best;
  }

  function bumpRarity(rarity, steps) {
    var rar = normalizeEquipmentRarity(rarity);
    var idx = RARITY_ORDER.indexOf(rar);
    if (idx < 0) idx = 0;
    var next = idx + (Math.floor(Number(steps)) || 0);
    if (next < 0) next = 0;
    if (next >= RARITY_ORDER.length) next = RARITY_ORDER.length - 1;
    return RARITY_ORDER[next];
  }

  function upgradeCountForEnemyTier(tier) {
    var t = String(tier || 'normal').toLowerCase();
    if (t === 'boss' || t === 'lieutenant') return 2;
    if (t === 'elite' || t === 'strong') return 1;
    return 0;
  }

  function buildEndlessMirrorRarityBag(opts) {
    opts = opts || {};
    var count = Math.max(0, Math.floor(Number(opts.count)) || 0);
    var base = normalizeEquipmentRarity(opts.baseRarity || 'grey');
    var upgradeCount = Math.max(0, Math.floor(Number(opts.upgradeCount)) || 0);
    upgradeCount = Math.min(upgradeCount, count);
    var rng = opts.rng || Math.random;
    var bag = [];
    for (var i = 0; i < count; i++) bag.push(base);
    if (upgradeCount > 0 && count > 0) {
      var idxs = [];
      for (var j = 0; j < count; j++) idxs.push(j);
      shuffleInPlace(idxs, rng);
      for (var u = 0; u < upgradeCount; u++) {
        bag[idxs[u]] = bumpRarity(base, 1);
      }
    }
    return bag;
  }

  function fillLoadoutFromRarityBag(classId, bag) {
    var eq = createEmptyLoadout();
    if (!bag || !bag.length) {
      return { equipment: eq, filledCount: 0, rarity: 'grey' };
    }
    var bagIdx = 0;
    for (var i = 0; i < STORY_FILL_SLOT_PRIORITY.length && bagIdx < bag.length; i++) {
      var slotKey = STORY_FILL_SLOT_PRIORITY[i];
      var rarity = bag[bagIdx];
      var itemId = pickReferenceItemForSlotAllowingShieldWith2H(classId, slotKey, rarity, eq);
      if (!itemId) continue;
      eq[slotKey] = itemId;
      bagIdx++;
    }
    var filledCount = 0;
    for (var sk in eq) {
      if (Object.prototype.hasOwnProperty.call(eq, sk) && eq[sk]) filledCount++;
    }
    return {
      equipment: eq,
      filledCount: filledCount,
      rarity: dominantRarityFromBag(bag),
    };
  }

  function rollMirroredPieceLoadout(enemy, opts) {
    opts = opts || {};
    var classId = getEnemyClassId(enemy);
    var player = opts.player || (globalThis.G && globalThis.G.player) || null;
    var count = opts.pieceCount != null
      ? Math.max(0, Math.floor(Number(opts.pieceCount)) || 0)
      : countEquippedPieces(player);
    var baseRarity = opts.baseRarity
      ? normalizeEquipmentRarity(opts.baseRarity)
      : modalEquippedRarity(player);
    var tier = opts.tier || enemy.combatTier || enemy.enemyTier || (enemy.isBoss ? 'boss' : (enemy.isElite ? 'elite' : 'normal'));
    var upgradeCount = opts.upgradeCount != null
      ? Math.max(0, Math.floor(Number(opts.upgradeCount)) || 0)
      : upgradeCountForEnemyTier(tier);
    upgradeCount = Math.min(upgradeCount, count);
    var seed = computeLoadoutSeed(enemy, Object.assign({}, opts, {
      rarity: 'mirror',
      tier: tier,
      pieceCount: count,
    }));
    var rng = mulberry32(seed);
    var bag = buildEndlessMirrorRarityBag({
      count: count,
      baseRarity: baseRarity,
      upgradeCount: upgradeCount,
      rng: rng,
    });
    shuffleInPlace(bag, rng);
    var filled = fillLoadoutFromRarityBag(classId, bag);
    var ref = findReferenceLoadout(classId, filled.rarity);
    return {
      equipment: filled.equipment,
      rarity: filled.rarity,
      referenceClass: classId,
      totals: ref && ref.totals ? ref.totals : null,
      seed: seed,
      filledCount: filled.filledCount,
      mirror: {
        pieceCount: count,
        baseRarity: baseRarity,
        upgradeCount: upgradeCount,
        bag: bag.slice(),
      },
    };
  }

  function rollEnemyEquipmentLoadout(enemy, opts) {
    opts = opts || {};
    var storyRecipe = resolveStoryEquipmentRecipe(opts);
    if (storyRecipe) {
      return rollStoryRecipeLoadout(enemy, opts, storyRecipe);
    }
    if (opts.mirrorPlayerEquipment || opts.endlessMirror) {
      return rollMirroredPieceLoadout(enemy, opts);
    }
    var classId = getEnemyClassId(enemy);
    var seed = computeLoadoutSeed(enemy, opts);
    var rng = mulberry32(seed);
    var tier = opts.tier || enemy.combatTier || enemy.enemyTier || (enemy.isBoss ? 'boss' : (enemy.isElite ? 'elite' : 'normal'));
    var rarity = opts.rarity ? normalizeEquipmentRarity(opts.rarity) : mapEnemyTierToRarityBand(tier, rng);
    var ref = findReferenceLoadout(classId, rarity);
    if (!ref) {
      ref = findReferenceLoadout(classId, 'grey');
      rarity = 'grey';
    }
    if (!ref) {
      return { equipment: createEmptyLoadout(), rarity: rarity, referenceClass: classId, totals: null };
    }
    var eq = cloneLoadoutEquipment(ref);
    eq = applyLoadoutVariance(eq, rarity, { seed: seed + 17, variance: opts.variance !== false });
    return { equipment: eq, rarity: rarity, referenceClass: classId, totals: ref.totals || null, seed: seed };
  }

  function syncEntityTopLevelStats(entity) {
    if (!entity || !entity.stats) return entity;
    entity.hp = entity.stats.hp;
    entity.maxHp = entity.stats.maxHp;
    entity.atk = entity.stats.atk;
    entity.def = entity.stats.def;
    entity.spd = entity.stats.spd;
    entity.acc = entity.stats.acc;
    entity.dodge = entity.stats.dodge;
    entity.mdef = entity.stats.mdef;
    entity.matk = entity.stats.matk;
    entity.cc = (Number(entity.stats.critChance) || 0) / 100;
    entity.stats.cc = entity.cc;
    entity.cd = Number(entity.stats.cd ?? entity.cd ?? entity.stats.critMult ?? 1.5);
    entity.stats.critMult = entity.cd;
    return entity;
  }

  function applyEquipmentStatsToEntity(entity) {
    if (!entity || !entity.stats || !entity.equipment) return entity;
    var roll = sumEquippedEquipment(entity);
    entity._equipmentMechanics = roll.mechanics;
    entity._equipmentPct = Object.assign({}, roll.pct);
    var keys = (typeof STAT_LEDGER_TRACKED_KEYS !== 'undefined')
      ? STAT_LEDGER_TRACKED_KEYS
      : ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance', 'armorPen', 'magicPen'];
    var prevMaxHp = Number(entity.stats.maxHp) || Number(entity.stats.hp) || 0;
    /* Chance / pen flats */
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var add = Number(roll.stats[k]) || 0;
      if (!add) continue;
      var cur = Number(entity.stats[k]) || 0;
      entity.stats[k] = capTrackedStatValue(k, cur + add);
    }
    /* Core percentage mods on current developed stats */
    var coreMap = { hp: 'maxHp', atk: 'atk', def: 'def', matk: 'matk', mdef: 'mdef', spd: 'spd' };
    Object.keys(coreMap).forEach(function (pctKey) {
      var frac = Number(roll.pct[pctKey]) || 0;
      if (!frac) return;
      var sk = coreMap[pctKey];
      var base = Number(entity.stats[sk]) || 0;
      entity.stats[sk] = capTrackedStatValue(sk, Math.round(base * (1 + frac)));
    });
    if (entity.stats.maxHp != null) {
      var nextMax = Number(entity.stats.maxHp) || 0;
      var delta = nextMax - prevMaxHp;
      if (delta) entity.stats.hp = Math.max(1, (Number(entity.stats.hp) || prevMaxHp) + delta);
      else entity.stats.hp = Math.max(1, Math.min(nextMax, Number(entity.stats.hp) || nextMax));
    }
    syncEntityTopLevelStats(entity);
    if (typeof normalizeCombatStats === 'function') normalizeCombatStats(entity.stats);
    return entity;
  }

  function assignEnemyEquipmentLoadout(enemy, opts) {
    if (!isEquipmentV2() || !enemy) return enemy;
    enemy.isEnemy = true;
    enemy.autoPickUltimate = true;
    if (!enemy.equipment || typeof enemy.equipment !== 'object') {
      enemy.equipment = createEmptyLoadout();
    }
    var rolled = rollEnemyEquipmentLoadout(enemy, opts);
    enemy.equipment = rolled.equipment;
    enemy.equipmentRarity = rolled.rarity;
    enemy._equipmentReferenceClass = rolled.referenceClass;
    enemy._equipmentLoadoutSeed = rolled.seed;
    applyEquipmentStatsToEntity(enemy);
    if (typeof Avian.equipmentActions !== 'undefined' && typeof Avian.equipmentActions.syncEntityAbilities === 'function') {
      Avian.equipmentActions.syncEntityAbilities(enemy);
    }
    enemy._equipmentApplied = true;
    return enemy;
  }

  equipment.isEquipmentV2 = isEquipmentV2;
  equipment.SLOT_ORDER = SLOT_ORDER;
  equipment.EQUIPMENT_PCT_KEYS = EQUIPMENT_PCT_KEYS;
  equipment.getSlotOrder = getSlotOrder;
  function getMechanicsRollup(player) {
    if (!player) return Object.create(null);
    if (player._equipmentMechanics && typeof player._equipmentMechanics === 'object') {
      return player._equipmentMechanics;
    }
    return sumEquippedEquipment(player).mechanics || Object.create(null);
  }

  equipment.getMechanicsRollup = getMechanicsRollup;
  equipment.createEmptyLoadout = createEmptyLoadout;
  equipment.getItem = getItem;
  equipment.getPlayerClassId = getPlayerClassId;
  equipment.itemAllowedForPlayer = itemAllowedForPlayer;
  equipment.ensurePlayerEquipmentState = ensurePlayerEquipmentState;
  equipment.addToInventory = addToInventory;
  equipment.canEquip = canEquip;
  equipment.equip = equip;
  equipment.unequip = unequip;
  equipment.validateLoadout = validateLoadout;
  equipment.sanitizeEquipmentLoadout = sanitizeEquipmentLoadout;
  equipment.defaultEquipmentSellPrice = defaultEquipmentSellPrice;
  equipment.rollupEquipmentStats = rollupEquipmentStats;
  equipment.sumEquippedEquipment = sumEquippedEquipment;
  equipment.reapplyPlayerStatsFromSources = reapplyPlayerStatsFromSources;
  equipment.findReferenceLoadout = findReferenceLoadout;
  equipment.slotAcceptsItem = slotAcceptsItem;
  equipment.getEnemyClassId = getEnemyClassId;
  equipment.normalizeEquipmentRarity = normalizeEquipmentRarity;
  equipment.mapEnemyTierToRarityBand = mapEnemyTierToRarityBand;
  equipment.countEquippedPieces = countEquippedPieces;
  equipment.modalEquippedRarity = modalEquippedRarity;
  equipment.bumpRarity = bumpRarity;
  equipment.upgradeCountForEnemyTier = upgradeCountForEnemyTier;
  equipment.buildEndlessMirrorRarityBag = buildEndlessMirrorRarityBag;
  equipment.rollMirroredPieceLoadout = rollMirroredPieceLoadout;
  equipment.rollEnemyEquipmentLoadout = rollEnemyEquipmentLoadout;
  equipment.applyEquipmentStatsToEntity = applyEquipmentStatsToEntity;
  equipment.assignEnemyEquipmentLoadout = assignEnemyEquipmentLoadout;
  equipment.computeLoadoutSeed = computeLoadoutSeed;
  equipment.hashSeedString = hashSeedString;
  equipment.resolveStoryEquipmentRecipe = resolveStoryEquipmentRecipe;
  equipment.buildStoryRarityBag = buildStoryRarityBag;

  function findEquipSlotForItem(player, itemId) {
    if (!player || !itemId) return null;
    ensurePlayerEquipmentState(player);
    var order = getSlotOrder();
    var emptyMatch = null;
    var occupiedMatch = null;
    for (var i = 0; i < order.length; i++) {
      var sk = order[i];
      if (!canEquip(player, itemId, sk).ok) continue;
      if (!player.equipment[sk]) {
        if (!emptyMatch) emptyMatch = sk;
      } else if (!occupiedMatch) {
        occupiedMatch = sk;
      }
    }
    return emptyMatch || occupiedMatch;
  }

  function equipAuto(player, itemId) {
    var sk = findEquipSlotForItem(player, itemId);
    if (!sk) return { ok: false, reason: 'no_slot', slot: null };
    var ok = equip(player, itemId, sk);
    return { ok: ok, reason: ok ? null : 'equip_failed', slot: sk };
  }

  equipment.findEquipSlotForItem = findEquipSlotForItem;
  equipment.equipAuto = equipAuto;

  Avian.equipment = equipment;
  Avian.systems.equipment = equipment;
})();
