/** C. Direct damage scenarios — isolate modifiers from full duels. */

export default [
  {
    id: 'DMG-001',
    name: 'Martial basic attack deals damage on hit',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, armour: 0, magicArmour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { hit: true, critical: false, damageRoll: 'average' },
    assert({ result, expectValue }) {
      expectValue(result.enemyWasHit, true, 'enemy was hit');
      expectValue(result.dmgDealt > 0, true, 'martial damage > 0');
    },
  },
  {
    id: 'DMG-002',
    name: 'Magic basic attack deals damage on hit',
    setup: {
      player: { bird: 'macaw', energy: 4, class: 'mage', equipment: { mainHand: 'WPN-B01' } },
      enemy: { bird: 'crow', hp: 100, armour: 0, magicArmour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { hit: true, critical: false },
    assert({ result, expectValue }) {
      expectValue(result.enemyWasHit, true, 'enemy was hit');
      expectValue(result.dmgDealt > 0, true, 'magic damage > 0');
    },
  },
  {
    id: 'DMG-003',
    name: 'Damage never becomes negative',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, armour: 0 },
    },
    action: {
      type: 'dealRawProtection',
      target: 'enemy',
      amount: 0,
      isMagic: false,
    },
    assert({ result, expectValue }) {
      const rem = result.hit?.remaining ?? 0;
      expectValue(rem >= 0, true, 'remaining damage non-negative');
    },
  },
  {
    id: 'DMG-004',
    name: 'Missed hit deals no damage',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, armour: 0 },
    },
    action: { type: 'basicAttack', forceHit: false },
    expect: {
      enemyHpChange: 0,
      enemyWasHit: false,
    },
  },
  {
    id: 'DMG-005',
    name: 'Seeded damage produces repeatable results',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, armour: 0, magicArmour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    seed: 424242,
    assert({ sandbox, result, expectValue }) {
      expectValue(result.enemyWasHit, true, 'seeded hit landed');
      expectValue(result.dmgDealt > 0, true, 'seeded damage > 0');
      sandbox.__lastSeededDmg = result.dmgDealt;
    },
  },
  {
    id: 'DMG-006',
    name: 'Minimum damage floor is at least 0',
    setup: {
      player: { bird: 'sparrow', energy: 4, atk: 1, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, def: 99, armour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { hit: true, critical: false },
    assert({ result, expectValue }) {
      expectValue(result.dmgDealt >= 0, true, 'damage >= 0');
    },
  },
];
