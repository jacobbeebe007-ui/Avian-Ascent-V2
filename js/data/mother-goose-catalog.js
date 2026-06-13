/* Mother Goose egg catalog — pools, costs, weights (sheet-driven). */
(function () {
  'use strict';

  var ANCESTRAL_EXCLUDE = {
    dukeBlakiston: false,
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
      desc: 'Boss and event pool. Hatches Ancestral-only species when unlocked.',
      enabled: true,
    },
  };

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

  function buildPoolForEgg(eggId, opts) {
    opts = opts || {};
    var birds = globalThis.BIRDS || {};
    var out = [];
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !isInNormalPool(key)) return;
      if (!birdHasEggPool(key, eggId)) return;

      if (eggId === 'cracked') {
        out.push(key);
        return;
      }

      if (!isUnlockedBird(bird, key)) return;

      if (eggId === 'feathered' && getSpeciesTier(key) === 'orange') return;

      if (eggId === 'royal') {
        var cls = String(opts.classFilter || '').toLowerCase();
        var birdCls =
          typeof globalThis.classToRoleId === 'function'
            ? globalThis.classToRoleId(bird.class)
            : String(bird.class || '').toLowerCase();
        if (cls && birdCls !== cls) return;
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

  function buildAncestralPool() {
    return buildPoolForEgg('ancestral');
  }

  function syncAncestralEggEnabled() {
    var data = speciesTiers();
    var hasAncestralBird = false;
    if (data && data.byBirdKey) {
      Object.keys(data.byBirdKey).forEach(function (key) {
        if (birdHasEggPool(key, 'ancestral')) hasAncestralBird = true;
      });
    }
    EGG_TYPES.ancestral.enabled = hasAncestralBird;
  }

  function getEggPool(eggType, opts) {
    opts = opts || {};
    var id = String(eggType || '').toLowerCase();
    if (id === 'cracked') return buildCrackedPool();
    if (id === 'feathered') return buildFeatheredPool();
    if (id === 'gleaming') return buildGleamingPool();
    if (id === 'royal') return buildRoyalPool(opts.classFilter);
    if (id === 'ancestral') return buildAncestralPool();
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

  function pickFromPool(eggType, opts) {
    opts = opts || {};
    var pool = getEggPool(eggType, opts);
    if (!pool.length) return null;
    if (String(eggType).toLowerCase() === 'gleaming') {
      return pickWeighted(pool, function (key) {
        return gleamingWeight(key, opts.ownedCards, opts.speciesFeathers);
      });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getEggTypeDef(eggType) {
    syncAncestralEggEnabled();
    return EGG_TYPES[String(eggType || '').toLowerCase()] || null;
  }

  syncAncestralEggEnabled();

  var catalog = {
    starterBirdKeys: starterBirdKeys,
    STARTER_BIRD_KEYS: starterBirdKeys,
    ANCESTRAL_EXCLUDE: ANCESTRAL_EXCLUDE,
    EGG_TYPES: EGG_TYPES,
    getEggPool: getEggPool,
    pickFromPool: pickFromPool,
    getEggTypeDef: getEggTypeDef,
    isUnlockedBird: isUnlockedBird,
    buildCrackedPool: buildCrackedPool,
    buildFeatheredPool: buildFeatheredPool,
    buildGleamingPool: buildGleamingPool,
    buildAncestralPool: buildAncestralPool,
    getBirdSpeciesRow: getBirdSpeciesRow,
    gleamingWeight: gleamingWeight,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.motherGooseCatalog = Object.freeze(catalog);
  globalThis.MOTHER_GOOSE_EGG_TYPES = EGG_TYPES;
})();
