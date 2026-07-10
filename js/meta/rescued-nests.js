/* Rescued Nest — inventory chest open flow. */
(function () {
  'use strict';

  var ROYAL_CLASSES = ['knight', 'brute', 'rogue', 'mage', 'siren', 'inquisitor', 'bard'];

  function miscId(eggId) {
    return typeof globalThis.miscIdForRescuedNest === 'function'
      ? globalThis.miscIdForRescuedNest(eggId)
      : 'rescuedNest_' + String(eggId || 'cracked');
  }

  function catalog() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
  }

  function pickRoyalClassFilter() {
    var cat = catalog();
    if (!cat || typeof cat.buildRoyalPool !== 'function') return ROYAL_CLASSES[0];
    var eligible = ROYAL_CLASSES.filter(function (cls) {
      return cat.buildRoyalPool(cls).length > 0;
    });
    if (!eligible.length) return ROYAL_CLASSES[0];
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  function addRescuedNest(eggId, count) {
    var id = miscId(eggId);
    if (typeof globalThis.addOwnedMisc !== 'function') return 0;
    return globalThis.addOwnedMisc(id, count);
  }

  function performOpenRescuedNest(eggId) {
    eggId = String(eggId || 'cracked').toLowerCase();
    var id = miscId(eggId);
    if (typeof globalThis.getOwnedMiscCount === 'function' && globalThis.getOwnedMiscCount(id) < 1) {
      return { ok: false, reason: 'empty' };
    }
    if (typeof globalThis.spendOwnedMisc !== 'function' || !globalThis.spendOwnedMisc(id, 1)) {
      return { ok: false, reason: 'empty' };
    }

    var goldenEggs =
      typeof globalThis.rollGoldenGooseEggsForNest === 'function'
        ? globalThis.rollGoldenGooseEggsForNest(eggId)
        : 1 + Math.floor(Math.random() * 100);
    if (typeof globalThis.addGoldenGooseEggs === 'function') globalThis.addGoldenGooseEggs(goldenEggs);

    var hatchOpts = {};
    if (eggId === 'royal') hatchOpts.classFilter = pickRoyalClassFilter();

    var hatch =
      typeof globalThis.hatchOne === 'function' ? globalThis.hatchOne(eggId, hatchOpts) : { ok: false, reason: 'config' };
    if (!hatch.ok) {
      if (typeof globalThis.addOwnedMisc === 'function') globalThis.addOwnedMisc(id, 1);
      return { ok: false, reason: hatch.reason || 'hatch_failed', goldenEggsGained: 0 };
    }

    var nestDef =
      typeof globalThis.getRescuedNestDef === 'function' ? globalThis.getRescuedNestDef(eggId) : { name: 'Rescued Nest' };
    return {
      ok: true,
      eggId: eggId,
      nestName: nestDef.name,
      goldenEggsGained: goldenEggs,
      hatch: hatch,
    };
  }

  function showRescuedNestOpenResult(result) {
    if (!result || !result.ok) return;
    var title = document.getElementById('mother-goose-hatch-title');
    if (title) {
      title.textContent =
        '+' + result.goldenEggsGained + ' Golden Goose Eggs from ' + (result.nestName || 'Rescued Nest');
    }
    if (typeof globalThis.showMotherGooseHatchModal === 'function' && result.hatch) {
      globalThis.showMotherGooseHatchModal(result.hatch, result.eggId);
    }
  }

  function openRescuedNest(eggId, _evt) {
    if (eggId && typeof eggId === 'object' && eggId.target) eggId = 'cracked';
    var result = performOpenRescuedNest(eggId);
    if (!result.ok) return;
    if (typeof globalThis.syncFortuneBalances === 'function') globalThis.syncFortuneBalances();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
    showRescuedNestOpenResult(result);
  }

  globalThis.addRescuedNest = addRescuedNest;
  globalThis.openRescuedNest = openRescuedNest;
  globalThis.showRescuedNestOpenResult = showRescuedNestOpenResult;
})();
