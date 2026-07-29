/** G. Precision / Dodge / hit / critical scenarios. */

export default [
  {
    id: 'HIT-001',
    name: 'Hit chance is clamped to configured min/max',
    setup: {
      player: { bird: 'sparrow', energy: 4, acc: 200, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, dodge: 0 },
    },
    assert({ sandbox, expectValue }) {
      const cfg = sandbox.Avian?.data?.combatConfig?.hit || { minPct: 15, maxPct: 95 };
      const high = sandbox.calculateAbilityHitChancePct(200, 0, 0);
      const low = sandbox.calculateAbilityHitChancePct(10, 80, 0);
      expectValue(high, cfg.maxPct, 'hit max clamp');
      expectValue(low, cfg.minPct, 'hit min clamp');
    },
  },
  {
    id: 'HIT-002',
    name: 'Defender Dodge reduces hit chance',
    setup: {
      player: { bird: 'sparrow', energy: 4, acc: 80, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, dodge: 20 },
    },
    assert({ sandbox, expectValue }) {
      const noDodge = sandbox.calculateAbilityHitChancePct(80, 0, 0);
      const withDodge = sandbox.calculateAbilityHitChancePct(80, 20, 0);
      expectValue(withDodge < noDodge, true, 'dodge lowers hit%');
      expectValue(withDodge, 60, '80 ACC − 20 dodge = 60');
    },
  },
  {
    id: 'HIT-003',
    name: 'A miss applies no damage',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 80, armour: 0 },
    },
    action: { type: 'basicAttack', forceHit: false },
    expect: { enemyHpChange: 0, enemyWasHit: false },
  },
  {
    id: 'HIT-004',
    name: 'Forced hit lands and deals damage',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 80, armour: 0, magicArmour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { critical: false },
    assert({ result, expectValue }) {
      expectValue(result.enemyWasHit, true, 'forced hit');
      expectValue(result.dmgDealt > 0, true, 'damage on hit');
    },
  },
  {
    id: 'HIT-005',
    name: 'Critical cannot occur on a miss',
    setup: {
      player: { bird: 'sparrow', energy: 4, critChance: 100, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 80, armour: 0 },
    },
    action: { type: 'basicAttack', forceHit: false },
    assert({ result, expectValue }) {
      expectValue(result.hitsLanded, 0, 'no hits on miss');
      expectValue(result.dmgDealt, 0, 'no damage on miss');
      const critLogged = (result.log || []).some((e) => e.isCrit);
      expectValue(critLogged, false, 'no crit on miss');
    },
  },
];
