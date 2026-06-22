/* Feather star growth profiles — major/minor/trace stat bands per class and bird. */
(function () {
  'use strict';

  var GROWTH_RATES = {
    major: 0.010,
    minor: 0.006,
    trace: 0.003,
  };

  var LOCKED_STAT_KEYS = ['acc', 'critChance', 'critMult', 'cc', 'cd'];

  var CLASS_PROFILES = {
    knight: {
      major: ['maxHp', 'def'],
      minor: ['atk', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    rogue: {
      major: ['spd', 'dodge'],
      minor: ['atk', 'maxHp'],
      trace: ['def', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    mage: {
      major: ['matk', 'mdef'],
      minor: ['spd', 'maxHp'],
      trace: ['def', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk'],
    },
    siren: {
      major: ['matk', 'spd'],
      minor: ['mdef', 'dodge'],
      trace: ['maxHp', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk'],
    },
    inquisitor: {
      major: ['maxHp', 'mdef'],
      minor: ['atk', 'matk'],
      trace: ['def', 'spd'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'dodge'],
    },
    bard: {
      major: ['spd', 'matk'],
      minor: ['atk', 'mdef'],
      trace: ['maxHp', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'def'],
    },
    brute: {
      major: ['maxHp', 'atk'],
      minor: ['def', 'spd'],
      trace: ['mdef', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    duke: {
      major: ['maxHp', 'matk'],
      minor: ['mdef', 'def'],
      trace: ['spd', 'atk'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'dodge'],
    },
  };

  /** Bird-specific overrides (class default used when absent). */
  var BIRD_OVERRIDES = {
    goose: {
      major: ['maxHp', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    pelican: {
      major: ['maxHp', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    shoebill: {
      major: ['maxHp', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    cassowary: {
      major: ['maxHp', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    emu: {
      major: ['maxHp', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    ostrich: {
      major: ['maxHp', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    peregrine: {
      major: ['spd', 'atk'],
      minor: ['dodge', 'maxHp'],
      trace: ['def', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    barnowl: {
      major: ['matk', 'mdef'],
      minor: ['spd', 'dodge'],
      trace: ['maxHp', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk'],
    },
    swan: {
      major: ['maxHp', 'mdef'],
      minor: ['matk', 'def'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk'],
    },
  };

  function normalizeStatKeyForGrowth(statKey) {
    var k = String(statKey || '').toLowerCase();
    if (k === 'hp') return 'maxHp';
    return k;
  }

  function normalizeClassKey(className) {
    var raw = String(className || 'rogue').toLowerCase().replace(/[^a-z]/g, '');
    if (raw === 'dukeblakiston') return 'duke';
    return CLASS_PROFILES[raw] ? raw : 'rogue';
  }

  function cloneProfile(profile) {
    return {
      major: (profile.major || []).slice(),
      minor: (profile.minor || []).slice(),
      trace: (profile.trace || []).slice(),
      locked: (profile.locked || LOCKED_STAT_KEYS).slice(),
    };
  }

  function getGrowthProfileForBird(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bk = String(birdKey || '').trim();
    if (bk && BIRD_OVERRIDES[bk]) return cloneProfile(BIRD_OVERRIDES[bk]);
    var bd = birds[bk];
    var cls = normalizeClassKey(bd && bd.class);
    return cloneProfile(CLASS_PROFILES[cls] || CLASS_PROFILES.rogue);
  }

  function getTotalFeatherStars(tier, stars) {
    var tiers = globalThis.Avian && Avian.data && Avian.data.birdCardTiers;
    var t = tiers && typeof tiers.normalizeTier === 'function' ? tiers.normalizeTier(tier) : String(tier || 'grey').toLowerCase();
    var s = tiers && typeof tiers.clampStars === 'function' ? tiers.clampStars(stars) : Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
    var idx = tiers && typeof tiers.tierIndex === 'function' ? tiers.tierIndex(t) : 0;
    if (idx < 0) idx = 0;
    var perTier = tiers && tiers.STARS_PER_TIER != null ? tiers.STARS_PER_TIER : 5;
    return Math.max(0, Math.min(30, idx * perTier + s));
  }

  function getGrowthBandForStat(statKey, profile) {
    var key = normalizeStatKeyForGrowth(statKey);
    if (!profile) return null;
    if (profile.locked && profile.locked.indexOf(key) >= 0) return 'locked';
    if (profile.major && profile.major.indexOf(key) >= 0) return 'major';
    if (profile.minor && profile.minor.indexOf(key) >= 0) return 'minor';
    if (profile.trace && profile.trace.indexOf(key) >= 0) return 'trace';
    return 'locked';
  }

  function getGrowthBonusForStat(statKey, profile, totalStars) {
    var band = getGrowthBandForStat(statKey, profile);
    if (!band || band === 'locked') return 0;
    var stars = Math.max(0, Math.min(30, Math.floor(Number(totalStars) || 0)));
    return stars * (GROWTH_RATES[band] || 0);
  }

  function getGrowthTierLabelForStat(statKey, profile) {
    var band = getGrowthBandForStat(statKey, profile);
    if (band === 'major') return 'Major +1.00%/star';
    if (band === 'minor') return 'Minor +0.60%/star';
    if (band === 'trace') return 'Trace +0.30%/star';
    return 'Locked';
  }

  function applyFeatherGrowthToStat(baseVal, statKey, profile, totalStars) {
    var key = normalizeStatKeyForGrowth(statKey);
    var base = Math.max(0, Number(baseVal) || 0);
    if (!base) return base;
    var bonus = getGrowthBonusForStat(key, profile, totalStars);
    var scaled = base * (1 + bonus);
    if (key === 'dodge') return Math.max(0, Math.round(scaled));
    return Math.max(1, Math.round(scaled));
  }

  function getEffectiveStatRatioForStat(statKey, birdKey, tier, stars) {
    var profile = getGrowthProfileForBird(birdKey);
    var totalStars = getTotalFeatherStars(tier, stars);
    var bonus = getGrowthBonusForStat(statKey, profile, totalStars);
    return 1 + bonus;
  }

  var pack = {
    GROWTH_RATES: GROWTH_RATES,
    LOCKED_STAT_KEYS: LOCKED_STAT_KEYS,
    CLASS_PROFILES: CLASS_PROFILES,
    BIRD_OVERRIDES: BIRD_OVERRIDES,
    normalizeStatKeyForGrowth: normalizeStatKeyForGrowth,
    getGrowthProfileForBird: getGrowthProfileForBird,
    getTotalFeatherStars: getTotalFeatherStars,
    getGrowthBandForStat: getGrowthBandForStat,
    getGrowthBonusForStat: getGrowthBonusForStat,
    getGrowthTierLabelForStat: getGrowthTierLabelForStat,
    applyFeatherGrowthToStat: applyFeatherGrowthToStat,
    getEffectiveStatRatioForStat: getEffectiveStatRatioForStat,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.featherGrowthProfiles = Object.freeze(pack);

  globalThis.getGrowthProfileForBird = getGrowthProfileForBird;
  globalThis.getTotalFeatherStars = getTotalFeatherStars;
  globalThis.getGrowthBonusForStat = getGrowthBonusForStat;
  globalThis.applyFeatherGrowthToStat = applyFeatherGrowthToStat;
  globalThis.getEffectiveStatRatioForStat = getEffectiveStatRatioForStat;
})();
