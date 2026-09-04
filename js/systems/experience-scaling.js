/* Experience award scaling — bird size, encounter role, species tier, mode, difficulty, progression. */
(function initExperienceScaling(global) {
  'use strict';

  var Avian = global.Avian || (global.Avian = {});
  Avian.balance = Avian.balance || Object.create(null);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function asInt(value, fallback) {
    var n = Math.floor(Number(value));
    return Number.isFinite(n) ? n : fallback;
  }

  /** EXP bonus by enemy body size (larger birds are tougher and pay more). */
  var SIZE_EXP_MULTIPLIERS = Object.freeze({
    tiny: 0.86,
    small: 0.93,
    medium: 1.00,
    large: 1.14,
    xl: 1.28,
    giant: 1.40,
    boss: 1.48,
  });

  /** Species rarity tiers from Mother Goose. */
  var SPECIES_TIER_EXP_MULTIPLIERS = Object.freeze({
    grey: 1.00,
    green: 1.05,
    blue: 1.10,
    purple: 1.18,
    gold: 1.26,
    orange: 1.35,
  });

  /** Encounter role — elites and bosses are worth more than fodder. */
  var ROLE_EXP_MULTIPLIERS = Object.freeze({
    normal: 1.00,
    elite: 1.38,
    boss: 1.00,
  });

  /** Story difficulty presets — harder settings earn more XP. */
  var STORY_DIFFICULTY_EXP_MULTIPLIERS = Object.freeze({
    fletchling: 0.90,
    juvenile: 1.00,
    predator: 1.10,
    murder: 1.18,
  });

  /** Endless difficulty offsets are level-based; reward a smaller bonus for higher presets. */
  var ENDLESS_DIFFICULTY_EXP_MULTIPLIERS = Object.freeze({
    fletchling: 0.96,
    juvenile: 1.00,
    predator: 1.04,
    murder: 1.08,
  });

  /** Story act bands layered on top of per-stage depth scaling. */
  var STORY_ACT_EXP_MULTIPLIERS = Object.freeze({
    act1: 1.00,
    act2: 1.04,
    act3: 1.08,
    finale: 1.12,
  });

  var BOSS_KIND_EXP_MULTIPLIERS = Object.freeze({
    milestone: 1.00,
    finale: 1.15,
    endlessSegment: 1.10,
    endlessLegacy: 1.08,
  });

  var ENDLESS_EXP_NORMAL_CAP_PCT = 0.30;
  var ENDLESS_EXP_BOSS_CAP_PCT = 0.85;
  var STORY_STAGE_EXP_BONUS_PER_STAGE = 0.05;
  var STORY_STAGE_EXP_BONUS_CAP = 1.0;
  var ENDLESS_BATTLE_EXP_BONUS_PER_BATTLE = 0.03;
  var ENDLESS_BATTLE_EXP_BONUS_CAP = 1.2;
  var ENDLESS_SEGMENT_EXP_BONUS_PER_SEGMENT = 0.02;
  var ENDLESS_SEGMENT_EXP_BONUS_CAP = 0.10;
  var BOSS_BASE_NEXT_LEVEL_PCT = 0.72;
  var BOSS_OVERLEVEL_BONUS_PER_LEVEL = 0.03;
  var BOSS_OVERLEVEL_BONUS_CAP = 5;
  var ROSTER_XP_WEIGHT_BASE = 0.90;
  var ROSTER_XP_WEIGHT_PER_POINT = 0.05;
  var ROSTER_XP_WEIGHT_CAP = 1.35;

  function normalizeSizeKey(enemy) {
    if (!enemy) return 'medium';
    var raw = String(enemy.size || enemy.runtimeSize || 'medium').trim().toLowerCase();
    if (raw === 'very large' || raw === 'verylarge') return 'xl';
    if (SIZE_EXP_MULTIPLIERS[raw] != null) return raw;
    if (enemy.isBoss && !raw) return 'boss';
    return 'medium';
  }

  function sizeExpMultiplier(enemy) {
    var key = normalizeSizeKey(enemy);
    return SIZE_EXP_MULTIPLIERS[key] != null ? SIZE_EXP_MULTIPLIERS[key] : SIZE_EXP_MULTIPLIERS.medium;
  }

  function resolveEncounterRole(enemy) {
    if (!enemy) return 'normal';
    if (enemy.isBoss) return 'boss';
    if (enemy.isElite) return 'elite';
    var tier = String(enemy.combatTier || enemy.enemyTier || '').toLowerCase();
    if (tier === 'elite' || tier === 'lieutenant') return 'elite';
    if (tier === 'boss') return 'boss';
    var encounterType = String(enemy.encounterType || '').toLowerCase();
    if (encounterType.indexOf('elite') >= 0) return 'elite';
    if (encounterType.indexOf('boss') >= 0) return 'boss';
    return 'normal';
  }

  function roleExpMultiplier(enemy) {
    var role = resolveEncounterRole(enemy);
    if (role === 'boss') return ROLE_EXP_MULTIPLIERS.normal;
    return ROLE_EXP_MULTIPLIERS[role] != null ? ROLE_EXP_MULTIPLIERS[role] : ROLE_EXP_MULTIPLIERS.normal;
  }

  function getSpeciesTierForEnemy(enemy, ctx) {
    if (!enemy) return 'grey';
    if (enemy.speciesTier) return String(enemy.speciesTier).toLowerCase();
    var rosterRow = null;
    if (ctx && typeof ctx.getRosterRow === 'function' && enemy.rosterId) {
      rosterRow = ctx.getRosterRow(enemy.rosterId);
    } else if (typeof global.getEnemyRosterRow === 'function' && enemy.rosterId) {
      rosterRow = global.getEnemyRosterRow(enemy.rosterId);
    }
    if (rosterRow && rosterRow.speciesTier) return String(rosterRow.speciesTier).toLowerCase();
    var birdKey = enemy.birdKey || rosterRow && rosterRow.birdKey;
    if (birdKey && typeof Avian.systems?.enemyRoster?.getBirdSpeciesTier === 'function') {
      return Avian.systems.enemyRoster.getBirdSpeciesTier(birdKey);
    }
    if (typeof global.getStorySpeciesTierForStage === 'function' && ctx && !ctx.isEndlessRunActive) {
      var stageTier = global.getStorySpeciesTierForStage(ctx.stage);
      if (stageTier) return stageTier;
    }
    return 'grey';
  }

  function speciesTierExpMultiplier(enemy, ctx) {
    var tier = getSpeciesTierForEnemy(enemy, ctx);
    return SPECIES_TIER_EXP_MULTIPLIERS[tier] != null ? SPECIES_TIER_EXP_MULTIPLIERS[tier] : SPECIES_TIER_EXP_MULTIPLIERS.grey;
  }

  function difficultyExpMultiplier(difficultyId, isEndlessRunActive) {
    var id = String(difficultyId || 'juvenile').toLowerCase();
    var table = isEndlessRunActive ? ENDLESS_DIFFICULTY_EXP_MULTIPLIERS : STORY_DIFFICULTY_EXP_MULTIPLIERS;
    return table[id] != null ? table[id] : 1.0;
  }

  function storyActExpMultiplier(stage) {
    var st = Math.max(1, asInt(stage, 1));
    if (st <= 4) return STORY_ACT_EXP_MULTIPLIERS.act1;
    if (st <= 9) return STORY_ACT_EXP_MULTIPLIERS.act2;
    if (st <= 14) return STORY_ACT_EXP_MULTIPLIERS.act3;
    return STORY_ACT_EXP_MULTIPLIERS.finale;
  }

  function stageDepthExpMultiplier(ctx) {
    if (ctx.isEndlessRunActive) {
      var eb = Math.max(0, asInt(ctx.endlessBattle, 0));
      return 1 + Math.min(ENDLESS_BATTLE_EXP_BONUS_CAP, eb * ENDLESS_BATTLE_EXP_BONUS_PER_BATTLE);
    }
    var stage = Math.max(1, asInt(ctx.stage, 1));
    return 1 + Math.min(STORY_STAGE_EXP_BONUS_CAP, (stage - 1) * STORY_STAGE_EXP_BONUS_PER_STAGE);
  }

  function endlessSegmentExpMultiplier(segmentIndex) {
    if (segmentIndex == null) return 1;
    var seg = Math.max(0, asInt(segmentIndex, 0));
    return 1 + Math.min(ENDLESS_SEGMENT_EXP_BONUS_CAP, seg * ENDLESS_SEGMENT_EXP_BONUS_PER_SEGMENT);
  }

  function modeProgressionExpMultiplier(ctx) {
    if (ctx.isEndlessRunActive) {
      return endlessSegmentExpMultiplier(ctx.segmentIndex);
    }
    return storyActExpMultiplier(ctx.stage);
  }

  function rosterXpWeightMultiplier(enemy, ctx) {
    var row = null;
    if (ctx && typeof ctx.getRosterRow === 'function' && enemy && enemy.rosterId) {
      row = ctx.getRosterRow(enemy.rosterId);
    } else if (typeof global.getEnemyRosterRow === 'function' && enemy && enemy.rosterId) {
      row = global.getEnemyRosterRow(enemy.rosterId);
    }
    var weight = row && Number.isFinite(Number(row.xpWeight)) ? Number(row.xpWeight) : 0;
    if (weight <= 0) return 1;
    return clamp(ROSTER_XP_WEIGHT_BASE + weight * ROSTER_XP_WEIGHT_PER_POINT, 0.75, ROSTER_XP_WEIGHT_CAP);
  }

  function resolveBossKind(ctx) {
    if (!ctx.isEndlessRunActive) {
      var stage = Math.max(1, asInt(ctx.stage, 1));
      if (stage >= 20) return 'finale';
      if (stage === 10) return 'milestone';
      return 'milestone';
    }
    if (ctx.segmentIndex != null) return 'endlessSegment';
    return 'endlessLegacy';
  }

  function bossKindExpMultiplier(ctx) {
    var kind = resolveBossKind(ctx);
    return BOSS_KIND_EXP_MULTIPLIERS[kind] != null ? BOSS_KIND_EXP_MULTIPLIERS[kind] : 1;
  }

  function buildAwardBreakdown(enemy, ctx, parts) {
    return Object.freeze({
      enemyLevel: parts.enemyLevel,
      playerLevel: parts.playerLevel,
      baseExp: parts.baseExp,
      size: normalizeSizeKey(enemy),
      speciesTier: getSpeciesTierForEnemy(enemy, ctx),
      encounterRole: resolveEncounterRole(enemy),
      bossKind: enemy && enemy.isBoss ? resolveBossKind(ctx) : null,
      multipliers: Object.freeze({
        size: parts.sizeMult,
        role: parts.roleMult,
        speciesTier: parts.speciesMult,
        difficulty: parts.difficultyMult,
        modeProgression: parts.modeMult,
        stageDepth: parts.depthMult,
        relativeLevel: parts.relativeMult,
        rosterWeight: parts.rosterMult,
        bossKind: parts.bossKindMult || 1,
      }),
      rawExp: parts.rawExp,
      cappedExp: parts.finalExp,
      isEndlessRunActive: !!ctx.isEndlessRunActive,
    });
  }

  function applyEndlessCaps(exp, playerLevel, isBoss, expForLevelFn) {
    if (typeof expForLevelFn !== 'function') return Math.max(1, Math.round(exp));
    var plv = Math.max(1, asInt(playerLevel, 1));
    var nextLevelExp = expForLevelFn(plv + 1);
    var capPct = isBoss ? ENDLESS_EXP_BOSS_CAP_PCT : ENDLESS_EXP_NORMAL_CAP_PCT;
    var cap = Math.max(1, Math.round(nextLevelExp * capPct));
    return Math.max(1, Math.min(Math.round(exp), cap));
  }

  function computeNormalAward(input) {
    var enemy = input.enemy;
    if (!enemy) return 0;
    var ctx = {
      playerLevel: Math.max(1, asInt(input.playerLevel, 1)),
      stage: Math.max(1, asInt(input.stage, 1)),
      endlessBattle: Math.max(0, asInt(input.endlessBattle, 0)),
      isEndlessRunActive: !!input.isEndlessRunActive,
      difficulty: input.difficulty || 'juvenile',
      segmentIndex: input.segmentIndex,
      getRosterRow: input.getRosterRow || null,
    };
    var enemyLevel = typeof input.getEnemyLevel === 'function'
      ? asInt(input.getEnemyLevel(enemy), 1)
      : asInt(enemy.storyLevel != null ? enemy.storyLevel : enemy.effectiveLevel, 1);
    var baseExp = typeof input.baseExpForLevel === 'function'
      ? input.baseExpForLevel(enemyLevel)
      : asInt(input.baseExp, 0);
    var relativeMult = typeof input.relativeLevelMult === 'function'
      ? input.relativeLevelMult(enemyLevel, ctx.playerLevel)
      : 1;
    var depthMult = typeof input.stageDepthMult === 'function'
      ? input.stageDepthMult()
      : stageDepthExpMultiplier(ctx);
    var sizeMult = sizeExpMultiplier(enemy);
    var roleMult = roleExpMultiplier(enemy);
    var speciesMult = speciesTierExpMultiplier(enemy, ctx);
    var difficultyMult = difficultyExpMultiplier(ctx.difficulty, ctx.isEndlessRunActive);
    var modeMult = modeProgressionExpMultiplier(ctx);
    var rosterMult = rosterXpWeightMultiplier(enemy, ctx);
    var rawExp = Math.max(1, Math.round(
      baseExp * relativeMult * depthMult * sizeMult * roleMult * speciesMult * difficultyMult * modeMult * rosterMult
    ));
    var finalExp = rawExp;
    if (ctx.isEndlessRunActive) {
      finalExp = applyEndlessCaps(rawExp, ctx.playerLevel, false, input.expForLevel);
    }
    if (input.captureBreakdown) {
      input.captureBreakdown(buildAwardBreakdown(enemy, ctx, {
        enemyLevel: enemyLevel,
        playerLevel: ctx.playerLevel,
        baseExp: baseExp,
        sizeMult: sizeMult,
        roleMult: roleMult,
        speciesMult: speciesMult,
        difficultyMult: difficultyMult,
        modeMult: modeMult,
        depthMult: depthMult,
        relativeMult: relativeMult,
        rosterMult: rosterMult,
        rawExp: rawExp,
        finalExp: finalExp,
      }));
    }
    return finalExp;
  }

  function computeBossAward(input) {
    var enemy = input.enemy || null;
    var ctx = {
      playerLevel: Math.max(1, asInt(input.playerLevel, 1)),
      stage: Math.max(1, asInt(input.stage, 1)),
      endlessBattle: Math.max(0, asInt(input.endlessBattle, 0)),
      isEndlessRunActive: !!input.isEndlessRunActive,
      difficulty: input.difficulty || 'juvenile',
      segmentIndex: input.segmentIndex,
      getRosterRow: input.getRosterRow || null,
    };
    var depthMult = typeof input.stageDepthMult === 'function'
      ? input.stageDepthMult()
      : stageDepthExpMultiplier(ctx);
    var sizeMult = sizeExpMultiplier(enemy);
    var speciesMult = speciesTierExpMultiplier(enemy, ctx);
    var difficultyMult = difficultyExpMultiplier(ctx.difficulty, ctx.isEndlessRunActive);
    var modeMult = modeProgressionExpMultiplier(ctx);
    var bossKindMult = bossKindExpMultiplier(ctx);
    var rosterMult = rosterXpWeightMultiplier(enemy, ctx);
    var nextLevelExp = typeof input.expForLevel === 'function'
      ? input.expForLevel(ctx.playerLevel + 1)
      : asInt(input.nextLevelExp, 100);
    var rawExp = Math.round(nextLevelExp * BOSS_BASE_NEXT_LEVEL_PCT * depthMult * sizeMult * speciesMult * difficultyMult * modeMult * bossKindMult * rosterMult);
    if (enemy) {
      var enemyLevel = typeof input.getEnemyLevel === 'function'
        ? asInt(input.getEnemyLevel(enemy), ctx.playerLevel)
        : asInt(enemy.storyLevel != null ? enemy.storyLevel : enemy.effectiveLevel, ctx.playerLevel);
      if (enemyLevel > ctx.playerLevel) {
        rawExp = Math.round(rawExp * (1 + BOSS_OVERLEVEL_BONUS_PER_LEVEL * Math.min(enemyLevel - ctx.playerLevel, BOSS_OVERLEVEL_BONUS_CAP)));
      }
    }
    var finalExp = Math.max(1, rawExp);
    if (ctx.isEndlessRunActive) {
      finalExp = applyEndlessCaps(finalExp, ctx.playerLevel, true, input.expForLevel);
    }
    if (input.captureBreakdown) {
      input.captureBreakdown(buildAwardBreakdown(enemy, ctx, {
        enemyLevel: enemy ? (typeof input.getEnemyLevel === 'function' ? input.getEnemyLevel(enemy) : enemy.storyLevel) : ctx.playerLevel,
        playerLevel: ctx.playerLevel,
        baseExp: nextLevelExp,
        sizeMult: sizeMult,
        roleMult: 1,
        speciesMult: speciesMult,
        difficultyMult: difficultyMult,
        modeMult: modeMult,
        depthMult: depthMult,
        relativeMult: 1,
        rosterMult: rosterMult,
        bossKindMult: bossKindMult,
        rawExp: rawExp,
        finalExp: finalExp,
      }));
    }
    return finalExp;
  }

  Avian.balance.experience = Object.freeze({
    SIZE_EXP_MULTIPLIERS: SIZE_EXP_MULTIPLIERS,
    SPECIES_TIER_EXP_MULTIPLIERS: SPECIES_TIER_EXP_MULTIPLIERS,
    ROLE_EXP_MULTIPLIERS: ROLE_EXP_MULTIPLIERS,
    STORY_DIFFICULTY_EXP_MULTIPLIERS: STORY_DIFFICULTY_EXP_MULTIPLIERS,
    ENDLESS_DIFFICULTY_EXP_MULTIPLIERS: ENDLESS_DIFFICULTY_EXP_MULTIPLIERS,
    STORY_ACT_EXP_MULTIPLIERS: STORY_ACT_EXP_MULTIPLIERS,
    BOSS_KIND_EXP_MULTIPLIERS: BOSS_KIND_EXP_MULTIPLIERS,
    ENDLESS_EXP_NORMAL_CAP_PCT: ENDLESS_EXP_NORMAL_CAP_PCT,
    ENDLESS_EXP_BOSS_CAP_PCT: ENDLESS_EXP_BOSS_CAP_PCT,
    normalizeSizeKey: normalizeSizeKey,
    sizeExpMultiplier: sizeExpMultiplier,
    resolveEncounterRole: resolveEncounterRole,
    roleExpMultiplier: roleExpMultiplier,
    getSpeciesTierForEnemy: getSpeciesTierForEnemy,
    speciesTierExpMultiplier: speciesTierExpMultiplier,
    difficultyExpMultiplier: difficultyExpMultiplier,
    storyActExpMultiplier: storyActExpMultiplier,
    stageDepthExpMultiplier: stageDepthExpMultiplier,
    endlessSegmentExpMultiplier: endlessSegmentExpMultiplier,
    modeProgressionExpMultiplier: modeProgressionExpMultiplier,
    rosterXpWeightMultiplier: rosterXpWeightMultiplier,
    resolveBossKind: resolveBossKind,
    bossKindExpMultiplier: bossKindExpMultiplier,
    applyEndlessCaps: applyEndlessCaps,
    computeNormalAward: computeNormalAward,
    computeBossAward: computeBossAward,
    buildAwardBreakdown: buildAwardBreakdown,
  });
})(typeof window !== 'undefined' ? window : globalThis);
