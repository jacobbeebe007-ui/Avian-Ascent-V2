/* Bird card tier progression — stats at run/preview time (feather growth profiles). */
(function () {
  'use strict';

  function tiers() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
  }

  function growth() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.featherGrowthProfiles;
  }

  function normalizeTier(t) {
    var pack = tiers();
    return pack && typeof pack.normalizeTier === 'function' ? pack.normalizeTier(t) : String(t || 'grey').toLowerCase();
  }

  function clampStars(stars) {
    var pack = tiers();
    return pack && typeof pack.clampStars === 'function' ? pack.clampStars(stars) : Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
  }

  function getFixedPassiveEffectText(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bd = birds[birdKey];
    if (bd && bd.passive && (bd.passive.desc || bd.passive.effect)) {
      return bd.passive.desc || bd.passive.effect;
    }
    var p = globalThis.Avian && Avian.data && Avian.data.combatPack && Avian.data.combatPack.birdPassives;
    if (p) {
      for (var id in p) {
        if (p[id].birdKey === birdKey) return p[id].effect || '';
      }
    }
    return '';
  }

  /** @deprecated Passives no longer scale with tier or stars. */
  function getPassiveBonusFraction() {
    return null;
  }

  /** @deprecated Passives no longer scale with tier or stars. */
  function formatPassiveEffectForTier(birdKey) {
    return getFixedPassiveEffectText(birdKey);
  }

  function excludedStarScalingKeys() {
    var t = tiers();
    if (t && Array.isArray(t.STAR_SCALING_EXCLUDED_STAT_KEYS)) return t.STAR_SCALING_EXCLUDED_STAT_KEYS;
    return ['acc', 'critChance', 'critMult', 'cc', 'cd'];
  }

  function scaleBirdCardStatValue(baseVal, key, birdKey, tier, stars) {
    if (excludedStarScalingKeys().indexOf(key) >= 0) {
      return Number(baseVal) || 0;
    }
    var gp = growth();
    if (!gp || typeof gp.applyFeatherGrowthToStat !== 'function') {
      return Number(baseVal) || 0;
    }
    var profile = typeof gp.getGrowthProfileForBird === 'function' ? gp.getGrowthProfileForBird(birdKey) : null;
    var totalStars = typeof gp.getTotalFeatherStars === 'function' ? gp.getTotalFeatherStars(tier, stars) : 0;
    return gp.applyFeatherGrowthToStat(baseVal, key, profile, totalStars);
  }

  function applyBirdCardStats(player, tier, stars) {
    var t = tiers();
    var birds = globalThis.BIRDS || {};
    if (!player || !t || !player.birdKey) return;
    var bd = birds[player.birdKey];
    if (!bd || !bd.stats) return;

    var base = bd.stats;
    var fromCard = {};
    var scaled = {};
    var s = clampStars(stars);
    var tierNorm = normalizeTier(tier);

    t.SCALED_STAT_KEYS.forEach(function (key) {
      if (base[key] == null) return;
      var val = scaleBirdCardStatValue(base[key], key, player.birdKey, tierNorm, s);
      scaled[key] = val;
      fromCard[key] = val - (Number(base[key]) || 0);
    });

    excludedStarScalingKeys().forEach(function (key) {
      if (base[key] == null) return;
      scaled[key] = Number(base[key]) || 0;
      fromCard[key] = 0;
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

  function applyBirdCardAbilities(_player, _tier) {
    /* Tier-based ability unlocks removed — redesigned separately. */
  }

  function applyBirdCardProgression(player) {
    if (!player || !player.birdKey) return player;
    var tier =
      typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(player.birdKey) : 'grey';
    var stars =
      typeof globalThis.getBirdCardStars === 'function' ? globalThis.getBirdCardStars(player.birdKey) : 0;
    tier = normalizeTier(tier);
    stars = clampStars(stars);
    player._birdCardTier = tier;
    player._birdCardStars = stars;
    if (!player.stats) return player;
    applyBirdCardStats(player, tier, stars);
    return player;
  }

  function getTierAbilityUnlockSummary(_birdKey, _tier) {
    return [];
  }

  var pack = {
    applyBirdCardProgression: applyBirdCardProgression,
    applyBirdCardStats: applyBirdCardStats,
    getFixedPassiveEffectText: getFixedPassiveEffectText,
    getPassiveBonusFraction: getPassiveBonusFraction,
    formatPassiveEffectForTier: formatPassiveEffectForTier,
    getTierAbilityUnlockSummary: getTierAbilityUnlockSummary,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.birdCardRuntime = pack;

  globalThis.applyBirdCardProgression = applyBirdCardProgression;
  globalThis.applyBirdCardStats = applyBirdCardStats;
  globalThis.formatPassiveEffectForTier = formatPassiveEffectForTier;
  globalThis.getPassiveBonusFraction = getPassiveBonusFraction;
  globalThis.getTierAbilityUnlockSummary = getTierAbilityUnlockSummary;
})();
