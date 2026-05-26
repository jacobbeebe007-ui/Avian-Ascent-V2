/* Feathers & Fortune — war room store catalog (hire birds, artifact stubs). */
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
    { id: 'art_goldenFeather', icon: '🪶', name: 'Golden Feather', desc: '+1 Max Energy permanently.' },
    { id: 'art_stormCrown', icon: '👑', name: 'Storm Crown', desc: 'Burn damage is doubled.' },
    { id: 'art_murderBanner', icon: '⚑', name: 'Murder Banner', desc: 'Crow-tagged physical attacks deal +25% damage.' },
    { id: 'art_skyLantern', icon: '🏮', name: 'Sky Lantern', desc: 'Gain +1 Energy on the first turn of each battle.' },
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

  globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  globalThis.FORTUNE_ARTIFACT_STUBS = FORTUNE_ARTIFACT_STUBS;
  globalThis.FORTUNE_MISC_STUBS = FORTUNE_MISC_STUBS;
  globalThis.getFortuneItemDef = getFortuneItemDef;
  globalThis.getOwnedInventoryRows = getOwnedInventoryRows;
  globalThis.rebuildFortuneHireCatalog = function () {
    globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  };
})();
