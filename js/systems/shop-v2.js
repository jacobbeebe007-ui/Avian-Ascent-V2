/* Avian Ascent — Stork Shop v2 (combat rewrite).
 *
 * Shop offer composition (per visit):
 *   - 3 healing items (from game.js SHOP_HEALING_ITEMS).
 *   - 6 ability-learning offers rolled from combat pack shop pool.
 *   - 1 pinned Mutated Feather (game.js).
 *
 * Purchased abilities go to player.abilityInventory; equip from the Nest.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var shop = Object.create(null);

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

  function getSkillSlots(player) {
    if (typeof globalThis.getSkillSlots === 'function') return globalThis.getSkillSlots(player);
    return Array.isArray(player && player.familyEvolutionState && player.familyEvolutionState.skillSlots)
      ? player.familyEvolutionState.skillSlots : [];
  }

  shop.ensureAbilityInventory = function ensureAbilityInventory(player) {
    if (!player) return [];
    if (!Array.isArray(player.abilityInventory)) player.abilityInventory = [];
    return player.abilityInventory;
  };

  shop.hasFamilyOwned = function hasFamilyOwned(player, familyId) {
    if (!familyId || !player) return false;
    var inv = shop.ensureAbilityInventory(player);
    if (inv.some(function (e) { return e && e.familyId === familyId; })) return true;
    return getSkillSlots(player).some(function (s) { return s && s.familyId === familyId && s.abilityId; });
  };

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
      shopCategory: 'abilities',
      designedFor: entry.designedFor || '',
      tags: entry.tags || [],
      apply: function (p) { shop.addAbilityToVault(p, entry.familyId, entry.baseAbilityId); },
    };
  };

  shop.describeAbility = function describeAbility(entry) {
    var normalizeEnLabel = function (s) {
      return String(s || '').replace(/\b(\d+)\s*AP\b/g, '$1 EN').replace(/\bAP\s*·/g, 'EN ·');
    };
    var fromEntry = normalizeEnLabel(String(entry.shortDesc || '').trim());
    if (fromEntry) return fromEntry;
    var p = pack();
    if (!p || !p.skillTrees) return entry.name || '';
    var row = p.skillTrees[entry.baseAbilityId];
    if (!row) return entry.name || '';
    var shortDesc = normalizeEnLabel(String(row.shortDesc || '').trim());
    if (shortDesc) return shortDesc;
    var bits = [];
    bits.push((row.apCost || 1) + ' EN · ' + (row.target === 'self' ? 'Self' : row.target === 'self_and_enemy' ? 'Self+Enemy' : 'Enemy'));
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

  shop.addAbilityToVault = function addAbilityToVault(player, familyId, baseAbilityId) {
    if (!player) return false;
    var pck = pack();
    if (!pck) return false;
    var row = pck.skillTrees && pck.skillTrees[baseAbilityId];
    if (!row) {
      if (typeof logMsg === 'function') logMsg('Shop: missing skill tree row ' + baseAbilityId, 'miss');
      return false;
    }
    if (shop.hasFamilyOwned(player, familyId)) {
      if (typeof logMsg === 'function') logMsg('Already own ' + row.name + ' (check Nest vault or loadout).', 'miss');
      return false;
    }
    var inv = shop.ensureAbilityInventory(player);
    inv.push({
      familyId: familyId,
      abilityId: baseAbilityId,
      name: row.name,
      tier: 0,
      pathId: null,
    });
    if (typeof logMsg === 'function') logMsg('🎓 ' + row.name + ' stored in Nest vault — equip from your Nest.', 'exp-gain');
    return true;
  };

  shop.learnAbility = function learnAbility(player, familyId, baseAbilityId) {
    return shop.addAbilityToVault(player, familyId, baseAbilityId);
  };

  shop.buildAbilityInstance = function buildAbilityInstance(abId, familyId, slot) {
    var pck = pack();
    var row = pck && pck.skillTrees && pck.skillTrees[abId];
    if (!row) return { id: abId, familyId: familyId, name: abId, level: 1, energy: 1, energyCost: 1, slotIndex: slot };
    var btnType = (typeof globalThis.resolveCombatRowBtnType === 'function')
      ? globalThis.resolveCombatRowBtnType(row)
      : (/magic|song|spell/i.test(row.category) ? 'spell' : (row.target === 'self' && row.noDamage ? 'utility' : 'physical'));
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

  shop.resolveFlexSlotIndex = function resolveFlexSlotIndex(player, preferred) {
    var slots = getSkillSlots(player);
    if (Number.isFinite(preferred) && preferred >= 2 && preferred <= 3) {
      var pref = slots.find(function (s) { return s && s.slotIndex === preferred; });
      if (pref) return preferred;
    }
    var empty = slots.find(function (s) { return s && s.slotIndex >= 2 && !s.abilityId; });
    if (empty) return empty.slotIndex;
    return 2;
  };

  shop.equipVaultAbility = function equipVaultAbility(player, vaultIndex, slotIndex) {
    if (!player) return false;
    var inv = shop.ensureAbilityInventory(player);
    var entry = inv[vaultIndex];
    if (!entry) return false;
    if (typeof globalThis.ensureFamilyEvolutionState === 'function') globalThis.ensureFamilyEvolutionState(player);
    var targetSlot = shop.resolveFlexSlotIndex(player, slotIndex);
    if (targetSlot < 2) targetSlot = 2;
    if (typeof globalThis.getSkillSlotByIndex !== 'function') return false;
    var skillSlot = globalThis.getSkillSlotByIndex(player, targetSlot);
    if (!skillSlot) return false;
    if (skillSlot.abilityId && skillSlot.familyId) {
      var pck = pack();
      var curRow = pck && pck.skillTrees && pck.skillTrees[skillSlot.abilityId];
      inv.push({
        familyId: skillSlot.familyId,
        abilityId: skillSlot.abilityId,
        name: (curRow && curRow.name) || skillSlot.abilityId,
        tier: skillSlot.tier || 0,
        pathId: skillSlot.pathId || null,
      });
    }
    skillSlot.familyId = entry.familyId;
    skillSlot.abilityId = entry.abilityId;
    skillSlot.pathId = entry.pathId || null;
    skillSlot.tier = entry.tier || 0;
    skillSlot.slotIndex = targetSlot;
    inv.splice(vaultIndex, 1);
    if (typeof globalThis.syncPlayerAbilitiesFromSkillSlots === 'function') {
      globalThis.syncPlayerAbilitiesFromSkillSlots(player);
    }
    if (typeof globalThis.ensureMainAttackAndLoadoutRules === 'function') {
      globalThis.ensureMainAttackAndLoadoutRules();
    }
    if (Avian.dispatcher && typeof Avian.dispatcher.registerActions === 'function' && globalThis.ACTIONS) {
      Avian.dispatcher.registerActions(globalThis.ACTIONS);
    }
    if (typeof refreshBattleUI === 'function') {
      try { refreshBattleUI(); } catch (_e) { /* ok during nest/shop */ }
    }
    return true;
  };

  shop.unequipToVault = function unequipToVault(player, slotIndex) {
    if (!player || slotIndex < 2) return false;
    if (typeof globalThis.ensureFamilyEvolutionState === 'function') globalThis.ensureFamilyEvolutionState(player);
    if (typeof globalThis.getSkillSlotByIndex !== 'function') return false;
    var slot = globalThis.getSkillSlotByIndex(player, slotIndex);
    if (!slot || !slot.abilityId) return false;
    var inv = shop.ensureAbilityInventory(player);
    var pck = pack();
    var row = pck && pck.skillTrees && pck.skillTrees[slot.abilityId];
    inv.push({
      familyId: slot.familyId,
      abilityId: slot.abilityId,
      name: (row && row.name) || slot.abilityId,
      tier: slot.tier || 0,
      pathId: slot.pathId || null,
    });
    slot.familyId = null;
    slot.abilityId = null;
    slot.pathId = null;
    slot.tier = 0;
    if (typeof globalThis.syncPlayerAbilitiesFromSkillSlots === 'function') {
      globalThis.syncPlayerAbilitiesFromSkillSlots(player);
    }
    if (typeof globalThis.ensureMainAttackAndLoadoutRules === 'function') {
      globalThis.ensureMainAttackAndLoadoutRules();
    }
    if (typeof refreshBattleUI === 'function') {
      try { refreshBattleUI(); } catch (_e) { /* ok */ }
    }
    return true;
  };

  shop.rollStockForMode = function rollStockForMode(mode) {
    var stage = currentStageNumber();
    var used = new Set();
    var count = mode === 'endless-boss' ? 1 : 9;
    var items = [];
    for (var i = 0; i < count; i++) {
      var entry = shop.rollOffer(stage, used);
      if (!entry) break;
      used.add(entry.familyId);
      items.push(shop.makeItem(entry));
    }
    return items;
  };

  shop.findById = function findById(id) {
    if (id === 'shop_mutated_feather' && typeof globalThis.makeMutatedFeatherShopOffer === 'function') {
      return globalThis.makeMutatedFeatherShopOffer();
    }
    var entries = poolEntries();
    for (var k in entries) {
      if (entries[k].baseAbilityId === id) return shop.makeItem(entries[k]);
    }
    return null;
  };

  Avian.shop = shop;
  Avian.systems.shop = shop;
})();
