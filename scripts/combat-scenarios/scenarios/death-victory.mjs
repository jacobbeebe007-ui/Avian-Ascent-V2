/** J. Death, revival, and battle completion. */

export default [
  {
    id: 'DTH-001',
    name: 'HP reaching 0 causes defeat state',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 5, maxHp: 200, armour: 0, magicArmour: 0 },
    },
    action: {
      type: 'dealRawProtection',
      target: 'enemy',
      amount: 50,
      isMagic: false,
    },
    assert({ sandbox, expectValue }) {
      expectValue(sandbox.G.enemy.stats.hp, 0, 'enemy hp is 0');
    },
  },
  {
    id: 'DTH-002',
    name: 'Damage does not heal after defeat (hp stays at 0)',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 0, maxHp: 200, armour: 0, magicArmour: 0 },
    },
    action: {
      type: 'dealRawProtection',
      target: 'enemy',
      amount: 20,
      isMagic: false,
    },
    assert({ sandbox, expectValue }) {
      expectValue(sandbox.G.enemy.stats.hp, 0, 'hp remains 0');
    },
  },
  {
    id: 'DTH-003',
    name: 'Player HP 0 is a defeat condition',
    setup: {
      player: {
        bird: 'sparrow', hp: 3, maxHp: 200, armour: 0, magicArmour: 0,
        energy: 4, equipment: { mainHand: 'WPN-B04' },
      },
      enemy: { bird: 'crow', hp: 200, armour: 0, magicArmour: 0 },
    },
    action: {
      type: 'dealRawProtection',
      target: 'player',
      amount: 50,
      isMagic: false,
    },
    assert({ sandbox, expectValue }) {
      expectValue(sandbox.G.player.stats.hp, 0, 'player hp is 0');
    },
  },
  {
    id: 'DTH-004',
    name: 'Simultaneous zero HP resolves with both at 0',
    setup: {
      player: {
        bird: 'sparrow', hp: 2, maxHp: 200, armour: 0, magicArmour: 0,
        energy: 4, equipment: { mainHand: 'WPN-B04' },
      },
      enemy: { bird: 'crow', hp: 2, maxHp: 200, armour: 0, magicArmour: 0 },
    },
    steps: [
      { action: { type: 'dealRawProtection', target: 'enemy', amount: 50, isMagic: false } },
      { action: { type: 'dealRawProtection', target: 'player', amount: 50, isMagic: false } },
    ],
    assert({ sandbox, expectValue }) {
      expectValue(sandbox.G.enemy.stats.hp, 0, 'enemy dead');
      expectValue(sandbox.G.player.stats.hp, 0, 'player dead');
    },
  },
];
