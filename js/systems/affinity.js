/* Affinity helpers — normalize legacy Aspect ids ↔ Affinity labels. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  function aspectsData() {
    return (Avian.data && Avian.data.aspects) || null;
  }

  function affinitiesData() {
    return (Avian.data && Avian.data.affinities) || null;
  }

  function normalizeAffinityId(raw) {
    if (raw == null || raw === '' || raw === 'neutral' || raw === 'none') return null;
    var key = String(raw).trim();
    var asp = aspectsData();
    if (asp && asp.aliases && asp.aliases[key] != null) return asp.aliases[key];
    var lower = key.toLowerCase();
    if (asp && asp.aliases && asp.aliases[lower] != null) return asp.aliases[lower];
    if (asp && asp.ids && asp.ids.indexOf(lower) >= 0) return lower;
    var aff = affinitiesData();
    if (aff && aff.toLegacy && aff.toLegacy[lower]) return aff.toLegacy[lower];
    return lower;
  }

  function affinityDisplayName(id) {
    var legacy = normalizeAffinityId(id);
    if (!legacy) return '—';
    var asp = aspectsData();
    if (asp && asp.displayNames && asp.displayNames[legacy]) return asp.displayNames[legacy];
    return String(legacy);
  }

  function plainAffinityId(id) {
    var legacy = normalizeAffinityId(id);
    if (!legacy) return null;
    var asp = aspectsData();
    if (asp && asp.plainNames && asp.plainNames[legacy]) return asp.plainNames[legacy];
    var aff = affinitiesData();
    if (aff && aff.toPlain && aff.toPlain[legacy]) return aff.toPlain[legacy];
    return legacy;
  }

  function getAffinityMultiplier(attackId, defendId) {
    var atk = normalizeAffinityId(attackId);
    var def = normalizeAffinityId(defendId);
    var asp = aspectsData();
    if (!asp || !asp.chart || !atk || !def) return Number(asp && asp.neutralMod) || 1;
    var row = asp.chart[atk];
    if (!row || row[def] == null) return Number(asp.neutralMod) || 1;
    var rel = String(row[def]).toLowerCase();
    if (rel === 'dominant') return Number(asp.dominantMod) || 1.2;
    if (rel === 'resisted') return Number(asp.resistedMod) || 0.8;
    return Number(asp.neutralMod) || 1;
  }

  function displayStatName(ledgerKey) {
    var g = Avian.data && Avian.data.displayGlossary;
    var stats = g && g.stats;
    var k = String(ledgerKey || '').toLowerCase();
    if (stats && stats[k] && stats[k].display) return stats[k].display;
    return String(ledgerKey || '');
  }

  function displayDamageChannel(raw) {
    var g = Avian.data && Avian.data.displayGlossary;
    var map = g && g.damageChannels;
    var s = String(raw || '');
    if (map && map[s] != null) return map[s];
    if (/physical/i.test(s)) return 'Martial';
    if (/hybrid/i.test(s)) return 'Martial + Magic';
    return s;
  }

  function displayFamilyName(family) {
    var g = Avian.data && Avian.data.displayGlossary;
    var aliases = g && g.familyAliases;
    var f = String(family || '');
    if (aliases && aliases[f]) return aliases[f];
    return f;
  }

  function conceptLabel(key) {
    var g = Avian.data && Avian.data.displayGlossary;
    var concepts = g && g.concepts;
    if (concepts && concepts[key] != null) return concepts[key];
    return key;
  }

  Avian.affinity = {
    normalize: normalizeAffinityId,
    displayName: affinityDisplayName,
    plainId: plainAffinityId,
    multiplier: getAffinityMultiplier,
  };
  Avian.display = {
    statName: displayStatName,
    damageChannel: displayDamageChannel,
    familyName: displayFamilyName,
    concept: conceptLabel,
  };

  Avian.systems.normalizeAffinityId = normalizeAffinityId;
  Avian.systems.affinityDisplayName = affinityDisplayName;
  Avian.systems.getAffinityMultiplier = getAffinityMultiplier;
})();
