/**
 * Enemy AI v2 — profile resolution, behaviour derivation, and Build Nest helpers.
 */
(function initEnemyAIResolver() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.enemyAiResolver = Avian.systems.enemyAiResolver || {};

  var AI_PROFILE = global.AI_PROFILE || { DEFAULT: 'default', EASY: 'easy', NORMAL: 'normal', ELITE: 'elite', BOSS: 'boss', CUSTOM: 'custom' };
  var VALID_PROFILES = new Set(['default', 'easy', 'normal', 'elite', 'boss', 'custom']);
  var VALID_BEHAVIOURS = new Set([
    'automatic', 'balanced', 'aggressive', 'defensive', 'control', 'sustain',
    'knight', 'rogue', 'mage', 'siren', 'inquisitor', 'bard', 'brute',
  ]);

  var CLASS_BEHAVIOUR = Object.freeze({
    knight: 'knight',
    rogue: 'rogue',
    mage: 'mage',
    siren: 'siren',
    inquisitor: 'inquisitor',
    bard: 'bard',
    brute: 'brute',
    striker: 'rogue',
    tank: 'knight',
    bruiser: 'brute',
    trickster: 'control',
    predator: 'inquisitor',
    singer: 'siren',
  });

  var CUSTOM_OVERRIDE_KEYS = [
    'randomness', 'koAwareness', 'protectionAwareness', 'ailmentAwareness',
    'comboAwareness', 'enPlanning', 'cooldownPlanning', 'defensiveUrgency',
    'lookahead', 'lookaheadWeight', 'scoreAccuracy',
  ];

  function normalizeProfileId(raw) {
    var id = String(raw || '').trim().toLowerCase();
    return VALID_PROFILES.has(id) ? id : '';
  }

  function normalizeBehaviourId(raw) {
    var id = String(raw || '').trim().toLowerCase();
    return VALID_BEHAVIOURS.has(id) ? id : '';
  }

  function normalizeDifficultyAIProfile(difficulty) {
    var id = String(difficulty || '').trim().toLowerCase();
    switch (id) {
      case 'easy':
      case 'fletchling':
        return 'easy';
      case 'elite':
      case 'veteran':
      case 'predator':
        return 'elite';
      case 'boss':
      case 'milestoneboss':
      case 'milestone_boss':
      case 'murder':
        return 'boss';
      case 'normal':
      case 'juvenile':
      default:
        return 'normal';
    }
  }

  function resolveEncounterAIDifficulty(combatContext) {
    var ctx = combatContext || {};
    if (ctx.isBoss) return 'boss';
    if (ctx.isElite) return 'elite';
    return normalizeDifficultyAIProfile(ctx.difficulty || ctx.gameDifficulty);
  }

  function defaultEnemyAI() {
    return { profile: AI_PROFILE.DEFAULT, behaviour: 'automatic' };
  }

  function normalizeSavedEnemyAI(ai) {
    if (!ai || typeof ai !== 'object') return defaultEnemyAI();
    var profile = normalizeProfileId(ai.profile) || AI_PROFILE.DEFAULT;
    var behaviour = normalizeBehaviourId(ai.behaviour) || 'automatic';
    var out = { profile: profile, behaviour: behaviour };
    if (profile === AI_PROFILE.CUSTOM && ai.overrides && typeof ai.overrides === 'object') {
      out.overrides = {};
      CUSTOM_OVERRIDE_KEYS.forEach(function (key) {
        if (ai.overrides[key] != null) out.overrides[key] = ai.overrides[key];
      });
    }
    return out;
  }

  function migrateLegacyAIDifficulty(raw) {
    var id = normalizeProfileId(raw);
    if (id && id !== AI_PROFILE.DEFAULT) {
      return { profile: id, behaviour: 'automatic' };
    }
    return defaultEnemyAI();
  }

  /** Ensure enemy.ai exists; never converts Default → Normal on save. */
  function ensureEnemyAI(enemy) {
    if (!enemy) return defaultEnemyAI();
    if (enemy.ai && typeof enemy.ai === 'object' && normalizeProfileId(enemy.ai.profile)) {
      enemy.ai = normalizeSavedEnemyAI(enemy.ai);
      return enemy.ai;
    }
    if (enemy.aiDifficulty != null && String(enemy.aiDifficulty).trim()) {
      var migrated = migrateLegacyAIDifficulty(enemy.aiDifficulty);
      enemy.ai = migrated;
      return enemy.ai;
    }
    enemy.ai = defaultEnemyAI();
    return enemy.ai;
  }

  function resolveEnemyAIProfile(enemy, encounterDifficulty) {
    ensureEnemyAI(enemy);
    var profile = enemy.ai.profile || AI_PROFILE.DEFAULT;
    if (profile !== AI_PROFILE.DEFAULT) {
      return profile === AI_PROFILE.CUSTOM ? AI_PROFILE.CUSTOM : profile;
    }
    return normalizeDifficultyAIProfile(encounterDifficulty) || AI_PROFILE.NORMAL;
  }

  function equipmentHintsBehaviour(enemy) {
    var eq = enemy && enemy.equipment;
    if (!eq || typeof eq !== 'object') return '';
    var items = (Avian.data && Avian.data.equipment && Avian.data.equipment.items) || {};
    var hay = '';
    Object.keys(eq).forEach(function (slot) {
      var id = eq[slot];
      if (!id) return;
      var row = items[id];
      if (row) hay += ' ' + String(row.name || '') + ' ' + String(row.family || '') + ' ' + String(row.slot || '');
    });
    hay = hay.toLowerCase();
    if (/focus|orb|shock|ailment|siren|charm/.test(hay)) return 'siren';
    if (/greatblade|heavy|crush|slam|brute/.test(hay)) return 'brute';
    if (/dagger|rogue|crit|bleed|poison/.test(hay)) return 'rogue';
    if (/shield|guard|fortify|knight/.test(hay)) return 'knight';
    if (/wand|staff|spell|arcane|mage/.test(hay)) return 'mage';
    if (/hymn|bard|chorus/.test(hay)) return 'bard';
    if (/inquisitor|smite|holy/.test(hay)) return 'inquisitor';
    return '';
  }

  function deriveAutomaticBehaviour(enemy) {
    var cls = String(enemy?.enemyClass || enemy?.class || '').toLowerCase();
    var fromClass = CLASS_BEHAVIOUR[cls] || '';
    var fromEquip = equipmentHintsBehaviour(enemy);
    if (fromEquip) return fromEquip;
    if (fromClass) return fromClass;
    if (typeof global.inferAIPersonalityFromClass === 'function') {
      var pers = global.inferAIPersonalityFromClass(cls);
      if (pers === 'control') return 'control';
      if (pers === 'tank') return 'knight';
      if (pers === 'aggressive') return 'aggressive';
    }
    return 'balanced';
  }

  function resolveEnemyAIBehaviour(enemy) {
    ensureEnemyAI(enemy);
    var saved = enemy.ai.behaviour || 'automatic';
    if (saved !== 'automatic') {
      return normalizeBehaviourId(saved) || 'balanced';
    }
    return deriveAutomaticBehaviour(enemy);
  }

  function resolveCustomAIConfig(enemy) {
    var base = Object.assign({}, (Avian.data && Avian.data.enemyAIDifficulties && Avian.data.enemyAIDifficulties.normal) || {});
    var overrides = (enemy && enemy.ai && enemy.ai.overrides) || {};
    CUSTOM_OVERRIDE_KEYS.forEach(function (key) {
      if (overrides[key] != null) base[key] = overrides[key];
    });
    return base;
  }

  function buildCombatContextFromEnemy(enemy, extra) {
    var g = global.G || {};
    var ctx = Object.assign({
      difficulty: g.difficulty || 'juvenile',
      gameDifficulty: g.difficulty || 'juvenile',
      isBoss: !!(enemy && enemy.isBoss),
      isElite: !!(enemy && enemy.isElite),
      stage: g.stage || 1,
    }, extra || {});
    if (extra && extra.difficulty != null) {
      ctx.difficulty = extra.difficulty;
    }
    return ctx;
  }

  function resolveEnemyAIConfig(enemy, combatContext) {
    ensureEnemyAI(enemy);
    var ctx = combatContext || buildCombatContextFromEnemy(enemy);
    var encounterDiff = resolveEncounterAIDifficulty(ctx);
    var profile = resolveEnemyAIProfile(enemy, encounterDiff);
    var behaviour = resolveEnemyAIBehaviour(enemy);
    var savedProfile = enemy.ai.profile || AI_PROFILE.DEFAULT;
    var difficulties = (Avian.data && Avian.data.enemyAIDifficulties) || {};
    var difficultyConfig = profile === AI_PROFILE.CUSTOM
      ? resolveCustomAIConfig(enemy)
      : (difficulties[profile] || difficulties.normal || {});

    var behaviourWeights = (Avian.data && Avian.data.enemyAI && Avian.data.enemyAI.behaviourWeights)
      || global.ENEMY_AI_BEHAVIOUR_WEIGHTS
      || {};
    var weights = behaviourWeights[behaviour] || behaviourWeights.balanced || {};

    return Object.assign({
      profile: profile,
      savedProfile: savedProfile,
      resolvedProfile: profile,
      behaviour: behaviour,
      savedBehaviour: savedProfile === AI_PROFILE.DEFAULT ? enemy.ai.behaviour : enemy.ai.behaviour,
      encounterDifficulty: encounterDiff,
      source: (savedProfile && savedProfile !== AI_PROFILE.DEFAULT)
        ? 'buildNestOverride'
        : 'encounterDifficulty',
      behaviourWeights: weights,
    }, difficultyConfig);
  }

  function getBehaviourProfileWeights(behaviour) {
    var behaviourWeights = (Avian.data && Avian.data.enemyAI && Avian.data.enemyAI.behaviourWeights)
      || global.ENEMY_AI_BEHAVIOUR_WEIGHTS
      || {};
    return behaviourWeights[behaviour] || behaviourWeights.balanced || {};
  }

  function applyAIConfigToScore(baseScore, cand, e, p, ctx, aiConfig, cat) {
    var cfg = aiConfig || {};
    var w = baseScore;
    var weights = cfg.behaviourWeights || getBehaviourProfileWeights(cfg.behaviour);
    if (cat === 'damage') w *= weights.damageBias || 1;
    if (cat === 'heavy') w *= weights.heavyBias || 1;
    if (cat === 'control') w *= weights.controlBias || 1;
    if (cat === 'buff') w *= weights.buffBias || 1;
    if (cat === 'guard') w *= weights.guardBias || 1;
    if (cat === 'heal') w *= weights.healBias || 1;

    var pHp = (p.stats.hp || 1) / Math.max(1, p.stats.maxHp || 1);
    var eHp = (e.stats.hp || 1) / Math.max(1, e.stats.maxHp || 1);
    if (pHp <= 0.35 && (cat === 'damage' || cat === 'heavy')) {
      w *= (cfg.koAwareness || 1) * (weights.finisherBias || 1);
    }
    if (ctx.playerDefending && (cat === 'guard' || cat === 'heal')) {
      w *= (cfg.protectionAwareness || 1);
    }
    if (cat === 'control') w *= (cfg.ailmentAwareness || 1);
    if (typeof global.getEnemyActionComboBonus === 'function') {
      var combo = global.getEnemyActionComboBonus(e, cand, cat);
      if (combo > 1) w *= 1 + (combo - 1) * (cfg.comboAwareness || 1);
    }
    if (eHp < 0.45 && (cat === 'guard' || cat === 'heal')) {
      w *= (cfg.defensiveUrgency || 1);
    }
    w *= (cfg.scoreAccuracy || 1);
    return w;
  }

  function formatAIProfileLabel(id) {
    var labels = (Avian.data && Avian.data.enemyAI && Avian.data.enemyAI.profileLabels) || {};
    return labels[id] || String(id || '').charAt(0).toUpperCase() + String(id || '').slice(1);
  }

  function formatAIBehaviourLabel(id, resolved) {
    if (id === 'automatic' && resolved && resolved !== 'automatic') {
      return 'Automatic → ' + formatAIBehaviourLabel(resolved);
    }
    var labels = (Avian.data && Avian.data.enemyAI && Avian.data.enemyAI.behaviourLabels) || {};
    return labels[id] || String(id || '').charAt(0).toUpperCase() + String(id || '').slice(1);
  }

  function compareAIProfiles(enemy, player, combatContext) {
    var profiles = ['easy', 'normal', 'elite', 'boss'];
    var difficulties = (Avian.data && Avian.data.enemyAIDifficulties) || {};
    var behaviour = resolveEnemyAIBehaviour(enemy);
    var results = [];
    profiles.forEach(function (profileId) {
      var cfg = Object.assign({
        profile: profileId,
        behaviour: behaviour,
        behaviourWeights: getBehaviourProfileWeights(behaviour),
        source: 'comparison',
      }, difficulties[profileId] || {});
      var plan = typeof global.planEnemyTurnWithAIConfig === 'function'
        ? global.planEnemyTurnWithAIConfig(enemy, player, cfg)
        : (typeof global.planEnemyTurn === 'function' ? global.planEnemyTurn(enemy, player) : { actions: [] });
      results.push({
        profile: profileId,
        label: formatAIProfileLabel(profileId),
        actions: (plan && plan.actions) || [],
        intent: plan && plan.intent,
        mode: plan && plan.mode,
      });
    });
    return results;
  }

  function testEnemyAI(enemy, player, combatContext) {
    ensureEnemyAI(enemy);
    var ctx = combatContext || buildCombatContextFromEnemy(enemy);
    var config = resolveEnemyAIConfig(enemy, ctx);
    var plan = typeof global.planEnemyTurn === 'function'
      ? global.planEnemyTurn(enemy, player)
      : { actions: [], mode: 'PRESSURE', intent: 'attack' };
    var pool = typeof global.buildEnemyActionPool === 'function' && typeof global.getEnemyMode === 'function'
      ? global.buildEnemyActionPool(enemy, global.getEnemyMode(enemy, player))
      : [];
    var topAction = (plan.actions && plan.actions[0]) || null;
    return {
      savedProfile: config.savedProfile,
      savedBehaviour: enemy.ai.behaviour,
      encounterDifficulty: config.encounterDifficulty,
      resolvedProfile: config.profile,
      source: config.source,
      behaviour: config.behaviour,
      behaviourLabel: formatAIBehaviourLabel(enemy.ai.behaviour, config.behaviour),
      availableActions: pool.length,
      likelyChoice: topAction ? (topAction.abilityId || topAction.type || 'unknown') : 'none',
      plan: plan,
      config: config,
    };
  }

  function applyForgeSlotAIToEnemy(enemy, slot) {
    if (!enemy) return enemy;
    if (slot && slot.ai && typeof slot.ai === 'object') {
      enemy.ai = normalizeSavedEnemyAI(JSON.parse(JSON.stringify(slot.ai)));
    } else {
      ensureEnemyAI(enemy);
    }
    return enemy;
  }

  function normalizeForgeSlotAI(slot) {
    if (!slot) return;
    if (slot.ai && typeof slot.ai === 'object') {
      slot.ai = normalizeSavedEnemyAI(slot.ai);
    } else {
      slot.ai = defaultEnemyAI();
    }
  }

  ns.normalizeDifficultyAIProfile = normalizeDifficultyAIProfile;
  ns.resolveEncounterAIDifficulty = resolveEncounterAIDifficulty;
  ns.ensureEnemyAI = ensureEnemyAI;
  ns.normalizeSavedEnemyAI = normalizeSavedEnemyAI;
  ns.defaultEnemyAI = defaultEnemyAI;
  ns.resolveEnemyAIProfile = resolveEnemyAIProfile;
  ns.resolveEnemyAIBehaviour = resolveEnemyAIBehaviour;
  ns.resolveCustomAIConfig = resolveCustomAIConfig;
  ns.resolveEnemyAIConfig = resolveEnemyAIConfig;
  ns.buildCombatContextFromEnemy = buildCombatContextFromEnemy;
  ns.deriveAutomaticBehaviour = deriveAutomaticBehaviour;
  ns.applyAIConfigToScore = applyAIConfigToScore;
  ns.formatAIProfileLabel = formatAIProfileLabel;
  ns.formatAIBehaviourLabel = formatAIBehaviourLabel;
  ns.compareAIProfiles = compareAIProfiles;
  ns.testEnemyAI = testEnemyAI;
  ns.applyForgeSlotAIToEnemy = applyForgeSlotAIToEnemy;
  ns.normalizeForgeSlotAI = normalizeForgeSlotAI;
  ns.getBehaviourProfileWeights = getBehaviourProfileWeights;

  global.normalizeDifficultyAIProfile = normalizeDifficultyAIProfile;
  global.resolveEncounterAIDifficulty = resolveEncounterAIDifficulty;
  global.ensureEnemyAI = ensureEnemyAI;
  global.normalizeSavedEnemyAI = normalizeSavedEnemyAI;
  global.defaultEnemyAI = defaultEnemyAI;
  global.resolveEnemyAIProfile = resolveEnemyAIProfile;
  global.resolveEnemyAIBehaviour = resolveEnemyAIBehaviour;
  global.resolveCustomAIConfig = resolveCustomAIConfig;
  global.resolveEnemyAIConfig = resolveEnemyAIConfig;
  global.buildCombatContextFromEnemy = buildCombatContextFromEnemy;
  global.applyAIConfigToScore = applyAIConfigToScore;
  global.formatAIProfileLabel = formatAIProfileLabel;
  global.formatAIBehaviourLabel = formatAIBehaviourLabel;
  global.compareAIProfiles = compareAIProfiles;
  global.testEnemyAI = testEnemyAI;
  global.applyForgeSlotAIToEnemy = applyForgeSlotAIToEnemy;
  global.normalizeForgeSlotAI = normalizeForgeSlotAI;
  global.getBehaviourProfileWeights = getBehaviourProfileWeights;
})();
