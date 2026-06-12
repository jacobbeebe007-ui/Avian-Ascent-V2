/**
 * Enhanced enemy AI planner with EV scoring, difficulty hooks, and initiative awareness.
 */
(function initEnemyAI() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.enemyAi = Avian.systems.enemyAi || {};

  var G = function () { return global.G; };

  function getDiffMod() {
    var diff = String(G().difficulty || 'juvenile').toLowerCase();
    var mods = global.DIFFICULTY_AI_MODIFIERS || {};
    return mods[diff] || mods.juvenile || { spendCapMin: 0.6, spendCapMax: 0.75, intentRandomness: 1, enEfficiencyWeight: 1, finisherPrecision: 1, evDefenseWeight: 1 };
  }

  function buildAIContext(e, p) {
    var g = G();
    var eSpd = Math.max(1, e && e.stats ? (e.stats.spd || 1) : 1);
    var pSpd = Math.max(1, p && p.stats ? (p.stats.spd || 1) : 1);
    var playerGoesFirst = g.turn === 'player' || (g.turn !== 'enemy' && pSpd >= eSpd);
    return {
      stage: g.stage || 1,
      difficulty: g.difficulty || 'juvenile',
      enemyTurnCount: g.enemyTurnCount || 1,
      playerGoesFirst: playerGoesFirst,
      playerDef: Math.max(0, p && p.stats ? (p.stats.def || 0) : 0),
      playerMdef: Math.max(0, p && p.stats ? (p.stats.mdef || 0) : 0),
      playerDodge: (typeof global.getEffectiveDodge === 'function' && p)
        ? Math.max(0, global.getEffectiveDodge(p))
        : Math.max(0, (p && p.stats ? (p.stats.dodge || 0) : 0) + (typeof global.dodgeBonusFromSpeed === 'function' ? global.dodgeBonusFromSpeed(p && p.stats ? p.stats.spd : 0) : 0)),
      playerAcc: Math.max(60, p && p.stats ? (p.stats.acc || 80) : 80),
      playerDefending: !!(g.playerStatus && g.playerStatus.defending),
      diffMod: getDiffMod(),
    };
  }

  function estimateHitChance(ctx, e) {
    var acc = Math.max(60, e && e.stats ? (e.stats.acc || 80) : 80);
    var dodge = ctx.playerDodge;
    if (ctx.playerDefending) dodge = Math.min(95, dodge + 15);
    var hit = Math.max(0.15, Math.min(0.98, (acc - dodge * 0.65) / 100));
    return hit;
  }

  function projectedActionExpectedValue(action, e, p, ctx) {
    if (!action || !e) return 0;
    var cat = typeof global.classifyEnemyActionCategory === 'function'
      ? global.classifyEnemyActionCategory(action)
      : 'utility';
    var eHp = (e.stats.hp || 1) / Math.max(1, e.stats.maxHp || 1);
    var pHp = (p.stats.hp || 1) / Math.max(1, p.stats.maxHp || 1);

    if (cat === 'heal') return eHp < 0.55 ? (1 - eHp) * 40 : 2;
    if (cat === 'guard') {
      var guardVal = ctx.playerGoesFirst ? 18 : 10;
      return eHp < 0.5 ? guardVal * 1.4 : guardVal * 0.6;
    }
    if (cat === 'buff') return eHp < 0.6 ? 14 : 8;
    if (cat === 'control') {
      var hasDebuff = !!(global.G && global.G.playerStatus && (
        global.G.playerStatus.feared || global.G.playerStatus.weaken || global.G.playerStatus.poison
        || global.G.playerStatus.paralyzed || global.G.playerStatus.confused
      ));
      return hasDebuff ? 6 : 16;
    }

    var raw = typeof global.projectedEnemyActionDamage === 'function'
      ? global.projectedEnemyActionDamage(action, e)
      : 0;
    if (raw <= 0) return 0;

    var btn = 'physical';
    if (action.type === 'ability' && action.abilityId) {
      var ab = (e.abilities || []).find(function (a) { return a && a.id === action.abilityId; }) || { id: action.abilityId };
      var tmpl = typeof global.getAbilityTemplateForUI === 'function' ? global.getAbilityTemplateForUI(ab) : null;
      btn = String((tmpl && (tmpl.btnType || tmpl.type)) || 'physical').toLowerCase();
    }
    var def = btn === 'spell' ? ctx.playerMdef : ctx.playerDef;
    var mitigation = 1 - Math.min(0.55, def / (def + 40));
    var hit = estimateHitChance(ctx, e);
    var finisher = pHp < 0.4 ? 1.25 : 1;
    var preferStat = btn === 'spell'
      ? (ctx.playerMdef <= ctx.playerDef ? 1.08 : 0.92)
      : (ctx.playerDef <= ctx.playerMdef ? 1.08 : 0.92);
    return raw * mitigation * hit * finisher * preferStat * (ctx.diffMod.evDefenseWeight || 1);
  }

  function getEnemyEnergySpendCapEnhanced(e, p, pool, totalEnergy, intent, canFinish, ctx) {
    var energy = Math.max(0, totalEnergy || 0);
    if (energy <= 0) return 0;
    var stage = ctx.stage || 1;
    if (intent === 'finish' && canFinish && stage > 5) return energy;
    var dm = ctx.diffMod || getDiffMod();
    var minSpend = Math.max(1, Math.ceil(energy * dm.spendCapMin));
    var maxSpend = Math.max(minSpend, Math.floor(energy * dm.spendCapMax));
    var hardCaps = { 2: 2, 3: 2, 4: 3, 5: 3 };
    if (hardCaps[energy]) maxSpend = Math.min(maxSpend, hardCaps[energy]);
    if (maxSpend < minSpend) maxSpend = minSpend;
    var spendCap = typeof global.roll === 'function' ? global.roll(minSpend, maxSpend) : maxSpend;
    return Math.max(1, Math.min(energy, spendCap));
  }

  function scoreCandidate(cand, e, p, ctx, profile, intent, archetype, mem, energy) {
    var cat = typeof global.classifyEnemyActionCategory === 'function'
      ? global.classifyEnemyActionCategory(cand)
      : 'utility';
    var cost = typeof global.getEnemyActionEnergyCost === 'function'
      ? global.getEnemyActionEnergyCost(cand)
      : 1;
    var ev = projectedActionExpectedValue(cand, e, p, ctx);
    var enEff = (ev + 0.5) / Math.max(1, cost);
    var w = 10 + ev * 0.35 + enEff * 3.5 * (ctx.diffMod.enEfficiencyWeight || 1);

    if (cat === 'damage') w *= profile.damageBias;
    if (cat === 'heavy') w *= profile.heavyBias;
    if (cat === 'control') w *= profile.controlBias;
    if (cat === 'buff') w *= profile.buffBias;
    if (cat === 'guard') w *= profile.guardBias;
    if (cat === 'heal') w *= profile.healBias;

    if (typeof global.getArchetypeCategoryBonus === 'function') {
      w *= global.getArchetypeCategoryBonus(archetype, cat);
    }
    if (intent === 'attack' && (cat === 'damage' || cat === 'heavy')) w *= 1.35;
    if (intent === 'control' && cat === 'control') w *= 1.40;
    if (intent === 'buff' && (cat === 'buff' || cat === 'guard' || cat === 'heal')) w *= 1.45;
    if (intent === 'finish' && (cat === 'damage' || cat === 'heavy')) w *= 1.55 * (ctx.diffMod.finisherPrecision || 1);

    var pHp = (p.stats.hp || 1) / Math.max(1, p.stats.maxHp || 1);
    var eHp = (e.stats.hp || 1) / Math.max(1, e.stats.maxHp || 1);
    if (pHp <= 0.5 && (cat === 'heavy' || cat === 'damage')) w *= profile.finisherBias;
    if (mem.lastAbilityId && (cand.abilityId || cand.type) === mem.lastAbilityId) w *= profile.repeatBias;
    if (!mem.lastTurnHadDamage && (cat === 'damage' || cat === 'heavy')) w *= 1.45;

    if (ctx.playerGoesFirst && eHp < 0.5 && (cat === 'guard' || cat === 'heal')) w *= 1.35;
    if (!ctx.playerGoesFirst && (cat === 'damage' || cat === 'heavy')) w *= 1.12;

    if (cost === energy) w *= 1.1;
    if (typeof global.getEnemyActionComboBonus === 'function') {
      var combo = global.getEnemyActionComboBonus(e, cand, cat);
      if (combo > 1) w *= combo;
    }
    return w;
  }

  function planEnemyTurn(e, p) {
    if (typeof global.getEnemyMode !== 'function' || typeof global.buildEnemyActionPool !== 'function') {
      return { mode: 'PRESSURE', intent: 'attack', archetype: 'striker', actions: [], energySpendCap: 0 };
    }

    var ctx = buildAIContext(e, p);
    var mode = global.getEnemyMode(e, p);
    var pool = global.buildEnemyActionPool(e, mode);
    var actions = [];
    var mem = typeof global.getEnemyAIMemory === 'function' ? global.getEnemyAIMemory(e) : {};
    var profile = typeof global.getAIPersonalityProfile === 'function'
      ? global.getAIPersonalityProfile(e)
      : (global.AI_PERSONALITY_PROFILES && global.AI_PERSONALITY_PROFILES.tactical) || {};

    var energy = Math.max(0, Number.isFinite(e.energy) ? e.energy : (e.energyMax || 4));
    var intentPick = typeof global.selectEnemyIntent === 'function'
      ? global.selectEnemyIntent(e, p, pool, energy, mode)
      : { intent: 'attack', archetype: 'striker', canFinish: false };
    var intent = intentPick.intent || 'attack';
    var archetype = intentPick.archetype || (typeof global.getEnemyArchetype === 'function' ? global.getEnemyArchetype(e) : 'striker');
    var intentPool = typeof global.filterEnemyActionsByIntent === 'function'
      ? global.filterEnemyActionsByIntent(intent, pool)
      : pool;
    var energySpendCap = getEnemyEnergySpendCapEnhanced(e, p, pool, energy, intent, !!intentPick.canFinish, ctx);
    var spentEnergy = 0;
    var actionsTaken = 0;
    var maxEnemyActions = global.MAX_ENEMY_ACTIONS_PER_TURN || 3;
    var earlyTurnLimit = (ctx.stage <= 5) ? 2 : maxEnemyActions;
    var maxActions = Math.min(earlyTurnLimit, 6);
    var turnHadDamage = false;

    if (intent === 'pressure') {
      var controlPick = (intentPool.length ? intentPool : pool).find(function (a) {
        return global.classifyEnemyActionCategory(a) === 'control'
          && global.getEnemyActionEnergyCost(a) <= energy
          && (spentEnergy + global.getEnemyActionEnergyCost(a) <= energySpendCap);
      });
      if (controlPick && actionsTaken < maxActions) {
        var cc = global.getEnemyActionEnergyCost(controlPick);
        actions.push(Object.assign({}, controlPick, { energyCost: cc, category: 'control' }));
        energy -= cc; spentEnergy += cc; actionsTaken++;
        mem.lastAbilityId = controlPick.abilityId || controlPick.type;
        mem.utilityStreak = (mem.utilityStreak || 0) + 1;
      }
      var basicPick = pool.find(function (a) {
        return (a.type === 'strike' || a.type === 'heavy')
          && global.getEnemyActionEnergyCost(a) <= energy
          && (spentEnergy + global.getEnemyActionEnergyCost(a) <= energySpendCap);
      });
      if (basicPick && actionsTaken < maxActions) {
        var bc = global.getEnemyActionEnergyCost(basicPick);
        actions.push(Object.assign({}, basicPick, { energyCost: bc, category: global.classifyEnemyActionCategory(basicPick) }));
        energy -= bc; spentEnergy += bc; actionsTaken++;
        turnHadDamage = global.projectedEnemyActionDamage(basicPick, e) > 0;
      }
    }

    while (energy > 0 && actionsTaken < maxActions && spentEnergy < energySpendCap) {
      var source = intentPool.length ? intentPool : pool;
      var affordable = source.filter(function (a) { return global.getEnemyActionEnergyCost(a) <= energy; });
      if (!affordable.length) break;

      var best = null;
      var bestScore = -1;
      for (var i = 0; i < affordable.length; i++) {
        var cand = affordable[i];
        var w = scoreCandidate(cand, e, p, ctx, profile, intent, archetype, mem, energy);
        if (w > bestScore) {
          bestScore = w;
          var cst = global.getEnemyActionEnergyCost(cand);
          best = Object.assign({}, cand, {
            energyCost: cst,
            category: global.classifyEnemyActionCategory(cand),
          });
        }
      }
      if (!best) break;
      if (spentEnergy + best.energyCost > energySpendCap) break;
      actions.push(best);
      energy -= best.energyCost;
      spentEnergy += best.energyCost;
      actionsTaken++;
      turnHadDamage = turnHadDamage || global.projectedEnemyActionDamage(best, e) > 0;
      mem.lastAbilityId = best.abilityId || best.type;
      mem.lastActionCategory = best.category;
      mem.utilityStreak = (best.category === 'guard' || best.category === 'heal' || best.category === 'buff' || best.category === 'control')
        ? (mem.utilityStreak + 1) : 0;
    }

    if (!turnHadDamage) {
      var fallback = pool.find(function (a) {
        return (a.type === 'strike' || a.type === 'heavy') && global.getEnemyActionEnergyCost(a) <= (e.energyMax || 3);
      });
      if (fallback && actions.length < maxActions) {
        actions.push(Object.assign({}, fallback, {
          energyCost: global.getEnemyActionEnergyCost(fallback),
          category: global.classifyEnemyActionCategory(fallback),
        }));
      }
    }

    return { mode: mode, intent: intent, archetype: archetype, actions: actions, energySpendCap: energySpendCap };
  }

  ns.buildAIContext = buildAIContext;
  ns.projectedActionExpectedValue = projectedActionExpectedValue;
  ns.planEnemyTurn = planEnemyTurn;

  global.planEnemyTurn = planEnemyTurn;
})();
