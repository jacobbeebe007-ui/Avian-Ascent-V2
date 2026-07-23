/* Avian Ascent — Equipment v0.3 Runtime (Phase 3)
 *
 * 8-slot loadout, inventory, validation, stat ledger rollup.
 * Gated by Avian.flags.equipmentV2; mutations keep owning stats when flag is off.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var equipment = Avian.equipment || Object.create(null);

  var SLOT_ORDER = [
    'helmet', 'armour', 'mainHand', 'offHand', 'shield', 'ankletL', 'ankletR', 'necklace',
  ];

  var FLAT_STAT_MAP = {
    hp: 'maxHp',
    atk: 'atk',
    def: 'def',
    matk: 'matk',
    mdef: 'mdef',
    spd: 'spd',
    dodgePct: 'dodge',
    critChancePct: 'critChance',
    physicalPenPct: 'armorPen',
    magicPenPct: 'magicPen',
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
    var req = item.classRestriction;
    if (!req || req === 'Any') return true;
    var cls = classIdOptional != null
      ? String(classIdOptional).toLowerCase()
      : getPlayerClassId(typeof G !== 'undefined' ? G.player : null);
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

  function slotAcceptsItem(slotKey, item) {
    if (!item || !slotKey) return false;
    var meta = slotMeta(slotKey);
    if (!meta) return false;
    if (item.slot !== meta.accepts) return false;
    if (slotKey === 'offHand' && (Number(item.hands) || 0) !== 1) return false;
    if (slotKey === 'shield' && (Number(item.hands) || 0) !== 0) return false;
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
      var order = getSlotOrder();
      for (var i = 0; i < order.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(player.equipment, order[i])) {
          player.equipment[order[i]] = null;
        }
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
    if (!itemId || !getItem(itemId)) return false;
    player.equipmentInventory.push(itemId);
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
      if (mainItem && (Number(mainItem.hands) || 0) === 2) {
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
      unequip(player, 'offHand');
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
      var offId = eq.offHand;
      eq.offHand = null;
      addToInventory(player, offId);
      issues.push({ slot: 'offHand', action: 'unequip_two_handed_conflict', itemId: offId });
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

  function seedGreyReferenceLoadout(player) {
    if (!player) return false;
    ensurePlayerEquipmentState(player);
    if (player.equipmentInventory.length > 0) return false;
    var classId = getPlayerClassId(player);
    var ref = findReferenceLoadout(classId, 'grey');
    if (!ref || !ref.equipment) return false;
    var eqMap = ref.equipment;
    var idsNeeded = Object.create(null);
    for (var sk in eqMap) {
      if (!Object.prototype.hasOwnProperty.call(eqMap, sk)) continue;
      var id = eqMap[sk];
      if (!id) continue;
      idsNeeded[id] = (idsNeeded[id] || 0) + 1;
    }
    for (var itemId in idsNeeded) {
      if (!Object.prototype.hasOwnProperty.call(idsNeeded, itemId)) continue;
      var count = idsNeeded[itemId];
      for (var c = 0; c < count; c++) addToInventory(player, itemId);
    }
    for (var slotKey in eqMap) {
      if (!Object.prototype.hasOwnProperty.call(eqMap, slotKey)) continue;
      var equipId = eqMap[slotKey];
      if (equipId) equip(player, equipId, slotKey);
    }
    return true;
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
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var flat = (Number(fromLevel[k]) || 0) + (Number(fromUpgrades[k]) || 0)
        + (Number(fromCardTier[k]) || 0) + (Number(eqRoll.stats[k]) || 0);
      var v = (Number(base[k]) || 0) + flat;
      player.stats[k] = capTrackedStatValue(k, v);
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

  var ACCESSORY_SLOTS = ['helmet', 'shield', 'ankletL', 'ankletR', 'necklace'];

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
      out[sk] = ref.equipment[sk] || null;
    }
    return out;
  }

  function listAccessoryAlternatives(slotKey, rarity, currentItemId) {
    var cat = itemsCatalog();
    if (!cat) return [];
    var meta = slotMeta(slotKey);
    if (!meta) return [];
    var accepts = meta.accepts;
    var rar = normalizeEquipmentRarity(rarity);
    var out = [];
    for (var id in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, id)) continue;
      var item = cat[id];
      if (!item || item.slot !== accepts) continue;
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

  function rollEnemyEquipmentLoadout(enemy, opts) {
    opts = opts || {};
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
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var add = Number(roll.stats[k]) || 0;
      if (!add) continue;
      var cur = Number(entity.stats[k]) || 0;
      entity.stats[k] = capTrackedStatValue(k, cur + add);
    }
    if (roll.stats.maxHp) {
      var delta = (Number(entity.stats.maxHp) || 0) - prevMaxHp;
      entity.stats.hp = Math.max(1, (Number(entity.stats.hp) || prevMaxHp) + delta);
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
  equipment.seedGreyReferenceLoadout = seedGreyReferenceLoadout;
  equipment.findReferenceLoadout = findReferenceLoadout;
  equipment.slotAcceptsItem = slotAcceptsItem;
  equipment.getEnemyClassId = getEnemyClassId;
  equipment.normalizeEquipmentRarity = normalizeEquipmentRarity;
  equipment.mapEnemyTierToRarityBand = mapEnemyTierToRarityBand;
  equipment.rollEnemyEquipmentLoadout = rollEnemyEquipmentLoadout;
  equipment.applyEquipmentStatsToEntity = applyEquipmentStatsToEntity;
  equipment.assignEnemyEquipmentLoadout = assignEnemyEquipmentLoadout;
  equipment.computeLoadoutSeed = computeLoadoutSeed;
  equipment.hashSeedString = hashSeedString;

  function findEquipSlotForItem(player, itemId) {
    if (!player || !itemId) return null;
    var order = getSlotOrder();
    for (var i = 0; i < order.length; i++) {
      if (canEquip(player, itemId, order[i]).ok) return order[i];
    }
    return null;
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
