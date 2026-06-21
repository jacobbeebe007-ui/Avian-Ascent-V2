/* Avian Ascent — standardized buff/debuff magnitude lookup for ACC, Dodge, Crit Chance, Crit Damage. */
(function () {
  'use strict';

  var MAGNITUDES = {
    accUp: { minor: 6, major: 10, grand: 15, epic: 20, legendary: 25 },
    accDown: { minor: 6, major: 10, severe: 15, critical: 20, lethal: 25 },
    dodgeUp: { minor: 3, major: 5, grand: 8, epic: 10, legendary: 12 },
    dodgeDown: { minor: 3, major: 5, severe: 8, critical: 10, lethal: 12 },
    critChanceUp: { minor: 5, major: 8, grand: 12, epic: 16, legendary: 20 },
    critChanceDown: { minor: 5, major: 8, severe: 12, critical: 16, lethal: 20 },
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
