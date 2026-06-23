/* Avian Ascent — Mutation gear bonus & set effect runtime */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.mutationEffects = Object.create(null);
  var G = function () { return globalThis.G; };

  function state() {
    var g = G();
    if (!g) return null;
    if (!g._mutationEffectState) {
      g._mutationEffectState = {
        turn: 0,
        playerActions: 0,
        magicUses: 0,
        physUses: 0,
        altPhysMagic: 'phys',
        bloodiedShieldUsed: false,
        firstDodgeMeterUsed: false,
        firstSongMarkedUsed: false,
        pendingAttackBonus: Object.create(null),
        pendingFlags: Object.create(null),
        setCounts: Object.create(null),
        setActive: Object.create(null),
      };
    }
    return g._mutationEffectState;
  }

  function resetBattleState() {
    var g = G();
    if (g) g._mutationEffectState = null;
  }

  function getSetsCatalog() {
    return (Avian.data && Avian.data.mutations && Avian.data.mutations.sets) || Object.create(null);
  }

  function setNameToId(name) {
    if (!name) return '';
    return String(name).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }

  function getActiveSets(player) {
    var out = Object.create(null);
    if (!player || !player.equippedMutations) return out;
    var eq = player.equippedMutations;
    for (var slot in eq) {
      if (!Array.isArray(eq[slot])) continue;
      for (var i = 0; i < eq[slot].length; i++) {
        var id = eq[slot][i];
        if (!id || typeof Avian.mutations.getItem !== 'function') continue;
        var item = Avian.mutations.getItem(id);
        if (!item || !item.setName) continue;
        var sid = setNameToId(item.setName);
        out[sid] = (out[sid] || 0) + 1;
      }
    }
    return out;
  }

  function setActiveThreshold(count, setDef) {
    if (!setDef || !Array.isArray(setDef.thresholds) || !setDef.thresholds.length) {
      if (count >= 6) return 6;
      if (count >= 4) return 4;
      if (count >= 2) return 2;
      return 0;
    }
    var active = 0;
    for (var ti = 0; ti < setDef.thresholds.length; ti++) {
      if (count >= setDef.thresholds[ti]) active = setDef.thresholds[ti];
    }
    return active;
  }

  function playerHpAboveHalf() {
    var p = G() && G().player;
    if (!p || !p.stats) return false;
    var maxHp = Number(p.stats.maxHp) || 1;
    return (Number(p.stats.hp) || 0) > maxHp * 0.5;
  }

  function parseBackendPct(raw, fallback) {
    var m = String(raw || '').match(/(\d+(?:\.\d+)?)\s*%/);
    return m ? Number(m[1]) : (fallback || 0);
  }

  function parseBackendDodge(raw, fallback) {
    var m = String(raw || '').match(/([+-]?\d+(?:\.\d+)?)\s*dodge/i);
    return m ? Number(m[1]) : (fallback || 0);
  }

  function applyStatDownFromBonus(target, statKey, val) {
    var entity = target === 'enemy' ? G().enemy : G().player;
    if (!entity || !entity.stats) return;
    var down = Math.abs(Number(val) || 6);
    if (statKey === 'damage') return applyMinorDamageDown(target);
    if (statKey === 'atk') entity.stats.atk = Math.max(0, (Number(entity.stats.atk) || 0) - down);
    else if (statKey === 'matk') entity.stats.matk = Math.max(0, (Number(entity.stats.matk) || 0) - down);
    else if (statKey === 'def') entity.stats.def = Math.max(0, (Number(entity.stats.def) || 0) - down);
    else if (statKey === 'mdef') entity.stats.mdef = Math.max(0, (Number(entity.stats.mdef) || 0) - down);
    else if (statKey === 'spd') entity.stats.spd = Math.max(0, (Number(entity.stats.spd) || 0) - down);
    else if (statKey === 'dodge') entity.stats.dodge = Math.max(0, (Number(entity.stats.dodge) || 0) - down);
  }

  function applyWorkbookBattleStartBonuses(player, bonuses) {
    var minorShield = maxBonusValue(bonuses, 'minor_shield');
    var majorShield = maxBonusValue(bonuses, 'major_shield');
    if (minorShield || majorShield) applyMinorShield('player', majorShield || minorShield || 6);

    var dodgeDownTotal = 0;
    for (var i = 0; i < bonuses.length; i++) {
      var bid = bonuses[i].id || '';
      if (bid === 'minor_dodge_down' || bid === 'apply_minor_dodge_down') dodgeDownTotal += Number(bonuses[i].value) || -3;
      if (bid === 'major_dodge_down' || bid === 'apply_major_dodge_down') dodgeDownTotal += Number(bonuses[i].value) || -5;
    }
    if (dodgeDownTotal && player && player.stats) {
      player.stats.dodge = Math.max(0, (Number(player.stats.dodge) || 0) + dodgeDownTotal);
    }
  }

  function processGenericOnHitBonuses(bonuses) {
    for (var i = 0; i < bonuses.length; i++) {
      var id = bonuses[i].id || '';
      var m = id.match(/^apply_(?:minor|major|grand|epic|legendary|crippling|ruinous|fatal)_(.+)_down$/);
      if (!m) continue;
      var stat = m[1];
      if (stat === 'dodge') continue;
      if (stat === 'damage') applyMinorDamageDown('enemy');
      else applyStatDownFromBonus('enemy', stat, bonuses[i].value);
    }
  }

  function collectBonuses(player) {
    var list = [];
    if (!player) return list;
    if (typeof Avian.mutations.getMechanicsRollup === 'function') {
      var mech = Avian.mutations.getMechanicsRollup(player);
      if (mech && Array.isArray(mech.itemBonuses)) {
        for (var i = 0; i < mech.itemBonuses.length; i++) list.push(mech.itemBonuses[i]);
      }
    }
    return list;
  }

  var BONUS_ID_GROUPS = {
    start_battle_minor_shield: ['start_battle_minor_shield', 'battle_start_shield'],
    opening_agility_minor_spd_up: ['opening_agility_minor_spd_up', 'first_turn_spd_up'],
    after_defend_next_physical_up: ['after_defend_next_physical_up', 'after_defend_physical_pierce'],
    after_dodge_next_light_up: ['after_dodge_next_light_up', 'after_dodge_dodge_up'],
    opening_focus_minor_acc_up: ['opening_focus_minor_acc_up', 'opening_crit_chance_up'],
    bloodied_self_minor_mdef_up: ['bloodied_self_minor_mdef_up', 'bloodied_mdef_up'],
    bloodied_self_shield: ['bloodied_self_shield', 'critical_hit_shield'],
    vs_marked_lifesteal: ['vs_marked_lifesteal', 'next_hit_lifesteal', 'low_hp_lifesteal'],
    on_heal_minor_shield: ['on_heal_minor_shield', 'critical_hit_shield'],
    guarded_step_minor_dodge_up: ['guarded_step_minor_dodge_up', 'movement_skill_dodge_up'],
    magic_after_utility_up: ['magic_after_utility_up', 'after_spell_magic_pierce', 'song_skill_matk_up'],
    first_utility_minor_meter_up: ['first_utility_minor_meter_up', 'defensive_turn_healing_received'],
  };

  function bonusIdVariants(id) {
    var out = [id];
    if (BONUS_ID_GROUPS[id]) return BONUS_ID_GROUPS[id].slice();
    for (var key in BONUS_ID_GROUPS) {
      if (BONUS_ID_GROUPS[key].indexOf(id) >= 0) {
        out = BONUS_ID_GROUPS[key].slice();
        break;
      }
    }
    return out;
  }

  function hasBonusId(bonuses, id) {
    var ids = bonusIdVariants(id);
    for (var i = 0; i < bonuses.length; i++) {
      if (ids.indexOf(bonuses[i].id) >= 0) return bonuses[i];
    }
    return null;
  }

  function sumBonusValue(bonuses, id) {
    var ids = bonusIdVariants(id);
    var total = 0;
    for (var i = 0; i < bonuses.length; i++) {
      if (ids.indexOf(bonuses[i].id) >= 0) total += Number(bonuses[i].value) || 0;
    }
    return total;
  }

  function maxBonusValue(bonuses, id) {
    var ids = bonusIdVariants(id);
    var best = 0;
    for (var i = 0; i < bonuses.length; i++) {
      if (ids.indexOf(bonuses[i].id) >= 0) best = Math.max(best, Number(bonuses[i].value) || 0);
    }
    return best;
  }

  function applyShieldFromBonusTier(val) {
    applyMinorShield('player', Math.max(8, Number(val) || 12));
  }

  function applyDodgeFromBonusTier(val) {
    applyMinorDodgeUp('player');
    if (G().player && G().player.stats && val > 6) {
      G().player.stats.dodge = (Number(G().player.stats.dodge) || 0) + Math.floor((Number(val) - 6) / 2);
    }
  }

  function tryBonusAilment(ailId, chancePct) {
    if (!ailId || !chancePct || !G().enemy) return;
    if (typeof globalThis.chance === 'function' && globalThis.chance(Math.min(95, Number(chancePct) || 0))) {
      if (typeof globalThis.applyAilment === 'function') globalThis.applyAilment('enemy', ailId, 1);
    }
  }

  function applyMinorShield(side, pctOptional) {
    if (typeof globalThis.applyGuardedBuff !== 'function') return;
    var pct = Math.max(8, Number(pctOptional) || 12);
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    if (mech && mech.shieldPowerPct) pct = Math.round(pct * (1 + mech.shieldPowerPct / 100));
    globalThis.applyGuardedBuff(side || 'player', { physReducPct: pct, turns: 2, sourceAbilityId: 'mutation_shield' });
  }

  function applyMinorAccDown(target) {
    var status = target === 'enemy' ? G().enemyStatus : G().playerStatus;
    if (!status) return;
    status.accDown = (status.accDown || 0) + 8;
  }

  function applyMinorDefDown(target) {
    var entity = target === 'enemy' ? G().enemy : G().player;
    if (!entity || !entity.stats) return;
    entity.stats.def = Math.max(0, (Number(entity.stats.def) || 0) - 3);
  }

  function applyMinorSpdDown(target) {
    var entity = target === 'enemy' ? G().enemy : G().player;
    if (!entity || !entity.stats) return;
    entity.stats.spd = Math.max(0, (Number(entity.stats.spd) || 0) - 3);
  }

  function applyMinorMdefDown(target) {
    var entity = target === 'enemy' ? G().enemy : G().player;
    if (!entity || !entity.stats) return;
    entity.stats.mdef = Math.max(0, (Number(entity.stats.mdef) || 0) - 3);
  }

  function applyMinorDodgeUp(side) {
    var entity = side === 'player' ? G().player : G().enemy;
    if (!entity || !entity.stats) return;
    entity.stats.dodge = (Number(entity.stats.dodge) || 0) + 6;
  }

  function applyMinorAccUp(side) {
    var entity = side === 'player' ? G().player : G().enemy;
    if (!entity || !entity.stats) return;
    entity.stats.acc = (Number(entity.stats.acc) || 0) + 6;
  }

  function applyMinorDamageDown(target) {
    var status = target === 'enemy' ? G().enemyStatus : G().playerStatus;
    if (!status) return;
    status.damageDown = (status.damageDown || 0) + 8;
  }

  function enemyHasAilmentOrMarked() {
    var es = G() && G().enemyStatus;
    if (!es) return false;
    if (es.marked) return true;
    return !!(es.poison || es.bleed || es.burning || es.chilled || es.weaken || es.paralyzed);
  }

  function enemyIsMarked() {
    return !!(G() && G().enemyStatus && G().enemyStatus.marked);
  }

  function refreshSetState(player) {
    var st = state();
    if (!st) return;
    var counts = getActiveSets(player);
    st.setCounts = counts;
    st.setActive = Object.create(null);
    var catalog = getSetsCatalog();
    for (var sid in counts) {
      var setDef = catalog[sid];
      st.setActive[sid] = setActiveThreshold(counts[sid], setDef);
      if (setDef) st.setActive[sid + '_def'] = setDef;
    }
  }

  function applySetBattleStart(player) {
    refreshSetState(player);
    var st = state();
    if (!st) return;
    var p = player || (G() && G().player);
    if (!p || !p.stats) return;
    var catalog = getSetsCatalog();

    if (st.setActive.dragonbone_guard >= 4) {
      var dgDef = catalog.dragonbone_guard && catalog.dragonbone_guard.bonuses && catalog.dragonbone_guard.bonuses[4];
      var defPct = parseBackendPct(dgDef && dgDef.backend, 18);
      if (defPct > 0) {
        p.stats.def = Math.round((Number(p.stats.def) || 0) * (1 + defPct / 100));
      }
    }

    if (st.setActive.thornbound_aerie >= 2 && playerHpAboveHalf()) {
      var taDef = catalog.thornbound_aerie && catalog.thornbound_aerie.bonuses && catalog.thornbound_aerie.bonuses[2];
      var dodgeBonus = parseBackendDodge(taDef && taDef.backend, 8);
      if (dodgeBonus > 0) p.stats.dodge = (Number(p.stats.dodge) || 0) + dodgeBonus;
    }
  }

  ns.onBattleStart = function onBattleStart(player) {
    resetBattleState();
    refreshSetState(player);
    var st = state();
    if (!st) return;
    applySetBattleStart(player);
    var bonuses = collectBonuses(player);
    applyWorkbookBattleStartBonuses(player, bonuses);
    if (hasBonusId(bonuses, 'start_battle_minor_shield') || hasBonusId(bonuses, 'opening_guard_minor_def_up')) {
      var shieldVal = maxBonusValue(bonuses, 'start_battle_minor_shield') || maxBonusValue(bonuses, 'battle_start_shield');
      applyShieldFromBonusTier(shieldVal || 12);
    }
    if (hasBonusId(bonuses, 'opening_focus_minor_acc_up')) applyMinorAccUp('player');
    if (hasBonusId(bonuses, 'guarded_step_minor_dodge_up')) applyMinorDodgeUp('player');
  };

  ns.onPlayerTurnStart = function onPlayerTurnStart() {
    var st = state();
    if (st) st.turn += 1;
    if (st && st.turn === 1) {
      var bonuses = collectBonuses(G() && G().player);
      if ((hasBonusId(bonuses, 'first_turn_spd_up') || hasBonusId(bonuses, 'opening_agility_minor_spd_up')) && G().player && G().player.stats) {
        var spdVal = maxBonusValue(bonuses, 'first_turn_spd_up') || maxBonusValue(bonuses, 'opening_agility_minor_spd_up');
        G().player.stats.spd = (Number(G().player.stats.spd) || 0) + Math.max(3, Math.round((spdVal || 6) * 0.67));
      }
      if (hasBonusId(bonuses, 'opening_crit_chance_up') && G().player && G().player.stats) {
        G().player.stats.critChance = (Number(G().player.stats.critChance) || 0) + maxBonusValue(bonuses, 'opening_crit_chance_up');
      }
    }
    if (st && st.setActive && st.setActive.thornbound_aerie >= 2 && G().player && G().player.stats) {
      if (playerHpAboveHalf()) {
        if (!st._thornboundDodgeApplied) {
          st._thornboundDodgeApplied = true;
          var taDef = getSetsCatalog().thornbound_aerie;
          var bonus = taDef && taDef.bonuses && taDef.bonuses[2];
          var dodgeBonus = parseBackendDodge(bonus && bonus.backend, 8);
          if (dodgeBonus > 0) G().player.stats.dodge = (Number(G().player.stats.dodge) || 0) + dodgeBonus;
        }
      } else if (st._thornboundDodgeApplied) {
        var taDef2 = getSetsCatalog().thornbound_aerie;
        var bonus2 = taDef2 && taDef2.bonuses && taDef2.bonuses[2];
        var dodgeRemove = parseBackendDodge(bonus2 && bonus2.backend, 8);
        if (dodgeRemove > 0) G().player.stats.dodge = Math.max(0, (Number(G().player.stats.dodge) || 0) - dodgeRemove);
        st._thornboundDodgeApplied = false;
      }
    }
  };

  ns.getOutgoingDamageBonusFractions = function getOutgoingDamageBonusFractions(ctx) {
    ctx = ctx || {};
    var fractions = [];
    var bonuses = collectBonuses(G() && G().player);
    var st = state();
    var weight = ctx.attackWeight;
    var isMagic = !!ctx.isMagic;
    var pending = st && st.pendingAttackBonus ? st.pendingAttackBonus : null;

    function consumePending(key) {
      if (!pending || !pending[key]) return 0;
      var v = pending[key];
      delete pending[key];
      return v / 100;
    }

    if (weight === 'light') {
      fractions.push(consumePending('light'));
      var fl = sumBonusValue(bonuses, 'first_light_attack_bonus');
      if (fl && st && !st.pendingFlags.firstLightUsed) {
        st.pendingFlags.firstLightUsed = true;
        fractions.push(fl / 100);
      }
    }
    if (weight === 'medium') {
      fractions.push(consumePending('medium'));
      var fm = sumBonusValue(bonuses, 'first_medium_attack_bonus');
      if (fm && st && !st.pendingFlags.firstMediumUsed) {
        st.pendingFlags.firstMediumUsed = true;
        fractions.push(fm / 100);
      }
    }
    if (weight === 'heavy') {
      fractions.push(consumePending('heavy'));
      var fh = sumBonusValue(bonuses, 'first_heavy_attack_bonus');
      if (fh && st && !st.pendingFlags.firstHeavyUsed) {
        st.pendingFlags.firstHeavyUsed = true;
        fractions.push(fh / 100);
      }
    }

    if (isMagic && sumBonusValue(bonuses, 'first_magic_ability_bonus') && st && !st.pendingFlags.firstMagicUsed) {
      st.pendingFlags.firstMagicUsed = true;
      fractions.push(sumBonusValue(bonuses, 'first_magic_ability_bonus') / 100);
    }

    if (ctx.afterDefend && sumBonusValue(bonuses, 'after_defend_next_physical_up')) {
      fractions.push(sumBonusValue(bonuses, 'after_defend_next_physical_up') / 100);
    }
    if (ctx.afterDodge && weight === 'light' && sumBonusValue(bonuses, 'after_dodge_next_light_up')) {
      fractions.push(sumBonusValue(bonuses, 'after_dodge_next_light_up') / 100);
    }
    if (ctx.afterUtility && isMagic && sumBonusValue(bonuses, 'magic_after_utility_up')) {
      fractions.push(sumBonusValue(bonuses, 'magic_after_utility_up') / 100);
    }
    if (enemyHasAilmentOrMarked() && sumBonusValue(bonuses, 'vs_ailmented_damage_up')) {
      fractions.push(sumBonusValue(bonuses, 'vs_ailmented_damage_up') / 100);
    }
    if (enemyIsMarked() && sumBonusValue(bonuses, 'marked_target_crit_up') && ctx.isCrit) {
      fractions.push(sumBonusValue(bonuses, 'marked_target_crit_up') / 100);
    }
    if (typeof globalThis.isBloodiedTarget === 'function' && G().enemy && globalThis.isBloodiedTarget(G().enemy)) {
      if (sumBonusValue(bonuses, 'bloodied_enemy_execute_up')) {
        fractions.push(sumBonusValue(bonuses, 'bloodied_enemy_execute_up') / 100);
      }
    }

    return fractions.filter(function (f) { return f > 0; });
  };

  ns.onAfterPlayerAttack = function onAfterPlayerAttack(ctx) {
    ctx = ctx || {};
    var st = state();
    if (!st) return;
    var isMagic = !!ctx.isMagic;
    var weight = ctx.attackWeight;
    var bonuses = collectBonuses(G() && G().player);
    if (isMagic) st.magicUses += 1;
    else st.physUses += 1;
    st.altPhysMagic = isMagic ? 'magic' : 'phys';

    if (isMagic && sumBonusValue(bonuses, 'after_spell_magic_pierce') && G().player && G().player.stats) {
      G().player.stats.magicPen = (Number(G().player.stats.magicPen) || 0) + sumBonusValue(bonuses, 'after_spell_magic_pierce');
    }
    if (weight === 'light' && sumBonusValue(bonuses, 'light_attack_poison_chance')) {
      tryBonusAilment('poison', sumBonusValue(bonuses, 'light_attack_poison_chance'));
    }
    if (weight === 'heavy' && sumBonusValue(bonuses, 'heavy_attack_bleed_chance')) {
      tryBonusAilment('bleed', sumBonusValue(bonuses, 'heavy_attack_bleed_chance'));
    }
    if (isMagic && sumBonusValue(bonuses, 'magic_hit_chilled_chance')) {
      tryBonusAilment('chilled', sumBonusValue(bonuses, 'magic_hit_chilled_chance'));
    }
    if (!isMagic && sumBonusValue(bonuses, 'physical_hit_weaken_chance')) {
      tryBonusAilment('weaken', sumBonusValue(bonuses, 'physical_hit_weaken_chance'));
    }
    if (sumBonusValue(bonuses, 'next_hit_lifesteal')) {
      G().player._mutationNextHitLifesteal = Math.max(G().player._mutationNextHitLifesteal || 0, sumBonusValue(bonuses, 'next_hit_lifesteal'));
    }

    processGenericOnHitBonuses(bonuses);

    if (st && st.setActive && st.setActive.embermarked_choir >= 3) {
      var ecDef = getSetsCatalog().embermarked_choir;
      var ecBonus = ecDef && ecDef.bonuses && ecDef.bonuses[3];
      var burnChance = parseBackendPct(ecBonus && ecBonus.backend, 20);
      if (burnChance > 0) tryBonusAilment('burning', burnChance);
    }
  };

  ns.onPlayerDodge = function onPlayerDodge() {
    var st = state();
    var bonuses = collectBonuses(G() && G().player);
    if (sumBonusValue(bonuses, 'after_dodge_next_light_up')) {
      st.pendingAttackBonus.light = (st.pendingAttackBonus.light || 0) + sumBonusValue(bonuses, 'after_dodge_next_light_up');
    }
    if (sumBonusValue(bonuses, 'after_dodge_dodge_up')) applyDodgeFromBonusTier(sumBonusValue(bonuses, 'after_dodge_dodge_up'));
  };

  ns.onPlayerCrit = function onPlayerCrit() {
    var bonuses = collectBonuses(G() && G().player);
    if (sumBonusValue(bonuses, 'on_crit_minor_acc_up')) applyMinorAccUp('player');
    if (sumBonusValue(bonuses, 'on_crit_minor_dodge_up')) applyMinorDodgeUp('player');
    if (sumBonusValue(bonuses, 'first_critical_minor_crit_damage_up') && G().player) {
      G().player._mutationCritDamageBonus = (G().player._mutationCritDamageBonus || 0) + sumBonusValue(bonuses, 'first_critical_minor_crit_damage_up') / 100;
    }
    if (sumBonusValue(bonuses, 'critical_hit_shield')) applyShieldFromBonusTier(sumBonusValue(bonuses, 'critical_hit_shield'));
  };

  ns.onPlayerGuard = function onPlayerGuard() {
    var st = state();
    var bonuses = collectBonuses(G() && G().player);
    if (sumBonusValue(bonuses, 'after_defend_next_physical_up')) {
      st.pendingFlags.afterDefend = true;
    }
    if (sumBonusValue(bonuses, 'after_defend_physical_pierce') && G().player && G().player.stats) {
      G().player.stats.armorPen = (Number(G().player.stats.armorPen) || 0) + sumBonusValue(bonuses, 'after_defend_physical_pierce');
    }
    if (sumBonusValue(bonuses, 'defensive_turn_healing_received') && G().player && G().player.stats) {
      var hr = sumBonusValue(bonuses, 'defensive_turn_healing_received');
      G().player._mutationHealingRecvBonus = (G().player._mutationHealingRecvBonus || 0) + hr;
    }
  };

  ns.onAilmentApplied = function onAilmentApplied(ailId, target) {
    if (target !== 'enemy') return;
    var bonuses = collectBonuses(G() && G().player);
    var st = state();
    if (sumBonusValue(bonuses, 'on_ailment_apply_minor_damage_down')) applyMinorDamageDown('enemy');
    if (ailId === 'burning' && sumBonusValue(bonuses, 'on_burn_apply_minor_def_down')) applyMinorDefDown('enemy');
    if (ailId === 'chilled' && sumBonusValue(bonuses, 'on_chilled_apply_minor_spd_down')) applyMinorSpdDown('enemy');
    if (ailId === 'poison' && sumBonusValue(bonuses, 'on_poison_apply_minor_healing_down')) {
      if (G().enemyStatus) G().enemyStatus.healingDown = (G().enemyStatus.healingDown || 0) + 10;
    }
    if (ailId === 'bleed' && sumBonusValue(bonuses, 'on_bleed_apply_minor_dodge_down') && G().enemy && G().enemy.stats) {
      G().enemy.stats.dodge = Math.max(0, (Number(G().enemy.stats.dodge) || 0) - 6);
    }
  };

  ns.onSongOrCall = function onSongOrCall(success) {
    var st = state();
    var bonuses = collectBonuses(G() && G().player);
    if (success && sumBonusValue(bonuses, 'after_song_acc_down_chance')) applyMinorAccDown('enemy');
    if (success && sumBonusValue(bonuses, 'song_skill_matk_up') && G().player && G().player.stats) {
      G().player.stats.matk = (Number(G().player.stats.matk) || 0) + Math.max(2, Math.round(sumBonusValue(bonuses, 'song_skill_matk_up') * 0.5));
    }
  };

  ns.onUtilityUsed = function onUtilityUsed(success) {
    var bonuses = collectBonuses(G() && G().player);
    if (success && sumBonusValue(bonuses, 'first_utility_minor_meter_up') && typeof globalThis.awardUltimateMeter === 'function') {
      globalThis.awardUltimateMeter('player', 6);
    }
    if (success && sumBonusValue(bonuses, 'movement_skill_dodge_up')) {
      applyDodgeFromBonusTier(sumBonusValue(bonuses, 'movement_skill_dodge_up'));
    }
  };

  ns.onHeal = function onHeal(side, amount) {
    var bonuses = collectBonuses(G() && G().player);
    if (side === 'player' && sumBonusValue(bonuses, 'on_heal_minor_shield')) applyMinorShield('player');
    if (sumBonusValue(bonuses, 'cleanse_grants_hp') && side === 'player' && G().player && G().player.stats) {
      var heal = Math.max(1, Math.round((Number(G().player.stats.maxHp) || 0) * 0.05));
      G().player.stats.hp = Math.min(Number(G().player.stats.maxHp) || 0, (Number(G().player.stats.hp) || 0) + heal);
    }
  };

  ns.onPurge = function onPurge() {
    var bonuses = collectBonuses(G() && G().player);
    if (sumBonusValue(bonuses, 'purge_grants_shield')) applyMinorShield('player', 10 + sumBonusValue(bonuses, 'purge_grants_shield'));
  };

  ns.getLifestealPct = function getLifestealPct() {
    var bonuses = collectBonuses(G() && G().player);
    var pct = 0;
    if (G().player && G().player._mutationNextHitLifesteal) {
      pct += G().player._mutationNextHitLifesteal;
      G().player._mutationNextHitLifesteal = 0;
    }
    if (enemyIsMarked() && sumBonusValue(bonuses, 'vs_marked_lifesteal')) pct += sumBonusValue(bonuses, 'vs_marked_lifesteal');
    if (typeof globalThis.isBloodiedTarget === 'function' && G().player && globalThis.isBloodiedTarget(G().player)) {
      if (sumBonusValue(bonuses, 'low_hp_lifesteal')) pct += sumBonusValue(bonuses, 'low_hp_lifesteal');
    }
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    if (mech && mech.lifestealPct) pct += mech.lifestealPct;
    return pct;
  };

  ns.getHeavyAccPenaltyReduction = function getHeavyAccPenaltyReduction() {
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    var red = mech ? (Number(mech.heavyAccPenaltyReductionPct) || 0) : 0;
    if (sumBonusValue(collectBonuses(G() && G().player), 'heavy_penalty_reduced_this_turn')) {
      red += sumBonusValue(collectBonuses(G() && G().player), 'heavy_penalty_reduced_this_turn');
    }
    return red;
  };

  ns.getUltimateMeterMultiplier = function getUltimateMeterMultiplier() {
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    var mult = 1;
    if (mech && mech.ultimateMeterGainPct) mult += mech.ultimateMeterGainPct / 100;
    return mult;
  };

  ns.getHealingDoneMultiplier = function getHealingDoneMultiplier() {
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    return mech && mech.healingDonePct ? 1 + mech.healingDonePct / 100 : 1;
  };

  ns.getHealingReceivedMultiplier = function getHealingReceivedMultiplier() {
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    var mult = mech && mech.healingReceivedPct ? 1 + mech.healingReceivedPct / 100 : 1;
    if (G().player && G().player._mutationHealingRecvBonus) {
      mult += G().player._mutationHealingRecvBonus / 100;
      G().player._mutationHealingRecvBonus = 0;
    }
    return mult;
  };

  ns.getStatusResistPct = function getStatusResistPct() {
    var mech = (G() && G().player && typeof Avian.mutations.getMechanicsRollup === 'function')
      ? Avian.mutations.getMechanicsRollup(G().player) : null;
    return mech ? (Number(mech.statusResistPct) || 0) : 0;
  };

  ns.onBloodiedSelf = function onBloodiedSelf() {
    var st = state();
    var bonuses = collectBonuses(G() && G().player);
    if (st && st.setActive && st.setActive.phoenix_oath >= 5 && !st.phoenixOathShieldUsed) {
      st.phoenixOathShieldUsed = true;
      var poDef = getSetsCatalog().phoenix_oath;
      var poBonus = poDef && poDef.bonuses && poDef.bonuses[5];
      var shieldPct = parseBackendPct(poBonus && poBonus.backend, 25);
      applyMinorShield('player', shieldPct || 25);
    }
    if (sumBonusValue(bonuses, 'bloodied_self_shield')) applyShieldFromBonusTier(sumBonusValue(bonuses, 'bloodied_self_shield'));
    if (sumBonusValue(bonuses, 'bloodied_self_minor_mdef_up') && G().player && G().player.stats) {
      G().player.stats.mdef = (Number(G().player.stats.mdef) || 0) + 5;
    }
    if (sumBonusValue(bonuses, 'bloodied_mdef_up') && G().player && G().player.stats) {
      G().player.stats.mdef = (Number(G().player.stats.mdef) || 0) + Math.max(3, Math.round(sumBonusValue(bonuses, 'bloodied_mdef_up') * 0.5));
    }
    if (sumBonusValue(bonuses, 'bloodied_def_up') && G().player && G().player.stats) {
      G().player.stats.def = (Number(G().player.stats.def) || 0) + Math.max(3, Math.round(sumBonusValue(bonuses, 'bloodied_def_up') * 0.5));
    }
  };

  ns.getActiveSets = getActiveSets;
  ns.refreshSetState = refreshSetState;
  Avian.systems.mutationEffects = ns;
})();
