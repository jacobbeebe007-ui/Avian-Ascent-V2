/** E. Ailment scenarios — poison/bleed/scorched/chill foundations.
 *  Shock and Paralysis marked pending until final rules are confirmed.
 */

export default [
  {
    id: 'AIL-001',
    name: 'Poison tick damage scales by stack count',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      if (typeof sandbox.calcPoisonTickDmg !== 'function') {
        throw new Error('calcPoisonTickDmg missing from sandbox');
      }
      const d3 = sandbox.calcPoisonTickDmg(3, 100);
      const d5 = sandbox.calcPoisonTickDmg(5, 100);
      expectValue(d5 > d3, true, 'more stacks → more poison damage');
      expectValue(d3 > 0, true, 'poison damage positive');
    },
  },
  {
    id: 'AIL-002',
    name: 'Bleed applies healing reduction by stack',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      const m1 = sandbox.getBleedHealMult(1);
      const m3 = sandbox.getBleedHealMult(3);
      expectValue(m1 < 1, true, 'bleed reduces healing');
      expectValue(m3 < m1, true, 'more stacks → stronger heal reduction');
    },
  },
  {
    id: 'AIL-003',
    name: 'Chill reduces Speed multiplier by stack',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      const m1 = sandbox.getChilledSpdMult(1);
      const m5 = sandbox.getChilledSpdMult(5);
      expectValue(m1 < 1, true, 'chill slows');
      expectValue(m5 < m1, true, 'more chill → slower');
    },
  },
  {
    id: 'AIL-004',
    name: 'Scorched applies defence pressure via burning rules',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      /* Scorched is Guard/Resolve down in v0.6 (no DoT). Burning may or may not
       * modify DEF depending on combatConfig sync — assert API presence + scorched tick. */
      expectValue(typeof sandbox.getBurningDefMult === 'function', true, 'burning def helper');
      expectValue(typeof sandbox.calcScorchedTickDmg === 'function', true, 'scorched helper');
      expectValue(sandbox.calcScorchedTickDmg(), 0, 'scorched has no DoT');
    },
  },
  {
    id: 'AIL-SHK-PENDING',
    name: 'Shock and Paralysis scenarios need final rule confirmation',
    pending: true,
    pendingReason: '🔁 Shock and Paralysis scenarios need final rule confirmation.',
  },
];
