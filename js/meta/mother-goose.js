/* Mother Goose — egg hatch engine. */
(function () {
  'use strict';

  function catalog() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
  }

  function tiers() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
  }

  function metaApi() {
    return globalThis.Avian && globalThis.Avian.meta && globalThis.Avian.meta.birdCards;
  }

  function pickPityOptions(pool, count) {
    var copy = pool.slice();
    var out = [];
    while (copy.length && out.length < count) {
      var idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  }

  function rollBirdKey(eggType, opts) {
    var cat = catalog();
    if (!cat) return null;
    var m = typeof globalThis.getFortuneMeta === 'function' ? globalThis.getFortuneMeta() : null;
    var owned = (m && m.birdCards && m.birdCards.owned) || {};
    var feathers = (m && m.speciesFeathers) || {};
    return cat.pickFromPool(eggType, {
      classFilter: opts && opts.classFilter,
      ownedCards: owned,
      speciesFeathers: feathers,
    });
  }

  function hatchEgg(eggType, opts) {
    opts = opts || {};
    var cat = catalog();
    var t = tiers();
    var api = metaApi();
    if (!cat || !t || !api) return { ok: false, reason: 'config' };

    var def = cat.getEggTypeDef(eggType);
    if (!def || !def.enabled) return { ok: false, reason: 'disabled' };
    if (def.requiresClassPick && !opts.classFilter) return { ok: false, reason: 'class_required' };

    var cost = Math.max(0, Math.floor(Number(def.cost) || 0));
    if (typeof globalThis.spendGoldenGooseEggs !== 'function' || !globalThis.spendGoldenGooseEggs(cost)) {
      return { ok: false, reason: 'funds' };
    }

    var pool = cat.getEggPool(eggType, { classFilter: opts.classFilter });
    if (!pool.length) return { ok: false, reason: 'empty_pool', cost: cost };

    var pity = api.getPityState();
    var th = t.PITY_THRESHOLDS || {};
    var forceNew = pity.eggsSinceChoice + 1 >= th.forceNewAt;
    var forceRare = pity.eggsSinceChoice + 1 >= th.rareAt;

    var birdKey = null;
    if (forceRare && String(eggType).toLowerCase() !== 'cracked') {
      birdKey = rollBirdKey('gleaming', opts);
    } else {
      birdKey = rollBirdKey(eggType, opts);
    }
    if (!birdKey) return { ok: false, reason: 'roll_failed', cost: cost };

    var isNew = !api.ownsBirdCard(birdKey);
    if (forceNew && !isNew) {
      var altPool = pool.filter(function (k) {
        return !api.ownsBirdCard(k);
      });
      if (altPool.length) {
        birdKey = altPool[Math.floor(Math.random() * altPool.length)];
        isNew = true;
      }
    }

    var feathersGained = 0;
    var tierAfter = null;

    if (isNew) {
      api.grantBirdCard(birdKey, 'grey');
      tierAfter = 'grey';
      var bird = (globalThis.BIRDS || {})[birdKey];
      if (bird && bird.unlockRequires && typeof globalThis.grantUnlock === 'function') {
        if (typeof globalThis.isUnlocked !== 'function' || !globalThis.isUnlocked(bird.unlockRequires)) {
          globalThis.grantUnlock(bird.unlockRequires);
        }
      }
    } else {
      var yieldN = t.getDuplicateFeatherYield(eggType);
      if (forceNew && !api.ownsBirdCard(birdKey)) {
        yieldN += t.PITY_FORCE_NEW_FEATHER_BONUS || 0;
      }
      if (forceRare) yieldN += t.PITY_RARE_FEATHER_BONUS || 0;
      feathersGained = yieldN;
      api.addSpeciesFeathers(birdKey, yieldN);
    }

    var birds = globalThis.BIRDS || {};
    var birdName = birds[birdKey] ? birds[birdKey].name : birdKey;
    var result = {
      ok: true,
      eggType: eggType,
      cost: cost,
      birdKey: birdKey,
      birdName: birdName,
      isNew: isNew,
      feathersGained: feathersGained,
      speciesFeatherTotal: api.getSpeciesFeathers(birdKey),
      tierAfter: tierAfter,
      message: isNew
        ? 'New ' + birdName + ' card hatched!'
        : 'Duplicate — +' + feathersGained + ' Species Feathers for ' + birdName + '.',
    };

    api.recordHatch(result);

    var pityAfter = api.getPityState();
    result.pityProgress = pityAfter;

    if (pityAfter.eggsSinceChoice >= th.choiceAt && !pityAfter.pityChoicePending) {
      var opts3 = pickPityOptions(pool, 3);
      if (opts3.length) api.setPityChoicePending(opts3);
      result.pityChoiceTriggered = true;
      result.message += ' Pity choice pending (pick 1 of 3 — UI coming soon).';
    }

    if (forceNew || forceRare) api.resetPityCounterAfterForce();

    return result;
  }

  function resolvePityChoice(birdKey) {
    var api = metaApi();
    if (!api) return { ok: false, reason: 'config' };
    return api.consumePityChoice(birdKey);
  }

  var pack = { hatchEgg: hatchEgg, resolvePityChoice: resolvePityChoice };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.motherGoose = pack;

  globalThis.hatchEgg = hatchEgg;
  globalThis.resolvePityChoice = resolvePityChoice;
})();
