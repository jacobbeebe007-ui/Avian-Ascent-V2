/** Class perk dedicated file — starter; PAS/PRK live in passives.mjs for now. */

export default [
  {
    id: 'CLS-001',
    name: 'Rogue class resolves with starting weapon WPN-B04',
    setup: {
      player: { bird: 'sparrow', class: 'rogue', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      expectValue(ctx.player.class, 'rogue', 'class is rogue');
      const rules = sandbox.Avian?.data?.equipment?.coreRules?.basicStartingWeapons;
      if (rules) expectValue(rules.rogue, 'WPN-B04', 'authored starting weapon');
    },
  },
];
