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
      major: ['vitality', 'def'],
      minor: ['atk', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    rogue: {
      major: ['dex', 'spd'],
      minor: ['dodge', 'vitality'],
      trace: ['atk', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    mage: {
      major: ['matk', 'mdef'],
      minor: ['spd', 'vitality'],
      trace: ['def', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk', 'dex'],
    },
    siren: {
      major: ['matk', 'spd'],
      minor: ['mdef', 'dodge'],
      trace: ['vitality', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk', 'dex'],
    },
    inquisitor: {
      major: ['vitality', 'mdef'],
      minor: ['atk', 'matk'],
      trace: ['def', 'spd'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'dodge', 'dex'],
    },
    bard: {
      major: ['spd', 'matk'],
      minor: ['dex', 'mdef'],
      trace: ['vitality', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'def'],
    },
    brute: {
      major: ['vitality', 'atk'],
      minor: ['def', 'spd'],
      trace: ['mdef', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    duke: {
      major: ['vitality', 'matk'],
      minor: ['mdef', 'def'],
      trace: ['spd', 'atk'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'dodge', 'dex'],
    },
  };

  /** Bird-specific overrides (class default used when absent). */
  var BIRD_OVERRIDES = {
    goose: {
      major: ['vitality', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    pelican: {
      major: ['vitality', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    shoebill: {
      major: ['vitality', 'atk'],
      minor: ['def', 'mdef'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    cassowary: {
      major: ['vitality', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    emu: {
      major: ['vitality', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    ostrich: {
      major: ['vitality', 'atk'],
      minor: ['spd', 'def'],
      trace: ['dodge', 'mdef'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk', 'dex'],
    },
    peregrine: {
      major: ['dex', 'spd'],
      minor: ['atk', 'vitality'],
      trace: ['dodge', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'matk'],
    },
    barnowl: {
      major: ['matk', 'mdef'],
      minor: ['spd', 'dodge'],
      trace: ['vitality', 'def'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk', 'dex'],
    },
    swan: {
      major: ['vitality', 'mdef'],
      minor: ['matk', 'def'],
      trace: ['spd', 'dodge'],
      locked: ['acc', 'critChance', 'critMult', 'cc', 'cd', 'atk', 'dex'],
    },
  };

  function normalizeStatKeyForGrowth(statKey) {
    var k = String(statKey || '').toLowerCase();
    if (k === 'hp' || k === 'maxhp') return 'vitality';
    if (k === 'dexterity') return 'dex';
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

  function roundGrowthStat(n, floor) {
    if (typeof globalThis.roundCombatStat === 'function') {
      return globalThis.roundCombatStat(n, floor);
    }
    return Math.max(floor, Math.round(Number(n) * 100) / 100);
  }

  function applyFeatherGrowthToStat(baseVal, statKey, profile, totalStars) {
    var key = normalizeStatKeyForGrowth(statKey);
    var base = Math.max(0, Number(baseVal) || 0);
    var bonus = getGrowthBonusForStat(key, profile, totalStars);
    if (!bonus) return key === 'dodge' ? roundGrowthStat(base, 0) : (base ? roundGrowthStat(base, key === 'vitality' ? 0 : 1) : base);
    /* Vitality may start at 0; grow from a 1-point effective base so starring still matters. */
    var scaleBase = base;
    if (key === 'vitality' && !(scaleBase > 0) && bonus > 0) scaleBase = 1;
    if (!scaleBase) return base;
    var scaled = scaleBase * (1 + bonus);
    if (key === 'dodge') return roundGrowthStat(scaled, 0);
    if (key === 'vitality') return roundGrowthStat(scaled, 0);
    return roundGrowthStat(scaled, 1);
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
