/* Bird card tier progression — stats, passives at run/preview time. */
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

  function clampStars(stars) {
    var pack = tiers();
    return pack && typeof pack.clampStars === 'function' ? pack.clampStars(stars) : Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
  }

  function getPassiveBonusAtTier(birdKey, tier) {
    var data = scalingData();
    if (!data || !data[birdKey]) return null;
    var row = data[birdKey];
    var t = normalizeTier(tier);
    if (t === 'orange' && row.orange && typeof row.orange === 'object') return row.orange.bonus;
    if (row[t] != null) return Number(row[t]);
    return row.grey != null ? Number(row.grey) : null;
  }

  function getPassiveBonusFraction(birdKey, tier, stars) {
    var t = tiers();
    var tierNorm = normalizeTier(tier);
    var s = clampStars(stars);
    var base = getPassiveBonusAtTier(birdKey, tierNorm);
    if (base == null) return null;
    if (!t || typeof t.nextTier !== 'function' || typeof t.STARS_PER_TIER !== 'number') return base;
    var nxt = t.nextTier(tierNorm);
    if (!nxt) return base;
    var nextBonus = getPassiveBonusAtTier(birdKey, nxt);
    if (nextBonus == null) return base;
    return base + (nextBonus - base) * (s / t.STARS_PER_TIER);
  }

  function formatPassiveEffectForTier(birdKey, tier, stars) {
    var data = scalingData();
    var birds = globalThis.BIRDS || {};
    var starVal = stars != null ? stars : (typeof globalThis.getBirdCardStars === 'function' ? globalThis.getBirdCardStars(birdKey) : 0);
    var frac = getPassiveBonusFraction(birdKey, tier, starVal);
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

  function excludedStarScalingKeys() {
    var t = tiers();
    if (t && Array.isArray(t.STAR_SCALING_EXCLUDED_STAT_KEYS)) return t.STAR_SCALING_EXCLUDED_STAT_KEYS;
    return ['acc', 'critChance', 'critMult', 'cc', 'cd'];
  }

  function scaleBirdCardStatValue(baseVal, key, mult) {
    if (excludedStarScalingKeys().indexOf(key) >= 0) {
      return Number(baseVal) || 0;
    }
    var base = Math.max(0, Number(baseVal) || 0);
    if (!base) return base;
    var scaled = base * mult;
    if (key === 'dodge') return Math.max(0, Math.round(scaled));
    return Math.max(1, Math.round(scaled));
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
    var mult = typeof t.getEffectiveStatMultiplier === 'function'
      ? t.getEffectiveStatMultiplier(tier, s)
      : t.getTierStatMultiplier(tier);

    t.SCALED_STAT_KEYS.forEach(function (key) {
      if (base[key] == null) return;
      var val = scaleBirdCardStatValue(base[key], key, mult);
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
