/**
 * Enemy skill evolution: base starters only unless player has mirrored mutations.
 */
(function initEnemyAbilities(global) {
  'use strict';

  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.enemyAbilities = Avian.systems.enemyAbilities || {};

  function getEnemyMutatedAbilityBudget(enemyLevel) {
    var lv = Math.max(1, Math.floor(Number(enemyLevel) || 1));
    if (lv <= 2) return { slots: 0, tiers: [] };
    if (lv === 3) return { slots: 1, tiers: [1] };
    if (lv <= 5) return { slots: 1, tiers: [1] };
    if (lv === 6) return { slots: 2, tiers: [1, 1] };
    if (lv <= 8) return { slots: 2, tiers: [1, 1] };
    if (lv <= 11) return { slots: 2, tiers: [2, 1] };
    return { slots: 2, tiers: [2, 2] };
  }

  function getPathBranchFromSlot(slot, birdKey) {
    if (!slot || !slot.pathId) return null;
    var pid = String(slot.pathId).toLowerCase();
    if (pid === 'power' || pid === 'ailment' || pid === 'utility') return pid;
    var pathDef = typeof global.getSkillSlotPathDef === 'function'
      ? global.getSkillSlotPathDef(slot, birdKey)
      : null;
    if (pathDef && pathDef.pathId) return String(pathDef.pathId).toLowerCase();
    return pid;
  }

  function chooseEquivalentPathForSlot(slot, branch, birdKey, cls) {
    if (!slot || !branch) return null;
    var family = typeof global.getSkillSlotFamilyDef === 'function'
      ? global.getSkillSlotFamilyDef(slot, birdKey)
      : null;
    if (family && family.paths && family.paths[branch]) return branch;
    var options = typeof global.getSkillEvolutionPathOptions === 'function'
      ? global.getSkillEvolutionPathOptions(slot, birdKey) || []
      : [];
    for (var i = 0; i < options.length; i++) {
      if (String(options[i].pathId).toLowerCase() === branch) return options[i].pathId;
    }
    if (typeof global.chooseStoryPathForSlot === 'function') {
      return global.chooseStoryPathForSlot(slot, birdKey, cls || 'striker');
    }
    return options[0] ? options[0].pathId : null;
  }

  function getPlayerMutatedSlots(player) {
    if (!player) return [];
    var slots = typeof global.getSkillSlots === 'function' ? global.getSkillSlots(player) : [];
    return slots
      .filter(function (slot) { return !!(slot && slot.pathId); })
      .sort(function (a, b) { return (a.slotIndex || 0) - (b.slotIndex || 0); });
  }

  function mirrorPlayerMutationsToEnemy(enemy, player, budget, enemyBirdKey, enemyClass) {
    if (!enemy || !player || !budget || budget.slots <= 0) return false;
    var mutated = getPlayerMutatedSlots(player);
    if (!mutated.length) return false;

    var birdKey = String(enemyBirdKey || enemy.birdKey || 'sparrow');
    var cls = String(enemyClass || enemy.enemyClass || 'striker').toLowerCase();
    var slots = enemy.familyEvolutionState && enemy.familyEvolutionState.skillSlots;
    if (!Array.isArray(slots) || !slots.length) return false;

    var count = Math.min(mutated.length, budget.slots, slots.length);
    var playerBirdKey = player.birdKey || 'sparrow';

    for (var i = 0; i < count; i++) {
      var playerSlot = mutated[i];
      var enemySlot = slots.find(function (s) { return s.slotIndex === playerSlot.slotIndex; })
        || slots[i];
      if (!enemySlot) continue;

      var branch = getPathBranchFromSlot(playerSlot, playerBirdKey);
      if (!branch) continue;

      var pathId = chooseEquivalentPathForSlot(enemySlot, branch, birdKey, cls);
      if (!pathId || typeof global.applySkillPathSelection !== 'function') continue;

      global.applySkillPathSelection(enemySlot, pathId, enemy);

      var targetTier = Math.max(1, Math.floor(Number(budget.tiers[i]) || 1));
      while ((enemySlot.tier || 0) < targetTier) {
        if (typeof global.slotCanTierUp === 'function' && !global.slotCanTierUp(enemySlot, birdKey)) break;
        if (typeof global.autoUpgradeSkillSlotTier !== 'function') break;
        var upgraded = global.autoUpgradeSkillSlotTier(enemySlot, enemy);
        if (!upgraded) break;
      }
    }
    return true;
  }

  function materializeEnemySkillsFromPlayerMirror(enemy, birdKey, enemyLevel, player, enemyClass) {
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
    enemy.familyEvolutionState.skillSlots = baseSlots.map(function (b) {
      return typeof global.normalizeSkillSlotState === 'function'
        ? global.normalizeSkillSlotState(JSON.parse(JSON.stringify(b)), b, birdKey)
        : b;
    });

    var budget = getEnemyMutatedAbilityBudget(enemyLevel);
    if (budget.slots > 0 && player) {
      mirrorPlayerMutationsToEnemy(enemy, player, budget, birdKey, enemyClass);
    }

    if (typeof global.syncPlayerAbilitiesFromSkillSlots === 'function') {
      global.syncPlayerAbilitiesFromSkillSlots(enemy);
    }
    return true;
  }

  function inferAIPersonalityFromClass(cls) {
    var c = String(cls || 'striker').toLowerCase();
    if (c === 'striker') return 'aggressive';
    if (c === 'singer') return 'seer';
    if (c === 'trickster') return 'control';
    if (c === 'tank') return 'tank';
    if (c === 'predator') return 'predator';
    if (c === 'bruiser') return 'tactical';
    return 'tactical';
  }

  ns.getEnemyMutatedAbilityBudget = getEnemyMutatedAbilityBudget;
  ns.getPathBranchFromSlot = getPathBranchFromSlot;
  ns.chooseEquivalentPathForSlot = chooseEquivalentPathForSlot;
  ns.mirrorPlayerMutationsToEnemy = mirrorPlayerMutationsToEnemy;
  ns.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  ns.inferAIPersonalityFromClass = inferAIPersonalityFromClass;

  global.getEnemyMutatedAbilityBudget = getEnemyMutatedAbilityBudget;
  global.mirrorPlayerMutationsToEnemy = mirrorPlayerMutationsToEnemy;
  global.materializeEnemySkillsFromPlayerMirror = materializeEnemySkillsFromPlayerMirror;
  global.inferAIPersonalityFromClass = inferAIPersonalityFromClass;
})();
