/**
 * Enemy skill materialization from workbook bird kits (7-slot, base abilities only).
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

    var isPlayer = kitOpts.forPlayer === true
      || (global.G && global.G.player && enemy === global.G.player);
    var unlockedCount;
    if (isPlayer) {
      unlockedCount = typeof global.getCardTierSlotCount === 'function'
        ? global.getCardTierSlotCount(enemy)
        : 2;
    } else if (Number.isFinite(Number(kitOpts.unlockSlots))) {
      unlockedCount = Math.max(0, Math.min(7, Math.floor(Number(kitOpts.unlockSlots))));
    } else {
      unlockedCount = getEnemyUnlockedSlotCount(enemyLevel);
    }

    var slots = baseSlots.map(function (base, idx) {
      var slot = typeof global.normalizeSkillSlotState === 'function'
        ? global.normalizeSkillSlotState(JSON.parse(JSON.stringify(base)), base, birdKey)
        : base;
      if (idx >= unlockedCount) {
        return typeof global.createSkillSlotState === 'function'
          ? global.createSkillSlotState(slot.slotIndex, slot.familyId, '')
          : slot;
      }
      var fam = typeof global.getSkillSlotFamilyDef === 'function'
        ? global.getSkillSlotFamilyDef(slot, birdKey)
        : null;
      if (fam && fam.baseAbilityId) {
        slot.abilityId = fam.baseAbilityId;
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
  ns.materializeEnemySkillsFromWorkbookKit = materializeEnemySkillsFromWorkbookKit;
  ns.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  ns.inferAIPersonalityFromClass = inferAIPersonalityFromClass;

  global.getEnemyUnlockedSlotCount = getEnemyUnlockedSlotCount;
  global.getEnemyUnlockedSlotCountForTier = getEnemyUnlockedSlotCountForTier;
  global.materializeEnemySkillsFromWorkbookKit = materializeEnemySkillsFromWorkbookKit;
  global.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  global.inferAIPersonalityFromClass = inferAIPersonalityFromClass;
})();
