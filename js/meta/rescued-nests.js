/* Rescued Nest — inventory chest open flow (single or multi). */
(function () {
  'use strict';

  var ROYAL_CLASSES = ['knight', 'brute', 'rogue', 'mage', 'siren', 'inquisitor', 'bard'];
  /** Per nest-type open quantity selection (inventory −/+). */
  var OPEN_QTY = Object.create(null);

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

  function ownedCount(eggId) {
    var id = miscId(eggId);
    if (typeof globalThis.getOwnedMiscCount !== 'function') return 0;
    return Math.max(0, Math.floor(Number(globalThis.getOwnedMiscCount(id)) || 0));
  }

  function clampOpenQty(eggId, qty) {
    var max = ownedCount(eggId);
    var n = Math.floor(Number(qty) || 1);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (max <= 0) return 1;
    return Math.max(1, Math.min(max, n));
  }

  function getRescuedNestOpenQty(eggId) {
    eggId = String(eggId || 'cracked').toLowerCase();
    if (OPEN_QTY[eggId] == null) OPEN_QTY[eggId] = 1;
    return clampOpenQty(eggId, OPEN_QTY[eggId]);
  }

  function setRescuedNestOpenQty(eggId, qty) {
    eggId = String(eggId || 'cracked').toLowerCase();
    if (String(qty).toLowerCase() === 'all') {
      OPEN_QTY[eggId] = Math.max(1, ownedCount(eggId));
    } else {
      OPEN_QTY[eggId] = clampOpenQty(eggId, qty);
    }
    return OPEN_QTY[eggId];
  }

  function adjustRescuedNestOpenQty(spec) {
    /* data-action arg: "cracked:1" | "cracked:-1" | "cracked:all" */
    var raw = String(spec || '');
    var parts = raw.split(':');
    var eggId = (parts[0] || 'cracked').toLowerCase();
    var deltaOrAll = parts[1] != null ? parts[1] : '1';
    if (String(deltaOrAll).toLowerCase() === 'all') {
      setRescuedNestOpenQty(eggId, 'all');
    } else {
      var cur = getRescuedNestOpenQty(eggId);
      setRescuedNestOpenQty(eggId, cur + (Number(deltaOrAll) || 0));
    }
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
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

  function performOpenRescuedNests(eggId, count) {
    eggId = String(eggId || 'cracked').toLowerCase();
    var want = Math.max(1, Math.floor(Number(count) || 1));
    var available = ownedCount(eggId);
    var n = Math.min(want, available);
    if (n < 1) return { ok: false, reason: 'empty', results: [], goldenEggsGained: 0 };

    var results = [];
    var eggsTotal = 0;
    for (var i = 0; i < n; i++) {
      var one = performOpenRescuedNest(eggId);
      if (!one.ok) break;
      results.push(one);
      eggsTotal += Number(one.goldenEggsGained) || 0;
    }
    if (!results.length) return { ok: false, reason: 'empty', results: [], goldenEggsGained: 0 };
    var nestName = results[0].nestName || 'Rescued Nest';
    return {
      ok: true,
      eggId: eggId,
      nestName: nestName,
      count: results.length,
      goldenEggsGained: eggsTotal,
      results: results,
      hatch: results[0].hatch,
    };
  }

  function showRescuedNestOpenResult(result) {
    if (!result || !result.ok) return;
    var batch = Array.isArray(result.results) && result.results.length > 1;
    var title = document.getElementById('mother-goose-hatch-title');
    if (title) {
      var nestLabel = result.nestName || 'Rescued Nest';
      if (batch) {
        title.textContent =
          '+' +
          result.goldenEggsGained +
          ' Golden Goose Eggs from ' +
          result.results.length +
          '× ' +
          nestLabel;
      } else {
        title.textContent = '+' + result.goldenEggsGained + ' Golden Goose Eggs from ' + nestLabel;
      }
    }
    var hatchResults = batch
      ? result.results.map(function (r) {
          return r.hatch;
        })
      : result.hatch
        ? [result.hatch]
        : [];
    if (typeof globalThis.showMotherGooseHatchModalBatch === 'function' && hatchResults.length) {
      globalThis.showMotherGooseHatchModalBatch(hatchResults, result.eggId, hatchResults.length);
    } else if (typeof globalThis.showMotherGooseHatchModal === 'function' && result.hatch) {
      globalThis.showMotherGooseHatchModal(result.hatch, result.eggId);
    }
  }

  function parseOpenSpec(spec) {
    /* "cracked" | "cracked:3" | "cracked:all" — also tolerate event objects. */
    if (spec && typeof spec === 'object' && spec.target) return { eggId: 'cracked', count: 1 };
    var raw = String(spec || 'cracked');
    var parts = raw.split(':');
    var eggId = (parts[0] || 'cracked').toLowerCase();
    var countPart = parts[1];
    var count;
    if (countPart == null || countPart === '') {
      count = getRescuedNestOpenQty(eggId);
    } else if (String(countPart).toLowerCase() === 'all') {
      count = Math.max(1, ownedCount(eggId));
    } else {
      count = Math.max(1, Math.floor(Number(countPart) || 1));
    }
    return { eggId: eggId, count: count };
  }

  function openRescuedNest(spec, _evt) {
    var parsed = parseOpenSpec(spec);
    var result =
      parsed.count > 1
        ? performOpenRescuedNests(parsed.eggId, parsed.count)
        : (function () {
            var one = performOpenRescuedNest(parsed.eggId);
            if (!one.ok) return one;
            return {
              ok: true,
              eggId: one.eggId,
              nestName: one.nestName,
              count: 1,
              goldenEggsGained: one.goldenEggsGained,
              results: [one],
              hatch: one.hatch,
            };
          })();
    if (!result.ok) return;
    setRescuedNestOpenQty(parsed.eggId, 1);
    if (typeof globalThis.syncFortuneBalances === 'function') globalThis.syncFortuneBalances();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
    showRescuedNestOpenResult(result);
  }

  globalThis.addRescuedNest = addRescuedNest;
  globalThis.openRescuedNest = openRescuedNest;
  globalThis.getRescuedNestOpenQty = getRescuedNestOpenQty;
  globalThis.setRescuedNestOpenQty = setRescuedNestOpenQty;
  globalThis.adjustRescuedNestOpenQty = adjustRescuedNestOpenQty;
  globalThis.showRescuedNestOpenResult = showRescuedNestOpenResult;
})();
