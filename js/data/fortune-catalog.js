/* Cuckoo's Feathers & Fortune Emporium — war room store catalog. */
(function () {
  'use strict';

  var STAGE10_BIRDS = {
    hummingbird: 1, shoebill: 1, secretary: 1, magpie: 1, kookaburra: 1,
  };
  var STAGE20_BIRDS = {
    harpy: 1, ostrich: 1, peregrine: 1, lyrebird: 1, kiwi: 1,
  };
  var ENDLESS_BIRDS = {
    penguin: 1, emu: 1, swan: 1, flamingo: 1, seagull: 1, albatross: 1,
  };

  function savedEggCostForBird(birdKey) {
    if (STAGE10_BIRDS[birdKey]) return 8;
    if (STAGE20_BIRDS[birdKey]) return 15;
    if (ENDLESS_BIRDS[birdKey]) return 25;
    if (birdKey === 'toucan') return 30;
    return 20;
  }

  function buildHireBirdCatalog() {
    var birds = globalThis.BIRDS;
    if (!birds || typeof birds !== 'object') return [];
    var rows = [];
    Object.keys(birds).forEach(function (birdKey) {
      var bird = birds[birdKey];
      if (!bird || typeof bird !== 'object') return;
      var unlockId = bird.unlockRequires;
      if (!unlockId || typeof unlockId !== 'string' || unlockId.indexOf('unlock_') !== 0) return;
      rows.push({
        birdKey: birdKey,
        unlockId: unlockId,
        savedEggCost: savedEggCostForBird(birdKey),
        unlockHint: bird.unlockHint || '',
      });
    });
    rows.sort(function (a, b) {
      if (a.savedEggCost !== b.savedEggCost) return a.savedEggCost - b.savedEggCost;
      var na = (birds[a.birdKey] && birds[a.birdKey].name) || a.birdKey;
      var nb = (birds[b.birdKey] && birds[b.birdKey].name) || b.birdKey;
      return na.localeCompare(nb);
    });
    return rows;
  }

  var FORTUNE_ARTIFACT_STUBS = [
    {
      id: 'art_goldenFeather',
      tier: 'gold',
      icon: '🪶',
      name: 'Golden Feather',
      desc: '+1 Max Energy permanently.',
      gooseEggCost: 1000,
      apply: function (p) {
        p.energyBonus = (p.energyBonus || 0) + 1;
        if (typeof globalThis.computePlayerMaxEnergy === 'function') p.energyMax = globalThis.computePlayerMaxEnergy();
      },
    },
    {
      id: 'art_stormCrown',
      tier: 'purple',
      icon: '👑',
      name: 'Storm Crown',
      desc: 'Burn damage is doubled.',
      gooseEggCost: 100,
      apply: function (p) {
        p.burnBonus = (p.burnBonus || 1) * 2;
      },
    },
    {
      id: 'art_murderBanner',
      tier: 'purple',
      icon: '⚑',
      name: 'Murder Banner',
      desc: 'Knight Classes physical attacks deal +25% damage.',
      gooseEggCost: 200,
      apply: function (p) {
        p.knightPhysBonus = (p.knightPhysBonus || 0) + 0.25;
      },
    },
    {
      id: 'art_skyLantern',
      tier: 'blue',
      icon: '🏮',
      name: 'Sky Lantern',
      desc: 'Gain +1 Energy on the first turn of each battle.',
      gooseEggCost: 250,
      apply: function (p) {
        p.firstTurnEnergy = (p.firstTurnEnergy || 0) + 1;
      },
    },
  ];

  var FORTUNE_TRADE_OFFERS = [
    {
      id: 'trade_goldenGoose',
      icon: '🪿',
      name: 'Golden Goose Egg',
      desc: 'Exchange Saved Eggs for one Golden Goose Egg.',
      baseCost: 10,
      costStep: 0,
      maxPurchases: null,
    },
    {
      id: 'trade_freshWaterCap',
      itemKey: 'freshWater',
      icon: '💧',
      name: 'Fresh Water Satchel',
      desc: 'Carry one more Fresh Water into every Flight.',
      baseCost: 50,
      costStep: 25,
      maxPurchases: 6,
      capLabel: 'Max hold 3 → 9',
    },
    {
      id: 'trade_sugarWaterCap',
      itemKey: 'sugarWater',
      icon: '🌾',
      name: 'Bird Seed Pouch',
      desc: 'Carry one more Bird Seed into every Flight.',
      baseCost: 100,
      costStep: 25,
      maxPurchases: 4,
      capLabel: 'Max hold 2 → 6',
    },
    {
      id: 'trade_honeyWaterCap',
      itemKey: 'honeyWater',
      icon: '🍯',
      name: 'Honey Water Flask',
      desc: 'Carry one more Honey Water into every Flight.',
      baseCost: 150,
      costStep: 25,
      maxPurchases: 2,
      capLabel: 'Max hold 1 → 3',
    },
  ];

  var FORTUNE_MISC_STUBS = [];

  function getFortuneItemDef(id) {
    if (!id) return null;
    var art = FORTUNE_ARTIFACT_STUBS.find(function (a) {
      return a.id === id;
    });
    if (art) return { kind: 'artifact', id: art.id, icon: art.icon, name: art.name, desc: art.desc };
    var misc = FORTUNE_MISC_STUBS.find(function (m) {
      return m.id === id;
    });
    if (misc) return { kind: 'misc', id: misc.id, icon: misc.icon, name: misc.name, desc: misc.desc };
    return null;
  }

  function getTradeOfferCost(offer, purchasesSoFar) {
    if (!offer) return 0;
    var count = Math.max(0, Math.floor(Number(purchasesSoFar) || 0));
    return Math.max(0, Math.floor(Number(offer.baseCost) || 0) + count * Math.max(0, Math.floor(Number(offer.costStep) || 0)));
  }

  function getOwnedInventoryRows(meta) {
    meta = meta || (typeof globalThis.getFortuneMeta === 'function' ? globalThis.getFortuneMeta() : null);
    if (!meta) meta = { savedEggs: 0, goldenGooseEggs: 0, ownedArtifacts: {}, ownedMisc: {} };

    var currency = [
      { kind: 'currency', id: 'savedEggs', icon: '🥚', name: 'Saved Eggs', count: Math.max(0, Math.floor(Number(meta.savedEggs) || 0)) },
      { kind: 'currency', id: 'goldenGooseEggs', icon: '🪿', name: 'Golden Goose Eggs', count: Math.max(0, Math.floor(Number(meta.goldenGooseEggs) || 0)) },
    ];

    var artifacts = [];
    var ownedArt = meta.ownedArtifacts && typeof meta.ownedArtifacts === 'object' ? meta.ownedArtifacts : {};
    FORTUNE_ARTIFACT_STUBS.forEach(function (art) {
      if (!ownedArt[art.id]) return;
      artifacts.push({
        kind: 'artifact',
        id: art.id,
        icon: art.icon,
        name: art.name,
        desc: art.desc,
        count: 1,
      });
    });

    var misc = [];
    var ownedMisc = meta.ownedMisc && typeof meta.ownedMisc === 'object' ? meta.ownedMisc : {};
    Object.keys(ownedMisc).forEach(function (id) {
      var count = Math.max(0, Math.floor(Number(ownedMisc[id]) || 0));
      if (!count) return;
      var def = getFortuneItemDef(id);
      misc.push({
        kind: 'misc',
        id: id,
        icon: def && def.icon ? def.icon : '📦',
        name: def && def.name ? def.name : id,
        desc: def && def.desc ? def.desc : 'Treasure from a past Flight.',
        count: count,
      });
    });

    return { currency: currency, artifacts: artifacts, misc: misc };
  }

  function applyOwnedFortuneArtifacts(player) {
    if (!player) return;
    var equippedId =
      typeof globalThis.getEquippedArtifactId === 'function' ? globalThis.getEquippedArtifactId() : null;
    if (!equippedId) return;
    var art = FORTUNE_ARTIFACT_STUBS.find(function (a) {
      return a.id === equippedId;
    });
    if (art && typeof art.apply === 'function') art.apply(player);
  }

  globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  globalThis.FORTUNE_ARTIFACT_STUBS = FORTUNE_ARTIFACT_STUBS;
  globalThis.FORTUNE_TRADE_OFFERS = FORTUNE_TRADE_OFFERS;
  globalThis.FORTUNE_MISC_STUBS = FORTUNE_MISC_STUBS;
  globalThis.getFortuneItemDef = getFortuneItemDef;
  globalThis.getTradeOfferCost = getTradeOfferCost;
  globalThis.getOwnedInventoryRows = getOwnedInventoryRows;
  globalThis.applyOwnedFortuneArtifacts = applyOwnedFortuneArtifacts;
  globalThis.rebuildFortuneHireCatalog = function () {
    globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  };
})();
