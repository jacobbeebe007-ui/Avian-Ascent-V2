/* Mother Goose egg catalog — pools, costs, weights. */
(function () {
  'use strict';

  var STARTER_BIRD_KEYS = ['sparrow', 'blackbird', 'macaw', 'crow', 'goose', 'robin'];

  var ANCESTRAL_EXCLUDE = {
    dukeBlakiston: true,
  };

  var EGG_TYPES = {
    cracked: {
      id: 'cracked',
      name: 'Cracked Egg',
      cost: 10,
      icon: '🥚',
      desc: 'Low cost. Hatches starter bird cards only.',
      enabled: true,
    },
    feathered: {
      id: 'feathered',
      name: 'Feathered Egg',
      cost: 20,
      icon: '🪶',
      desc: 'Medium cost. Hatches any bird you have unlocked.',
      enabled: true,
    },
    gleaming: {
      id: 'gleaming',
      name: 'Gleaming Egg',
      cost: 35,
      icon: '✨',
      desc: 'Better odds for rarer or less-owned unlocked birds.',
      enabled: true,
    },
    royal: {
      id: 'royal',
      name: 'Royal Egg',
      cost: 50,
      icon: '👑',
      desc: 'Pick a class, then hatch a bird from that class.',
      enabled: true,
      requiresClassPick: true,
    },
    ancestral: {
      id: 'ancestral',
      name: 'Ancestral Egg',
      cost: 75,
      icon: '🌙',
      desc: 'Reserved for boss, event, and legendary birds (coming soon).',
      enabled: false,
    },
  };

  function isUnlockedBird(bird, birdKey) {
    if (!bird) return false;
    var req = bird.unlockRequires;
    if (!req) return true;
    if (typeof globalThis.isUnlocked === 'function') return globalThis.isUnlocked(req);
    return false;
  }

  function isAncestralEligible(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (!bird) return false;
    if (ANCESTRAL_EXCLUDE[birdKey]) return false;
    return !!bird.ancestralEligible;
  }

  function isInNormalPool(birdKey) {
    if (ANCESTRAL_EXCLUDE[birdKey]) return false;
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (!bird || !bird.stats) return false;
    return true;
  }

  function buildCrackedPool() {
    var birds = globalThis.BIRDS || {};
    return STARTER_BIRD_KEYS.filter(function (key) {
      return birds[key] && isInNormalPool(key);
    });
  }

  function buildFeatheredPool() {
    var birds = globalThis.BIRDS || {};
    var out = [];
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !bird.stats || !isInNormalPool(key)) return;
      if (!isUnlockedBird(bird, key)) return;
      out.push(key);
    });
    return out;
  }

  function buildRoyalPool(classId) {
    var birds = globalThis.BIRDS || {};
    var cls = String(classId || '').toLowerCase();
    var out = [];
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !bird.stats || !isInNormalPool(key)) return;
      if (!isUnlockedBird(bird, key)) return;
      var birdCls = typeof globalThis.classToRoleId === 'function' ? globalThis.classToRoleId(bird.class) : String(bird.class || '').toLowerCase();
      if (birdCls === cls) out.push(key);
    });
    return out;
  }

  function buildAncestralPool() {
    var birds = globalThis.BIRDS || {};
    var out = [];
    Object.keys(birds).forEach(function (key) {
      if (isAncestralEligible(key) && isUnlockedBird(birds[key], key)) out.push(key);
    });
    return out;
  }

  function getEggPool(eggType, opts) {
    opts = opts || {};
    var id = String(eggType || '').toLowerCase();
    if (id === 'cracked') return buildCrackedPool();
    if (id === 'feathered') return buildFeatheredPool();
    if (id === 'gleaming') return buildFeatheredPool();
    if (id === 'royal') return buildRoyalPool(opts.classFilter);
    if (id === 'ancestral') return buildAncestralPool();
    return [];
  }

  function gleamingWeight(birdKey, ownedCards, speciesFeathers) {
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (!bird) return 1;
    var w = 10;
    if (!ownedCards || !ownedCards[birdKey]) w += 25;
    var feathers = speciesFeathers && speciesFeathers[birdKey] ? speciesFeathers[birdKey] : 0;
    if (feathers < 12) w += 10;
    if (bird.unlockRequires) w += 8;
    if (bird.unlockRequires && bird.unlockRequires.indexOf('unlock_') === 0) w += 5;
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
    return EGG_TYPES[String(eggType || '').toLowerCase()] || null;
  }

  var catalog = {
    STARTER_BIRD_KEYS: STARTER_BIRD_KEYS,
    ANCESTRAL_EXCLUDE: ANCESTRAL_EXCLUDE,
    EGG_TYPES: EGG_TYPES,
    getEggPool: getEggPool,
    pickFromPool: pickFromPool,
    getEggTypeDef: getEggTypeDef,
    isUnlockedBird: isUnlockedBird,
    buildCrackedPool: buildCrackedPool,
    buildFeatheredPool: buildFeatheredPool,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.motherGooseCatalog = Object.freeze(catalog);
  globalThis.MOTHER_GOOSE_EGG_TYPES = EGG_TYPES;
})();
