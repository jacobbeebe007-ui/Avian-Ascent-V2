/* Avian Ascent — Equipment v0.3 bonus / unique / tradeoff runtime (Phases 4a/4b)
 *
 * Mirrors mutation-effects hook surface; tier engine uses effectTiers (10/25/50).
 * Gated by Avian.flags.equipmentV2.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.equipmentEffects = Object.create(null);
  var G = function () { return globalThis.G; };

  function isEquipmentV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function state() {
    var g = G();
    if (!g) return null;
    if (!g._equipmentEffectState) {
      g._equipmentEffectState = {
        turn: 0,
        activeTierEffects: Object.create(null),
        pendingAttackBonus: Object.create(null),
        pendingFlags: Object.create(null),
      };
    }
    return g._equipmentEffectState;
  }

  function resetBattleState() {
    var g = G();
    if (g) g._equipmentEffectState = null;
  }

  function tierMagnitude(tier, dir) {
    var tiers = Avian.data && Avian.data.effectTiers;
    var bucket = dir === 'down' ? 'debuff' : 'buff';
    var map = tiers && tiers[bucket];
    var t = String(tier || 'minor').toLowerCase();
    if (map && map[t] != null) return Number(map[t]);
    var cfg = Avian.data && Avian.data.combatConfig;
    if (cfg && cfg.effectTiers && cfg.effectTiers[t] != null) return Number(cfg.effectTiers[t]);
    return t === 'major' ? 50 : (t === 'moderate' ? 25 : 10);
  }

  function tierRank(tier) {
    var t = String(tier || 'minor').toLowerCase();
    if (t === 'major') return 3;
    if (t === 'moderate') return 2;
    return 1;
  }

  function ledgerStatKey(stat) {
    var s = String(stat || '').toLowerCase();
    if (s === 'physicaldamage') return 'physDamagePct';
    if (s === 'magicdamage') return 'magicDamagePct';
    if (s === 'aspectdamage') return 'aspectDamagePct';
    if (s === 'critdamage') return 'critDamagePct';
    if (s === 'critchance') return 'critChance';
    if (s === 'healingpower') return 'healingPowerPct';
    if (s === 'shieldstrength') return 'shieldStrengthPct';
    if (s === 'dodge') return 'dodge';
    if (s === 'acc') return 'acc';
    return s;
  }

  function applyLoan(side, entity, statKey, sourceId, value, turns, pctMode) {
    var status = side === 'enemy' ? (G() && G().enemyStatus) : (G() && G().playerStatus);
    if (!entity || !entity.stats || !status) return false;
    var bag = '_equipmentEffectLoans';
    if (pctMode) {
      if (typeof globalThis.applySourceStatLoanPct === 'function') {
        globalThis.applySourceStatLoanPct(status, entity, bag, statKey, sourceId, value, turns || 1);
        return true;
      }
    } else if (typeof globalThis.applySourceStatLoan === 'function') {
      globalThis.applySourceStatLoan(status, entity, bag, statKey, sourceId, value, turns || 1);
      return true;
    }
    return false;
  }

  /** Strongest-applies tier effect on a stat; reapply refreshes duration. Exported for tests. */
  ns.applyTierEffect = function applyTierEffect(battleState, side, stat, tier, dir, sourceId, turnsOptional) {
    battleState = battleState || state();
    if (!battleState) return { applied: false, magnitude: 0 };
    var turns = Math.max(1, Number(turnsOptional) || 1);
    var magnitude = tierMagnitude(tier, dir);
    var key = ledgerStatKey(stat) + ':' + String(dir || 'up');
    var active = battleState.activeTierEffects[key];
    if (active && active.magnitude > magnitude) {
      return { applied: false, magnitude: active.magnitude, reason: 'weaker_blocked' };
    }
    battleState.activeTierEffects[key] = {
      stat: stat,
      tier: tier,
      dir: dir,
      magnitude: magnitude,
      turns: turns,
      sourceId: sourceId,
      rank: tierRank(tier),
    };
    var entity = side === 'enemy' ? (G() && G().enemy) : (G() && G().player);
    var signed = dir === 'down' ? -magnitude : magnitude;
    var pctStats = {
      physDamagePct: true, magicDamagePct: true, aspectDamagePct: true,
      critDamagePct: true, healingPowerPct: true, shieldStrengthPct: true,
      atk: true, matk: true, def: true, mdef: true, spd: true, dodge: true, acc: true, critChance: true,
    };
    var statKey = ledgerStatKey(stat);
    var applied = false;
    if (pctStats[statKey]) {
      applied = applyLoan(side, entity, statKey, sourceId || ('tier:' + key), signed, turns, true);
    }
    return { applied: applied, magnitude: magnitude };
  };

  function collectEquippedItems(player) {
    var list = [];
    if (!player || !player.equipment) return list;
    var order = (typeof Avian.equipment !== 'undefined' && typeof Avian.equipment.getSlotOrder === 'function')
      ? Avian.equipment.getSlotOrder()
      : ['helmet', 'armour', 'mainHand', 'offHand', 'shield', 'ankletL', 'ankletR', 'necklace'];
    for (var i = 0; i < order.length; i++) {
      var id = player.equipment[order[i]];
      if (!id) continue;
      var item = typeof Avian.equipment !== 'undefined' && typeof Avian.equipment.getItem === 'function'
        ? Avian.equipment.getItem(id) : null;
      if (!item && Avian.data && Avian.data.equipment && Avian.data.equipment.items) {
        item = Avian.data.equipment.items[id] || null;
      }
      if (item) list.push(item);
    }
    return list;
  }

  function effectEntriesFromItem(item) {
    var out = [];
    if (!item) return out;
    var pushEntry = function (entry, kind) {
      if (!entry) return;
      if (Array.isArray(entry)) {
        entry.forEach(function (e) { pushEntry(e, kind); });
        return;
      }
      if (typeof entry === 'string') {
        out.push({ kind: kind, text: entry, parsed: null });
        return;
      }
      if (typeof entry === 'object') {
        out.push({
          kind: kind,
          text: entry.text || '',
          parsed: entry.parsed || null,
          id: entry.id || null,
        });
      }
    };
    pushEntry(item.bonuses, 'bonus');
    pushEntry(item.uniqueEffect, 'unique');
    pushEntry(item.tradeoff, 'tradeoff');
    return out;
  }

  function applyParsedEffects(parsed, sourceId, side, defaultTurns) {
    if (!parsed || !Array.isArray(parsed.effects)) return 0;
    var st = state();
    var applied = 0;
    for (var i = 0; i < parsed.effects.length; i++) {
      var eff = parsed.effects[i];
      if (!eff || eff.kind !== 'tierStat') continue;
      var turns = defaultTurns || 1;
      if (parsed.duration && parsed.duration.kind === 'turns') turns = parsed.duration.turns || turns;
      var res = ns.applyTierEffect(st, side, eff.stat, eff.tier, eff.dir, sourceId + ':parsed', turns);
      if (res.applied) applied++;
    }
    return applied;
  }

  function applyEffectEntry(entry, item, hook) {
    if (!entry) return;
    var sourceId = (item && item.id) || 'equipment';
    if (entry.parsed && entry.parsed.effects && entry.parsed.effects.length) {
      applyParsedEffects(entry.parsed, sourceId, 'player', 1);
      return;
    }
    if (entry.parsed === null && entry.text) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[equipment-effects] unparsed effect noop:', hook, entry.text.slice(0, 80));
      }
    }
  }

  function forEachEquippedEffect(player, hook, filterKind) {
    var items = collectEquippedItems(player);
    for (var i = 0; i < items.length; i++) {
      var entries = effectEntriesFromItem(items[i]);
      for (var j = 0; j < entries.length; j++) {
        if (filterKind && entries[j].kind !== filterKind) continue;
        applyEffectEntry(entries[j], items[i], hook);
      }
    }
  }

  ns.onBattleStart = function onBattleStart(player) {
    if (!isEquipmentV2()) return;
    resetBattleState();
    var st = state();
    if (!st) return;
    forEachEquippedEffect(player, 'onBattleStart');
  };

  ns.onPlayerTurnStart = function onPlayerTurnStart() {
    if (!isEquipmentV2()) return;
    var st = state();
    if (st) st.turn += 1;
  };

  ns.onAfterPlayerAttack = function onAfterPlayerAttack(ctx) {
    if (!isEquipmentV2()) return;
    ctx = ctx || {};
    var st = state();
    if (!st) return;
    var pending = st.pendingAttackBonus || {};
    if (ctx.attackWeight && pending[ctx.attackWeight]) {
      delete pending[ctx.attackWeight];
    }
  };

  ns.onAfterEnemyAttack = function onAfterEnemyAttack() {
    if (!isEquipmentV2()) return;
  };

  ns.onPlayerDodge = function onPlayerDodge() {
    if (!isEquipmentV2()) return;
  };

  ns.onPlayerCrit = function onPlayerCrit() {
    if (!isEquipmentV2()) return;
  };

  ns.onPlayerGuard = function onPlayerGuard() {
    if (!isEquipmentV2()) return;
  };

  ns.onUtilityUsed = function onUtilityUsed() {
    if (!isEquipmentV2()) return;
  };

  ns.onSongOrCall = function onSongOrCall() {
    if (!isEquipmentV2()) return;
  };

  ns.onAilmentApplied = function onAilmentApplied() {
    if (!isEquipmentV2()) return;
  };

  ns.onHeal = function onHeal() {
    if (!isEquipmentV2()) return;
  };

  ns.onPurge = function onPurge() {
    if (!isEquipmentV2()) return;
  };

  ns.onBloodiedSelf = function onBloodiedSelf() {
    if (!isEquipmentV2()) return;
  };

  ns.getOutgoingDamageBonusFractions = function getOutgoingDamageBonusFractions() {
    return [];
  };

  ns.getLifestealPct = function getLifestealPct() {
    return 0;
  };

  ns.getHeavyAccPenaltyReduction = function getHeavyAccPenaltyReduction() {
    return 0;
  };

  ns.getUltimateMeterMultiplier = function getUltimateMeterMultiplier() {
    return 1;
  };

  ns.getHealingDoneMultiplier = function getHealingDoneMultiplier() {
    return 1;
  };

  ns.getHealingReceivedMultiplier = function getHealingReceivedMultiplier() {
    return 1;
  };

  ns.getStatusResistPct = function getStatusResistPct() {
    return 0;
  };

  ns.resetBattleState = resetBattleState;
  ns.tierMagnitude = tierMagnitude;
  ns.collectEquippedItems = collectEquippedItems;

  Avian.systems.equipmentEffects = ns;
})();
