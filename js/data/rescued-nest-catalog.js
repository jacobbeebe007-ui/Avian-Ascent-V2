/* Rescued Nest chest items — tier mapping, misc defs, golden-egg roll tables. */
(function () {
  'use strict';

  var EGG_IDS = ['cracked', 'feathered', 'gleaming', 'royal', 'ancestral'];

  var SPECIES_TIER_TO_BASE_NEST_RANK = {
    grey: 0,
    green: 1,
    blue: 2,
    purple: 3,
    gold: 3,
    orange: 4,
  };

  var NEST_RANK_TO_EGG_ID = {
    0: 'cracked',
    1: 'feathered',
    2: 'gleaming',
    3: 'royal',
    4: 'ancestral',
  };

  var GOLDEN_EGG_ROLL = {
    cracked: { min: 1, max: 30, weightPower: 1.4 },
    feathered: { min: 1, max: 50, weightPower: 1.2 },
    gleaming: { min: 5, max: 75, weightPower: 1.0 },
    royal: { min: 10, max: 90, weightPower: 0.85 },
    ancestral: { min: 25, max: 100, weightPower: 0.7 },
  };

  function catalog() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
  }

  function getSpeciesTier(birdKey) {
    var cat = catalog();
    if (cat && typeof cat.getSpeciesTier === 'function') return cat.getSpeciesTier(birdKey);
    return 'grey';
  }

  function miscIdForEgg(eggId) {
    return 'rescuedNest_' + String(eggId || 'cracked');
  }

  function eggIdFromMiscId(miscId) {
    var id = String(miscId || '');
    if (id.indexOf('rescuedNest_') !== 0) return null;
    return id.slice('rescuedNest_'.length) || null;
  }

  function getRescuedNestDef(eggId) {
    var id = String(eggId || 'cracked').toLowerCase();
    var cat = catalog();
    var eggDef = cat && typeof cat.getEggTypeDef === 'function' ? cat.getEggTypeDef(id) : null;
    var eggName = eggDef && eggDef.name ? eggDef.name.replace(/ Egg$/, '') : id;
    var icon = eggDef && eggDef.icon ? eggDef.icon : '🪺';
    return {
      id: miscIdForEgg(id),
      eggId: id,
      icon: icon,
      name: eggName + ' Rescued Nest',
      desc:
        'Open for Golden Goose Eggs (1–100, tier-weighted) and one ' +
        eggName.toLowerCase() +
        '-tier bird hatch.',
      openable: true,
    };
  }

  function buildMiscStubs() {
    return EGG_IDS.map(function (eggId) {
      return getRescuedNestDef(eggId);
    });
  }

  function computeRescuedNestTier(defeatedBirds) {
    var birds = Array.isArray(defeatedBirds) ? defeatedBirds : [];
    var withKeys = birds.filter(function (b) {
      return b && b.birdKey;
    });
    var count = Math.max(1, withKeys.length || birds.length || 1);
    var maxRank = 0;
    if (withKeys.length) {
      withKeys.forEach(function (b) {
        var tier = getSpeciesTier(b.birdKey);
        var rank = SPECIES_TIER_TO_BASE_NEST_RANK[tier];
        if (rank == null) rank = 0;
        if (rank > maxRank) maxRank = rank;
      });
    } else {
      maxRank = 0;
    }
    var extra = Math.max(0, count - 1);
    var finalRank = Math.min(4, maxRank + extra);
    return NEST_RANK_TO_EGG_ID[finalRank] || 'cracked';
  }

  function rollGoldenGooseEggsForNest(eggId) {
    var id = String(eggId || 'cracked').toLowerCase();
    var cfg = GOLDEN_EGG_ROLL[id] || GOLDEN_EGG_ROLL.cracked;
    var min = Math.max(1, Math.floor(Number(cfg.min) || 1));
    var max = Math.max(min, Math.floor(Number(cfg.max) || 100));
    var span = max - min + 1;
    var power = Number(cfg.weightPower) || 1;
    var u = Math.random();
    var biased = Math.pow(u, power);
    return min + Math.floor(biased * span);
  }

  function buildRescuedNestDrop(defeatedBirds, opts) {
    opts = opts || {};
    var eggId = computeRescuedNestTier(defeatedBirds);
    var def = getRescuedNestDef(eggId);
    var tierMap = { cracked: 'grey', feathered: 'green', gleaming: 'blue', royal: 'purple', ancestral: 'gold' };
    return {
      type: 'rescuedNest',
      eggId: eggId,
      count: Math.max(1, Math.floor(Number(opts.count) || 1)),
      tier: tierMap[eggId] || 'grey',
      icon: def.icon,
      name: def.name,
      desc: def.desc,
    };
  }

  var pack = {
    EGG_IDS: EGG_IDS,
    SPECIES_TIER_TO_BASE_NEST_RANK: SPECIES_TIER_TO_BASE_NEST_RANK,
    NEST_RANK_TO_EGG_ID: NEST_RANK_TO_EGG_ID,
    miscIdForEgg: miscIdForEgg,
    eggIdFromMiscId: eggIdFromMiscId,
    getRescuedNestDef: getRescuedNestDef,
    buildMiscStubs: buildMiscStubs,
    computeRescuedNestTier: computeRescuedNestTier,
    rollGoldenGooseEggsForNest: rollGoldenGooseEggsForNest,
    buildRescuedNestDrop: buildRescuedNestDrop,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.rescuedNestCatalog = Object.freeze(pack);

  globalThis.miscIdForRescuedNest = miscIdForEgg;
  globalThis.eggIdFromRescuedNestMisc = eggIdFromMiscId;
  globalThis.getRescuedNestDef = getRescuedNestDef;
  globalThis.computeRescuedNestTier = computeRescuedNestTier;
  globalThis.rollGoldenGooseEggsForNest = rollGoldenGooseEggsForNest;
  globalThis.buildRescuedNestDrop = buildRescuedNestDrop;

  if (Array.isArray(globalThis.FORTUNE_MISC_STUBS)) {
    globalThis.FORTUNE_MISC_STUBS = buildMiscStubs();
  }
})();
