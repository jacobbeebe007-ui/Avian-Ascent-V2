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

  var LEDGER_STAT_ALIASES = Object.freeze({
    might: 'atk', atk: 'atk',
    dexterity: 'dex', dex: 'dex',
    focus: 'matk', matk: 'matk', matt: 'matk',
    guard: 'def', def: 'def',
    resolve: 'mdef', mdef: 'mdef',
    agility: 'spd', spd: 'spd',
    precision: 'acc', acc: 'acc',
    evasion: 'dodge', dodge: 'dodge',
    vitality: 'vitality', vit: 'vitality', vig: 'vitality',
    hp: 'hp',
    maxhp: 'maxHp', maxhealth: 'maxHp',
    ferocity: 'critDamage', critdamage: 'critDamage', critmult: 'critDamage',
    critical: 'critChance', critchance: 'critChance',
    armour: 'armour', armor: 'armour',
    magicarmour: 'magicArmour', magicarmor: 'magicArmour',
  });

  function normalizeLedgerStatKey(raw) {
    var k = String(raw || '').trim().toLowerCase();
    if (!k) return '';
    if (LEDGER_STAT_ALIASES[k]) return LEDGER_STAT_ALIASES[k];
    return k;
  }

  function glossaryStatEntry(ledgerKey) {
    var g = Avian.data && Avian.data.displayGlossary;
    var stats = g && g.stats;
    var k = normalizeLedgerStatKey(ledgerKey);
    /* Max Health is distinct from the Vitality attribute in v0.9. */
    if (k === 'maxHp') {
      return (stats && stats.maxHp) || { display: 'Max Health', short: 'HP' };
    }
    if (k === 'vitality') {
      return (stats && (stats.vitality || stats.hp)) || { display: 'Vitality', short: 'VIT' };
    }
    if (k === 'hp') {
      /* Gear hpFlat affixes display as Vitality. */
      return (stats && (stats.vitality || stats.hp)) || { display: 'Vitality', short: 'VIT' };
    }
    if (k === 'dex') {
      return (stats && (stats.dex || stats.dexterity)) || { display: 'Dexterity', short: 'DEX' };
    }
    if (k === 'critDamage') return (stats && stats.critDamage) || null;
    if (k === 'critChance') return (stats && stats.critChance) || null;
    if (stats && stats[k]) return stats[k];
    return null;
  }

  function displayStatName(ledgerKey) {
    var entry = glossaryStatEntry(ledgerKey);
    if (entry && entry.display) return entry.display;
    var k = normalizeLedgerStatKey(ledgerKey) || String(ledgerKey || '').toLowerCase();
    if (k === 'armorpen' || k === 'physicalpen' || k === 'armorPen') return 'Martial Penetration';
    if (k === 'magicpen' || k === 'magicPen') return 'Magic Penetration';
    if (k === 'armour' || k === 'armor') return 'Armour';
    if (k === 'magicArmour' || k === 'magicarmour' || k === 'magicarmor') return 'Magic Armour';
    if (k === 'maxarmour' || k === 'maxarmor') return 'Armour';
    if (k === 'maxmagicarmour' || k === 'maxmagicarmor') return 'Magic Armour';
    return String(ledgerKey || '');
  }

  function displayStatShort(ledgerKey) {
    var entry = glossaryStatEntry(ledgerKey);
    if (entry && entry.short) return entry.short;
    var k = String(ledgerKey || '').toLowerCase();
    if (k === 'armorpen' || k === 'physicalpen') return 'MPen';
    if (k === 'magicpen') return 'MgPen';
    if (k === 'armour' || k === 'armor' || k === 'maxarmour' || k === 'maxarmor') return 'ARM';
    if (k === 'magicarmour' || k === 'magicarmor' || k === 'maxmagicarmour' || k === 'maxmagicarmor') return 'MARM';
    return displayStatName(ledgerKey);
  }

  function displayScalingStat(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return 'Might';
    var u = s.toUpperCase();
    if (u === 'HYBRID') return 'Might + Focus';
    if (u === 'TRUE') return 'True';
    var name = displayStatName(s);
    if (name && name.toLowerCase() !== s.toLowerCase()) return name;
    return displayStatName(normalizeLedgerStatKey(s) || s) || s;
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
    statShort: displayStatShort,
    scalingStat: displayScalingStat,
    ledgerKey: normalizeLedgerStatKey,
    damageChannel: displayDamageChannel,
    familyName: displayFamilyName,
    concept: conceptLabel,
  };

  Avian.systems.normalizeAffinityId = normalizeAffinityId;
  Avian.systems.affinityDisplayName = affinityDisplayName;
  Avian.systems.getAffinityMultiplier = getAffinityMultiplier;
})();
