/* Avian Ascent — permanent, deterministic balance benchmark definitions.
 * Values here are fixtures, not live tuning.  Change them deliberately and
 * compare the generated report with scripts/data/balance-baseline.json.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  var tierSpec = Object.freeze({
    starter: Object.freeze({ level: 1, featherLevel: 0, rarity: 'grey' }),
    mid: Object.freeze({ level: 10, featherLevel: 4, rarity: 'blue' }),
    late: Object.freeze({ level: 20, featherLevel: 8, rarity: 'gold' }),
  });
  var starts = { knight: 'WPN-B02', rogue: 'WPN-B04', mage: 'WPN-B01', siren: 'WPN-B01', inquisitor: 'WPN-B05', bard: 'WPN-B03', brute: 'WPN-B02' };
  var birds = {
    knight: ['crow', 'Core Knight: reliable Might/Guard defender without Brute burst.'],
    rogue: ['sparrow', 'Starter Rogue with representative Dexterity, Agility, precision and fragility.'],
    mage: ['blackbird', 'Starter Mage with a clear Focus/magic-pressure profile and low physical durability.'],
    siren: ['bowerbird', 'Controller Siren whose ailment tempo is not inflated by extreme direct damage.'],
    inquisitor: ['bluejay', 'Central hybrid Inquisitor with offensive sustain and anti-magic identity.'],
    bard: ['pigeon', 'Intentionally average hybrid Bard with no statistical spike.'],
    brute: ['goose', 'Starter Brute expressing high HP and Might with low precision and mobility.'],
  };
  var loadoutIds = {
    knight: { grey: ['HLM-001','ARM-001',null,'ACC-001','ACC-001','ACC-025'], blue: ['HLM-003','ARM-003','WPN-075','ACC-003','ACC-003','ACC-027'], gold: ['HLM-005','ARM-005','WPN-077','ACC-005','ACC-005','ACC-029'] },
    rogue: { grey: ['HLM-019','ARM-019',null,'ACC-001','ACC-001','ACC-025','SHD-019'], blue: ['HLM-021','ARM-021','WPN-015','ACC-003','ACC-003','ACC-027','SHD-021'], gold: ['HLM-023','ARM-023','WPN-017','ACC-005','ACC-005','ACC-029','SHD-023'] },
    mage: { grey: ['HLM-007','ARM-007',null,'ACC-001','ACC-001','ACC-025','SHD-007'], blue: ['HLM-009','ARM-009','WPN-051','ACC-003','ACC-003','ACC-027','SHD-009'], gold: ['HLM-011','ARM-011','WPN-053','ACC-005','ACC-005','ACC-029','SHD-011'] },
    siren: { grey: ['HLM-007','ARM-007',null,'ACC-001','ACC-001','ACC-025','SHD-007'], blue: ['HLM-009','ARM-009','WPN-033','ACC-003','ACC-003','ACC-027','SHD-009'], gold: ['HLM-011','ARM-011','WPN-035','ACC-005','ACC-005','ACC-029','SHD-011'] },
    inquisitor: { grey: ['HLM-001','ARM-001',null,'ACC-001','ACC-001','ACC-025','SHD-001'], blue: ['HLM-003','ARM-003','WPN-027','ACC-003','ACC-003','ACC-027','SHD-003'], gold: ['HLM-005','ARM-005','WPN-029','ACC-005','ACC-005','ACC-029','SHD-005'] },
    bard: { grey: ['HLM-007','ARM-007',null,'ACC-001','ACC-001','ACC-025','SHD-007'], blue: ['HLM-009','ARM-009','WPN-015','ACC-003','ACC-003','ACC-027','SHD-009'], gold: ['HLM-011','ARM-011','WPN-017','ACC-005','ACC-005','ACC-029','SHD-011'] },
    brute: { grey: ['HLM-001','ARM-001',null,'ACC-001','ACC-001','ACC-025'], blue: ['HLM-003','ARM-003','WPN-075','ACC-003','ACC-003','ACC-027'], gold: ['HLM-005','ARM-005','WPN-077','ACC-005','ACC-005','ACC-029'] },
  };
  function equipment(cls, tier) {
    var a = loadoutIds[cls][tierSpec[tier].rarity];
    return Object.freeze({ helmet:a[0], armour:a[1], mainHand:a[2] || starts[cls], offHand:a[6] || null, ankletL:a[3], ankletR:a[4], necklace:a[5] });
  }
  var roster = {};
  Object.keys(birds).forEach(function (cls) {
    var tiers = {};
    Object.keys(tierSpec).forEach(function (tier) { tiers[tier] = Object.freeze(Object.assign({}, tierSpec[tier], { equipment:equipment(cls,tier) })); });
    roster[cls] = Object.freeze({ birdId:birds[cls][0], reason:birds[cls][1], tiers:Object.freeze(tiers) });
  });

  /* Tier values are anchored to level-band expectations (1/10/20), then the
   * archetype changes one defensive axis only so comparisons stay legible. */
  function targets(hp, armour, magicArmour, precision, dodge) { return Object.freeze({
    balanced: Object.freeze({ hp:hp, armour:armour, magicArmour:magicArmour, precision:precision, dodge:dodge }),
    highArmour: Object.freeze({ hp:hp, armour:Math.round(armour*2), magicArmour:Math.round(magicArmour*.5), precision:precision, dodge:dodge }),
    highMagicArmour: Object.freeze({ hp:hp, armour:Math.round(armour*.5), magicArmour:Math.round(magicArmour*2), precision:precision, dodge:dodge }),
    highHp: Object.freeze({ hp:Math.round(hp*1.6), armour:armour, magicArmour:magicArmour, precision:precision, dodge:dodge }),
    highDodge: Object.freeze({ hp:hp, armour:armour, magicArmour:magicArmour, precision:precision, dodge:dodge+15 }),
    lowDefence: Object.freeze({ hp:Math.round(hp*.7), armour:0, magicArmour:0, precision:precision, dodge:Math.max(0,dodge-3) }),
  }); }
  Avian.data.balanceBenchmarks = Object.freeze({
    version: 1, baseSeed: 12345, maxTurns: 40,
    roster:Object.freeze(roster),
    targets:Object.freeze({ starter:targets(22,6,6,80,5), mid:targets(55,16,16,84,8), late:targets(105,32,32,88,11) }),
    boss:Object.freeze({ birdId:'crow', reason:'Duke reference uses the stable Knight combat profile.', tiers:Object.freeze({ early:{level:10,rarity:'blue',hp:80}, mid:{level:20,rarity:'purple',hp:150}, late:{level:30,rarity:'gold',hp:240} }) }),
    endlessBands:Object.freeze([1,5,10,15,20]),
    startingWeapons:Object.freeze(['WPN-B01','WPN-B02','WPN-B03','WPN-B04','WPN-B05']),
    thresholds:Object.freeze({ winRateMin:.4,winRateMax:.6,turnsMin:2,turnsMax:8,hitRateMin:.6,hitRateMax:.95,skillUsageMin:.05,efficiencyDrift:.25 }),
  });
})();
