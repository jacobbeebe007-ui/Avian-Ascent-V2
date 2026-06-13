/* Bird card collection — meta APIs (avianAscent_meta_v1). */
(function () {
  'use strict';

  var tiers = function () {
    return (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers) || null;
  };

  function normalizeTier(t) {
    if (tiers() && typeof tiers().normalizeTier === 'function') return tiers().normalizeTier(t);
    return String(t || 'grey').toLowerCase();
  }

  function emptyBirdCardsBlock() {
    return { owned: {}, mutationHistory: {} };
  }

  function emptyMotherGooseBlock() {
    return {
      totalHatches: 0,
      eggsSinceChoice: 0,
      pityChoicePending: false,
      pityChoiceOptions: [],
      lastHatch: null,
    };
  }

  function normalizeOwnedCards(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (key) {
      var row = raw[key];
      if (!row || typeof row !== 'object') return;
      out[key] = {
        tier: normalizeTier(row.tier),
        acquiredAt: row.acquiredAt != null ? row.acquiredAt : Date.now(),
      };
    });
    return out;
  }

  function normalizeSpeciesFeathers(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (key) {
      var n = Math.max(0, Math.floor(Number(raw[key]) || 0));
      if (n > 0) out[key] = n;
    });
    return out;
  }

  function normalizeMotherGoose(raw) {
    var base = emptyMotherGooseBlock();
    if (!raw || typeof raw !== 'object') return base;
    base.totalHatches = Math.max(0, Math.floor(Number(raw.totalHatches) || 0));
    base.eggsSinceChoice = Math.max(0, Math.floor(Number(raw.eggsSinceChoice) || 0));
    base.pityChoicePending = !!raw.pityChoicePending;
    base.pityChoiceOptions = Array.isArray(raw.pityChoiceOptions)
      ? raw.pityChoiceOptions.filter(Boolean).map(String)
      : [];
    base.lastHatch = raw.lastHatch && typeof raw.lastHatch === 'object' ? raw.lastHatch : null;
    return base;
  }

  function starterBirdKeys() {
    var data = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseSpeciesTiers;
    if (data && Array.isArray(data.starterBirdKeys) && data.starterBirdKeys.length) {
      return data.starterBirdKeys.slice();
    }
    var cat = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
    if (cat && typeof cat.starterBirdKeys === 'function') return cat.starterBirdKeys();
    if (cat && Array.isArray(cat.STARTER_BIRD_KEYS)) return cat.STARTER_BIRD_KEYS.slice();
    return ['sparrow', 'blackbird', 'macaw', 'crow', 'goose'];
  }

  function migrateBirdCardsInMeta(meta) {
    if (!meta || typeof meta !== 'object') return meta;
    if (!meta.birdCards || typeof meta.birdCards !== 'object') meta.birdCards = emptyBirdCardsBlock();
    if (!meta.birdCards.owned || typeof meta.birdCards.owned !== 'object') meta.birdCards.owned = {};
    if (!meta.birdCards.mutationHistory || typeof meta.birdCards.mutationHistory !== 'object') {
      meta.birdCards.mutationHistory = {};
    }
    if (!meta.speciesFeathers || typeof meta.speciesFeathers !== 'object') meta.speciesFeathers = {};
    if (!meta.motherGoose || typeof meta.motherGoose !== 'object') meta.motherGoose = emptyMotherGooseBlock();
    if (!Array.isArray(meta.eggPurchaseHistory)) meta.eggPurchaseHistory = [];

    var owned = meta.birdCards.owned;
    var ts = Date.now();
    Object.keys(owned).forEach(function (key) {
      if (owned[key] && owned[key].tier) owned[key].tier = normalizeTier(owned[key].tier);
    });
    starterBirdKeys().forEach(function (key) {
      if (!owned[key]) owned[key] = { tier: 'grey', acquiredAt: ts };
    });

    var birds = globalThis.BIRDS || {};
    var unlocks = typeof globalThis.getUnlocks === 'function' ? globalThis.getUnlocks() : {};
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !bird.unlockRequires) return;
      if (unlocks[bird.unlockRequires] && !owned[key]) {
        owned[key] = { tier: 'grey', acquiredAt: ts };
      }
    });

    meta.metaSchemaVersion = 2;
    return meta;
  }

  function loadMeta() {
    if (typeof globalThis.getFortuneMeta !== 'function') return null;
    return globalThis.getFortuneMeta();
  }

  function saveMeta(meta) {
    if (typeof globalThis.saveFortuneMeta === 'function') globalThis.saveFortuneMeta(meta);
  }

  function getBirdCard(birdKey) {
    if (!birdKey) return null;
    var m = loadMeta();
    return m && m.birdCards && m.birdCards.owned ? m.birdCards.owned[birdKey] || null : null;
  }

  function ownsBirdCard(birdKey) {
    return !!getBirdCard(birdKey);
  }

  function getBirdCardTier(birdKey) {
    var card = getBirdCard(birdKey);
    if (card && card.tier) return normalizeTier(card.tier);
    if (starterBirdKeys().indexOf(birdKey) >= 0) return 'grey';
    return 'grey';
  }

  function getSpeciesFeathers(birdKey) {
    if (!birdKey) return 0;
    var m = loadMeta();
    return Math.max(0, Math.floor(Number(m && m.speciesFeathers && m.speciesFeathers[birdKey]) || 0));
  }

  function addSpeciesFeathers(birdKey, n) {
    if (!birdKey) return 0;
    var amt = Math.max(0, Math.floor(Number(n) || 0));
    var m = loadMeta();
    if (!m) return 0;
    m.speciesFeathers = normalizeSpeciesFeathers(m.speciesFeathers);
    m.speciesFeathers[birdKey] = getSpeciesFeathers(birdKey) + amt;
    saveMeta(m);
    return m.speciesFeathers[birdKey];
  }

  function spendSpeciesFeathers(birdKey, n) {
    if (!birdKey) return false;
    var cost = Math.max(0, Math.floor(Number(n) || 0));
    if (!cost) return true;
    var m = loadMeta();
    if (!m) return false;
    var have = getSpeciesFeathers(birdKey);
    if (have < cost) return false;
    m.speciesFeathers = normalizeSpeciesFeathers(m.speciesFeathers);
    m.speciesFeathers[birdKey] = have - cost;
    if (m.speciesFeathers[birdKey] <= 0) delete m.speciesFeathers[birdKey];
    saveMeta(m);
    return true;
  }

  function grantBirdCard(birdKey, tier) {
    if (!birdKey) return false;
    var m = loadMeta();
    if (!m) return false;
    if (!m.birdCards) m.birdCards = emptyBirdCardsBlock();
    if (!m.birdCards.owned) m.birdCards.owned = {};
    var isNew = !m.birdCards.owned[birdKey];
    m.birdCards.owned[birdKey] = {
      tier: normalizeTier(tier || 'grey'),
      acquiredAt: m.birdCards.owned[birdKey]?.acquiredAt || Date.now(),
    };
    saveMeta(m);
    return isNew;
  }

  function mutateBirdCard(birdKey) {
    if (!birdKey || !ownsBirdCard(birdKey)) return { ok: false, reason: 'no_card' };
    var t = tiers();
    if (!t) return { ok: false, reason: 'config' };
    var current = getBirdCardTier(birdKey);
    var next = t.nextTier(current);
    if (!next) return { ok: false, reason: 'max_tier' };
    var cost = t.getMutationCostForTier(current);
    if (!spendSpeciesFeathers(birdKey, cost)) return { ok: false, reason: 'feathers' };

    var m = loadMeta();
    m.birdCards.owned[birdKey].tier = next;
    if (!m.birdCards.mutationHistory[birdKey]) m.birdCards.mutationHistory[birdKey] = [];
    m.birdCards.mutationHistory[birdKey].push(next);
    saveMeta(m);
    return { ok: true, tier: next, cost: cost };
  }

  function getPityState() {
    var m = loadMeta();
    var mg = (m && m.motherGoose) || emptyMotherGooseBlock();
    var th = (tiers() && tiers().PITY_THRESHOLDS) || { choiceAt: 10, forceNewAt: 30, rareAt: 50 };
    var since = mg.eggsSinceChoice || 0;
    var nextAt = th.choiceAt;
    if (since >= th.choiceAt && since < th.forceNewAt) nextAt = th.forceNewAt;
    else if (since >= th.forceNewAt && since < th.rareAt) nextAt = th.rareAt;
    else if (since >= th.rareAt) nextAt = th.rareAt;
    return {
      totalHatches: mg.totalHatches || 0,
      eggsSinceChoice: since,
      pityChoicePending: !!mg.pityChoicePending,
      pityChoiceOptions: (mg.pityChoiceOptions || []).slice(),
      nextThreshold: nextAt,
      eggsUntilNext: Math.max(0, nextAt - since),
      lastHatch: mg.lastHatch,
    };
  }

  function recordHatch(result) {
    var m = loadMeta();
    if (!m) return;
    if (!m.motherGoose) m.motherGoose = emptyMotherGooseBlock();
    m.motherGoose.totalHatches = (m.motherGoose.totalHatches || 0) + 1;
    m.motherGoose.eggsSinceChoice = (m.motherGoose.eggsSinceChoice || 0) + 1;
    m.motherGoose.lastHatch = result || null;
    if (!Array.isArray(m.eggPurchaseHistory)) m.eggPurchaseHistory = [];
    m.eggPurchaseHistory.push({
      at: Date.now(),
      eggType: result && result.eggType,
      birdKey: result && result.birdKey,
      isNew: !!(result && result.isNew),
    });
    if (m.eggPurchaseHistory.length > 50) m.eggPurchaseHistory = m.eggPurchaseHistory.slice(-50);
    saveMeta(m);
  }

  function consumePityChoice(birdKey) {
    if (!birdKey) return { ok: false, reason: 'missing' };
    var m = loadMeta();
    if (!m || !m.motherGoose || !m.motherGoose.pityChoicePending) return { ok: false, reason: 'none_pending' };
    var opts = m.motherGoose.pityChoiceOptions || [];
    if (opts.indexOf(birdKey) < 0) return { ok: false, reason: 'invalid_option' };
    var isNew = grantBirdCard(birdKey, 'grey');
    var bird = (globalThis.BIRDS || {})[birdKey];
    if (bird && bird.unlockRequires && typeof globalThis.grantUnlock === 'function') {
      if (typeof globalThis.isUnlocked !== 'function' || !globalThis.isUnlocked(bird.unlockRequires)) {
        globalThis.grantUnlock(bird.unlockRequires);
      }
    }
    m = loadMeta();
    m.motherGoose.pityChoicePending = false;
    m.motherGoose.pityChoiceOptions = [];
    m.motherGoose.eggsSinceChoice = 0;
    saveMeta(m);
    return { ok: true, birdKey: birdKey, isNew: isNew };
  }

  function setPityChoicePending(options) {
    var m = loadMeta();
    if (!m) return;
    if (!m.motherGoose) m.motherGoose = emptyMotherGooseBlock();
    m.motherGoose.pityChoicePending = true;
    m.motherGoose.pityChoiceOptions = (options || []).slice(0, 3);
    saveMeta(m);
  }

  function resetPityCounterAfterForce() {
    var m = loadMeta();
    if (!m || !m.motherGoose) return;
    m.motherGoose.eggsSinceChoice = 0;
    saveMeta(m);
  }

  var api = {
    migrateBirdCardsInMeta: migrateBirdCardsInMeta,
    normalizeOwnedCards: normalizeOwnedCards,
    normalizeSpeciesFeathers: normalizeSpeciesFeathers,
    normalizeMotherGoose: normalizeMotherGoose,
    emptyBirdCardsBlock: emptyBirdCardsBlock,
    emptyMotherGooseBlock: emptyMotherGooseBlock,
    getBirdCard: getBirdCard,
    ownsBirdCard: ownsBirdCard,
    getBirdCardTier: getBirdCardTier,
    getSpeciesFeathers: getSpeciesFeathers,
    addSpeciesFeathers: addSpeciesFeathers,
    spendSpeciesFeathers: spendSpeciesFeathers,
    grantBirdCard: grantBirdCard,
    mutateBirdCard: mutateBirdCard,
    getPityState: getPityState,
    recordHatch: recordHatch,
    consumePityChoice: consumePityChoice,
    setPityChoicePending: setPityChoicePending,
    resetPityCounterAfterForce: resetPityCounterAfterForce,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.birdCards = api;

  globalThis.migrateBirdCardsInMeta = migrateBirdCardsInMeta;
  globalThis.normalizeBirdCardsInMeta = migrateBirdCardsInMeta;
  globalThis.getBirdCard = getBirdCard;
  globalThis.ownsBirdCard = ownsBirdCard;
  globalThis.getBirdCardTier = getBirdCardTier;
  globalThis.getSpeciesFeathers = getSpeciesFeathers;
  globalThis.addSpeciesFeathers = addSpeciesFeathers;
  globalThis.mutateBirdCard = mutateBirdCard;
  globalThis.getPityState = getPityState;
  globalThis.recordHatch = recordHatch;
  globalThis.consumePityChoice = consumePityChoice;
  globalThis.grantBirdCard = grantBirdCard;
})();
