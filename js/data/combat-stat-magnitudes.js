/* Avian Ascent — standardized buff/debuff magnitude lookup for ACC, Dodge, Crit Chance, Crit Damage. */
(function () {
  'use strict';

  function tierBuffTable() {
    return (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers && globalThis.Avian.data.effectTiers.buff)
      || { minor: 6, major: 8, grand: 12, epic: 18, legendary: 25 };
  }

  function tierDebuffTable() {
    return (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers && globalThis.Avian.data.effectTiers.debuff)
      || { minor: 6, major: 8, crippling: 12, ruinous: 18, fatal: 25 };
  }

  var buff = tierBuffTable();
  var debuff = tierDebuffTable();

  var MAGNITUDES = {
    accUp: { minor: buff.minor, major: buff.major, grand: buff.grand, epic: buff.epic, legendary: buff.legendary },
    accDown: { minor: debuff.minor, major: debuff.major, severe: debuff.crippling, critical: debuff.ruinous, lethal: debuff.fatal },
    dodgeUp: { minor: buff.minor, major: buff.major, grand: buff.grand, epic: buff.epic, legendary: buff.legendary },
    dodgeDown: { minor: debuff.minor, major: debuff.major, severe: debuff.crippling, critical: debuff.ruinous, lethal: debuff.fatal },
    critChanceUp: { minor: buff.minor, major: buff.major, grand: buff.grand, epic: buff.epic, legendary: buff.legendary },
    critChanceDown: { minor: debuff.minor, major: debuff.major, severe: debuff.crippling, critical: debuff.ruinous, lethal: debuff.fatal },
    critDamageUp: { minor: 0.10, major: 0.15, grand: 0.25, epic: 0.35, legendary: 0.50 },
    critDamageDown: { minor: 0.10, major: 0.15, severe: 0.25, critical: 0.35, lethal: 0.50 },
  };

  function normalizeTier(tier) {
    return String(tier || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function normalizeStatKey(stat) {
    var s = String(stat || '').toLowerCase().replace(/[^a-z]/g, '');
    if (s === 'accuracy' || s === 'acc') return 'acc';
    if (s === 'dodge') return 'dodge';
    if (s === 'critchance' || s === 'crit') return 'critChance';
    if (s === 'critdamage' || s === 'critdmg') return 'critDamage';
    return s;
  }

  /** @param {'acc'|'dodge'|'critChance'|'critDamage'} stat @param {'up'|'down'} direction @param {string} tier */
  function getMagnitude(stat, direction, tier) {
    var key = normalizeStatKey(stat);
    var dir = String(direction || 'up').toLowerCase();
    var mapKey = key + (dir === 'down' ? 'Down' : 'Up');
    var table = MAGNITUDES[mapKey];
    if (!table) return null;
    var val = table[normalizeTier(tier)];
    return val != null ? val : null;
  }

  var api = { MAGNITUDES: MAGNITUDES, getMagnitude: getMagnitude, normalizeTier: normalizeTier };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.combatStatMagnitudes = api;
  globalThis.getCombatStatMagnitude = getMagnitude;
})();
