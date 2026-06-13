/* Bird card tier constants — star progression, mutation costs, stat multipliers. */
(function () {
  'use strict';

  var TIER_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

  var STARS_PER_TIER = 5;

  var TIER_STAT_MULTIPLIER = {
    grey: 1.0,
    green: 1.05,
    blue: 1.1,
    purple: 1.16,
    gold: 1.23,
    orange: 1.3,
  };

  /** Species Feathers cost per star upgrade within each card tier. */
  var MUTATION_COST_PER_STAR = {
    grey: 20,
    green: 24,
    blue: 28,
    purple: 32,
    gold: 36,
    orange: 40,
  };

  var DUPLICATE_FEATHER_YIELD_DEFAULT = 4;
  var DUPLICATE_FEATHER_YIELD_BY_EGG = {
    cracked: 4,
    feathered: 4,
    gleaming: 4,
    royal: 4,
    ancestral: 4,
  };

  var PITY_THRESHOLDS = {
    choiceAt: 10,
    forceNewAt: 30,
    rareAt: 50,
  };

  var PITY_FORCE_NEW_FEATHER_BONUS = 20;
  var PITY_RARE_FEATHER_BONUS = 40;

  /** Max effective stat bonus above base at Orange (fraction of base). */
  var STAT_GUARD_MAX_BONUS = {
    hp: { tiny: 0.08, small: 0.12, medium: 0.2, large: 0.2, xl: 0.2 },
    def: { tiny: 0.08, small: 0.1, medium: 0.18, large: 0.22, xl: 0.22 },
    acc: { tiny: 0.15, small: 0.12, medium: 0.1, large: 0.04, xl: 0.02 },
    dodge: { tiny: 0.15, small: 0.12, medium: 0.1, large: 0.06, xl: 0.04 },
  };

  var SCALED_STAT_KEYS = ['maxHp', 'hp', 'atk', 'def', 'spd', 'dodge', 'acc', 'mdef', 'matk'];

  var TIER_LABELS = {
    grey: 'Grey',
    green: 'Green',
    blue: 'Blue',
    purple: 'Purple',
    gold: 'Gold',
    orange: 'Orange',
  };

  var TIER_CSS = {
    grey: 'tier-grey',
    green: 'tier-green',
    blue: 'tier-blue',
    purple: 'tier-purple',
    gold: 'tier-gold',
    orange: 'tier-orange',
  };

  function normalizeTier(tier) {
    var t = String(tier || 'grey').toLowerCase();
    return TIER_ORDER.indexOf(t) >= 0 ? t : 'grey';
  }

  function clampStars(stars) {
    return Math.max(0, Math.min(STARS_PER_TIER, Math.floor(Number(stars) || 0)));
  }

  function tierIndex(tier) {
    return TIER_ORDER.indexOf(normalizeTier(tier));
  }

  function nextTier(tier) {
    var i = tierIndex(tier);
    if (i < 0 || i >= TIER_ORDER.length - 1) return null;
    return TIER_ORDER[i + 1];
  }

  function getTierStatMultiplier(tier) {
    return TIER_STAT_MULTIPLIER[normalizeTier(tier)] || 1;
  }

  function getMutationCostPerStar(tier) {
    var t = normalizeTier(tier);
    return Math.max(0, Math.floor(Number(MUTATION_COST_PER_STAR[t]) || 0));
  }

  /** @deprecated Use getMutationCostPerStar — kept for transitional callers. */
  function getMutationCostForTier(currentTier) {
    return getMutationCostPerStar(currentTier);
  }

  function getEffectiveStatMultiplier(tier, stars) {
    var t = normalizeTier(tier);
    var s = clampStars(stars);
    var base = getTierStatMultiplier(t);
    var nxt = nextTier(t);
    var nextMult = nxt ? getTierStatMultiplier(nxt) : base;
    return base + (nextMult - base) * (s / STARS_PER_TIER);
  }

  function canUpgradeBirdCard(tier, stars) {
    var t = normalizeTier(tier);
    var s = clampStars(stars);
    if (s < STARS_PER_TIER) return true;
    return !!nextTier(t);
  }

  function previewUpgrade(tier, stars) {
    var t = normalizeTier(tier);
    var s = clampStars(stars);
    if (s < STARS_PER_TIER) {
      return { tierAfter: t, starsAfter: s + 1, isTierUp: false };
    }
    var nxt = nextTier(t);
    if (!nxt) return { tierAfter: t, starsAfter: s, isTierUp: false };
    return { tierAfter: nxt, starsAfter: 0, isTierUp: true };
  }

  function getDuplicateFeatherYield(eggType) {
    var key = String(eggType || '').toLowerCase();
    if (DUPLICATE_FEATHER_YIELD_BY_EGG[key] != null) return DUPLICATE_FEATHER_YIELD_BY_EGG[key];
    return DUPLICATE_FEATHER_YIELD_DEFAULT;
  }

  function runtimeSizeBucket(size) {
    var s = String(size || 'medium').toLowerCase();
    if (s === 'tiny') return 'tiny';
    if (s === 'small') return 'small';
    if (s === 'xl' || s.indexOf('giant') >= 0) return 'xl';
    if (s.indexOf('large') >= 0 || s === 'very large') return 'large';
    return 'medium';
  }

  function applyGuardrailedStatMult(baseVal, statKey, tier, size, stars) {
    var base = Math.max(0, Number(baseVal) || 0);
    if (!base) return base;
    var mult = getEffectiveStatMultiplier(tier, stars);
    var bucket = runtimeSizeBucket(size);
    var guard = STAT_GUARD_MAX_BONUS[statKey];
    var maxBonusFrac = guard && guard[bucket] != null ? guard[bucket] : null;
    var scaled = base * mult;
    if (maxBonusFrac != null) {
      var cap = base * (1 + maxBonusFrac);
      if (scaled > cap) scaled = cap;
    }
    if (statKey === 'dodge' || statKey === 'acc') return Math.round(scaled);
    return Math.max(1, Math.round(scaled));
  }

  var pack = {
    TIER_ORDER: TIER_ORDER,
    STARS_PER_TIER: STARS_PER_TIER,
    TIER_STAT_MULTIPLIER: TIER_STAT_MULTIPLIER,
    MUTATION_COST_PER_STAR: MUTATION_COST_PER_STAR,
    DUPLICATE_FEATHER_YIELD_DEFAULT: DUPLICATE_FEATHER_YIELD_DEFAULT,
    DUPLICATE_FEATHER_YIELD_BY_EGG: DUPLICATE_FEATHER_YIELD_BY_EGG,
    PITY_THRESHOLDS: PITY_THRESHOLDS,
    PITY_FORCE_NEW_FEATHER_BONUS: PITY_FORCE_NEW_FEATHER_BONUS,
    PITY_RARE_FEATHER_BONUS: PITY_RARE_FEATHER_BONUS,
    STAT_GUARD_MAX_BONUS: STAT_GUARD_MAX_BONUS,
    SCALED_STAT_KEYS: SCALED_STAT_KEYS,
    TIER_LABELS: TIER_LABELS,
    TIER_CSS: TIER_CSS,
    normalizeTier: normalizeTier,
    clampStars: clampStars,
    tierIndex: tierIndex,
    nextTier: nextTier,
    getTierStatMultiplier: getTierStatMultiplier,
    getMutationCostPerStar: getMutationCostPerStar,
    getMutationCostForTier: getMutationCostForTier,
    getEffectiveStatMultiplier: getEffectiveStatMultiplier,
    canUpgradeBirdCard: canUpgradeBirdCard,
    previewUpgrade: previewUpgrade,
    getDuplicateFeatherYield: getDuplicateFeatherYield,
    applyGuardrailedStatMult: applyGuardrailedStatMult,
    runtimeSizeBucket: runtimeSizeBucket,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.birdCardTiers = Object.freeze(pack);

  globalThis.BIRD_CARD_TIER_ORDER = TIER_ORDER;
  globalThis.BIRD_CARD_STARS_PER_TIER = STARS_PER_TIER;
  globalThis.getBirdCardTierMultiplier = getTierStatMultiplier;
  globalThis.getBirdCardMutationCost = getMutationCostPerStar;
  globalThis.getBirdCardMutationCostPerStar = getMutationCostPerStar;
  globalThis.getEffectiveBirdCardStatMultiplier = getEffectiveStatMultiplier;
  globalThis.normalizeBirdCardTier = normalizeTier;
  globalThis.nextBirdCardTier = nextTier;
  globalThis.clampBirdCardStars = clampStars;
  globalThis.canUpgradeBirdCard = canUpgradeBirdCard;
  globalThis.previewBirdCardUpgrade = previewUpgrade;
})();
