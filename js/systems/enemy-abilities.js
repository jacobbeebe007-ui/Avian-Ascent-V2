/**
 * Enemy skill materialization from workbook bird kits (7-slot / Stage 1-3).
 */
(function initEnemyAbilities() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.enemyAbilities = Avian.systems.enemyAbilities || {};

  function getEnemyUnlockedSlotCount(storyLevel) {
    var lv = Math.max(1, Math.floor(Number(storyLevel) || 1));
    if (lv <= 2) return 2;
    if (lv <= 5) return 3;
    if (lv <= 8) return 4;
    if (lv <= 11) return 6;
    return 7;
  }

  /** Bird-card tier -> unlocked skill slot count (grey=2 .. orange=7). */
  function getEnemyUnlockedSlotCountForTier(tier) {
    var order = global.BIRD_CARD_TIER_ORDER
      || (global.Avian && global.Avian.data && global.Avian.data.birdCardTiers && global.Avian.data.birdCardTiers.TIER_ORDER)
      || ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
    var norm = typeof global.normalizeBirdCardTier === 'function'
      ? global.normalizeBirdCardTier(tier)
      : String(tier || 'grey').toLowerCase();
    var idx = order.indexOf(norm);
    if (idx < 0) idx = 0;
    return Math.max(2, Math.min(7, idx + 2));
  }

  /** Bird-card tier (+ stars for clamping) -> mutation stage 1-3. */
  function mutationStageForTierStar(tier, stars) {
    void stars;
    var norm = typeof global.normalizeBirdCardTier === 'function'
      ? global.normalizeBirdCardTier(tier)
      : String(tier || 'grey').toLowerCase();
    if (norm === 'gold' || norm === 'orange') return 3;
    if (norm === 'blue' || norm === 'purple') return 2;
    return 1;
  }

  function slotBiasScore(slotIndex, family, rosterRow) {
    var bias = String((rosterRow && rosterRow.abilityBias) || '').toLowerCase();
    var pack = String((rosterRow && rosterRow.suggestedAbilityPack) || '').toLowerCase();
    var hay = bias + ' ' + pack;
    if (!hay.trim()) return 0;
    var fam = family || {};
    var role = String(fam.role || '').toLowerCase();
    var score = 0;
    if (/light|quick|peck|jab/.test(hay) && slotIndex < 2) score += 2;
    if (/heavy|slam|ultimate|special/.test(hay) && slotIndex >= 4) score += 2;
    if (/bleed/.test(hay) && /bleed|cut|slash|skewer/.test(role)) score += 2;
    if (/poison|toxic/.test(hay) && /poison|toxic|venom/.test(role)) score += 2;
    if (/burn|scorch|ember/.test(hay) && /burn|ember|fire/.test(role)) score += 2;
    if (/control|debuff|weaken|fear/.test(hay) && /purple|utility|aspect|class/.test(role)) score += 1;
    if (/finisher|execute/.test(hay) && slotIndex >= 4) score += 1;
    return score;
  }

  function mutationStageForEnemySlot(storyLevel, slotIndex, family, rosterRow) {
    var lv = Math.max(1, Math.floor(Number(storyLevel) || 1));
    var base = 1;
    if (lv >= 12) base = 3;
    else if (lv >= 6) base = 2;
    var bias = slotBiasScore(slotIndex, family, rosterRow);
    if (bias >= 2 && lv >= 9 && base < 3) base = 3;
    else if (bias >= 1 && lv >= 4 && base < 2) base = 2;
    return Math.max(1, Math.min(3, base));
  }

  function materializeEnemySkillsFromWorkbookKit(enemy, birdKey, enemyLevel, enemyClass, rosterRow, kitOpts) {
    kitOpts = kitOpts || {};
    if (!enemy || !birdKey) return false;
    if (typeof global.usesFamilySkillEvolution !== 'function' || !global.usesFamilySkillEvolution({ birdKey: birdKey })) {
      return false;
    }
    var baseSlots = typeof global.getBaseSkillSlotsForBird === 'function'
      ? global.getBaseSkillSlotsForBird(birdKey)
      : [];
    if (!baseSlots.length) return false;

    if (!enemy.familyEvolutionState || typeof enemy.familyEvolutionState !== 'object') {
      enemy.familyEvolutionState = {};
    }

    var unlockedCount = Number.isFinite(Number(kitOpts.unlockSlots))
      ? Math.max(0, Math.min(7, Math.floor(Number(kitOpts.unlockSlots))))
      : getEnemyUnlockedSlotCount(enemyLevel);
    var forcedMutationStage = Number.isFinite(Number(kitOpts.mutationStage))
      ? Math.max(1, Math.min(3, Math.floor(Number(kitOpts.mutationStage))))
      : null;
    var slots = baseSlots.map(function (base, idx) {
      var slot = typeof global.normalizeSkillSlotState === 'function'
        ? global.normalizeSkillSlotState(JSON.parse(JSON.stringify(base)), base, birdKey)
        : base;
      if (idx >= unlockedCount) {
        return typeof global.createSkillSlotState === 'function'
          ? global.createSkillSlotState(slot.slotIndex, slot.familyId, 'mutation', 0, '', 0, [])
          : slot;
      }
      var fam = typeof global.getSkillSlotFamilyDef === 'function'
        ? global.getSkillSlotFamilyDef(slot, birdKey)
        : null;
      var stage = forcedMutationStage != null
        ? forcedMutationStage
        : mutationStageForEnemySlot(enemyLevel, idx, fam, rosterRow);
      if (fam && fam.maxMutationStage != null) {
        stage = Math.max(1, Math.min(Number(fam.maxMutationStage) || 3, stage));
      }
      if (fam && fam.mutations) {
        var abId = fam.mutations[String(stage)] || fam.baseAbilityId || slot.abilityId;
        slot.pathId = 'mutation';
        slot.mutationStage = stage;
        slot.tier = Math.max(0, stage - 1);
        slot.abilityId = abId;
      } else if (fam && fam.baseAbilityId) {
        slot.abilityId = fam.baseAbilityId;
        slot.pathId = 'mutation';
      }
      return slot;
    });

    enemy.familyEvolutionState.skillSlots = slots;
    if (typeof global.syncPlayerAbilitiesFromSkillSlots === 'function') {
      global.syncPlayerAbilitiesFromSkillSlots(enemy);
    }
    return true;
  }

  function materializeEnemySkillsFromPlayerMirror(enemy, birdKey, enemyLevel, player, enemyClass) {
    return materializeEnemySkillsFromWorkbookKit(enemy, birdKey, enemyLevel, enemyClass, null);
  }

  function inferAIPersonalityFromClass(cls) {
    var c = String(cls || 'striker').toLowerCase();
    if (c === 'striker' || c === 'rogue') return 'aggressive';
    if (c === 'singer' || c === 'siren' || c === 'mage') return 'seer';
    if (c === 'trickster' || c === 'bard') return 'control';
    if (c === 'tank' || c === 'knight') return 'tank';
    if (c === 'predator' || c === 'inquisitor') return 'predator';
    if (c === 'bruiser' || c === 'brute') return 'tactical';
    return 'tactical';
  }

  ns.getEnemyUnlockedSlotCount = getEnemyUnlockedSlotCount;
  ns.getEnemyUnlockedSlotCountForTier = getEnemyUnlockedSlotCountForTier;
  ns.mutationStageForTierStar = mutationStageForTierStar;
  ns.materializeEnemySkillsFromWorkbookKit = materializeEnemySkillsFromWorkbookKit;
  ns.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  ns.inferAIPersonalityFromClass = inferAIPersonalityFromClass;

  global.getEnemyUnlockedSlotCount = getEnemyUnlockedSlotCount;
  global.getEnemyUnlockedSlotCountForTier = getEnemyUnlockedSlotCountForTier;
  global.mutationStageForTierStar = mutationStageForTierStar;
  global.materializeEnemySkillsFromWorkbookKit = materializeEnemySkillsFromWorkbookKit;
  global.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  global.inferAIPersonalityFromClass = inferAIPersonalityFromClass;
})();
