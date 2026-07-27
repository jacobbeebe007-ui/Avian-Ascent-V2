/* Bird card tier constants — star progression, mutation costs, stat multipliers. */
(function () {
  'use strict';

  var TIER_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

  var STARS_PER_TIER = 5;

  /** @deprecated Compound per-tier multipliers replaced by feather-growth-profiles major/minor/trace bands. */
  var STAR_STAT_MULTIPLIER = {
    grey: 1.10,
    green: 1.15,
    blue: 1.20,
    purple: 1.25,
    gold: 1.30,
    orange: 1.35,
  };

  /** @deprecated Legacy tier-end multipliers; use feather growth profiles. */
  var TIER_STAT_MULTIPLIER = STAR_STAT_MULTIPLIER;

  function growthPack() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.featherGrowthProfiles;
  }

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

  var SCALED_STAT_KEYS = ['vitality', 'maxHp', 'hp', 'atk', 'dex', 'def', 'spd', 'dodge', 'mdef', 'matk'];

  /** Stats that never increase from bird card star upgrades. */
  var STAR_SCALING_EXCLUDED_STAT_KEYS = ['acc', 'critChance', 'critMult', 'cc', 'cd'];

  var TIER_LABELS = {
    grey: 'Grey',
    green: 'Green',
    blue: 'Blue',
    purple: 'Purple',
    gold: 'Gold',
    orange: 'Orange',
  };

  /** Display labels for bird species rarity (sheet species tier). */
  var SPECIES_RARITY_LABELS = {
    grey: 'Common',
    green: 'Uncommon',
    blue: 'Rare',
    purple: 'Legendary',
    gold: 'Exotic',
    orange: 'Ancestral',
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

  function getStarStatMultiplier(tier) {
    return STAR_STAT_MULTIPLIER[normalizeTier(tier)] || 1;
  }

  function getTierStatMultiplier(tier) {
    return getStarStatMultiplier(tier);
  }

  function getMutationCostPerStar(tier) {
    var t = normalizeTier(tier);
    return Math.max(0, Math.floor(Number(MUTATION_COST_PER_STAR[t]) || 0));
  }

  /** @deprecated Use getMutationCostPerStar — kept for transitional callers. */
  function getMutationCostForTier(currentTier) {
    return getMutationCostPerStar(currentTier);
  }

  /** @deprecated Returns major-band growth ratio (1 + stars×1%) for transitional callers without bird context. */
  function getEffectiveStatMultiplier(tier, stars, birdKey, statKey) {
    var gp = growthPack();
    if (gp) {
      if (birdKey && statKey && typeof gp.getEffectiveStatRatioForStat === 'function') {
        return gp.getEffectiveStatRatioForStat(statKey, birdKey, tier, stars);
      }
      if (typeof gp.getTotalFeatherStars === 'function') {
        var totalStars = gp.getTotalFeatherStars(tier, stars);
        return 1 + totalStars * (gp.GROWTH_RATES && gp.GROWTH_RATES.major != null ? gp.GROWTH_RATES.major : 0.010);
      }
    }
    return 1;
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

  function applyGuardrailedStatMult(baseVal, statKey, tier, size, stars, birdKey) {
    var base = Math.max(0, Number(baseVal) || 0);
    if (!base) return base;
    var gp = growthPack();
    var scaled = base;
    if (gp && typeof gp.applyFeatherGrowthToStat === 'function' && birdKey) {
      var profile = typeof gp.getGrowthProfileForBird === 'function' ? gp.getGrowthProfileForBird(birdKey) : null;
      var totalStars = typeof gp.getTotalFeatherStars === 'function' ? gp.getTotalFeatherStars(tier, stars) : 0;
      scaled = gp.applyFeatherGrowthToStat(base, statKey, profile, totalStars);
    } else {
      scaled = base * getEffectiveStatMultiplier(tier, stars, birdKey, statKey);
      if (statKey === 'dodge') scaled = Math.max(0, Math.round(scaled));
      else scaled = Math.max(1, Math.round(scaled));
    }
    return scaled;
  }

  var pack = {
    TIER_ORDER: TIER_ORDER,
    STARS_PER_TIER: STARS_PER_TIER,
    STAR_STAT_MULTIPLIER: STAR_STAT_MULTIPLIER,
    TIER_STAT_MULTIPLIER: TIER_STAT_MULTIPLIER,
    STAR_SCALING_EXCLUDED_STAT_KEYS: STAR_SCALING_EXCLUDED_STAT_KEYS,
    MUTATION_COST_PER_STAR: MUTATION_COST_PER_STAR,
    DUPLICATE_FEATHER_YIELD_DEFAULT: DUPLICATE_FEATHER_YIELD_DEFAULT,
    DUPLICATE_FEATHER_YIELD_BY_EGG: DUPLICATE_FEATHER_YIELD_BY_EGG,
    PITY_THRESHOLDS: PITY_THRESHOLDS,
    PITY_FORCE_NEW_FEATHER_BONUS: PITY_FORCE_NEW_FEATHER_BONUS,
    PITY_RARE_FEATHER_BONUS: PITY_RARE_FEATHER_BONUS,
    STAT_GUARD_MAX_BONUS: STAT_GUARD_MAX_BONUS,
    SCALED_STAT_KEYS: SCALED_STAT_KEYS,
    TIER_LABELS: TIER_LABELS,
    SPECIES_RARITY_LABELS: SPECIES_RARITY_LABELS,
    TIER_CSS: TIER_CSS,
    normalizeTier: normalizeTier,
    clampStars: clampStars,
    tierIndex: tierIndex,
    nextTier: nextTier,
    getStarStatMultiplier: getStarStatMultiplier,
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
