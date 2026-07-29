/** Enemy AI scenario placeholders — expand with planEnemyTurn checks. */

export default [
  {
    id: 'AI-001',
    name: 'Enemy AI planner is available',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50, energy: 4 },
    },
    assert({ sandbox, expectValue }) {
      expectValue(typeof sandbox.planEnemyTurn === 'function', true, 'planEnemyTurn present');
      const plan = sandbox.planEnemyTurn(sandbox.G.enemy, sandbox.G.player);
      expectValue(!!plan && Array.isArray(plan.actions), true, 'plan has actions array');
    },
  },
];
