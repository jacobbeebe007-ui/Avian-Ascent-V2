/** D. Armour / Magic Armour / Fortify / Ward scenarios. */

export default [
  {
    id: 'PRO-001',
    name: 'Armour absorbs Martial damage before HP',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        maxHp: 100,
        armour: 10,
        maxArmour: 10,
        normalMaxArmour: 10,
        magicArmour: 0,
      },
    },
    action: {
      type: 'dealRawProtection',
      target: 'enemy',
      amount: 4,
      isMagic: false,
    },
    assert({ sandbox, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.armour, 6, 'armour remaining');
      expectValue(e.hp, 100, 'hp untouched');
    },
  },
  {
    id: 'PRO-002',
    name: 'Excess Martial damage carries into HP',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        maxHp: 100,
        armour: 3,
        maxArmour: 3,
        normalMaxArmour: 3,
        magicArmour: 5,
      },
    },
    action: {
      type: 'dealRawProtection',
      target: 'enemy',
      amount: 7,
      isMagic: false,
    },
    assert({ sandbox, result, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.armour, 0, 'armour broken');
      expectValue(e.hp, 96, 'overflow into hp');
      expectValue(e.magicArmour, 5, 'magic armour untouched by martial');
      expectValue(result.hit.damagedHealth, true, 'damaged health flag');
    },
  },
  {
    id: 'PRO-003',
    name: 'Magic Armour does not absorb ordinary Martial damage',
    setup: {
      enemy: {
        bird: 'crow',
        hp: 50,
        maxHp: 50,
        armour: 0,
        maxArmour: 0,
        magicArmour: 12,
        maxMagicArmour: 12,
        normalMaxMagicArmour: 12,
      },
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
    },
    action: { type: 'dealRawProtection', target: 'enemy', amount: 5, isMagic: false },
    assert({ sandbox, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.magicArmour, 12, 'magic armour intact');
      expectValue(e.hp, 45, 'martial hit hp');
    },
  },
  {
    id: 'PRO-004',
    name: 'Magic Armour absorbs Magic damage before HP',
    setup: {
      player: { bird: 'macaw', energy: 4, equipment: { mainHand: 'WPN-B01' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        maxHp: 100,
        armour: 8,
        maxArmour: 8,
        magicArmour: 10,
        maxMagicArmour: 10,
        normalMaxMagicArmour: 10,
      },
    },
    action: { type: 'dealRawProtection', target: 'enemy', amount: 4, isMagic: true },
    assert({ sandbox, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.magicArmour, 6, 'magic armour remaining');
      expectValue(e.armour, 8, 'armour untouched by magic');
      expectValue(e.hp, 100, 'hp untouched');
    },
  },
  {
    id: 'PRO-005',
    name: 'Excess Magic damage carries into HP',
    setup: {
      player: { bird: 'macaw', energy: 4, equipment: { mainHand: 'WPN-B01' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        maxHp: 100,
        armour: 8,
        magicArmour: 2,
        maxMagicArmour: 2,
        normalMaxMagicArmour: 2,
      },
    },
    action: { type: 'dealRawProtection', target: 'enemy', amount: 5, isMagic: true },
    assert({ sandbox, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.magicArmour, 0, 'magic armour broken');
      expectValue(e.hp, 97, 'overflow into hp');
      expectValue(e.armour, 8, 'armour untouched');
    },
  },
  {
    id: 'PRO-006',
    name: 'Armour does not absorb ordinary Magic damage',
    setup: {
      enemy: {
        bird: 'crow',
        hp: 50,
        maxHp: 50,
        armour: 20,
        maxArmour: 20,
        magicArmour: 0,
      },
      player: { bird: 'macaw', energy: 4, equipment: { mainHand: 'WPN-B01' } },
    },
    action: { type: 'dealRawProtection', target: 'enemy', amount: 6, isMagic: true },
    assert({ sandbox, expectValue }) {
      const e = sandbox.G.enemy.stats;
      expectValue(e.armour, 20, 'armour intact vs magic');
      expectValue(e.hp, 44, 'magic hit hp');
    },
  },
  {
    id: 'PRO-007',
    name: 'Restore Armour restores only missing Armour',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 18,
        maxArmour: 24,
        normalMaxArmour: 24,
        magicArmour: 10,
        maxMagicArmour: 10,
        normalMaxMagicArmour: 10,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const restored = sandbox.Avian.protection.restoreArmour(stats, 8);
      expectValue(restored, 6, 'restored amount capped');
      expectValue(stats.armour, 24, 'armour at normal max');
      expectValue(stats.magicArmour, 10, 'magic armour unchanged');
    },
  },
  {
    id: 'PRO-008',
    name: 'Restore Magic Armour cannot exceed normal maximum',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 24,
        maxArmour: 24,
        normalMaxArmour: 24,
        magicArmour: 15,
        maxMagicArmour: 18,
        normalMaxMagicArmour: 18,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const restored = sandbox.Avian.protection.restoreMagicArmour(stats, 10);
      expectValue(restored, 3, 'restored to normal max only');
      expectValue(stats.magicArmour, 18, 'magic armour at normal max');
    },
  },
  {
    id: 'PRO-009',
    name: 'Restoration at full protection does not create overflow',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 24,
        maxArmour: 24,
        normalMaxArmour: 24,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const restored = sandbox.Avian.protection.restoreArmour(stats, 12);
      expectValue(restored, 0, 'nothing restored');
      expectValue(stats.armour, 24, 'no overflow');
      expectValue(stats.maxArmour, 24, 'max unchanged');
    },
  },
  {
    id: 'PRO-010',
    name: 'Fortify restores Armour and raises temporary maximum',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 20,
        maxArmour: 24,
        normalMaxArmour: 24,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const status = sandbox.G.playerStatus;
      sandbox.Avian.protection.applyFortify(stats, status, 12, 2);
      expectValue(stats.armour, 32, 'fortify heal+overflow');
      expectValue(stats.maxArmour, 36, 'temp max raised');
      expectValue(!!status.fortify, true, 'fortify status present');
    },
  },
  {
    id: 'PRO-011',
    name: 'Ward restores Magic Armour and raises temporary maximum',
    setup: {
      player: {
        bird: 'sparrow',
        magicArmour: 15,
        maxMagicArmour: 18,
        normalMaxMagicArmour: 18,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const status = sandbox.G.playerStatus;
      sandbox.Avian.protection.applyWard(stats, status, 8, 2);
      expectValue(stats.magicArmour, 23, 'ward heal+overflow');
      expectValue(stats.maxMagicArmour, 26, 'temp magic max raised');
      expectValue(!!status.ward, true, 'ward status present');
    },
  },
  {
    id: 'PRO-014',
    name: 'Fortify expiry clamps Armour to normal maximum',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 27,
        maxArmour: 24,
        normalMaxArmour: 24,
        statuses: {
          fortify: { amount: 12, turns: 1 },
        },
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      /* Seed fortify bonus field used by expireFortify */
      const stats = sandbox.G.player.stats;
      const status = sandbox.G.playerStatus;
      stats._fortifyBonus = 12;
      stats.maxArmour = 24 + 12;
      stats.armour = 27;
      status.fortify = { amount: 12, turns: 1 };
      sandbox.Avian.protection.expireFortify(stats, status);
      expectValue(stats.armour, 24, 'armour clamped');
      expectValue(stats.maxArmour, 24, 'maxArmour restored');
      expectValue(!!status.fortify, false, 'fortify cleared');
    },
  },
  {
    id: 'PRO-015',
    name: 'Protection below normal max unchanged when Fortify expires',
    setup: {
      player: {
        bird: 'sparrow',
        armour: 10,
        maxArmour: 36,
        normalMaxArmour: 24,
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const status = sandbox.G.playerStatus;
      stats._fortifyBonus = 12;
      status.fortify = { amount: 12, turns: 1 };
      sandbox.Avian.protection.expireFortify(stats, status);
      expectValue(stats.armour, 10, 'below-max armour preserved');
      expectValue(stats.maxArmour, 24, 'max restored to normal');
    },
  },
];
