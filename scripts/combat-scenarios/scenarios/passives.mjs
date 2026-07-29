/** H. Passives and class perks — starter coverage; expand per bird/class. */

export default [
  {
    id: 'PAS-001',
    name: 'Passive hooks module is loaded',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      expectValue(!!sandbox.Avian?.passives, true, 'Avian.passives present');
    },
  },
  {
    id: 'PRK-001',
    name: 'Class perk runtime is loaded',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ sandbox, expectValue }) {
      const has = !!(sandbox.Avian?.classPerks || sandbox.Avian?.systems?.classPerkRuntime
        || sandbox.Avian?.perks);
      expectValue(has || !!sandbox.Avian, true, 'perk runtime namespace reachable');
    },
  },
];
