/* Mother Goose egg catalog — pools, costs, weights (sheet-driven). */
(function () {
  'use strict';

  var ANCESTRAL_DUKE_CHANCE = 0.1;
  var ROYAL_BLUE_ROLL_CHANCE = 0.25;

  var FEATHERED_SPECIES_TIERS = { grey: true, green: true };
  var GLEAMING_SPECIES_TIERS = { blue: true, green: true };

  var ANCESTRAL_TIER_FALLBACK_WEIGHT = {
    grey: 40,
    green: 30,
    blue: 20,
    purple: 12,
    gold: 6,
    orange: 1,
  };

  /** Eggs that grant unlock on hatch — prior roster unlock not required. */
  var GACHA_EGG_IDS = {
    feathered: true,
    gleaming: true,
    royal: true,
    ancestral: true,
  };

  var EGG_TYPES = {
    cracked: {
      id: 'cracked',
      name: 'Cracked Egg',
      cost: 10,
      icon: '🥚',
      desc: 'Low cost. Hatches Grey-tier birds from the starter pool and other Cracked-eligible species.',
      enabled: true,
    },
    feathered: {
      id: 'feathered',
      name: 'Feathered Egg',
      cost: 20,
      icon: '🪶',
      desc: 'Medium cost. Hatches unlocked Grey, Green, and Blue species (excludes Orange-tier boss birds).',
      enabled: true,
    },
    gleaming: {
      id: 'gleaming',
      name: 'Gleaming Egg',
      cost: 35,
      icon: '✨',
      desc: 'Better odds for rarer species tiers and birds you own less of.',
      enabled: true,
    },
    royal: {
      id: 'royal',
      name: 'Royal Egg',
      cost: 50,
      icon: '👑',
      desc: 'Pick a class, then hatch Purple or Gold species from that class.',
      enabled: true,
      requiresClassPick: true,
    },
    ancestral: {
      id: 'ancestral',
      name: 'Ancestral Egg',
      cost: 75,
      icon: '🌙',
      desc: '10% Duke Blakiston; otherwise hatches other species with odds favouring lower tiers.',
      enabled: true,
    },
  };

  function speciesRarityLabels() {
    var pack = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
    return (pack && pack.SPECIES_RARITY_LABELS) || {
      grey: 'Common',
      green: 'Uncommon',
      blue: 'Rare',
      purple: 'Legendary',
      gold: 'Exotic',
      orange: 'Ancestral',
    };
  }

  function rarityLabel(tierKey) {
    var labels = speciesRarityLabels();
    return labels[tierKey] || tierKey;
  }

  function pct(n) {
    return Math.round(n * 100) + '%';
  }

  function formatEggDescription(eggId) {
    var id = String(eggId || '').toLowerCase();
    var labels = speciesRarityLabels();
    if (id === 'cracked') {
      return pct(1) + ' ' + rarityLabel('grey') + ' species.';
    }
    if (id === 'feathered') {
      return (
        rarityLabel('grey') +
        ' & ' +
        rarityLabel('green') +
        ' species — equal odds within pool.'
      );
    }
    if (id === 'gleaming') {
      var data = speciesTiers();
      var wGreen =
        data && data.gleamingWeightBySpeciesTier && data.gleamingWeightBySpeciesTier.green != null
          ? data.gleamingWeightBySpeciesTier.green
          : 5;
      var wBlue =
        data && data.gleamingWeightBySpeciesTier && data.gleamingWeightBySpeciesTier.blue != null
          ? data.gleamingWeightBySpeciesTier.blue
          : 5;
      var baseTotal = Math.max(1, wGreen + wBlue);
      return (
        rarityLabel('green') +
        ' ' +
        pct(wGreen / baseTotal) +
        ' · ' +
        rarityLabel('blue') +
        ' ' +
        pct(wBlue / baseTotal) +
        ' base odds (weighted further by collection).'
      );
    }
    if (id === 'royal') {
      return (
        pct(1 - ROYAL_BLUE_ROLL_CHANCE) +
        ' ' +
        rarityLabel('purple') +
        ' · ' +
        pct(ROYAL_BLUE_ROLL_CHANCE) +
        ' ' +
        rarityLabel('blue') +
        ' — class you select.'
      );
    }
    if (id === 'ancestral') {
      var fb = ANCESTRAL_TIER_FALLBACK_WEIGHT;
      var fbTotal = 0;
      Object.keys(fb).forEach(function (k) {
        fbTotal += fb[k];
      });
      fbTotal = Math.max(1, fbTotal);
      var parts = [pct(ANCESTRAL_DUKE_CHANCE) + ' ' + rarityLabel('orange') + ' (Duke Blakiston)'];
      ['grey', 'green', 'blue', 'purple', 'gold'].forEach(function (tk) {
        if (fb[tk]) {
          parts.push(pct((fb[tk] / fbTotal) * (1 - ANCESTRAL_DUKE_CHANCE)) + ' ' + rarityLabel(tk));
        }
      });
      return parts.join(' · ') + ' on fallback.';
    }
    return '';
  }

  function speciesTiers() {
    return (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseSpeciesTiers) || null;
  }

  function getBirdSpeciesRow(birdKey) {
    var data = speciesTiers();
    return data && data.byBirdKey ? data.byBirdKey[birdKey] || null : null;
  }

  function birdHasEggPool(birdKey, eggId) {
    var row = getBirdSpeciesRow(birdKey);
    if (!row || !Array.isArray(row.eggPools)) return false;
    return row.eggPools.indexOf(eggId) >= 0;
  }

  function getSpeciesTier(birdKey) {
    var row = getBirdSpeciesRow(birdKey);
    return row ? row.speciesTier : 'grey';
  }

  function starterBirdKeys() {
    var data = speciesTiers();
    if (data && Array.isArray(data.starterBirdKeys) && data.starterBirdKeys.length) {
      return data.starterBirdKeys.slice();
    }
    return ['sparrow', 'blackbird', 'macaw', 'crow', 'goose'];
  }

  function isUnlockedBird(bird, birdKey) {
    if (!bird) return false;
    var req = bird.unlockRequires;
    if (!req) return true;
    if (typeof globalThis.isUnlocked === 'function') return globalThis.isUnlocked(req);
    return false;
  }

  function isInNormalPool(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (!bird || !bird.stats) return false;
    return true;
  }

  function birdClassRoleId(bird) {
    return typeof globalThis.classToRoleId === 'function'
      ? globalThis.classToRoleId(bird.class)
      : String(bird.class || '').toLowerCase();
  }

  function buildPoolForEgg(eggId, opts) {
    opts = opts || {};
    var birds = globalThis.BIRDS || {};
    var out = [];
    var id = String(eggId || '').toLowerCase();
    var isGacha = !!GACHA_EGG_IDS[id];

    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !isInNormalPool(key)) return;
      if (!birdHasEggPool(key, id)) return;

      if (id === 'cracked') {
        out.push(key);
        return;
      }

      if (!isGacha && !isUnlockedBird(bird, key)) return;

      var speciesTier = getSpeciesTier(key);

      if (id === 'feathered' && !FEATHERED_SPECIES_TIERS[speciesTier]) return;

      if (id === 'gleaming' && !GLEAMING_SPECIES_TIERS[speciesTier]) return;

      if (id === 'royal') {
        if (speciesTier !== 'purple') return;
        var cls = String(opts.classFilter || '').toLowerCase();
        if (cls && birdClassRoleId(bird) !== cls) return;
      }

      out.push(key);
    });
    return out;
  }

  function buildCrackedPool() {
    return buildPoolForEgg('cracked');
  }

  function buildFeatheredPool() {
    return buildPoolForEgg('feathered');
  }

  function buildGleamingPool() {
    return buildPoolForEgg('gleaming');
  }

  function buildRoyalPool(classId) {
    return buildPoolForEgg('royal', { classFilter: classId });
  }

  function birdInRoyalBluePool(birdKey) {
    var row = getBirdSpeciesRow(birdKey);
    if (!row || !Array.isArray(row.eggPools)) return false;
    if (getSpeciesTier(birdKey) !== 'blue') return false;
    return row.eggPools.indexOf('gleaming') >= 0 || row.eggPools.indexOf('royal') >= 0;
  }

  function buildRoyalBluePool(classId) {
    var birds = globalThis.BIRDS || {};
    var out = [];
    var cls = String(classId || '').toLowerCase();
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !isInNormalPool(key)) return;
      if (!birdInRoyalBluePool(key)) return;
      if (cls && birdClassRoleId(bird) !== cls) return;
      out.push(key);
    });
    return out;
  }

  function buildAncestralPool() {
    return buildPoolForEgg('ancestral');
  }

  function buildAncestralFallbackPool() {
    var birds = globalThis.BIRDS || {};
    var out = [];
    Object.keys(birds).forEach(function (key) {
      if (key === 'dukeBlakiston') return;
      var bird = birds[key];
      if (!bird || !isInNormalPool(key)) return;
      var row = getBirdSpeciesRow(key);
      if (!row || !Array.isArray(row.eggPools) || !row.eggPools.length) return;
      var hasOther = false;
      for (var i = 0; i < row.eggPools.length; i++) {
        if (row.eggPools[i] !== 'ancestral') {
          hasOther = true;
          break;
        }
      }
      if (!hasOther) return;
      out.push(key);
    });
    return out;
  }

  function syncAncestralEggEnabled() {
    var data = speciesTiers();
    var hasAncestralBird = false;
    if (data && data.byBirdKey) {
      Object.keys(data.byBirdKey).forEach(function (key) {
        if (birdHasEggPool(key, 'ancestral')) hasAncestralBird = true;
      });
    }
    EGG_TYPES.ancestral.enabled = hasAncestralBird || buildAncestralFallbackPool().length > 0;
  }

  function getEggPool(eggType, opts) {
    opts = opts || {};
    var id = String(eggType || '').toLowerCase();
    if (id === 'cracked') return buildCrackedPool();
    if (id === 'feathered') return buildFeatheredPool();
    if (id === 'gleaming') return buildGleamingPool();
    if (id === 'royal') return buildRoyalPool(opts.classFilter);
    if (id === 'ancestral') {
      var pool = buildAncestralPool();
      if (pool.length) return pool;
      return buildAncestralFallbackPool();
    }
    return [];
  }

  function gleamingWeight(birdKey, ownedCards, speciesFeathers) {
    var data = speciesTiers();
    var tier = getSpeciesTier(birdKey);
    var base =
      data && data.gleamingWeightBySpeciesTier && data.gleamingWeightBySpeciesTier[tier] != null
        ? data.gleamingWeightBySpeciesTier[tier]
        : 5;
    var w = Math.max(1, base);
    if (!ownedCards || !ownedCards[birdKey]) w += 25;
    var feathers = speciesFeathers && speciesFeathers[birdKey] ? speciesFeathers[birdKey] : 0;
    if (feathers < 12) w += 10;
    return Math.max(1, w);
  }

  function ancestralFallbackWeight(birdKey) {
    var tier = getSpeciesTier(birdKey);
    return Math.max(1, ANCESTRAL_TIER_FALLBACK_WEIGHT[tier] || 5);
  }

  function pickWeighted(pool, weightFn) {
    if (!pool || !pool.length) return null;
    var total = 0;
    var weights = pool.map(function (key) {
      var w = weightFn ? weightFn(key) : 1;
      total += w;
      return w;
    });
    if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
    var roll = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function pickAncestral(opts) {
    var dukeKey = 'dukeBlakiston';
    var dukeEligible = birdHasEggPool(dukeKey, 'ancestral') && isInNormalPool(dukeKey);

    if (dukeEligible && Math.random() < ANCESTRAL_DUKE_CHANCE) {
      return dukeKey;
    }

    var fallback = buildAncestralFallbackPool();
    if (fallback.length) {
      return pickWeighted(fallback, ancestralFallbackWeight);
    }
    if (dukeEligible) return dukeKey;
    return null;
  }

  function pickFromPool(eggType, opts) {
    opts = opts || {};
    var id = String(eggType || '').toLowerCase();

    if (id === 'ancestral') {
      return pickAncestral(opts);
    }

    var pool = getEggPool(eggType, opts);
    if (!pool.length) return null;

    if (id === 'gleaming') {
      return pickWeighted(pool, function (key) {
        return gleamingWeight(key, opts.ownedCards, opts.speciesFeathers);
      });
    }

    if (id === 'royal') {
      var bluePool = buildRoyalBluePool(opts.classFilter);
      var useBlue = bluePool.length && Math.random() < ROYAL_BLUE_ROLL_CHANCE;
      var royalPool = useBlue ? bluePool : pool;
      if (!royalPool.length) royalPool = pool.length ? pool : bluePool;
      if (!royalPool.length) return null;
      return royalPool[Math.floor(Math.random() * royalPool.length)];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getEggTypeDef(eggType) {
    syncAncestralEggEnabled();
    var base = EGG_TYPES[String(eggType || '').toLowerCase()];
    if (!base) return null;
    return {
      id: base.id,
      name: base.name,
      cost: base.cost,
      icon: base.icon,
      desc: formatEggDescription(base.id),
      enabled: base.enabled,
      requiresClassPick: base.requiresClassPick,
    };
  }

  syncAncestralEggEnabled();

  var catalog = {
    starterBirdKeys: starterBirdKeys,
    STARTER_BIRD_KEYS: starterBirdKeys,
    ANCESTRAL_DUKE_CHANCE: ANCESTRAL_DUKE_CHANCE,
    ROYAL_BLUE_ROLL_CHANCE: ROYAL_BLUE_ROLL_CHANCE,
    ANCESTRAL_TIER_FALLBACK_WEIGHT: ANCESTRAL_TIER_FALLBACK_WEIGHT,
    EGG_TYPES: EGG_TYPES,
    getEggPool: getEggPool,
    pickFromPool: pickFromPool,
    pickAncestral: pickAncestral,
    getEggTypeDef: getEggTypeDef,
    formatEggDescription: formatEggDescription,
    isUnlockedBird: isUnlockedBird,
    buildCrackedPool: buildCrackedPool,
    buildFeatheredPool: buildFeatheredPool,
    buildGleamingPool: buildGleamingPool,
    buildRoyalPool: buildRoyalPool,
    buildRoyalBluePool: buildRoyalBluePool,
    buildAncestralPool: buildAncestralPool,
    buildAncestralFallbackPool: buildAncestralFallbackPool,
    getBirdSpeciesRow: getBirdSpeciesRow,
    gleamingWeight: gleamingWeight,
    ancestralFallbackWeight: ancestralFallbackWeight,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.motherGooseCatalog = Object.freeze(catalog);
  globalThis.MOTHER_GOOSE_EGG_TYPES = EGG_TYPES;
})();
