/* Avian Ascent — Stork Shop v2 (combat rewrite).
 *
 * Replaces the legacy stat-card shop with an ability-learning shop fed by
 * Avian.data.combatPack.shopPool (150 universal families across 5 tiers).
 *
 * Shop offer composition (per visit):
 *   - 3 healing items (unchanged shelf, retained from game.js's
 *     `SHOP_HEALING_ITEMS`).
 *   - 4 ability-learning offers rolled from the pool by rarity × stage gate
 *     (endless-boss shops offer 1 ability + healing only).
 *
 * Item shape mirrors the legacy `_shopItems[]` entries so the existing
 * shop UI (`renderShopItems`, `shopBuySelected`) continues to render them
 * without modification:
 *
 *   { id, tier, icon, name, desc, costOverride, apply(p), isLearnAbility:true,
 *     familyId, baseAbilityId, tags, designedFor }
 *
 * `apply(p)`:
 *   1. Validates the player has < 4 active abilities (or replaces if full).
 *   2. Instantiates the ability from `Avian.data.combatPack.skillTrees`.
 *   3. Pushes it into `p.abilities[]` and registers its action handler.
 *
 * For "shop is full kit" UX, we keep the simple "fill first empty slot"
 * default. The dispatcher already knows the row at runtime — no change to
 * combat is required when slots gain/lose abilities.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var shop = Object.create(null);

  // Tier name from spreadsheet → CSS class used by renderShopItems
  var TIER_CSS = { White: 'grey', Green: 'green', Blue: 'blue', Purple: 'purple', Gold: 'gold' };
  var TIER_ICON = { White: '⚪', Green: '🟢', Blue: '🔵', Purple: '🟣', Gold: '🟡' };
  var SHOP_COST_BY_EN = { 1: 50, 2: 100, 3: 150 };

  function shopCostForEntry(entry) {
    var row = pack() && pack().skillTrees && pack().skillTrees[entry.baseAbilityId];
    var en = Math.max(1, Math.round(Number(row && row.apCost) || 1));
    return SHOP_COST_BY_EN[en] || SHOP_COST_BY_EN[3];
  }

  function pack() { return (Avian.data && Avian.data.combatPack) || null; }
  function poolEntries() {
    var p = pack();
    return (p && p.shopPool && p.shopPool.entries) || {};
  }

  function currentStageNumber() {
    if (!globalThis.G) return 1;
    return Math.max(1, Number(G.stage) || 1);
  }

  function unlockStageOf(entry) {
    // Spreadsheet uses strings like "Stage 1+", "Stage 8+", "Stage 20+ / rare shop"
    var s = String(entry.shopUnlock || '');
    var m = s.match(/(\d+)/);
    return m ? Number(m[1]) : 1;
  }

  function eligibleTier(entry, stage) {
    return stage >= unlockStageOf(entry);
  }

  function weightedRoll(items, weight) {
    var total = 0;
    for (var i = 0; i < items.length; i++) total += Math.max(0, weight(items[i]) || 0);
    if (total <= 0) return null;
    var r = Math.random() * total;
    for (var j = 0; j < items.length; j++) {
      r -= Math.max(0, weight(items[j]) || 0);
      if (r <= 0) return items[j];
    }
    return items[items.length - 1];
  }

  shop.rollOffer = function rollOffer(stage, used) {
    var entries = poolEntries();
    var ids = Object.keys(entries).filter(function (k) {
      if (used && used.has(k)) return false;
      return eligibleTier(entries[k], stage);
    });
    if (!ids.length) return null;
    var pool = ids.map(function (k) { return entries[k]; });
    return weightedRoll(pool, function (e) { return e.rarityWeight || 1; });
  };

  shop.makeItem = function makeItem(entry) {
    if (!entry) return null;
    var tierCss = TIER_CSS[entry.tier] || 'grey';
    var icon = TIER_ICON[entry.tier] || '⚔️';
    return {
      id: entry.baseAbilityId,
      familyId: entry.familyId,
      tier: tierCss,
      icon: icon,
      name: entry.name,
      desc: shop.describeAbility(entry),
      costOverride: shopCostForEntry(entry),
      isLearnAbility: true,
      designedFor: entry.designedFor || '',
      tags: entry.tags || [],
      apply: function (p) { shop.learnAbility(p, entry.familyId, entry.baseAbilityId); },
    };
  };

  shop.describeAbility = function describeAbility(entry) {
    var fromEntry = String(entry.shortDesc || '').trim();
    if (fromEntry) return fromEntry;
    var p = pack();
    if (!p || !p.skillTrees) return entry.name || '';
    var row = p.skillTrees[entry.baseAbilityId];
    if (!row) return entry.name || '';
    var shortDesc = String(row.shortDesc || '').trim();
    if (shortDesc) return shortDesc;
    var bits = [];
    bits.push((row.apCost || 1) + ' AP · ' + (row.target === 'self' ? 'Self' : row.target === 'self_and_enemy' ? 'Self+Enemy' : 'Enemy'));
    if (!row.noDamage) {
      var damage = (row.hits > 1 ? row.hits + '× ' : '') + 'Base ' + (row.baseFlat || 0) + ' + ' + (row.scalePct || 0) + '% ' + (row.scaleStat || 'ATK');
      bits.push(damage);
    }
    if (row.ailment) {
      var aid = Array.isArray(row.ailment) ? row.ailment.join('/') : row.ailment;
      bits.push(aid + ' ' + (row.ailmentChance || 0) + '%');
    }
    if (row.pierceDef > 0) bits.push(row.pierceDef + '% DEF ign');
    if (row.pierceMdef > 0) bits.push(row.pierceMdef + '% MDEF ign');
    if (row.riderText && row.riderText !== 'None') bits.push(row.riderText);
    return bits.join(' · ');
  };

  shop.learnAbility = function learnAbility(player, familyId, baseAbilityId) {
    if (!player) return false;
    player.abilities = player.abilities || [];
    var pck = pack();
    if (!pck) return false;
    var row = pck.skillTrees && pck.skillTrees[baseAbilityId];
    if (!row) {
      if (typeof logMsg === 'function') logMsg('Shop: missing skill tree row ' + baseAbilityId, 'miss');
      return false;
    }
    // Prevent duplicate family
    if (player.abilities.some(function (a) { return a && (a.familyId === familyId || a.id === baseAbilityId); })) {
      if (typeof logMsg === 'function') logMsg('Already learned ' + row.name + '.', 'miss');
      return false;
    }
    // Choose a slot: first empty, or replace last if full
    var slot = -1;
    for (var i = 0; i < 4; i++) {
      if (!player.abilities[i]) { slot = i; break; }
    }
    if (slot < 0) slot = player.abilities.length >= 4 ? 3 : player.abilities.length;
    var built = shop.buildAbilityInstance(baseAbilityId, familyId, slot);
    player.abilities[slot] = built;
    // Register the dispatcher proxy for this id
    if (Avian.dispatcher && typeof Avian.dispatcher.registerActions === 'function' && globalThis.ACTIONS) {
      Avian.dispatcher.registerActions(globalThis.ACTIONS);
    }
    if (typeof refreshBattleUI === 'function') {
      try { refreshBattleUI(); } catch (_e) { /* during shop screen, ok to skip */ }
    }
    if (typeof logMsg === 'function') logMsg('🎓 Learned ' + row.name + '!', 'exp-gain');
    return true;
  };

  shop.buildAbilityInstance = function buildAbilityInstance(abId, familyId, slot) {
    var pck = pack();
    var row = pck && pck.skillTrees && pck.skillTrees[abId];
    if (!row) return { id: abId, familyId: familyId, name: abId, level: 1, energy: 1, energyCost: 1, slotIndex: slot };
    var isMagic = /magic|song|spell/i.test(row.category);
    var btnType = isMagic ? 'spell' : (row.target === 'self' && row.noDamage ? 'utility' : 'physical');
    return {
      id: row.id,
      familyId: familyId,
      name: row.name,
      desc: row.shortDesc || row.designNote || row.riderText || '',
      type: btnType,
      btnType: btnType,
      energy: row.apCost || 1,
      energyCost: row.apCost || 1,
      level: row.level || 1,
      slotIndex: slot,
      pierceDef: row.pierceDef || 0,
      pierceMdef: row.pierceMdef || 0,
      ailmentIds: row.ailment ? (Array.isArray(row.ailment) ? row.ailment : [row.ailment]) : [],
    };
  };

  shop.rollStockForMode = function rollStockForMode(mode) {
    var stage = currentStageNumber();
    var used = new Set();
    var count = mode === 'endless-boss' ? 1 : 4;
    var items = [];
    for (var i = 0; i < count; i++) {
      var entry = shop.rollOffer(stage, used);
      if (!entry) break;
      used.add(entry.familyId);
      items.push(shop.makeItem(entry));
    }
    return items;
  };

  // For overworld restore-by-id: find the abilities by their persisted id
  shop.findById = function findById(id) {
    var entries = poolEntries();
    for (var k in entries) {
      if (entries[k].baseAbilityId === id) return shop.makeItem(entries[k]);
    }
    return null;
  };

  Avian.shop = shop;
  Avian.systems.shop = shop;
})();
