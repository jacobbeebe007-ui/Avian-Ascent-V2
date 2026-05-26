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

  globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  globalThis.FORTUNE_ARTIFACT_STUBS = FORTUNE_ARTIFACT_STUBS;
  globalThis.rebuildFortuneHireCatalog = function () {
    globalThis.FORTUNE_HIRE_BIRDS = buildHireBirdCatalog();
  };
})();
