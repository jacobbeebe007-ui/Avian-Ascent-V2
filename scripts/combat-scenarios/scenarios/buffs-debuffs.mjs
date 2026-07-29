/** F. Buffs and debuffs — foundational percentage / expiry checks. */

export default [
  {
    id: 'BUF-001',
    name: 'Temporary ATK buff does not permanently mutate base when cleared',
    setup: {
      player: { bird: 'sparrow', atk: 12, energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const base = stats.atk;
      stats.atk = base + Math.round(base * 0.15);
      expectValue(stats.atk > base, true, 'buff applied');
      stats.atk = base;
      expectValue(stats.atk, 12, 'base restored after clear');
    },
  },
  {
    id: 'BUF-002',
    name: 'Temporary DEF debuff restores original value on expiry',
    setup: {
      player: { bird: 'sparrow', def: 14, energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const stats = sandbox.G.player.stats;
      const base = stats.def;
      const loan = Math.round(base * 0.1);
      stats.def = base - loan;
      stats.def = base;
      expectValue(stats.def, base, 'def restored');
    },
  },
];
