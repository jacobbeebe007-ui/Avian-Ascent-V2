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

  function inferAIPersonalityFromRosterProfile(aiProfile) {
    var s = String(aiProfile || '').toLowerCase();
    if (!s) return '';
    if (/opportunist/.test(s)) return 'opportunistic';
    if (/control|controller|trickster|seer/.test(s)) return 'control';
    if (/tank|guardian|bulwark|defender/.test(s)) return 'tank';
    if (/executioner|reaper|finisher/.test(s)) return 'executioner';
    if (/predator|hunter|assassin/.test(s)) return 'predator';
    if (/duelist|aggressive|striker|berserk/.test(s)) return 'aggressive';
    if (/scavenger/.test(s)) return 'scavenger';
    if (/tactical|balanced|generalist/.test(s)) return 'tactical';
    return '';
  }

  function parseRosterHealingThreshold(healingRule) {
    var m = String(healingRule || '').match(/(?:<=|≤|below|under|at)\s*(\d+)\s*%/i)
      || String(healingRule || '').match(/(\d+)\s*%\s*(?:hp|health|or)/i)
      || String(healingRule || '').match(/(\d+)\s*%/);
    if (m) return Math.max(0.05, Math.min(0.95, Number(m[1]) / 100));
    return 0;
  }

  function rosterAbilityBiasMatches(action, enemy, cat) {
    var bias = String(enemy && enemy.abilityBias || '').toLowerCase();
    if (!bias || !action) return 1;
    var id = String(action.abilityId || '').toLowerCase();
    var label = typeof global.getEnemyAbilityDisplayLabel === 'function'
      ? String(global.getEnemyAbilityDisplayLabel(action.abilityId, enemy) || '').toLowerCase()
      : id;
    var hay = id + ' ' + label + ' ' + cat;
    var score = 1;
    if (/light attack|light combo|quick|peck|jab/.test(bias) && cat === 'damage') score *= 1.15;
    if (/heavy|slam|crush|ultimate|special/.test(bias) && (cat === 'heavy' || cat === 'damage')) score *= 1.12;
    if (/bleed/.test(bias) && /bleed/.test(hay)) score *= 1.25;
    if (/poison|toxic/.test(bias) && /poison|toxic|venom/.test(hay)) score *= 1.25;
    if (/burn|scorch|ember/.test(bias) && /burn|scorch|ember/.test(hay)) score *= 1.2;
    if (/dodge|evade|evasion/.test(bias) && /dodge|evade|evasion/.test(hay)) score *= 1.15;
    if (/defen|guard|shield|brace/.test(bias) && (cat === 'guard' || /guard|shield|brace/.test(hay))) score *= 1.2;
    if (/heal|recover|mend/.test(bias) && cat === 'heal') score *= 1.25;
    if (/control|debuff|weaken|fear|paraly|chill|blind/.test(bias) && cat === 'control') score *= 1.2;
    if (/finisher|execute/.test(bias) && (cat === 'heavy' || cat === 'damage')) score *= 1.15;
    return score;
  }

  function rosterRuleWeightAdjust(cand, e, p, ctx, cat) {
    var w = 1;
    var eHp = (e.stats.hp || 1) / Math.max(1, e.stats.maxHp || 1);
    var healTh = parseRosterHealingThreshold(e.healingRule);
    if (healTh > 0 && eHp <= healTh) {
      if (cat === 'heal') w *= 2.1;
      if (cat === 'guard') w *= 1.35;
    }
    var defRule = String(e.defenceRule || '').toLowerCase();
    if (defRule) {
      if ((ctx.playerDefending || eHp < 0.45) && (cat === 'guard' || cat === 'heal')) w *= 1.35;
      if (/evade|dodge|retreat/.test(defRule) && cat === 'guard') w *= 1.2;
    }
    var atkRule = String(e.attackRule || '').toLowerCase();
    if (atkRule) {
      if ((cat === 'damage' || cat === 'heavy') && /attack first|press|strike/.test(atkRule)) w *= 1.18;
      if ((cat === 'damage' || cat === 'heavy') && /low def|weak target|vulnerable/.test(atkRule)) {
        var pDef = Math.max(0, p && p.stats ? (p.stats.def || 0) : 0);
        if (pDef <= ctx.playerDef + 2) w *= 1.12;
      }
    }
    var prio = String(e.aiPriority || '').toLowerCase();
    if (/survive|retreat|escape/.test(prio) && eHp < 0.5 && (cat === 'heal' || cat === 'guard')) w *= 1.25;
    if (/finish|execute|kill/.test(prio)) {
      var pHp = (p.stats.hp || 1) / Math.max(1, p.stats.maxHp || 1);
      if (pHp < 0.45 && (cat === 'damage' || cat === 'heavy')) w *= 1.3;
    }
    w *= rosterAbilityBiasMatches(cand, e, cat);
    return w;
  }

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
        : Math.max(0, p && p.stats ? (p.stats.dodge || 0) : 0),
      playerAcc: Math.max(0, p && p.stats ? (Number.isFinite(Number(p.stats.acc)) ? Number(p.stats.acc) : 0) : 0),
      playerDefending: !!(g.playerStatus && (
        g.playerStatus.defending ||
        (typeof global.playerIsGuarding === 'function' && global.playerIsGuarding(g.playerStatus)) ||
        (typeof global.getGuardedPhysReducPct === 'function' && global.getGuardedPhysReducPct(g.playerStatus) > 0)
      )),
      diffMod: getDiffMod(),
    };
  }

  /** Same LEG-022 formula as combat: (100 − Dodge − skillPenalty) / 100. */
  function estimateHitChance(ctx, e, action) {
    var dodge = Math.max(0, Number(ctx.playerDodge) || 0);
    if (ctx.playerDefending) dodge = Math.min(95, dodge + 15);
    var baseHit = 100;
    var g = global.G;
    if (g && g.enemyStatus) {
      baseHit -= Number(g.enemyStatus.accDebuff) || 0;
      if (g.enemyStatus.enemyBlind > 0) baseHit -= 15;
    }
    var penalty = 0;
    if (action && typeof global.calculateAbilityAccuracyPenalty === 'function') {
      var row = null;
      if (typeof global.resolveAbilityCombatRow === 'function') {
        var ab = null;
        if (action.type === 'ability' && action.abilityId && e && e.abilities) {
          ab = e.abilities.find(function (a) { return a && a.id === action.abilityId; }) || { id: action.abilityId };
        } else if (action.ability) {
          ab = action.ability;
        }
        if (ab) row = global.resolveAbilityCombatRow(ab);
      }
      if (row) penalty = Number(global.calculateAbilityAccuracyPenalty(row)) || 0;
    }
    var pct = typeof global.calculateAbilityHitChancePct === 'function'
      ? global.calculateAbilityHitChancePct(baseHit, dodge, penalty)
      : Math.max(15, Math.min(95, baseHit - dodge - penalty));
    return Math.max(0.15, Math.min(0.95, pct / 100));
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
    var curveK = (typeof global.DEFENCE_CURVE_VALUE === 'number') ? global.DEFENCE_CURVE_VALUE : 25;
    var mitigation = curveK / (curveK + Math.max(0, def || 0));
    var hit = estimateHitChance(ctx, e, action);
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
    /* Finish or full pool: dump available EN (within 3-action turn limit). */
    if (intent === 'finish' && canFinish) return energy;
    if (energy >= 6) return energy;
    var dm = ctx.diffMod || getDiffMod();
    var spendMinFrac = dm.spendCapMin != null ? Number(dm.spendCapMin) : 0.85;
    var spendMaxFrac = dm.spendCapMax != null ? Number(dm.spendCapMax) : 1;
    var minSpend = Math.max(1, Math.ceil(energy * Math.min(1, spendMinFrac)));
    var maxSpend = Math.max(minSpend, Math.floor(energy * Math.min(1, Math.max(spendMinFrac, spendMaxFrac))));
    /* Prefer full spend; never leave more than 1 EN stranded when pool ≥ 3. */
    if (energy >= 3) maxSpend = energy;
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
    w *= rosterRuleWeightAdjust(cand, e, p, ctx, cat);
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
        return a.type === 'ability'
          && global.classifyEnemyActionCategory(a) === 'damage'
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
        return a.type === 'ability'
          && global.classifyEnemyActionCategory(a) === 'damage'
          && global.getEnemyActionEnergyCost(a) <= (e.energyMax || 3);
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
  ns.inferAIPersonalityFromRosterProfile = inferAIPersonalityFromRosterProfile;
  ns.parseRosterHealingThreshold = parseRosterHealingThreshold;

  global.planEnemyTurn = planEnemyTurn;
  global.inferAIPersonalityFromRosterProfile = inferAIPersonalityFromRosterProfile;
  global.parseRosterHealingThreshold = parseRosterHealingThreshold;
})();
