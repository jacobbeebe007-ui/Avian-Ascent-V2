/* Avian Ascent — Mutations / Equipment Runtime
 *
 * Slot-based gear: inventory, equip/unequip/swap, stat rollup, combat mechanics.
 * Data lives in Avian.data.mutations (imported from spreadsheet).
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var mutations = Avian.mutations || Object.create(null);

  var TIER_ICONS = { white: '🤍', green: '💚', blue: '💙', purple: '💜', gold: '👑' };
  var SLOT_ICONS = {
    wing: '🪽', feet: '🦶', head: '🪖', beak: '🦅', chest: '🛡',
    eyes: '👁', tail: '🪶', plumage: '✨', syrinx: '🎵',
  };
  var MUTATION_SHOP_COSTS = { white: 16, green: 28, blue: 44, purple: 64, gold: 96 };
  var SLOT_LABELS = {
    wing: 'Wing', feet: 'Feet', head: 'Head', beak: 'Beak', chest: 'Chest',
    eyes: 'Eyes', tail: 'Tail', plumage: 'Plumage', syrinx: 'Syrinx',
  };
  var SLOT_DISPLAY_TAGS = {
    feet: 'foot', wing: 'wing', head: 'head', beak: 'beak', chest: 'chest',
    eyes: 'eyes', tail: 'tail', plumage: 'plumage', syrinx: 'syrinx',
  };

  function formatSlotTag(slot) {
    if (!slot) return '';
    var tag = SLOT_DISPLAY_TAGS[slot] || slot;
    return '(' + tag + ')';
  }

  function formatMutationDesc(item) {
    if (!item) return '';
    var base = item.statLine || (SLOT_LABELS[item.slot] || item.slot) + ' mutation';
    var tag = formatSlotTag(item.slot);
    if (!tag || base.indexOf(tag) >= 0) return base;
    return base + ' ' + tag;
  }

  function pack() { return (Avian.data && Avian.data.mutations) || null; }
  function slotsDef() { var p = pack(); return (p && p.slots) || { limits: {}, order: [] }; }

  function getItem(id) {
    var p = pack();
    if (!p || !id) return null;
    return (p.byId && p.byId[id]) || null;
  }

  function getCatalog() {
    var p = pack();
    return (p && p.byId) || Object.create(null);
  }

  function createEmptyEquipped() {
    var lim = slotsDef().limits || {};
    var out = Object.create(null);
    for (var slot in lim) {
      var n = lim[slot] || 1;
      out[slot] = new Array(n).fill(null);
    }
    return out;
  }

  function ensurePlayerMutationState(player) {
    if (!player) return null;
    if (!Array.isArray(player.mutationInventory)) player.mutationInventory = [];
    if (!player.equippedMutations || typeof player.equippedMutations !== 'object') {
      player.equippedMutations = createEmptyEquipped();
    } else {
      var lim = slotsDef().limits || {};
      for (var slot in lim) {
        var need = lim[slot] || 1;
        if (!Array.isArray(player.equippedMutations[slot])) {
          player.equippedMutations[slot] = new Array(need).fill(null);
        } else while (player.equippedMutations[slot].length < need) {
          player.equippedMutations[slot].push(null);
        }
        if (player.equippedMutations[slot].length > need) {
          player.equippedMutations[slot] = player.equippedMutations[slot].slice(0, need);
        }
      }
    }
    return player;
  }

  function findInventoryIndex(player, itemId) {
    if (!player || !itemId) return -1;
    var inv = player.mutationInventory || [];
    for (var i = 0; i < inv.length; i++) {
      var e = inv[i];
      if ((typeof e === 'string' ? e : e && e.itemId) === itemId) return i;
    }
    return -1;
  }

  function addToInventory(player, itemId) {
    ensurePlayerMutationState(player);
    if (!itemId || !getItem(itemId)) return false;
    player.mutationInventory.push({ itemId: itemId });
    return true;
  }

  function removeFromInventory(player, itemId) {
    var idx = findInventoryIndex(player, itemId);
    if (idx < 0) return false;
    player.mutationInventory.splice(idx, 1);
    return true;
  }

  function findEquippedSlot(player, itemId) {
    ensurePlayerMutationState(player);
    var eq = player.equippedMutations;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        if (eq[slot][i] === itemId) return { slot: slot, index: i };
      }
    }
    return null;
  }

  function firstOpenSlot(player, slotKey) {
    ensurePlayerMutationState(player);
    var arr = player.equippedMutations[slotKey];
    if (!Array.isArray(arr)) return -1;
    for (var i = 0; i < arr.length; i++) if (!arr[i]) return i;
    return -1;
  }

  function canEquip(player, itemId, slotKey, slotIndex) {
    var item = getItem(itemId);
    if (!item || !player) return false;
    ensurePlayerMutationState(player);
    if (findEquippedSlot(player, itemId)) return false;
    if (findInventoryIndex(player, itemId) < 0) return false;
    var sk = slotKey || item.slot;
    if (sk !== item.slot) return false;
    var arr = player.equippedMutations[sk];
    if (!Array.isArray(arr)) return false;
    if (slotIndex != null && slotIndex >= 0) {
      return slotIndex < arr.length;
    }
    return firstOpenSlot(player, sk) >= 0 || arr.length > 0;
  }

  var MECHANICAL_STAT_KEYS = [
    'lightAttackDmgPct', 'mediumAttackDmgPct', 'heavyAttackDmgPct',
    'multiHitDmgPct', 'critDamageBonusPct', 'defPenPct', 'physicalAilmentChance', 'magicAilmentChance',
    'delayedDmgPct',
  ];

  function pushAilmentEntry(list, entry) {
    if (!entry || !entry.id || !entry.chance) return;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === entry.id) {
        list[i].chance = (Number(list[i].chance) || 0) + Number(entry.chance);
        return;
      }
    }
    list.push({ id: entry.id, chance: Number(entry.chance) });
  }

  function sumEquippedStats(player) {
    var stats = Object.create(null);
    var mech = Object.create(null);
    ensurePlayerMutationState(player);
    var eq = player.equippedMutations;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        var id = eq[slot][i];
        if (!id) continue;
        var item = getItem(id);
        if (!item) continue;
        var s = item.stats || {};
        for (var k in s) {
          if (MECHANICAL_STAT_KEYS.indexOf(k) >= 0) {
            mech[k] = (mech[k] || 0) + (Number(s[k]) || 0);
          } else {
            stats[k] = (stats[k] || 0) + (Number(s[k]) || 0);
          }
        }
        var m = item.mechanics || {};
        if (m.piercePct) mech.piercePct = (mech.piercePct || 0) + Number(m.piercePct);
        if (m.damageBonus) {
          mech.damageBonuses = mech.damageBonuses || [];
          mech.damageBonuses.push(m.damageBonus);
        }
        if (m.physicalAilment) {
          mech.physicalAilmentChance = (mech.physicalAilmentChance || 0) + Number(m.physicalAilment.chance || 0);
          mech.physicalAilments = mech.physicalAilments || [];
          pushAilmentEntry(mech.physicalAilments, m.physicalAilment);
        }
        if (m.magicAilment) {
          mech.magicAilmentChance = (mech.magicAilmentChance || 0) + Number(m.magicAilment.chance || 0);
          mech.magicAilments = mech.magicAilments || [];
          pushAilmentEntry(mech.magicAilments, m.magicAilment);
        }
      }
    }
    return { stats: stats, mechanics: mech };
  }

  function reapplyPlayerStatsFromSources(player) {
    if (!player || !player.stats) return;
    ensurePlayerMutationState(player);
    var L = (typeof ensureStatLedger === 'function') ? ensureStatLedger(player) : null;
    var base = (L && L.birdBaseline) ? L.birdBaseline : null;
    if (!base || !Object.keys(base).length) {
      var bd = (typeof BIRDS !== 'undefined' && BIRDS[player.birdKey]) ? BIRDS[player.birdKey] : null;
      base = bd && bd.stats ? Object.assign({}, bd.stats) : Object.assign({}, player.stats);
    }
    var keys = (typeof STAT_LEDGER_TRACKED_KEYS !== 'undefined')
      ? STAT_LEDGER_TRACKED_KEYS
      : ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance'];
    var fromLevel = (L && L.fromLevel) ? L.fromLevel : {};
    var fromUpgrades = (L && L.fromUpgrades) ? L.fromUpgrades : {};
    var eqRoll = sumEquippedStats(player);
    if (L) L.fromEquipment = Object.assign({}, eqRoll.stats);
    player._mutationMechanics = eqRoll.mechanics;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = (Number(base[k]) || 0) + (Number(fromLevel[k]) || 0) + (Number(fromUpgrades[k]) || 0) + (Number(eqRoll.stats[k]) || 0);
      player.stats[k] = k === 'critChance' ? Math.max(0, Math.min(100, v)) : Math.max(0, v);
    }
    if (player.stats.maxHp != null) {
      player.stats.hp = Math.min(player.stats.hp || player.stats.maxHp, player.stats.maxHp);
    }
    if (typeof normalizeCombatStats === 'function') normalizeCombatStats(player.stats);
  }

  function unequip(player, slotKey, slotIndex) {
    ensurePlayerMutationState(player);
    var arr = player.equippedMutations[slotKey];
    if (!Array.isArray(arr) || slotIndex == null || slotIndex < 0 || slotIndex >= arr.length) return false;
    var id = arr[slotIndex];
    if (!id) return false;
    arr[slotIndex] = null;
    addToInventory(player, id);
    reapplyPlayerStatsFromSources(player);
    return true;
  }

  function equip(player, itemId, slotKey, slotIndex) {
    var item = getItem(itemId);
    if (!item || !player) return false;
    ensurePlayerMutationState(player);
    var sk = slotKey || item.slot;
    if (sk !== item.slot) return false;
    if (findInventoryIndex(player, itemId) < 0) return false;
    var arr = player.equippedMutations[sk];
    if (!Array.isArray(arr)) return false;
    var idx = (slotIndex != null && slotIndex >= 0) ? slotIndex : firstOpenSlot(player, sk);
    if (idx < 0) idx = arr.length - 1;
    if (idx >= arr.length) return false;
    var displaced = arr[idx];
    removeFromInventory(player, itemId);
    if (displaced) addToInventory(player, displaced);
    arr[idx] = itemId;
    reapplyPlayerStatsFromSources(player);
    return true;
  }

  function equipAuto(player, itemId) {
    var item = getItem(itemId);
    if (!item) return false;
    var idx = firstOpenSlot(player, item.slot);
    return equip(player, itemId, item.slot, idx >= 0 ? idx : 0);
  }

  function getEquippedSummary(player) {
    var roll = sumEquippedStats(player);
    var lines = [];
    var s = roll.stats;
    var labels = (typeof STAT_LEDGER_LABELS !== 'undefined') ? STAT_LEDGER_LABELS : {};
    for (var k in s) {
      if (!s[k]) continue;
      lines.push({ key: k, label: labels[k] || k, value: s[k] });
    }
    var m = roll.mechanics;
    if (m.lightAttackDmgPct) lines.push({ key: 'lightDmg', label: 'Light Attack', value: '+' + m.lightAttackDmgPct + '%' });
    if (m.mediumAttackDmgPct) lines.push({ key: 'mediumDmg', label: 'Medium Attack', value: '+' + m.mediumAttackDmgPct + '%' });
    if (m.heavyAttackDmgPct) lines.push({ key: 'heavyDmg', label: 'Heavy Attack', value: '+' + m.heavyAttackDmgPct + '%' });
    if (m.multiHitDmgPct) lines.push({ key: 'multiHitDmg', label: 'Multi-hit', value: '+' + m.multiHitDmgPct + '%' });
    if (m.critDamageBonusPct) lines.push({ key: 'critDmg', label: 'Crit Damage', value: '+' + m.critDamageBonusPct + '%' });
    if (m.piercePct || m.defPenPct) lines.push({ key: 'pierce', label: 'Pierce', value: '+' + (m.piercePct || m.defPenPct) + '%' });
    if (m.physicalAilmentChance) lines.push({ key: 'physAil', label: 'Phys Ailment', value: '+' + m.physicalAilmentChance + '%' });
    if (m.magicAilmentChance) lines.push({ key: 'magAil', label: 'Magic Ailment', value: '+' + m.magicAilmentChance + '%' });
    if (m.delayedDmgPct) lines.push({ key: 'delayedDmg', label: 'Delayed', value: '+' + m.delayedDmgPct + '% dmg' });
    return { stats: s, mechanics: m, lines: lines };
  }

  function getMechanicsRollup(player) {
    ensurePlayerMutationState(player);
    if (!player._mutationMechanics) reapplyPlayerStatsFromSources(player);
    return player._mutationMechanics || Object.create(null);
  }

  function rollTierForContext(opts) {
    opts = opts || {};
    var stage = opts.stage || (globalThis.G && G.stage) || 1;
    var isBoss = !!opts.isBoss;
    var endless = !!(globalThis.G && G.endlessMode);
    if (isBoss && stage >= 20) return endless ? 'purple' : 'blue';
    if (isBoss) return stage >= 10 ? 'purple' : 'blue';
    if (stage >= 15) return chanceWeighted(['white', 'green', 'blue', 'purple'], [20, 30, 35, 15]);
    if (stage >= 8) return chanceWeighted(['white', 'green', 'blue'], [35, 40, 25]);
    if (stage >= 4) return chanceWeighted(['white', 'green'], [55, 45]);
    return 'white';
  }

  function chanceWeighted(tiers, weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    var r = Math.random() * total;
    for (var j = 0; j < tiers.length; j++) {
      r -= weights[j];
      if (r <= 0) return tiers[j];
    }
    return tiers[0];
  }

  function rollDrop(tier, opts) {
    var p = pack();
    if (!p) return null;
    tier = String(tier || 'white').toLowerCase();
    var pool = p['items_' + tier];
    if (!pool) return null;
    var ids = Object.keys(pool);
    if (!ids.length) return null;
    opts = opts || {};
    if (opts.slot) {
      ids = ids.filter(function (id) { return pool[id].slot === opts.slot; });
      if (!ids.length) return null;
    }
    return pool[ids[Math.floor(Math.random() * ids.length)]];
  }

  function buildRewardCard(item) {
    if (!item) return null;
    var tier = item.tier || 'white';
    var uiTier = tier === 'white' ? 'grey' : tier;
    var tierLabels = { grey: 'Common', green: 'Uncommon', blue: 'Rare', purple: 'Epic', gold: 'Legendary' };
    return {
      id: item.id,
      tier: uiTier,
      tierLabel: tierLabels[uiTier] || 'Common',
      type: 'mutation',
      icon: SLOT_ICONS[item.slot] || '🧬',
      name: item.name,
      desc: formatMutationDesc(item),
      mutationItemId: item.id,
      apply: function (p) {
        if (typeof Avian.mutations.addToInventory === 'function') {
          Avian.mutations.addToInventory(p, item.id);
        }
      },
    };
  }

  function toShopOffer(item) {
    var card = buildRewardCard(item);
    if (!card) return null;
    var tier = String(item.tier || 'white').toLowerCase();
    card.costOverride = MUTATION_SHOP_COSTS[tier] || 20;
    return card;
  }

  function reconstructShopOffer(id) {
    var item = getItem(id);
    return item ? toShopOffer(item) : null;
  }

  function rollUniqueFromTier(tier, used) {
    var attempts = 50;
    while (attempts-- > 0) {
      var drop = rollDrop(tier);
      if (!drop) return null;
      if (used.has(drop.id)) continue;
      used.add(drop.id);
      return drop;
    }
    var fallback = rollDrop(tier);
    if (fallback) used.add(fallback.id);
    return fallback;
  }

  function rollShopMutations(spec, used) {
    used = used || new Set();
    var offers = [];
    if (!spec) return offers;
    if (spec.tiers && spec.count) {
      for (var i = 0; i < spec.count; i++) {
        var tier = spec.tiers[Math.floor(Math.random() * spec.tiers.length)];
        var picked = rollUniqueFromTier(tier, used);
        if (picked) offers.push(toShopOffer(picked));
      }
      return offers;
    }
    for (var tierKey in spec) {
      if (tierKey === 'tiers' || tierKey === 'count') continue;
      var n = spec[tierKey];
      for (var j = 0; j < n; j++) {
        var item = rollUniqueFromTier(tierKey, used);
        if (item) offers.push(toShopOffer(item));
      }
    }
    return offers;
  }

  function rollMutationReward(opts) {
    var tier = (opts && opts.tier) || rollTierForContext(opts || {});
    var item = rollDrop(tier, opts || {});
    return buildRewardCard(item);
  }

  mutations.getCatalog = getCatalog;
  mutations.getItem = getItem;
  mutations.createEmptyEquipped = createEmptyEquipped;
  mutations.ensurePlayerMutationState = ensurePlayerMutationState;
  mutations.addToInventory = addToInventory;
  mutations.canEquip = canEquip;
  mutations.equip = equip;
  mutations.equipAuto = equipAuto;
  mutations.unequip = unequip;
  mutations.getEquippedSummary = getEquippedSummary;
  mutations.getMechanicsRollup = getMechanicsRollup;
  mutations.reapplyPlayerStatsFromSources = reapplyPlayerStatsFromSources;
  mutations.rollDrop = rollDrop;
  mutations.rollTierForContext = rollTierForContext;
  mutations.rollMutationReward = rollMutationReward;
  mutations.buildRewardCard = buildRewardCard;
  mutations.toShopOffer = toShopOffer;
  mutations.reconstructShopOffer = reconstructShopOffer;
  mutations.rollShopMutations = rollShopMutations;
  mutations.formatMutationDesc = formatMutationDesc;
  mutations.formatSlotTag = formatSlotTag;
  mutations.SLOT_LABELS = SLOT_LABELS;
  mutations.SLOT_ICONS = SLOT_ICONS;
  mutations.TIER_ICONS = TIER_ICONS;
  mutations.MUTATION_SHOP_COSTS = MUTATION_SHOP_COSTS;

  Avian.mutations = mutations;
  Avian.systems.mutations = mutations;
})();
