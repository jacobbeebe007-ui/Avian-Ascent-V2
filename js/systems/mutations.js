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

  var TIER_ICONS = { white: '🤍', green: '💚', blue: '💙', purple: '💜', gold: '👑', orange: '🧡' };
  var SLOT_ICONS = {
    leftWing: '🪽', rightWing: '🪽', leftFoot: '🦶', rightFoot: '🦶',
    head: '🪖', beak: '🦅', chest: '🛡', eyes: '👁', tail: '🪶', plumage: '✨', syrinx: '🎵',
  };
  var MUTATION_SHOP_COSTS = { white: 16, green: 28, blue: 44, purple: 64, gold: 96, orange: 140 };
  var SLOT_LABELS = {
    leftWing: 'Left Wing', rightWing: 'Right Wing', leftFoot: 'Left Foot', rightFoot: 'Right Foot',
    head: 'Head', beak: 'Beak', chest: 'Chest', eyes: 'Eyes', tail: 'Tail', plumage: 'Plumage', syrinx: 'Syrinx',
  };
  var SLOT_DISPLAY_TAGS = {
    leftFoot: 'left foot', rightFoot: 'right foot', leftWing: 'left wing', rightWing: 'right wing',
    head: 'head', beak: 'beak', chest: 'chest', eyes: 'eyes', tail: 'tail', plumage: 'plumage', syrinx: 'syrinx',
  };
  var ALL_TIERS = ['white', 'green', 'blue', 'purple', 'gold', 'orange'];

  function formatSlotTag(slot) {
    if (!slot) return '';
    var tag = SLOT_DISPLAY_TAGS[slot] || slot;
    return '(' + tag + ')';
  }

  function normalizeMutationCritStatLine(statLine) {
    if (!statLine) return statLine;
    var parts = String(statLine).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) return statLine;
    var full = parts.join('; ');
    var hasCritChance = /\bCrit\s*Chance\b/i.test(full);
    var hasCritDamage = /\bCrit\s*Damage\b/i.test(full);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (/\bCritical\b/i.test(p)) {
        if (hasCritChance || hasCritDamage) continue;
        out.push(p.replace(/\bCritical\b/i, 'Crit Damage'));
        continue;
      }
      out.push(p);
    }
    return out.join('; ');
  }

  var MUT_STAT_DISPLAY = {
    maxHp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', acc: 'ACC', dodge: 'DODGE',
    matk: 'MATK', mdef: 'MDEF', critChance: 'CRIT', armorPen: 'Armour Pen', magicPen: 'Magic Pen',
    shieldPowerPct: 'Shield Power', lifestealPct: 'Lifesteal', healingDonePct: 'Healing Done',
    healingReceivedPct: 'Healing Received', statusResistPct: 'Status Resist',
    heavyAccPenaltyReductionPct: 'Heavy ACC', ultimateMeterGainPct: 'Ult Meter',
    physicalDamageUpPct: 'Physical Damage', magicDamageUpPct: 'Magic Damage',
  };
  var MUT_MECH_DISPLAY_KEYS = [
    'shieldPowerPct', 'lifestealPct', 'healingDonePct', 'healingReceivedPct',
    'statusResistPct', 'heavyAccPenaltyReductionPct', 'ultimateMeterGainPct',
    'physicalDamageUpPct', 'magicDamageUpPct',
  ];
  var MUT_STAT_COLOR = {
    atk: 'mut-stat-atk', matk: 'mut-stat-matk', def: 'mut-stat-def', mdef: 'mut-stat-mdef',
    spd: 'mut-stat-spd', acc: 'mut-stat-acc', dodge: 'mut-stat-dodge', critChance: 'mut-stat-crit',
    maxHp: 'mut-stat-hp', armorPen: 'mut-stat-atk', magicPen: 'mut-stat-matk',
    lightDmg: 'mut-stat-atk', mediumDmg: 'mut-stat-atk', heavyDmg: 'mut-stat-atk',
    multiHitDmg: 'mut-stat-atk', critDmg: 'mut-stat-crit',
    physAil: 'mut-stat-ail', magAil: 'mut-stat-ail', delayedDmg: 'mut-stat-atk',
    shieldPowerPct: 'mut-stat-def', lifestealPct: 'mut-stat-hp', healingDonePct: 'mut-stat-hp',
    healingReceivedPct: 'mut-stat-hp', statusResistPct: 'mut-stat-mdef',
    heavyAccPenaltyReductionPct: 'mut-stat-acc', ultimateMeterGainPct: 'mut-stat-misc',
    bonus: 'mut-stat-misc', statLine: 'mut-stat-misc',
  };

  function mutStatColorClass(key) {
    return MUT_STAT_COLOR[key] || 'mut-stat-misc';
  }

  function formatStatLineValue(key, raw) {
    var n = Number(raw) || 0;
    if (!n) return '';
    if (key === 'critChance' || key === 'armorPen' || key === 'magicPen') return (n > 0 ? '+' : '') + n + '%';
    return (n > 0 ? '+' : '') + n;
  }

  function addArmorPenStat(stats, value) {
    var v = Number(value) || 0;
    if (!v) return;
    stats.armorPen = (Number(stats.armorPen) || 0) + v;
  }

  function addMagicPenStat(stats, value) {
    var v = Number(value) || 0;
    if (!v) return;
    stats.magicPen = (Number(stats.magicPen) || 0) + v;
  }

  function capTrackedStatValue(statKey, value) {
    var v = Number(value) || 0;
    if (statKey === 'critChance') return Math.max(0, Math.min(100, v));
    if (statKey === 'armorPen' || statKey === 'magicPen') return Math.max(0, Math.min(95, v));
    return Math.max(0, v);
  }

  function buildMutationStatLines(item) {
    if (!item) return [];
    var stats = Object.create(null);
    var mech = Object.create(null);
    var statsPct = Object.create(null);
    rollupMutationItem(item, stats, mech, statsPct);
    var lines = [];
    var order = ['atk', 'matk', 'def', 'mdef', 'spd', 'acc', 'dodge', 'critChance', 'armorPen', 'magicPen', 'maxHp'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var v = Number(stats[k]) || 0;
      var pct = Number(statsPct[k]) || 0;
      if (!v && !pct) continue;
      var disp = v ? formatStatLineValue(k, v) : '';
      if (pct) disp = (disp ? disp + ' ' : '') + '+' + pct + '%';
      lines.push({ key: k, label: MUT_STAT_DISPLAY[k] || k.toUpperCase(), value: disp, colorClass: mutStatColorClass(k) });
    }
    if (mech.lightAttackDmgPct) lines.push({ key: 'lightDmg', label: 'Light Attack', value: '+' + mech.lightAttackDmgPct + '%', colorClass: mutStatColorClass('lightDmg') });
    if (mech.mediumAttackDmgPct) lines.push({ key: 'mediumDmg', label: 'Medium Attack', value: '+' + mech.mediumAttackDmgPct + '%', colorClass: mutStatColorClass('mediumDmg') });
    if (mech.heavyAttackDmgPct) lines.push({ key: 'heavyDmg', label: 'Heavy Attack', value: '+' + mech.heavyAttackDmgPct + '%', colorClass: mutStatColorClass('heavyDmg') });
    if (mech.multiHitDmgPct) lines.push({ key: 'multiHitDmg', label: 'Multi-hit', value: '+' + mech.multiHitDmgPct + '%', colorClass: mutStatColorClass('multiHitDmg') });
    if (mech.critDamageBonusPct) lines.push({ key: 'critDmg', label: 'Crit Damage', value: '+' + mech.critDamageBonusPct + '%', colorClass: mutStatColorClass('critDmg') });
    if (mech.delayedDmgPct) lines.push({ key: 'delayedDmg', label: 'Delayed', value: '+' + mech.delayedDmgPct + '% dmg', colorClass: mutStatColorClass('delayedDmg') });
    for (var mi = 0; mi < MUT_MECH_DISPLAY_KEYS.length; mi++) {
      var mk = MUT_MECH_DISPLAY_KEYS[mi];
      var mv = Number(mech[mk]) || 0;
      if (!mv) continue;
      lines.push({ key: mk, label: MUT_STAT_DISPLAY[mk] || mk, value: '+' + mv + '%', colorClass: mutStatColorClass(mk) });
    }
    var m = item.mechanics || {};
    var hasPhysAilLine = false;
    var hasMagAilLine = false;
    if (m.physicalAilment && m.physicalAilment.chance) {
      hasPhysAilLine = true;
      lines.push({
        key: 'physAil',
        label: 'Phys ailment',
        value: '+' + m.physicalAilment.chance + '% ' + (m.physicalAilment.id || ''),
        colorClass: mutStatColorClass('physAil'),
      });
    } else if (mech.physicalAilmentChance) {
      hasPhysAilLine = true;
      lines.push({ key: 'physAil', label: 'Phys ailment', value: '+' + mech.physicalAilmentChance + '%', colorClass: mutStatColorClass('physAil') });
    }
    if (mech.physicalAilments && mech.physicalAilments.length && !hasPhysAilLine) {
      for (var pai = 0; pai < mech.physicalAilments.length; pai++) {
        var pa = mech.physicalAilments[pai];
        if (!pa || !pa.chance) continue;
        lines.push({
          key: 'physAil_' + pai,
          label: String(pa.id || 'Phys ailment'),
          value: '+' + pa.chance + '%',
          colorClass: mutStatColorClass('physAil'),
        });
      }
    }
    if (m.magicAilment && m.magicAilment.chance) {
      hasMagAilLine = true;
      lines.push({
        key: 'magAil',
        label: 'Magic ailment',
        value: '+' + m.magicAilment.chance + '% ' + (m.magicAilment.id || ''),
        colorClass: mutStatColorClass('magAil'),
      });
    } else if (mech.magicAilmentChance) {
      hasMagAilLine = true;
      lines.push({ key: 'magAil', label: 'Magic ailment', value: '+' + mech.magicAilmentChance + '%', colorClass: mutStatColorClass('magAil') });
    }
    if (mech.magicAilments && mech.magicAilments.length && !hasMagAilLine) {
      for (var mai = 0; mai < mech.magicAilments.length; mai++) {
        var ma = mech.magicAilments[mai];
        if (!ma || !ma.chance) continue;
        lines.push({
          key: 'magAil_' + mai,
          label: String(ma.id || 'Magic ailment'),
          value: '+' + ma.chance + '%',
          colorClass: mutStatColorClass('magAil'),
        });
      }
    }
    if (item.bonuses && Array.isArray(item.bonuses)) {
      for (var bi = 0; bi < item.bonuses.length; bi++) {
        var b = item.bonuses[bi];
        if (!b || !b.name) continue;
        var bval = Number(b.value) || 0;
        lines.push({
          key: 'bonus_' + bi,
          label: b.name,
          value: bval ? ('(' + bval + ')') : '',
          colorClass: mutStatColorClass('bonus'),
        });
      }
    }
    return lines;
  }

  function formatStatLineFallbackHtml(item) {
    if (!item || !item.statLine) return '';
    return '<span class="mut-stat-chip mut-stat-misc">' + escapeMutHtml(item.statLine) + '</span>';
  }

  function formatStatLineFallbackBlock(item) {
    if (!item || !item.statLine) return '';
    return '<div class="mut-stat-line"><span class="mut-stat-misc">' + escapeMutHtml(item.statLine) + '</span></div>';
  }

  function escapeMutHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatMutationDescHtml(item) {
    var lines = buildMutationStatLines(item);
    if (!lines.length) return formatStatLineFallbackBlock(item);
    return lines.map(function (ln) {
      return '<div class="mut-stat-line"><span class="' + ln.colorClass + '">' + escapeMutHtml(ln.label) + ' ' + escapeMutHtml(ln.value) + '</span></div>';
    }).join('');
  }

  function formatMutationStatCompactHtml(item) {
    var lines = buildMutationStatLines(item);
    if (!lines.length) return formatStatLineFallbackHtml(item);
    return lines.map(function (ln) {
      return '<span class="mut-stat-chip ' + ln.colorClass + '">' + escapeMutHtml(ln.label) + ' ' + escapeMutHtml(ln.value) + '</span>';
    }).join(' · ');
  }

  function formatMutationDesc(item) {
    if (!item) return '';
    var lines = buildMutationStatLines(item);
    if (!lines.length) return item.statLine || item.name || '';
    return lines.map(function (ln) { return ln.label + ' ' + ln.value; }).join('\n');
  }

  function getMutationStatNumericMap(item) {
    if (!item) return Object.create(null);
    var stats = Object.create(null);
    var mech = Object.create(null);
    var statsPct = Object.create(null);
    rollupMutationItem(item, stats, mech, statsPct);
    var map = Object.create(null);
    var order = ['atk', 'matk', 'def', 'mdef', 'spd', 'acc', 'dodge', 'critChance', 'armorPen', 'magicPen', 'maxHp'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      var v = Number(stats[k]) || 0;
      if (v) map[k] = v;
      if (statsPct[k]) map[k + 'Pct'] = Number(statsPct[k]);
    }
    if (mech.lightAttackDmgPct) map.lightDmg = Number(mech.lightAttackDmgPct);
    if (mech.mediumAttackDmgPct) map.mediumDmg = Number(mech.mediumAttackDmgPct);
    if (mech.heavyAttackDmgPct) map.heavyDmg = Number(mech.heavyAttackDmgPct);
    if (mech.multiHitDmgPct) map.multiHitDmg = Number(mech.multiHitDmgPct);
    if (mech.critDamageBonusPct) map.critDmg = Number(mech.critDamageBonusPct);
    if (stats.armorPen) map.armorPen = Number(stats.armorPen);
    if (stats.magicPen) map.magicPen = Number(stats.magicPen);
    if (mech.delayedDmgPct) map.delayedDmg = Number(mech.delayedDmgPct);
    var m = item.mechanics || {};
    if (m.physicalAilment && m.physicalAilment.chance) map.physAil = Number(m.physicalAilment.chance);
    else if (mech.physicalAilmentChance) map.physAil = Number(mech.physicalAilmentChance);
    if (m.magicAilment && m.magicAilment.chance) map.magAil = Number(m.magicAilment.chance);
    else if (mech.magicAilmentChance) map.magAil = Number(mech.magicAilmentChance);
    return map;
  }

  function formatCompareDelta(key, delta) {
    var d = Number(delta) || 0;
    if (!d) return '';
    if (key === 'critChance' || key === 'armorPen' || key === 'magicPen') return (d > 0 ? '▲+' : '▼') + d + '%';
    var pctKeys = ['lightDmg', 'mediumDmg', 'heavyDmg', 'multiHitDmg', 'critDmg', 'delayedDmg', 'physAil', 'magAil'];
    if (pctKeys.indexOf(key) >= 0) return (d > 0 ? '▲+' : '▼') + d + '%';
    return (d > 0 ? '▲+' : '▼') + d;
  }

  function buildMutationCompareLines(candidate, baselineItem) {
    if (!candidate) return [];
    if (!baselineItem) return buildMutationStatLines(candidate);
    var candLines = buildMutationStatLines(candidate);
    var baseLines = buildMutationStatLines(baselineItem);
    var baseByKey = Object.create(null);
    for (var i = 0; i < baseLines.length; i++) baseByKey[baseLines[i].key] = baseLines[i];
    var candMap = getMutationStatNumericMap(candidate);
    var baseMap = getMutationStatNumericMap(baselineItem);
    var out = [];
    for (var j = 0; j < candLines.length; j++) {
      var ln = candLines[j];
      var delta = null;
      var deltaClass = '';
      if (candMap[ln.key] != null && baseMap[ln.key] != null) {
        var diff = candMap[ln.key] - baseMap[ln.key];
        if (diff > 0.0001) {
          delta = formatCompareDelta(ln.key, diff);
          deltaClass = 'mut-stat-delta-up';
        } else if (diff < -0.0001) {
          delta = formatCompareDelta(ln.key, diff);
          deltaClass = 'mut-stat-delta-down';
        }
      } else if (candMap[ln.key] != null && baseMap[ln.key] == null) {
        delta = '▲new';
        deltaClass = 'mut-stat-delta-up';
      } else if (baseByKey[ln.key] && ln.value !== baseByKey[ln.key].value) {
        delta = '▲';
        deltaClass = 'mut-stat-delta-up';
      }
      out.push({
        key: ln.key,
        label: ln.label,
        value: ln.value,
        colorClass: ln.colorClass,
        delta: delta,
        deltaClass: deltaClass,
      });
    }
    return out;
  }

  function formatMutationCompareHtml(candidate, baselineItem) {
    if (!candidate) return '';
    if (!baselineItem) return formatMutationDescHtml(candidate);
    var lines = buildMutationCompareLines(candidate, baselineItem);
    if (!lines.length) return '';
    return lines.map(function (ln) {
      var deltaHtml = ln.delta
        ? ' <span class="mut-stat-delta ' + ln.deltaClass + '">' + escapeMutHtml(ln.delta) + '</span>'
        : '';
      return '<div class="mut-stat-line"><span class="' + ln.colorClass + '">' + escapeMutHtml(ln.label) + ' ' + escapeMutHtml(ln.value) + '</span>' + deltaHtml + '</div>';
    }).join('');
  }

  function getEquipTargetSlotIndex(player, itemId, slotKeyOptional) {
    var item = getItem(itemId);
    if (!item || !player) return -1;
    ensurePlayerMutationState(player);
    var sk = slotKeyOptional || item.slot;
    var idx = firstOpenSlot(player, sk);
    if (idx >= 0) return idx;
    return 0;
  }

  function getCompareBaselineId(player, itemId) {
    var item = getItem(itemId);
    if (!item || !player) return null;
    ensurePlayerMutationState(player);
    var sk = item.slot;
    var arr = player.equippedMutations[sk];
    if (!Array.isArray(arr)) return null;
    var idx = getEquipTargetSlotIndex(player, itemId, sk);
    if (idx < 0 || idx >= arr.length) return null;
    return arr[idx] || null;
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

  function itemAllowedForPlayer(item, classIdOptional) {
    if (!item) return false;
    var req = item.classRequired;
    if (!req) return true;
    var cls = classIdOptional != null ? String(classIdOptional).toLowerCase() : getPlayerClassId(globalThis.G && G.player);
    return !!cls && String(req).toLowerCase() === cls;
  }

  function pack() { return (Avian.data && Avian.data.mutations) || null; }
  function slotsDef() { var p = pack(); return (p && p.slots) || { limits: {}, order: [] }; }

  function canPlayerEquipItem(player, itemId) {
    var item = getItem(itemId);
    if (!item || !player) return false;
    return itemAllowedForPlayer(item, getPlayerClassId(player));
  }

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
    if (!canPlayerEquipItem(player, itemId)) return false;
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
    'multiHitDmgPct', 'critDamageBonusPct', 'physicalAilmentChance', 'magicAilmentChance',
    'delayedDmgPct', 'heavyAccPenaltyReductionPct', 'lifestealPct', 'healingDonePct',
    'healingReceivedPct', 'shieldPowerPct', 'statusResistPct', 'ultimateMeterGainPct',
    'physicalDamageUpPct', 'magicDamageUpPct',
  ];
  var LEGACY_ARMOR_PEN_KEYS = ['defPenPct', 'piercePct'];
  var LEGACY_MAGIC_PEN_KEYS = ['mdefPenPct'];

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

  function rollupMutationItem(item, stats, mech, statsPct) {
    if (!item) return;
    var s = item.stats || {};
    for (var k in s) {
      if (LEGACY_ARMOR_PEN_KEYS.indexOf(k) >= 0) {
        addArmorPenStat(stats, s[k]);
      } else if (LEGACY_MAGIC_PEN_KEYS.indexOf(k) >= 0) {
        addMagicPenStat(stats, s[k]);
      } else if (k === 'armorPen') {
        addArmorPenStat(stats, s[k]);
      } else if (k === 'magicPen') {
        addMagicPenStat(stats, s[k]);
      } else if (MECHANICAL_STAT_KEYS.indexOf(k) >= 0) {
        mech[k] = (mech[k] || 0) + (Number(s[k]) || 0);
      } else {
        stats[k] = (stats[k] || 0) + (Number(s[k]) || 0);
      }
    }
    if (item.statsPct && statsPct) {
      var sp = item.statsPct;
      for (var pk in sp) {
        if (!Object.prototype.hasOwnProperty.call(sp, pk)) continue;
        statsPct[pk] = (statsPct[pk] || 0) + (Number(sp[pk]) || 0);
      }
    }
    var m = item.mechanics || {};
    if (m.piercePct) addArmorPenStat(stats, m.piercePct);
    if (m.defPenPct) addArmorPenStat(stats, m.defPenPct);
    if (m.mdefPenPct) addMagicPenStat(stats, m.mdefPenPct);
    if (m.armorPen) addArmorPenStat(stats, m.armorPen);
    if (m.magicPen) addMagicPenStat(stats, m.magicPen);
    for (var mk in m) {
      if (!Object.prototype.hasOwnProperty.call(m, mk)) continue;
      if (mk === 'piercePct' || mk === 'defPenPct' || mk === 'mdefPenPct' || mk === 'armorPen' || mk === 'magicPen') continue;
      if (mk === 'damageBonus' || mk === 'physicalAilment' || mk === 'magicAilment' || mk === 'ailmentChances') continue;
      if (MECHANICAL_STAT_KEYS.indexOf(mk) >= 0) {
        mech[mk] = (mech[mk] || 0) + (Number(m[mk]) || 0);
      }
    }
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
    if (m.ailmentChances && Array.isArray(m.ailmentChances)) {
      for (var ai = 0; ai < m.ailmentChances.length; ai++) {
        var ac = m.ailmentChances[ai];
        if (!ac || !ac.id) continue;
        if (ac.school === 'magic') {
          mech.magicAilmentChance = (mech.magicAilmentChance || 0) + Number(ac.chance || 0);
          mech.magicAilments = mech.magicAilments || [];
          pushAilmentEntry(mech.magicAilments, { id: ac.id, chance: ac.chance });
        } else {
          mech.physicalAilmentChance = (mech.physicalAilmentChance || 0) + Number(ac.chance || 0);
          mech.physicalAilments = mech.physicalAilments || [];
          pushAilmentEntry(mech.physicalAilments, { id: ac.id, chance: ac.chance });
        }
      }
    }
    if (item.bonuses && Array.isArray(item.bonuses)) {
      mech.itemBonuses = mech.itemBonuses || [];
      for (var bi = 0; bi < item.bonuses.length; bi++) {
        mech.itemBonuses.push(Object.assign({}, item.bonuses[bi], { sourceItemId: item.id, setName: item.setName || null }));
      }
    }
  }

  function sumMutationIds(ids) {
    var stats = Object.create(null);
    var mech = Object.create(null);
    var statsPct = Object.create(null);
    if (!Array.isArray(ids)) return { stats: stats, mechanics: mech, statsPct: statsPct };
    for (var i = 0; i < ids.length; i++) {
      rollupMutationItem(getItem(ids[i]), stats, mech, statsPct);
    }
    return { stats: stats, mechanics: mech, statsPct: statsPct };
  }

  function sumEquippedStats(player) {
    var stats = Object.create(null);
    var mech = Object.create(null);
    var statsPct = Object.create(null);
    ensurePlayerMutationState(player);
    var eq = player.equippedMutations;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        rollupMutationItem(getItem(eq[slot][i]), stats, mech, statsPct);
      }
    }
    return { stats: stats, mechanics: mech, statsPct: statsPct };
  }

  function enemyMutationCount(stage, isBoss) {
    stage = Math.max(1, Number(stage) || 1);
    var count = 0;
    if (stage <= 2) {
      count = Math.random() < 0.4 ? 1 : 0;
    } else if (stage <= 6) {
      count = 1;
    } else if (stage <= 12) {
      count = Math.random() < 0.5 ? 2 : 1;
    } else {
      count = 2;
    }
    if (isBoss) count = Math.min(3, count + 1);
    return count;
  }

  function rollTierFromBand(bandId) {
    var bands = globalThis.OW_MUTATION_BANDS || {};
    var tiers = bands[String(bandId || 'grey_green')] || ['white', 'green'];
    if (!tiers.length) return 'white';
    return tiers[Math.floor(Math.random() * tiers.length)];
  }

  function rollEnemyMutationsFromForgeSlot(opts) {
    opts = opts || {};
    var max = Math.max(0, Math.min(11, Math.floor(Number(opts.maxMutations) || 0)));
    if (max <= 0) return [];
    var used = new Set();
    var ids = [];
    var enemyOpts = { filterForPlayer: false };
    for (var i = 0; i < max; i++) {
      var tier = rollTierFromBand(opts.mutationBand);
      var drop = rollUniqueFromTier(tier, used, enemyOpts);
      if (drop && drop.id) ids.push(drop.id);
    }
    return ids;
  }

  function rollEnemyMutations(opts) {
    opts = opts || {};
    var stage = Math.max(1, Number(opts.stage) || 1);
    var isBoss = !!opts.isBoss;
    var endless = !!opts.endless;
    var count = enemyMutationCount(stage, isBoss);
    var used = new Set();
    var ids = [];
    var enemyOpts = { filterForPlayer: false };
    for (var i = 0; i < count; i++) {
      var tier = rollTierForContext({ stage: stage, isBoss: isBoss, endless: endless });
      var drop = rollUniqueFromTier(tier, used, enemyOpts);
      if (drop && drop.id) ids.push(drop.id);
    }
    return ids;
  }

  function applyMutationsToEntity(entity, ids) {
    if (!entity || !entity.stats) return entity;
    ids = Array.isArray(ids) ? ids : [];
    entity.mutationIds = ids;
    var roll = sumMutationIds(ids);
    entity._mutationMechanics = roll.mechanics;
    var keys = (typeof STAT_LEDGER_TRACKED_KEYS !== 'undefined')
      ? STAT_LEDGER_TRACKED_KEYS
      : ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance'];
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
      entity.hp = entity.stats.hp;
      entity.maxHp = entity.stats.maxHp;
    }
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
    var fromCardTier = (L && L.fromCardTier) ? L.fromCardTier : {};
    var eqRoll = sumEquippedStats(player);
    if (L) L.fromEquipment = Object.assign({}, eqRoll.stats);
    player._mutationMechanics = eqRoll.mechanics;
    player._mutationStatsPct = eqRoll.statsPct || Object.create(null);
    var pctRoll = player._mutationStatsPct;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var flat = (Number(fromLevel[k]) || 0) + (Number(fromUpgrades[k]) || 0) + (Number(fromCardTier[k]) || 0) + (Number(eqRoll.stats[k]) || 0);
      var pctBonus = pctRoll[k] ? Math.round((Number(base[k]) || 0) * (Number(pctRoll[k]) || 0) / 100) : 0;
      var v = (Number(base[k]) || 0) + flat + pctBonus;
      player.stats[k] = capTrackedStatValue(k, v);
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
    if (!canPlayerEquipItem(player, itemId)) return false;
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
    var m = roll.mechanics;
    var labels = (typeof STAT_LEDGER_LABELS !== 'undefined') ? STAT_LEDGER_LABELS : {};
    for (var k in s) {
      if (!s[k]) continue;
      lines.push({ key: k, label: labels[k] || k, value: s[k] });
    }
    if (m.lightAttackDmgPct) lines.push({ key: 'lightDmg', label: 'Light Attack', value: '+' + m.lightAttackDmgPct + '%' });
    if (m.mediumAttackDmgPct) lines.push({ key: 'mediumDmg', label: 'Medium Attack', value: '+' + m.mediumAttackDmgPct + '%' });
    if (m.heavyAttackDmgPct) lines.push({ key: 'heavyDmg', label: 'Heavy Attack', value: '+' + m.heavyAttackDmgPct + '%' });
    if (m.multiHitDmgPct) lines.push({ key: 'multiHitDmg', label: 'Multi-hit', value: '+' + m.multiHitDmgPct + '%' });
    if (m.critDamageBonusPct) lines.push({ key: 'critDmg', label: 'Crit Damage', value: '+' + m.critDamageBonusPct + '%' });
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

  function rollTierFromDropWeights() {
    var p = pack();
    var dw = (p && p.dropWeights) || { white: 40, green: 24, blue: 16, purple: 10, gold: 6, orange: 4 };
    var tiers = ALL_TIERS.slice();
    var weights = tiers.map(function (t) { return Math.max(0, Number(dw[t]) || 0); });
    return chanceWeighted(tiers, weights);
  }

  function countPlayerEquippedMutations(player) {
    ensurePlayerMutationState(player);
    var n = 0;
    var eq = player.equippedMutations;
    if (!eq) return 0;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        if (eq[slot][i]) n++;
      }
    }
    return n;
  }

  function getPlayerEquippedMutationTiers(player) {
    ensurePlayerMutationState(player);
    var tiers = [];
    var eq = player.equippedMutations;
    if (!eq) return tiers;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        var id = eq[slot][i];
        if (!id) continue;
        var item = getItem(id);
        if (item && item.tier) tiers.push(String(item.tier).toLowerCase());
      }
    }
    return tiers;
  }

  function rollEndlessEnemyMutations(player, opts) {
    opts = opts || {};
    var playerCount = countPlayerEquippedMutations(player);
    var count = Math.max(0, Math.min(11, playerCount));
    var playerTiers = getPlayerEquippedMutationTiers(player);
    var used = new Set();
    var ids = [];
    var enemyOpts = { filterForPlayer: false };
    for (var i = 0; i < count; i++) {
      var tier;
      if (playerTiers.length) {
        tier = playerTiers[i % playerTiers.length];
      } else {
        var ebFn = global.getEndlessNormalFightTier;
        var eb = opts.endlessBattle;
        tier = (typeof ebFn === 'function' && eb) ? ebFn(eb) : null;
        if (!tier) tier = rollTierFromDropWeights();
      }
      var drop = rollUniqueFromTier(tier, used, enemyOpts);
      if (drop && drop.id) ids.push(drop.id);
    }
    return ids;
  }

  function rollTierForContext(opts) {
    opts = opts || {};
    var stage = opts.stage || (globalThis.G && G.stage) || 1;
    var isBoss = !!opts.isBoss;
    var endless = !!(globalThis.G && G.endlessMode);
    if (isBoss && stage >= 20) return endless ? chanceWeighted(['purple', 'gold', 'orange'], [35, 40, 25]) : 'gold';
    if (isBoss) return stage >= 10 ? chanceWeighted(['blue', 'purple', 'gold'], [25, 45, 30]) : 'blue';
    if (stage >= 18) return chanceWeighted(['white', 'green', 'blue', 'purple', 'gold', 'orange'], [10, 15, 25, 25, 15, 10]);
    if (stage >= 15) return chanceWeighted(['white', 'green', 'blue', 'purple', 'gold'], [15, 25, 30, 20, 10]);
    if (stage >= 8) return chanceWeighted(['white', 'green', 'blue'], [30, 40, 30]);
    if (stage >= 4) return chanceWeighted(['white', 'green'], [50, 50]);
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
    var classId = opts.classId;
    if (classId == null && opts.filterForPlayer !== false && globalThis.G && G.player) {
      classId = getPlayerClassId(G.player);
    }
    if (opts.slot) {
      ids = ids.filter(function (id) { return pool[id].slot === opts.slot; });
    }
    if (opts.filterForPlayer !== false && classId != null) {
      ids = ids.filter(function (id) { return itemAllowedForPlayer(pool[id], classId); });
    }
    if (!ids.length) return null;
    return pool[ids[Math.floor(Math.random() * ids.length)]];
  }

  function buildRewardCard(item) {
    if (!item) return null;
    var tier = item.tier || 'white';
    var uiTier = tier === 'white' ? 'grey' : tier;
    var tierLabels = { grey: 'Common', green: 'Uncommon', blue: 'Rare', purple: 'Epic', gold: 'Legendary', orange: 'Ancestral' };
    var card = {
      id: item.id,
      tier: uiTier,
      tierLabel: tierLabels[uiTier] || 'Common',
      type: 'mutation',
      icon: SLOT_ICONS[item.slot] || '🧬',
      name: item.name,
      desc: formatMutationDesc(item),
      mutationItemId: item.id,
      slot: item.slot,
      classRequired: item.classRequired || null,
      apply: function (p) {
        if (typeof Avian.mutations.addToInventory === 'function') {
          Avian.mutations.addToInventory(p, item.id);
        }
      },
    };
    if (item.classRequired) card.classTag = String(item.classRequired);
    return card;
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

  function rollUniqueFromTier(tier, used, opts) {
    opts = opts || {};
    var attempts = 50;
    while (attempts-- > 0) {
      var drop = rollDrop(tier, opts);
      if (!drop) return null;
      if (used.has(drop.id)) continue;
      used.add(drop.id);
      return drop;
    }
    var fallback = rollDrop(tier, opts);
    if (fallback) used.add(fallback.id);
    return fallback;
  }

  function rollMutationShopTier(stage) {
    stage = Math.max(1, Number(stage) || 1);
    if (stage >= 18) return chanceWeighted(['white', 'green', 'blue', 'purple', 'gold', 'orange'], [10, 15, 25, 25, 15, 10]);
    if (stage >= 15) return chanceWeighted(['white', 'green', 'blue', 'purple', 'gold'], [15, 25, 30, 20, 10]);
    if (stage >= 8) return chanceWeighted(['white', 'green', 'blue'], [30, 40, 30]);
    if (stage >= 4) return chanceWeighted(['white', 'green'], [50, 50]);
    return 'white';
  }

  function rollMutationStock(count, stage, used, opts) {
    used = used || new Set();
    opts = Object.assign({ filterForPlayer: true }, opts || {});
    var offers = [];
    var fallbackTiers = ALL_TIERS.slice();
    for (var i = 0; i < count; i++) {
      var tier = rollMutationShopTier(stage);
      var picked = rollUniqueFromTier(tier, used, opts);
      if (!picked) {
        for (var j = 0; j < fallbackTiers.length; j++) {
          picked = rollUniqueFromTier(fallbackTiers[j], used, opts);
          if (picked) break;
        }
      }
      if (!picked) continue;
      var offer = toShopOffer(picked);
      if (offer) {
        offer.shopCategory = 'mutation';
        offers.push(offer);
      }
    }
    return offers;
  }

  function rollShopMutations(spec, used, opts) {
    used = used || new Set();
    opts = Object.assign({ filterForPlayer: true }, opts || {});
    var offers = [];
    if (!spec) return offers;
    if (spec.tiers && spec.count) {
      for (var i = 0; i < spec.count; i++) {
        var tier = spec.tiers[Math.floor(Math.random() * spec.tiers.length)];
        var picked = rollUniqueFromTier(tier, used, opts);
        if (picked) offers.push(toShopOffer(picked));
      }
      return offers;
    }
    for (var tierKey in spec) {
      if (tierKey === 'tiers' || tierKey === 'count') continue;
      var n = spec[tierKey];
      for (var j = 0; j < n; j++) {
        var item = rollUniqueFromTier(tierKey, used, opts);
        if (item) offers.push(toShopOffer(item));
      }
    }
    return offers;
  }

  function rollMutationReward(opts) {
    opts = Object.assign({ filterForPlayer: true }, opts || {});
    var tier = opts.tier || rollTierForContext(opts);
    var item = rollDrop(tier, opts);
    return buildRewardCard(item);
  }

  function rollMutationRewardFromDropWeights(opts) {
    opts = Object.assign({ filterForPlayer: true }, opts || {});
    var tier = rollTierFromDropWeights();
    var item = rollDrop(tier, opts);
    return buildRewardCard(item);
  }

  mutations.getPlayerClassId = getPlayerClassId;
  mutations.itemAllowedForPlayer = itemAllowedForPlayer;
  mutations.canPlayerEquipItem = canPlayerEquipItem;
  mutations.ALL_TIERS = ALL_TIERS;
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
  mutations.sumMutationIds = sumMutationIds;
  mutations.rollEnemyMutations = rollEnemyMutations;
  mutations.rollEnemyMutationsFromForgeSlot = rollEnemyMutationsFromForgeSlot;
  mutations.rollTierFromBand = rollTierFromBand;
  mutations.applyMutationsToEntity = applyMutationsToEntity;
  mutations.reapplyPlayerStatsFromSources = reapplyPlayerStatsFromSources;
  mutations.rollDrop = rollDrop;
  mutations.rollTierForContext = rollTierForContext;
  mutations.rollMutationReward = rollMutationReward;
  mutations.rollMutationRewardFromDropWeights = rollMutationRewardFromDropWeights;
  mutations.rollTierFromDropWeights = rollTierFromDropWeights;
  mutations.countPlayerEquippedMutations = countPlayerEquippedMutations;
  mutations.rollEndlessEnemyMutations = rollEndlessEnemyMutations;
  mutations.buildRewardCard = buildRewardCard;
  mutations.toShopOffer = toShopOffer;
  mutations.reconstructShopOffer = reconstructShopOffer;
  mutations.rollShopMutations = rollShopMutations;
  mutations.rollMutationStock = rollMutationStock;
  mutations.formatMutationDesc = formatMutationDesc;
  mutations.buildMutationStatLines = buildMutationStatLines;
  mutations.getMutationStatNumericMap = getMutationStatNumericMap;
  mutations.formatMutationDescHtml = formatMutationDescHtml;
  mutations.formatMutationStatCompactHtml = formatMutationStatCompactHtml;
  mutations.buildMutationCompareLines = buildMutationCompareLines;
  mutations.formatMutationCompareHtml = formatMutationCompareHtml;
  mutations.getEquipTargetSlotIndex = getEquipTargetSlotIndex;
  mutations.getCompareBaselineId = getCompareBaselineId;
  mutations.formatSlotTag = formatSlotTag;
  mutations.SLOT_LABELS = SLOT_LABELS;
  mutations.SLOT_ICONS = SLOT_ICONS;
  mutations.TIER_ICONS = TIER_ICONS;
  mutations.MUTATION_SHOP_COSTS = MUTATION_SHOP_COSTS;

  Avian.mutations = mutations;
  Avian.systems.mutations = mutations;
})();
