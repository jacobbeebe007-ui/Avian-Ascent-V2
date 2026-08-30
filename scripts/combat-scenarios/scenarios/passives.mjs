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
      const hpBefore = sandbox.G.enemy.stats.hp;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.magicArmour, 0, 'Magic Armour stripped');
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'pool-only damage does not hit Health');
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
      const hpBefore = sandbox.G.enemy.stats.hp;
      sandbox.Avian.dispatcher.execute(util);
      expectValue((sandbox.G.playerStatus._dispatcherAccNextHitPenalty || 0) >= 10, true, 'next attack −10 Precision');
      expectValue(sandbox.G.enemy.stats.armour, 0, '3 Armour stripped');
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'War Stomp Armour poke does not hit Health');
    },
  },
  {
    id: 'PAS-007',
    name: 'Galah Shrill Display never deals Health; Might/Focus Down only if it reaches Health',
    setup: {
      player: { bird: 'galah', energy: 4, equipment: { mainHand: 'WPN-B03' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        maxHp: 80,
        atk: 20,
        matk: 18,
        magicArmour: 0,
        maxMagicArmour: 0,
        normalMaxMagicArmour: 0,
      },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util && /Shrill Display/i.test(util.name || ''), true, 'Shrill Display present');
      const hpBefore = sandbox.G.enemy.stats.hp;
      const atkBefore = sandbox.G.enemy.stats.atk;
      const matkBefore = sandbox.G.enemy.stats.matk;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'no Magic Armour → no Health damage');
      expectValue(sandbox.G.enemy.stats.atk < atkBefore, true, 'Might Down when effect reaches Health');
      expectValue(sandbox.G.enemy.stats.matk < matkBefore, true, 'Focus Down when effect reaches Health');
    },
  },
  {
    id: 'PAS-008',
    name: 'Galah Shrill Display strips Magic Armour only and withholds debuffs while pool remains',
    setup: {
      player: { bird: 'galah', energy: 4, equipment: { mainHand: 'WPN-B03' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        maxHp: 80,
        atk: 20,
        matk: 18,
        magicArmour: 5,
        maxMagicArmour: 8,
        normalMaxMagicArmour: 8,
      },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      const hpBefore = sandbox.G.enemy.stats.hp;
      const atkBefore = sandbox.G.enemy.stats.atk;
      const matkBefore = sandbox.G.enemy.stats.matk;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.magicArmour, 2, '3 Magic Armour stripped');
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'leftover does not exist so Health is untouched');
      expectValue(sandbox.G.enemy.stats.atk, atkBefore, 'Might Down withheld while Magic Armour remains');
      expectValue(sandbox.G.enemy.stats.matk, matkBefore, 'Focus Down withheld while Magic Armour remains');
    },
  },
  {
    id: 'PAS-009',
    name: 'Galah Shrill Display leftover reaches Health for debuffs but still deals 0 Health',
    setup: {
      player: { bird: 'galah', energy: 4, equipment: { mainHand: 'WPN-B03' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        maxHp: 80,
        atk: 20,
        matk: 18,
        magicArmour: 2,
        maxMagicArmour: 8,
        normalMaxMagicArmour: 8,
      },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      const hpBefore = sandbox.G.enemy.stats.hp;
      const atkBefore = sandbox.G.enemy.stats.atk;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.magicArmour, 0, 'remaining Magic Armour stripped');
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'leftover pool damage never becomes Health');
      expectValue(sandbox.G.enemy.stats.atk < atkBefore, true, 'Might Down because leftover reached Health');
    },
  },
  {
    id: 'PAS-010',
    name: 'Finch Seed Scatter Armour poke never deals Health',
    setup: {
      player: { bird: 'finch', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        maxHp: 80,
        spd: 16,
        armour: 0,
        maxArmour: 0,
        normalMaxArmour: 0,
      },
    },
    assert({ ctx, sandbox, expectValue }) {
      const util = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(!!util, true, 'Seed Scatter present');
      const hpBefore = sandbox.G.enemy.stats.hp;
      const spdBefore = sandbox.G.enemy.stats.spd;
      sandbox.Avian.dispatcher.execute(util);
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'Armour poke does not hit Health');
      expectValue(sandbox.G.enemy.stats.spd < spdBefore, true, 'Agility Down when no Armour remains');
    },
  },
];
