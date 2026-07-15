/**
 * Enemy / player skill materialization from bird startAbilities / slotAbilities.
 * Family-evolution catalogs are not used.
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

  function slotAbilityIdsForBird(birdKey) {
    var birds = global.BIRDS || {};
    var bd = birds[birdKey] || birds[String(birdKey || '')];
    if (!bd) return [];
    if (Array.isArray(bd.slotAbilities) && bd.slotAbilities.length) {
      return bd.slotAbilities.map(function (id) { return id ? String(id) : ''; });
    }
    if (Array.isArray(bd.startAbilities)) {
      return bd.startAbilities.map(function (id) { return id ? String(id) : ''; });
    }
    return [];
  }

  function materializeEnemySkillsFromWorkbookKit(enemy, birdKey, enemyLevel, enemyClass, rosterRow, kitOpts) {
    kitOpts = kitOpts || {};
    if (!enemy || !birdKey) return false;

    var ids = slotAbilityIdsForBird(birdKey);
    if (!ids.length) return false;

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

    if (!enemy.familyEvolutionState || typeof enemy.familyEvolutionState !== 'object') {
      enemy.familyEvolutionState = {};
    }

    var slots = [];
    var abilities = [];
    var makeSlot = typeof global.createSkillSlotState === 'function'
      ? global.createSkillSlotState
      : function (slotIndex, familyId, abilityId) {
        return { slotIndex: slotIndex, familyId: familyId || null, abilityId: String(abilityId || '') };
      };
    var ensureAb = typeof global.ensureAbilityObjectFromTemplate === 'function'
      ? global.ensureAbilityObjectFromTemplate
      : null;

    for (var i = 0; i < 7; i++) {
      var abilityId = (i < unlockedCount && ids[i]) ? String(ids[i]) : '';
      var slot = makeSlot(i, null, abilityId);
      slots.push(slot);
      if (!abilityId) continue;
      var prior = (enemy.abilities || []).find(function (ab) {
        return ab && (ab.id === abilityId || ab.slotIndex === i);
      }) || null;
      if (ensureAb) {
        var ab = ensureAb(abilityId, prior, i, enemy);
        if (i === 0) ab.fixedMainAttackCost = true;
        abilities.push(ab);
      } else {
        abilities.push({ id: abilityId, level: 1, slotIndex: i });
      }
    }

    enemy.familyEvolutionState.skillSlots = slots;
    enemy.abilities = abilities;
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
