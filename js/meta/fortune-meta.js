/* Avian Ascent — global meta currency (Saved Eggs, Golden Goose Eggs) across Flights. */
(function () {
  'use strict';

  var META_KEY = 'avianAscent_meta_v1';

  function emptyMeta() {
    return { savedEggs: 0, goldenGooseEggs: 0, ownedArtifacts: {}, ownedMisc: {} };
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

  function normalizeMeta(raw) {
    var m = raw && typeof raw === 'object' ? raw : emptyMeta();
    return {
      savedEggs: Math.max(0, Math.floor(Number(m.savedEggs) || 0)),
      goldenGooseEggs: Math.max(0, Math.floor(Number(m.goldenGooseEggs) || 0)),
      ownedArtifacts: m.ownedArtifacts && typeof m.ownedArtifacts === 'object' ? m.ownedArtifacts : {},
      ownedMisc: normalizeOwnedMisc(m.ownedMisc),
    };
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

  function getSavedEggBalance() {
    return getFortuneMeta().savedEggs;
  }

  function getGoldenGooseEggBalance() {
    return getFortuneMeta().goldenGooseEggs;
  }

  function addSavedEggs(n) {
    var amt = Math.max(0, Math.floor(Number(n) || 0));
    if (!amt) return getSavedEggBalance();
    var m = getFortuneMeta();
    m.savedEggs += amt;
    saveFortuneMeta(m);
    return m.savedEggs;
  }

  function addGoldenGooseEggs(n) {
    var amt = Math.max(0, Math.floor(Number(n) || 0));
    if (!amt) return getGoldenGooseEggBalance();
    var m = getFortuneMeta();
    m.goldenGooseEggs += amt;
    saveFortuneMeta(m);
    return m.goldenGooseEggs;
  }

  function spendSavedEggs(n) {
    var cost = Math.max(0, Math.floor(Number(n) || 0));
    if (!cost) return true;
    var m = getFortuneMeta();
    if (m.savedEggs < cost) return false;
    m.savedEggs -= cost;
    saveFortuneMeta(m);
    return true;
  }

  function spendGoldenGooseEggs(n) {
    var cost = Math.max(0, Math.floor(Number(n) || 0));
    if (!cost) return true;
    var m = getFortuneMeta();
    if (m.goldenGooseEggs < cost) return false;
    m.goldenGooseEggs -= cost;
    saveFortuneMeta(m);
    return true;
  }

  function ownsArtifact(id) {
    if (!id) return false;
    return !!getFortuneMeta().ownedArtifacts[id];
  }

  function grantArtifact(id) {
    if (!id) return false;
    var m = getFortuneMeta();
    m.ownedArtifacts[id] = true;
    saveFortuneMeta(m);
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

  globalThis.FORTUNE_META_KEY = META_KEY;
  globalThis.getFortuneMeta = getFortuneMeta;
  globalThis.saveFortuneMeta = saveFortuneMeta;
  globalThis.getSavedEggBalance = getSavedEggBalance;
  globalThis.getGoldenGooseEggBalance = getGoldenGooseEggBalance;
  globalThis.addSavedEggs = addSavedEggs;
  globalThis.addGoldenGooseEggs = addGoldenGooseEggs;
  globalThis.spendSavedEggs = spendSavedEggs;
  globalThis.spendGoldenGooseEggs = spendGoldenGooseEggs;
  globalThis.ownsArtifact = ownsArtifact;
  globalThis.grantArtifact = grantArtifact;
  globalThis.getOwnedMiscCount = getOwnedMiscCount;
  globalThis.getAllOwnedMisc = getAllOwnedMisc;
  globalThis.addOwnedMisc = addOwnedMisc;
})();
