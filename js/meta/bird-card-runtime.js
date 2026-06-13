/* Bird card tier progression — stats, abilities, passive tier at run/preview time. */
(function () {
  'use strict';

  function tiers() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
  }

  function scalingData() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardPassiveScaling;
  }

  function normalizeTier(t) {
    var pack = tiers();
    return pack && typeof pack.normalizeTier === 'function' ? pack.normalizeTier(t) : String(t || 'grey').toLowerCase();
  }

  function getPassiveBonusFraction(birdKey, tier) {
    var data = scalingData();
    if (!data || !data[birdKey]) return null;
    var row = data[birdKey];
    var t = normalizeTier(tier);
    if (t === 'orange' && row.orange && typeof row.orange === 'object') return row.orange.bonus;
    if (row[t] != null) return Number(row[t]);
    return row.grey != null ? Number(row.grey) : null;
  }

  function formatPassiveEffectForTier(birdKey, tier) {
    var data = scalingData();
    var birds = globalThis.BIRDS || {};
    var frac = getPassiveBonusFraction(birdKey, tier);
    if (data && data[birdKey] && data[birdKey].effectTemplate && frac != null) {
      var pct = (frac * 100).toFixed(frac * 100 % 1 === 0 ? 0 : 1);
      return String(data[birdKey].effectTemplate).replace('{pct}', pct);
    }
    if (typeof globalThis.getBirdPassiveInfo === 'function') {
      var info = globalThis.getBirdPassiveInfo(birdKey);
      if (info) return info.desc || info.effect || '';
    }
    var bd = birds[birdKey];
    return (bd && bd.passive && (bd.passive.desc || bd.passive.effect)) || '';
  }

  function statGuardKey(key) {
    if (key === 'maxHp' || key === 'hp') return 'hp';
    if (key === 'dodge') return 'dodge';
    if (key === 'acc') return 'acc';
    if (key === 'def' || key === 'mdef') return 'def';
    return null;
  }

  function applyBirdCardStats(player, tier) {
    var t = tiers();
    var birds = globalThis.BIRDS || {};
    if (!player || !t || !player.birdKey) return;
    var bd = birds[player.birdKey];
    if (!bd || !bd.stats) return;

    var size = player.size || bd.size || 'medium';
    var base = bd.stats;
    var fromCard = {};
    var scaled = {};

    t.SCALED_STAT_KEYS.forEach(function (key) {
      if (base[key] == null) return;
      var guard = statGuardKey(key);
      var val = guard
        ? t.applyGuardrailedStatMult(base[key], guard, tier, size)
        : Math.max(key === 'dodge' || key === 'acc' ? 0 : 1, Math.round(base[key] * t.getTierStatMultiplier(tier)));
      scaled[key] = val;
      fromCard[key] = val - (Number(base[key]) || 0);
    });

    Object.keys(scaled).forEach(function (key) {
      player.stats[key] = scaled[key];
    });
    if (player.stats.maxHp != null && player.stats.hp != null && base.hp != null && base.maxHp != null) {
      var hpRatio = base.maxHp > 0 ? base.hp / base.maxHp : 1;
      player.stats.hp = Math.max(1, Math.round((player.stats.maxHp || player.stats.hp) * hpRatio));
    }

    if (typeof globalThis.ensureStatLedger === 'function') {
      var L = globalThis.ensureStatLedger(player);
      if (L) {
        L.birdBaseline = L.birdBaseline || {};
        if (!Object.keys(L.birdBaseline).length && typeof globalThis.cloneStatLedgerSlice === 'function') {
          L.birdBaseline = globalThis.cloneStatLedgerSlice(base);
        }
        L.fromCardTier = fromCard;
      }
    }
  }

  function preferPowerPath(options) {
    if (!options || !options.length) return null;
    var power = options.find(function (o) {
      return String(o.pathId || '').toLowerCase() === 'power';
    });
    return power || options[0];
  }

  function applyBirdCardAbilities(player, tier) {
    if (!player || typeof globalThis.usesFamilySkillEvolution !== 'function') return;
    if (!globalThis.usesFamilySkillEvolution(player)) return;
    if (typeof globalThis.ensureFamilyEvolutionState !== 'function') return;

    globalThis.ensureFamilyEvolutionState(player);
    var t = tiers();
    var birdKey = player.birdKey;
    var slots =
      typeof globalThis.getSkillSlots === 'function' ? globalThis.getSkillSlots(player) : player.familyEvolutionState?.skillSlots || [];

    if (t.tierIndex(tier) >= t.tierIndex('green')) {
      var slot2 = slots.find(function (s) {
        return s.slotIndex === 2;
      });
      if (slot2 && slot2.familyId && !slot2.pathId && typeof globalThis.getSkillEvolutionPathOptions === 'function') {
        var opts2 = globalThis.getSkillEvolutionPathOptions(slot2, birdKey);
        var pick2 = preferPowerPath(opts2);
        if (pick2 && typeof globalThis.applySkillPathSelection === 'function') {
          globalThis.applySkillPathSelection(slot2, pick2.pathId, player);
        }
      }
    }

    if (t.tierIndex(tier) >= t.tierIndex('purple')) {
      var slot0 = slots.find(function (s) {
        return s.slotIndex === 0;
      });
      if (slot0 && slot0.familyId) {
        if (!slot0.pathId && typeof globalThis.getSkillEvolutionPathOptions === 'function') {
          var opts0 = globalThis.getSkillEvolutionPathOptions(slot0, birdKey);
          var pick0 = preferPowerPath(opts0);
          if (pick0 && typeof globalThis.applySkillPathSelection === 'function') {
            globalThis.applySkillPathSelection(slot0, pick0.pathId, player);
          }
        }
        if (typeof globalThis.autoUpgradeSkillSlotTier === 'function' && typeof globalThis.slotCanTierUp === 'function') {
          while (globalThis.slotCanTierUp(slot0, birdKey) && (slot0.tier || 0) < 3) {
            globalThis.autoUpgradeSkillSlotTier(slot0, player);
          }
        }
      }
    }

    if (typeof globalThis.syncPlayerAbilitiesFromSkillSlots === 'function') {
      globalThis.syncPlayerAbilitiesFromSkillSlots(player);
    }
  }

  function applyBirdCardProgression(player) {
    if (!player || !player.birdKey) return player;
    var tier =
      typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(player.birdKey) : 'grey';
    tier = normalizeTier(tier);
    player._birdCardTier = tier;
    if (!player.stats) return player;
    applyBirdCardStats(player, tier);
    applyBirdCardAbilities(player, tier);
    return player;
  }

  function getTierAbilityUnlockSummary(birdKey, tier) {
    var t = tiers();
    if (!t) return [];
    var out = [];
    if (t.tierIndex(tier) >= t.tierIndex('green')) out.push('Green: 3rd ability path unlocked');
    if (t.tierIndex(tier) >= t.tierIndex('purple')) out.push('Purple: Signature ability (tier 3)');
    return out;
  }

  var pack = {
    applyBirdCardProgression: applyBirdCardProgression,
    getPassiveBonusFraction: getPassiveBonusFraction,
    formatPassiveEffectForTier: formatPassiveEffectForTier,
    getTierAbilityUnlockSummary: getTierAbilityUnlockSummary,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.birdCardRuntime = pack;

  globalThis.applyBirdCardProgression = applyBirdCardProgression;
  globalThis.formatPassiveEffectForTier = formatPassiveEffectForTier;
  globalThis.getPassiveBonusFraction = getPassiveBonusFraction;
  globalThis.getTierAbilityUnlockSummary = getTierAbilityUnlockSummary;
})();
