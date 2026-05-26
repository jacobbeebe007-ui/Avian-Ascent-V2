/* Avian Ascent — global meta currency (Saved Eggs, Golden Goose Eggs) across Flights. */
(function () {
  'use strict';

  var META_KEY = 'avianAscent_meta_v1';

  function emptyMeta() {
    return { savedEggs: 0, goldenGooseEggs: 0, ownedArtifacts: {} };
  }

  function normalizeMeta(raw) {
    var m = raw && typeof raw === 'object' ? raw : emptyMeta();
    return {
      savedEggs: Math.max(0, Math.floor(Number(m.savedEggs) || 0)),
      goldenGooseEggs: Math.max(0, Math.floor(Number(m.goldenGooseEggs) || 0)),
      ownedArtifacts: m.ownedArtifacts && typeof m.ownedArtifacts === 'object' ? m.ownedArtifacts : {},
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

  globalThis.FORTUNE_META_KEY = META_KEY;
  globalThis.getFortuneMeta = getFortuneMeta;
  globalThis.saveFortuneMeta = saveFortuneMeta;
  globalThis.getSavedEggBalance = getSavedEggBalance;
  globalThis.getGoldenGooseEggBalance = getGoldenGooseEggBalance;
  globalThis.addSavedEggs = addSavedEggs;
  globalThis.addGoldenGooseEggs = addGoldenGooseEggs;
  globalThis.spendSavedEggs = spendSavedEggs;
})();
