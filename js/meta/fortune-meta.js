/* Avian Ascent — global meta currency (Golden Goose Eggs) across Flights. */
(function () {
  'use strict';

  var META_KEY = 'avianAscent_meta_v1';
  var META_SCHEMA_VERSION = 4;

  var DEFAULT_TRADE_PURCHASES = {
    trade_freshWaterCap: 0,
    trade_sugarWaterCap: 0,
    trade_honeyWaterCap: 0,
  };

  function emptyMeta() {
    return {
      metaSchemaVersion: META_SCHEMA_VERSION,
      goldenGooseEggs: 0,
      ownedArtifacts: {},
      ownedMisc: {},
      equippedArtifactId: null,
      tradePurchases: Object.assign({}, DEFAULT_TRADE_PURCHASES),
      combatItemCapBonus: { freshWater: 0, sugarWater: 0, honeyWater: 0 },
      birdCards: { owned: {}, mutationHistory: {} },
      speciesFeathers: {},
      motherGoose: {
        totalHatches: 0,
        eggsSinceChoice: 0,
        pityChoicePending: false,
        pityChoiceOptions: [],
        lastHatch: null,
      },
      eggPurchaseHistory: [],
      activityLog: [],
    };
  }

  function normalizeOwnedMisc(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (id) {
      var n = Math.max(0, Math.floor(Number(raw[id]) || 0));
      if (n > 0) out[id] = n;
    });
    return out;
  }

  function normalizeTradePurchases(raw) {
    var out = Object.assign({}, DEFAULT_TRADE_PURCHASES);
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(DEFAULT_TRADE_PURCHASES).forEach(function (id) {
      out[id] = Math.max(0, Math.floor(Number(raw[id]) || 0));
    });
    return out;
  }

  function normalizeCombatItemCapBonus(raw) {
    return {
      freshWater: Math.max(0, Math.floor(Number(raw && raw.freshWater) || 0)),
      sugarWater: Math.max(0, Math.floor(Number(raw && raw.sugarWater) || 0)),
      honeyWater: Math.max(0, Math.floor(Number(raw && raw.honeyWater) || 0)),
    };
  }

  function normalizeEquippedArtifactId(rawId, ownedArtifacts) {
    var id = rawId != null && rawId !== '' ? String(rawId) : null;
    if (!id) return null;
    if (!ownedArtifacts || !ownedArtifacts[id]) return null;
    return id;
  }

  function normalizeBirdCardsBlock(m) {
    var owned = {};
    var hist = {};
    if (m.birdCards && typeof m.birdCards === 'object') {
      if (m.birdCards.owned && typeof m.birdCards.owned === 'object') owned = m.birdCards.owned;
      if (m.birdCards.mutationHistory && typeof m.birdCards.mutationHistory === 'object') hist = m.birdCards.mutationHistory;
    }
    return { owned: owned, mutationHistory: hist };
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
    var base = {
      totalHatches: 0,
      eggsSinceChoice: 0,
      pityChoicePending: false,
      pityChoiceOptions: [],
      lastHatch: null,
    };
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

  function migrateSavedEggsToGolden(out) {
    if (out.metaSchemaVersion >= META_SCHEMA_VERSION) return;
    var legacy = Math.max(0, Math.floor(Number(out.savedEggs) || 0));
    if (legacy > 0) {
      out.goldenGooseEggs = Math.max(0, Math.floor(Number(out.goldenGooseEggs) || 0)) + legacy;
    }
    delete out.savedEggs;
    out.metaSchemaVersion = META_SCHEMA_VERSION;
  }

  function normalizeMeta(raw) {
    var m = raw && typeof raw === 'object' ? raw : emptyMeta();
    var ownedArtifacts = m.ownedArtifacts && typeof m.ownedArtifacts === 'object' ? m.ownedArtifacts : {};
    var goldenGooseEggs = Math.max(0, Math.floor(Number(m.goldenGooseEggs) || 0));
    if (m.savedEggs != null) {
      goldenGooseEggs += Math.max(0, Math.floor(Number(m.savedEggs) || 0));
    }
    var out = {
      metaSchemaVersion: Math.max(1, Math.floor(Number(m.metaSchemaVersion) || 1)),
      goldenGooseEggs: goldenGooseEggs,
      ownedArtifacts: ownedArtifacts,
      ownedMisc: normalizeOwnedMisc(m.ownedMisc),
      equippedArtifactId: normalizeEquippedArtifactId(m.equippedArtifactId, ownedArtifacts),
      tradePurchases: normalizeTradePurchases(m.tradePurchases),
      combatItemCapBonus: normalizeCombatItemCapBonus(m.combatItemCapBonus),
      birdCards: normalizeBirdCardsBlock(m),
      speciesFeathers: normalizeSpeciesFeathers(m.speciesFeathers),
      motherGoose: normalizeMotherGoose(m.motherGoose),
      eggPurchaseHistory: Array.isArray(m.eggPurchaseHistory) ? m.eggPurchaseHistory.slice(-50) : [],
      activityLog: Array.isArray(m.activityLog) ? m.activityLog.slice(-100) : [],
    };
    if (typeof globalThis.migrateBirdCardsInMeta === 'function') {
      globalThis.migrateBirdCardsInMeta(out);
    }
    migrateSavedEggsToGolden(out);
    return out;
  }

  function getFortuneMeta() {
    try {
      return normalizeMeta(JSON.parse(localStorage.getItem(META_KEY) || '{}'));
    } catch (_) {
      return emptyMeta();
    }
  }

  function saveFortuneMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(normalizeMeta(meta)));
    } catch (_) { /* noop */ }
  }

  function getGoldenGooseEggBalance() {
    if (isGoldenGooseInfinite()) return Infinity;
    return getFortuneMeta().goldenGooseEggs;
  }

  function isGoldenGooseInfinite() {
    try { return localStorage.getItem('avian_infinite_golden_eggs') === '1'; } catch (_) { return false; }
  }

  function getSavedEggBalance() {
    return getGoldenGooseEggBalance();
  }

  function addGoldenGooseEggs(n) {
    var amt = Math.max(0, Math.floor(Number(n) || 0));
    if (!amt) return getGoldenGooseEggBalance();
    var m = getFortuneMeta();
    m.goldenGooseEggs += amt;
    saveFortuneMeta(m);
    return m.goldenGooseEggs;
  }

  function addSavedEggs(n) {
    return addGoldenGooseEggs(n);
  }

  function spendGoldenGooseEggs(n) {
    if (isGoldenGooseInfinite()) return true;
    var cost = Math.max(0, Math.floor(Number(n) || 0));
    if (!cost) return true;
    var m = getFortuneMeta();
    if (m.goldenGooseEggs < cost) return false;
    m.goldenGooseEggs -= cost;
    saveFortuneMeta(m);
    return true;
  }

  function spendSavedEggs(n) {
    return spendGoldenGooseEggs(n);
  }

  function recordSuppliesActivity(title, details) {
    var m = getFortuneMeta();
    if (!Array.isArray(m.activityLog)) m.activityLog = [];
    m.activityLog.push({ at: Date.now(), title: String(title || 'Supplies updated'), details: (details || []).map(String) });
    m.activityLog = m.activityLog.slice(-100);
    saveFortuneMeta(m);
  }

  function getSuppliesActivityLog() { return getFortuneMeta().activityLog.slice().reverse(); }

  function ownsArtifact(id) {
    if (!id) return false;
    return !!getFortuneMeta().ownedArtifacts[id];
  }

  function getEquippedArtifactId() {
    return getFortuneMeta().equippedArtifactId || null;
  }

  function setEquippedArtifact(artifactId) {
    var m = getFortuneMeta();
    if (artifactId == null || artifactId === '') {
      m.equippedArtifactId = null;
      saveFortuneMeta(m);
      return true;
    }
    var id = String(artifactId);
    if (!m.ownedArtifacts[id]) return false;
    m.equippedArtifactId = id;
    saveFortuneMeta(m);
    return true;
  }

  function equipArtifactIfEmpty(artifactId) {
    if (!artifactId || getEquippedArtifactId()) return false;
    return setEquippedArtifact(artifactId);
  }

  function grantArtifact(id) {
    if (!id) return false;
    var m = getFortuneMeta();
    m.ownedArtifacts[id] = true;
    saveFortuneMeta(m);
    equipArtifactIfEmpty(id);
    return true;
  }

  function getOwnedMiscCount(id) {
    if (!id) return 0;
    return Math.max(0, Math.floor(Number(getFortuneMeta().ownedMisc[id]) || 0));
  }

  function getAllOwnedMisc() {
    var misc = getFortuneMeta().ownedMisc || {};
    return Object.keys(misc)
      .filter(function (id) {
        return getOwnedMiscCount(id) > 0;
      })
      .map(function (id) {
        return { id: id, count: getOwnedMiscCount(id) };
      });
  }

  function addOwnedMisc(id, n) {
    if (!id) return 0;
    var amt = Math.max(0, Math.floor(Number(n) || 0));
    if (!amt) return getOwnedMiscCount(id);
    var m = getFortuneMeta();
    m.ownedMisc[id] = getOwnedMiscCount(id) + amt;
    saveFortuneMeta(m);
    return m.ownedMisc[id];
  }

  function spendOwnedMisc(id, n) {
    if (!id) return false;
    var cost = Math.max(0, Math.floor(Number(n) || 0));
    if (!cost) return true;
    var m = getFortuneMeta();
    var have = getOwnedMiscCount(id);
    if (have < cost) return false;
    var left = have - cost;
    if (left > 0) m.ownedMisc[id] = left;
    else delete m.ownedMisc[id];
    saveFortuneMeta(m);
    return true;
  }

  function getTradePurchaseCount(tradeId) {
    if (!tradeId) return 0;
    var purchases = getFortuneMeta().tradePurchases || {};
    return Math.max(0, Math.floor(Number(purchases[tradeId]) || 0));
  }

  function getTradeOfferById(tradeId) {
    var offers = globalThis.FORTUNE_TRADE_OFFERS || [];
    return offers.find(function (o) {
      return o.id === tradeId;
    }) || null;
  }

  function isTradeOfferMaxed(offer, purchasesSoFar) {
    if (!offer || offer.maxPurchases == null) return false;
    return getTradePurchaseCount(offer.id) >= Math.max(0, Math.floor(Number(offer.maxPurchases) || 0));
  }

  function commitFortuneTradePurchase(tradeId, count) {
    var offer = getTradeOfferById(tradeId);
    if (!offer) return { ok: false, reason: 'missing' };
    var batch = Math.max(1, Math.floor(Number(count) || 1));
    var purchasesSoFar = getTradePurchaseCount(tradeId);
    if (offer.maxPurchases != null) {
      var max = Math.max(0, Math.floor(Number(offer.maxPurchases) || 0));
      if (purchasesSoFar >= max) return { ok: false, reason: 'maxed' };
      if (purchasesSoFar + batch > max) return { ok: false, reason: 'maxed' };
    }
    var unitCost =
      typeof globalThis.getTradeOfferCost === 'function'
        ? globalThis.getTradeOfferCost(offer, purchasesSoFar)
        : Math.max(0, Math.floor(Number(offer.baseCost) || 0));
    var totalCost = unitCost * batch;
    if (!spendGoldenGooseEggs(totalCost)) return { ok: false, reason: 'funds' };

    var m = getFortuneMeta();
    m.tradePurchases = normalizeTradePurchases(m.tradePurchases);
    m.tradePurchases[tradeId] = purchasesSoFar + batch;

    if (offer.itemKey) {
      m.combatItemCapBonus = normalizeCombatItemCapBonus(m.combatItemCapBonus);
      m.combatItemCapBonus[offer.itemKey] = (m.combatItemCapBonus[offer.itemKey] || 0) + batch;
    }

    saveFortuneMeta(m);
    return { ok: true, cost: totalCost, count: batch, offer: offer };
  }

  globalThis.FORTUNE_META_KEY = META_KEY;
  globalThis.getFortuneMeta = getFortuneMeta;
  globalThis.saveFortuneMeta = saveFortuneMeta;
  globalThis.getSavedEggBalance = getSavedEggBalance;
  globalThis.getGoldenGooseEggBalance = getGoldenGooseEggBalance;
  globalThis.addSavedEggs = addSavedEggs;
  globalThis.addGoldenGooseEggs = addGoldenGooseEggs;
  globalThis.spendSavedEggs = spendSavedEggs;
  globalThis.spendGoldenGooseEggs = spendGoldenGooseEggs;
  globalThis.isGoldenGooseInfinite = isGoldenGooseInfinite;
  globalThis.recordSuppliesActivity = recordSuppliesActivity;
  globalThis.getSuppliesActivityLog = getSuppliesActivityLog;
  globalThis.ownsArtifact = ownsArtifact;
  globalThis.grantArtifact = grantArtifact;
  globalThis.getEquippedArtifactId = getEquippedArtifactId;
  globalThis.setEquippedArtifact = setEquippedArtifact;
  globalThis.equipArtifactIfEmpty = equipArtifactIfEmpty;
  globalThis.getOwnedMiscCount = getOwnedMiscCount;
  globalThis.getAllOwnedMisc = getAllOwnedMisc;
  globalThis.addOwnedMisc = addOwnedMisc;
  globalThis.spendOwnedMisc = spendOwnedMisc;
  globalThis.getTradePurchaseCount = getTradePurchaseCount;
  globalThis.commitFortuneTradePurchase = commitFortuneTradePurchase;
})();
