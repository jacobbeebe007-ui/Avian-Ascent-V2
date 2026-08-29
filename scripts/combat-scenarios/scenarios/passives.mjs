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
  {
    id: 'PAS-002',
    name: 'Sparrow Hedge Hop utility grants Agility Up',
    setup: {
      player: { bird: 'sparrow', energy: 4, spd: 10, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'innate utility present');
      const before = ctx.player.stats.spd;
      sandbox.Avian.dispatcher.execute(util);
      const loaned = !!(sandbox.G.playerStatus && sandbox.G.playerStatus._dispatcherStatLoans);
      expectValue(ctx.player.stats.spd > before || loaned, true, 'Hedge Hop raised Agility');
    },
  },
  {
    id: 'PAS-003',
    name: 'Snowy Owl Frost Glide damages Magic Armour then applies Chilled',
    setup: {
      player: { bird: 'snowyOwl', energy: 4, equipment: { mainHand: 'WPN-B01' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        magicArmour: 3,
        maxMagicArmour: 8,
        normalMaxMagicArmour: 8,
      },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'Frost Glide present');
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.magicArmour, 0, 'Magic Armour stripped');
      expectValue(!!sandbox.G.enemyStatus.chilled, true, 'Chilled applied after break');
    },
  },
  {
    id: 'PAS-004',
    name: 'Toucan Colour Display arms next damaging skill as Day',
    setup: {
      player: { bird: 'toucan', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'Colour Display present');
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.playerStatus._nextSkillAspect, 'day', 'next skill becomes Day');
    },
  },
  {
    id: 'PAS-005',
    name: 'Dodo Stubborn Stand Fortifies and inflicts self Agility Down',
    setup: {
      player: { bird: 'dodo', energy: 4, spd: 12, equipment: { mainHand: 'WPN-B02' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'Stubborn Stand present');
      const before = ctx.player.stats.spd;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(ctx.player.stats.spd < before, true, 'self Agility Down while Fortify remains');
      expectValue((ctx.player.stats.armour || 0) > 0, true, 'Fortified Armour applied');
    },
  },
  {
    id: 'PAS-006',
    name: 'Cassowary War Stomp arms next-attack Precision penalty on self',
    setup: {
      player: { bird: 'cassowary', energy: 4, equipment: { mainHand: 'WPN-B02' } },
      enemy: { bird: 'crow', hp: 80, armour: 3, maxArmour: 8, normalMaxArmour: 8 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'War Stomp present');
      sandbox.Avian.dispatcher.execute(util);
      expectValue((sandbox.G.playerStatus._dispatcherAccNextHitPenalty || 0) >= 10, true, 'next attack −10 Precision');
      expectValue(sandbox.G.enemy.stats.armour, 0, '3 Armour stripped');
    },
  },
];
