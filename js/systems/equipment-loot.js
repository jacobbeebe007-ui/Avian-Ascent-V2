/* Equipment v0.3 loot — drops, shop stock, orange uniqueness (Phase 7).
 * Gated by Avian.flags.equipmentV2 for acquisition paths; exports are safe to call always.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var loot = Avian.equipmentLoot || Object.create(null);

  var RARITIES = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

  function isEquipmentV2() {
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function lootConfig() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.loot) || null;
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

  function getItem(id) {
    if (Avian.equipment && typeof Avian.equipment.getItem === 'function') {
      return Avian.equipment.getItem(id);
    }
    var cat = itemsCatalog();
    return cat && id ? cat[id] || null : null;
  }

  function getPlayerClassId(player) {
    if (Avian.equipment && typeof Avian.equipment.getPlayerClassId === 'function') {
      return Avian.equipment.getPlayerClassId(player);
    }
    if (player && player.class) return String(player.class).toLowerCase();
    return null;
  }

  function parseClassList(raw) {
    if (!raw || raw === 'Any') return null;
    return String(raw).split('/').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  }

  function itemHardAllowedForClass(item, classId) {
    if (!item || !classId) return true;
    var parts = parseClassList(item.classRestriction);
    if (!parts) return true;
    return parts.indexOf(String(classId).toLowerCase()) >= 0;
  }

  function itemPreferredForClass(item, classId) {
    if (!item || !classId) return false;
    var parts = parseClassList(item.preferredClasses);
    if (!parts) return false;
    return parts.indexOf(String(classId).toLowerCase()) >= 0;
  }

  function itemHasForbiddenStats(item) {
    if (!item || !item.stats) return false;
    var sd = slotsDef();
    var forbidden = (sd && Array.isArray(sd.forbiddenStatIds)) ? sd.forbiddenStatIds : ['ACC'];
    var forbiddenLower = forbidden.map(function (s) { return String(s).toLowerCase(); });
    for (var key in item.stats) {
      if (!Object.prototype.hasOwnProperty.call(item.stats, key)) continue;
      var low = String(key).toLowerCase();
      if (low === 'acc' || forbiddenLower.indexOf(low) >= 0 || forbiddenLower.indexOf(String(key)) >= 0) {
        return true;
      }
    }
    return false;
  }

  function orangeUniquenessMode() {
    var cfg = combatConfig();
    var mode = cfg && cfg.orangeUniqueness;
    return mode || 'perRun';
  }

  function ensureRunOrangeSet() {
    var g = globalThis.G;
    if (!g) return null;
    if (!(g.runOrangeEquipmentIds instanceof Set)) g.runOrangeEquipmentIds = new Set();
    if (!(g.runOrangeEquipmentFamilies instanceof Set)) g.runOrangeEquipmentFamilies = new Set();
    return g;
  }

  function collectPlayerOrangeKeys(player) {
    var ids = new Set();
    var families = new Set();
    if (!player) return { ids: ids, families: families };
    if (Avian.equipment && typeof Avian.equipment.ensurePlayerEquipmentState === 'function') {
      Avian.equipment.ensurePlayerEquipmentState(player);
    }
    var inv = player.equipmentInventory || [];
    for (var i = 0; i < inv.length; i++) {
      var item = getItem(inv[i]);
      if (!item || String(item.rarity).toLowerCase() !== 'orange') continue;
      ids.add(item.id);
      if (item.family) families.add(item.family);
    }
    var eq = player.equipment || {};
    for (var sk in eq) {
      if (!Object.prototype.hasOwnProperty.call(eq, sk)) continue;
      var eid = eq[sk];
      if (!eid) continue;
      var eqItem = getItem(eid);
      if (!eqItem || String(eqItem.rarity).toLowerCase() !== 'orange') continue;
      ids.add(eqItem.id);
      if (eqItem.family) families.add(eqItem.family);
    }
    return { ids: ids, families: families };
  }

  function isOrangeBlocked(item, opts) {
    if (!item || String(item.rarity).toLowerCase() !== 'orange') return false;
    var mode = orangeUniquenessMode();
    if (mode === 'none') return false;

    if (mode === 'perRun') {
      var g = ensureRunOrangeSet();
      if (!g) return false;
      if (g.runOrangeEquipmentIds.has(item.id)) return true;
      if (item.family && g.runOrangeEquipmentFamilies.has(item.family)) return true;
      return false;
    }

    if (mode === 'perInventory') {
      var player = (opts && opts.player) || (globalThis.G && globalThis.G.player);
      var keys = collectPlayerOrangeKeys(player);
      if (keys.ids.has(item.id)) return true;
      if (item.family && keys.families.has(item.family)) return true;
      return false;
    }

    return false;
  }

  function registerOrangeAcquired(item) {
    if (!item || String(item.rarity).toLowerCase() !== 'orange') return;
    if (orangeUniquenessMode() !== 'perRun') return;
    var g = ensureRunOrangeSet();
    if (!g) return;
    g.runOrangeEquipmentIds.add(item.id);
    if (item.family) g.runOrangeEquipmentFamilies.add(item.family);
  }

  var _byRarity = null;

  function buildRarityIndex() {
    if (_byRarity) return _byRarity;
    _byRarity = Object.create(null);
    RARITIES.forEach(function (r) { _byRarity[r] = []; });
    var cat = itemsCatalog();
    if (!cat) return _byRarity;
    for (var id in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, id)) continue;
      var item = cat[id];
      var rar = String(item.rarity || 'grey').toLowerCase();
      if (!_byRarity[rar]) _byRarity[rar] = [];
      if (!itemHasForbiddenStats(item)) _byRarity[rar].push(id);
    }
    return _byRarity;
  }

  function rngFloat(rng) {
    if (rng && typeof rng.next === 'function') return rng.next();
    if (rng && typeof rng === 'function') return rng();
    return Math.random();
  }

  function pickWeightedKey(weights, rng) {
    var keys = [];
    var vals = [];
    var total = 0;
    for (var k in weights) {
      if (!Object.prototype.hasOwnProperty.call(weights, k)) continue;
      var w = Math.max(0, Number(weights[k]) || 0);
      if (w <= 0) continue;
      keys.push(k);
      vals.push(w);
      total += w;
    }
    if (!keys.length) return null;
    var r = rngFloat(rng) * total;
    for (var i = 0; i < keys.length; i++) {
      r -= vals[i];
      if (r <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  function rollRarityFromBand(bandId, rng) {
    var cfg = lootConfig();
    var bands = (cfg && cfg.rarityWeightsByBand) || {};
    var weights = bands[String(bandId || 'grey_green')] || bands.grey_green || { grey: 0.55, green: 0.45 };
    return pickWeightedKey(weights, rng) || 'grey';
  }

  function rollRarityForStage(stage, rng) {
    stage = Math.max(1, Math.floor(Number(stage) || 1));
    var cfg = lootConfig();
    var rows = (cfg && cfg.rarityWeightsByStage) || [];
    var weights = null;
    for (var i = 0; i < rows.length; i++) {
      if (stage <= Number(rows[i].maxStage)) {
        weights = rows[i].weights;
        break;
      }
    }
    if (!weights && rows.length) weights = rows[rows.length - 1].weights;
    if (!weights) weights = { grey: 0.5, green: 0.5 };
    return pickWeightedKey(weights, rng) || 'grey';
  }

  function rollRarityForGrove(outcomeType, stage, rng) {
    var cfg = lootConfig();
    var grove = (cfg && cfg.groveWeights) || {};
    var weights = grove[String(outcomeType || 'nest')];
    if (!weights) {
      stage = Math.max(1, Math.floor(Number(stage) || 1));
      if (outcomeType === 'goldenGoose') {
        weights = stage >= 18
          ? { purple: 0.35, gold: 0.45, orange: 0.2 }
          : { purple: 0.45, gold: 0.55 };
      } else {
        weights = stage >= 12
          ? { green: 0.35, blue: 0.4, purple: 0.25 }
          : { green: 0.45, blue: 0.55 };
      }
    }
    return pickWeightedKey(weights, rng) || 'green';
  }

  function filterPoolIds(ids, opts) {
    opts = opts || {};
    var classId = opts.classId;
    if (classId == null && opts.filterForPlayer !== false && globalThis.G && globalThis.G.player) {
      classId = getPlayerClassId(globalThis.G.player);
    }
    var used = opts.usedIds || null;
    var player = opts.player || (globalThis.G && globalThis.G.player);
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var item = getItem(id);
      if (!item) continue;
      if (used && used.has(id)) continue;
      if (opts.filterForPlayer !== false && classId && !itemHardAllowedForClass(item, classId)) continue;
      if (itemHasForbiddenStats(item)) continue;
      if (isOrangeBlocked(item, { player: player })) continue;
      out.push(id);
    }
    if (!out.length) return out;
    if (classId) {
      var preferred = out.filter(function (id) { return itemPreferredForClass(getItem(id), classId); });
      if (preferred.length) return preferred;
    }
    return out;
  }

  function pickRandomId(ids, rng) {
    if (!ids || !ids.length) return null;
    var idx = Math.floor(rngFloat(rng) * ids.length);
    return ids[idx];
  }

  function rollEquipmentDrop(opts) {
    opts = opts || {};
    var rng = opts.rng;
    var rarity = opts.rarity;
    if (!rarity && opts.band) rarity = rollRarityFromBand(opts.band, rng);
    if (!rarity && opts.groveOutcome) rarity = rollRarityForGrove(opts.groveOutcome, opts.stage, rng);
    if (!rarity) rarity = rollRarityForStage(opts.stage, rng);
    rarity = String(rarity || 'grey').toLowerCase();

    var index = buildRarityIndex();
    var pool = (index[rarity] || []).slice();
    var filtered = filterPoolIds(pool, opts);
    if (!filtered.length) {
      if (pool.length) return null;
      if (rarity !== 'grey') filtered = filterPoolIds(index.grey || [], opts);
    }

    var attempts = 40;
    while (attempts-- > 0) {
      var pick = pickRandomId(filtered, rng);
      if (!pick) break;
      if (opts.usedIds) {
        if (opts.usedIds.has(pick)) continue;
        opts.usedIds.add(pick);
      }
      return pick;
    }
    return null;
  }

  function formatEquipmentDesc(item) {
    if (!item) return '';
    var sd = slotsDef();
    var names = (sd && sd.statDisplayNames) || {};
    var parts = [];
    var stats = item.stats || {};
    for (var key in stats) {
      if (!Object.prototype.hasOwnProperty.call(stats, key)) continue;
      var val = Number(stats[key]) || 0;
      if (!val) continue;
      var label = names[key] || key;
      parts.push('+' + val + (String(label).indexOf('%') >= 0 ? '' : ' ') + label);
    }
    if (item.family) parts.unshift(item.family);
    return parts.join(' · ') || item.slot || 'Equipment';
  }

  function slotIcon(item) {
    var cfg = lootConfig();
    var icons = (cfg && cfg.slotIcons) || {};
    return icons[item && item.slot] || '\u2694\uFE0F';
  }

  function tierLabel(rarity) {
    var cfg = lootConfig();
    var labels = (cfg && cfg.tierLabels) || {};
    return labels[String(rarity || 'grey').toLowerCase()] || 'Common';
  }

  function getShopCost(rarity) {
    var cfg = lootConfig();
    var costs = (cfg && cfg.shopCosts) || { grey: 15, green: 28, blue: 44, purple: 64, gold: 96, orange: 200 };
    return costs[String(rarity || 'grey').toLowerCase()] || 20;
  }

  function getSellPrice(rarity) {
    return Math.max(1, Math.floor(getShopCost(rarity) / 2));
  }

  function buildRewardCard(itemId) {
    var item = getItem(itemId);
    if (!item) return null;
    var rarity = String(item.rarity || 'grey').toLowerCase();
    return {
      id: item.id,
      tier: rarity,
      tierLabel: tierLabel(rarity),
      type: 'equipment',
      icon: slotIcon(item),
      name: item.name,
      desc: formatEquipmentDesc(item),
      equipmentItemId: item.id,
      family: item.family || null,
      slot: item.slot || null,
      apply: function (p) {
        if (Avian.equipment && typeof Avian.equipment.addToInventory === 'function') {
          Avian.equipment.addToInventory(p, item.id);
        }
        registerOrangeAcquired(item);
      },
    };
  }

  function toShopOffer(itemId) {
    var card = buildRewardCard(itemId);
    if (!card) return null;
    var item = getItem(itemId);
    card.costOverride = getShopCost(item && item.rarity);
    card.shopCategory = 'equipment';
    return card;
  }

  function reconstructShopOffer(id) {
    var item = getItem(id);
    return item ? toShopOffer(id) : null;
  }

  function rollEquipmentStock(count, stage, used, opts) {
    used = used || new Set();
    opts = Object.assign({ filterForPlayer: true, stage: stage, usedIds: used }, opts || {});
    var offers = [];
    for (var i = 0; i < count; i++) {
      var id = rollEquipmentDrop(opts);
      if (!id) continue;
      var offer = toShopOffer(id);
      if (offer) offers.push(offer);
    }
    return offers;
  }

  function rollEquipmentReward(opts) {
    opts = Object.assign({ filterForPlayer: true }, opts || {});
    var id = rollEquipmentDrop(opts);
    return id ? buildRewardCard(id) : null;
  }

  function rollTierFromBand(bandId, rng) {
    return rollRarityFromBand(bandId, rng);
  }

  loot.isEquipmentV2 = isEquipmentV2;
  loot.RARITIES = RARITIES;
  loot.getItem = getItem;
  loot.itemHardAllowedForClass = itemHardAllowedForClass;
  loot.itemHasForbiddenStats = itemHasForbiddenStats;
  loot.rollRarityFromBand = rollRarityFromBand;
  loot.rollRarityForStage = rollRarityForStage;
  loot.rollEquipmentDrop = rollEquipmentDrop;
  loot.buildRewardCard = buildRewardCard;
  loot.toShopOffer = toShopOffer;
  loot.reconstructShopOffer = reconstructShopOffer;
  loot.rollEquipmentStock = rollEquipmentStock;
  loot.rollEquipmentReward = rollEquipmentReward;
  loot.getShopCost = getShopCost;
  loot.getSellPrice = getSellPrice;
  loot.formatEquipmentDesc = formatEquipmentDesc;
  loot.registerOrangeAcquired = registerOrangeAcquired;
  loot.isOrangeBlocked = isOrangeBlocked;
  loot.rollTierFromBand = rollTierFromBand;
  loot.buildRarityIndex = buildRarityIndex;
  loot.pickWeightedKey = pickWeightedKey;

  Avian.equipmentLoot = loot;
  Avian.systems.equipmentLoot = loot;
})();
