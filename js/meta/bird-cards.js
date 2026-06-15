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

  function clampStars(stars) {
    var t = tiers();
    if (t && typeof t.clampStars === 'function') return t.clampStars(stars);
    return Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
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
        stars: clampStars(row.stars),
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
      if (!owned[key] || typeof owned[key] !== 'object') return;
      owned[key].tier = normalizeTier(owned[key].tier);
      if (owned[key].stars == null) owned[key].stars = 0;
      owned[key].stars = clampStars(owned[key].stars);
    });
    starterBirdKeys().forEach(function (key) {
      if (!owned[key]) owned[key] = { tier: 'grey', stars: 0, acquiredAt: ts };
    });

    var birds = globalThis.BIRDS || {};
    var unlocks = typeof globalThis.getUnlocks === 'function' ? globalThis.getUnlocks() : {};
    Object.keys(birds).forEach(function (key) {
      var bird = birds[key];
      if (!bird || !bird.unlockRequires) return;
      if (unlocks[bird.unlockRequires] && !owned[key]) {
        owned[key] = { tier: 'grey', stars: 0, acquiredAt: ts };
      }
    });

    meta.metaSchemaVersion = 3;
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

  function getBirdCardStars(birdKey) {
    var card = getBirdCard(birdKey);
    if (card && card.stars != null) return clampStars(card.stars);
    return 0;
  }

  function getBirdCardProgress(birdKey) {
    var t = tiers();
    var tier = getBirdCardTier(birdKey);
    var stars = getBirdCardStars(birdKey);
    var cost = t && typeof t.getMutationCostPerStar === 'function' ? t.getMutationCostPerStar(tier) : 0;
    var canUpgrade = t && typeof t.canUpgradeBirdCard === 'function' ? t.canUpgradeBirdCard(tier, stars) : false;
    var preview = t && typeof t.previewUpgrade === 'function' ? t.previewUpgrade(tier, stars) : null;
    var isMax = !canUpgrade;
    return {
      tier: tier,
      stars: stars,
      cost: cost,
      canUpgrade: canUpgrade,
      isMax: isMax,
      preview: preview,
    };
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
      tier: 'grey',
      stars: 0,
      acquiredAt: m.birdCards.owned[birdKey]?.acquiredAt || Date.now(),
    };
    saveMeta(m);
    return isNew;
  }

  function mutateBirdCard(birdKey) {
    if (!birdKey || !ownsBirdCard(birdKey)) return { ok: false, reason: 'no_card' };
    var t = tiers();
    if (!t) return { ok: false, reason: 'config' };

    var card = getBirdCard(birdKey);
    var tier = normalizeTier(card && card.tier);
    var stars = clampStars(card && card.stars);

    if (!t.canUpgradeBirdCard(tier, stars)) return { ok: false, reason: 'max_tier' };

    var cost = t.getMutationCostPerStar(tier);
    if (!spendSpeciesFeathers(birdKey, cost)) return { ok: false, reason: 'feathers' };

    var preview = t.previewUpgrade(tier, stars);
    var tierAfter = preview.tierAfter;
    var starsAfter = preview.starsAfter;
    var isTierUp = !!preview.isTierUp;

    var m = loadMeta();
    m.birdCards.owned[birdKey].tier = tierAfter;
    m.birdCards.owned[birdKey].stars = starsAfter;
    if (!m.birdCards.mutationHistory[birdKey]) m.birdCards.mutationHistory[birdKey] = [];
    m.birdCards.mutationHistory[birdKey].push({ tier: tierAfter, stars: starsAfter, at: Date.now() });
    saveMeta(m);

    return {
      ok: true,
      tier: tierAfter,
      stars: starsAfter,
      isTierUp: isTierUp,
      cost: cost,
    };
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

  function escUpgradeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBirdCardUpgradeHtml(birdKey, opts) {
    opts = opts || {};
    var layout = opts.layout === 'inventory' ? 'inventory' : 'panel';
    if (!birdKey) return '';
    if (typeof globalThis.ownsBirdCard === 'function' && !globalThis.ownsBirdCard(birdKey)) return '';
    if (typeof globalThis.getBirdCardProgress !== 'function') return '';
    var progress = globalThis.getBirdCardProgress(birdKey);
    if (!progress) return '';

    var t = tiers();
    var preview = progress.preview || null;
    var previewTierLabel =
      preview && t && t.TIER_LABELS
        ? t.TIER_LABELS[preview.tierAfter] || preview.tierAfter
        : preview
        ? preview.tierAfter
        : null;
    var speciesFeathers =
      typeof globalThis.getSpeciesFeathers === 'function' ? globalThis.getSpeciesFeathers(birdKey) : 0;
    var mutationCost = progress.cost || 0;
    var ownsCard = typeof globalThis.ownsBirdCard !== 'function' || globalThis.ownsBirdCard(birdKey);
    var canMutate = !!(progress.canUpgrade && speciesFeathers >= mutationCost && ownsCard);
    var wrapClass =
      layout === 'inventory'
        ? 'bird-card-upgrade-wrap bird-card-upgrade-wrap--inventory'
        : 'bird-card-upgrade-wrap bird-card-upgrade-wrap--panel';
    var btnClass =
      'bird-card-upgrade-btn' +
      (layout === 'inventory' ? ' bird-card-upgrade-btn--inventory' : ' bird-card-upgrade-btn--panel');

    var inner = '';
    if (canMutate) {
      var label =
        preview && preview.isTierUp ? 'Ascend to ' + previewTierLabel : 'Upgrade star';
      inner =
        '<button type="button" class="' +
        btnClass +
        '" data-action="mutateBirdCardSelect:' +
        escUpgradeHtml(birdKey) +
        '">' +
        escUpgradeHtml(label) +
        ' (' +
        speciesFeathers +
        '/' +
        mutationCost +
        ' 🪶)</button>';
    } else if (progress.canUpgrade && ownsCard) {
      var hintTarget =
        preview && preview.isTierUp
          ? 'ascending to ' + (previewTierLabel || 'next tier')
          : 'next star';
      inner =
        '<p class="bird-card-upgrade-hint">Species Feathers: ' +
        speciesFeathers +
        ' / ' +
        mutationCost +
        ' for ' +
        escUpgradeHtml(hintTarget) +
        '</p>';
    } else if (progress.isMax && ownsCard) {
      inner = '<p class="bird-card-upgrade-hint">Card at maximum tier and stars.</p>';
    }
    if (!inner) return '';
    return '<div class="' + wrapClass + '">' + inner + '</div>';
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
    getBirdCardStars: getBirdCardStars,
    getBirdCardProgress: getBirdCardProgress,
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
    renderBirdCardUpgradeHtml: renderBirdCardUpgradeHtml,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.birdCards = api;

  globalThis.migrateBirdCardsInMeta = migrateBirdCardsInMeta;
  globalThis.normalizeBirdCardsInMeta = migrateBirdCardsInMeta;
  globalThis.getBirdCard = getBirdCard;
  globalThis.ownsBirdCard = ownsBirdCard;
  globalThis.getBirdCardTier = getBirdCardTier;
  globalThis.getBirdCardStars = getBirdCardStars;
  globalThis.getBirdCardProgress = getBirdCardProgress;
  globalThis.getSpeciesFeathers = getSpeciesFeathers;
  globalThis.addSpeciesFeathers = addSpeciesFeathers;
  globalThis.mutateBirdCard = mutateBirdCard;
  globalThis.getPityState = getPityState;
  globalThis.recordHatch = recordHatch;
  globalThis.consumePityChoice = consumePityChoice;
  globalThis.grantBirdCard = grantBirdCard;
  globalThis.renderBirdCardUpgradeHtml = renderBirdCardUpgradeHtml;
})();
