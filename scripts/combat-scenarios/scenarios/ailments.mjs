/** E. Ailment scenarios — poison/bleed/scorched/chill + finalized Shock/Paralysis. */

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
    id: 'AIL-001b',
    name: 'Poison end-of-turn tick uses MaxHP% formula',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, maxHp: 100 },
    },
    assert({ sandbox, expectValue }) {
      const hpBefore = sandbox.G.enemy.stats.hp;
      sandbox.G.enemyStatus = { poison: { stacks: 3, turns: 3 } };
      const expected = sandbox.calcPoisonTickDmg(3, sandbox.G.enemy.stats.maxHp, 1);
      sandbox.tickEndOfTurnAilments('enemy');
      const hpAfter = sandbox.G.enemy.stats.hp;
      const dealt = Math.round((hpBefore - hpAfter) * 100) / 100;
      expectValue(dealt, expected, 'tickEndOfTurnAilments poison matches calcPoisonTickDmg');
      expectValue(dealt > 3, true, 'poison tick scales with maxHp not flat stacks');
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
      expectValue(typeof sandbox.getBurningDefMult === 'function', true, 'burning def helper');
      expectValue(typeof sandbox.calcScorchedTickDmg === 'function', true, 'scorched helper');
      expectValue(sandbox.calcScorchedTickDmg(), 0, 'scorched has no DoT');
      sandbox.applyAilment('enemy', 'scorched', 1);
      const es = sandbox.G.enemyStatus;
      expectValue(!!es.scorched, true, 'scorched applied');
      const guardPen = sandbox.getScorchedGuardPenalty(es);
      const resolvePen = sandbox.getScorchedResolvePenalty(es);
      expectValue(guardPen < 0, true, 'scorched Minor Guard Down');
      expectValue(resolvePen < 0, true, 'scorched Minor Resolve Down');
      expectValue(sandbox.getBurningDefMult(0, true), 1, 'scorched is not a % DEF mult');
    },
  },
  {
    id: 'AIL-SHK-001',
    name: 'Shock tick damage matches Burn formula',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, magicArmour: 0 },
    },
    assert({ sandbox, expectValue }) {
      expectValue(typeof sandbox.calcShockTickDmg === 'function', true, 'calcShockTickDmg present');
      const shock3 = sandbox.calcShockTickDmg(3, 100);
      const burn3 = sandbox.calcBurningTickDmg(3, 100);
      expectValue(shock3, burn3, 'shock DoT equals burn DoT');
      expectValue(sandbox.calcShockTickDmg(5, 100) > shock3, true, 'more stacks → more shock dmg');
    },
  },
  {
    id: 'AIL-SHK-002',
    name: 'Shock cannot apply while Magic Armour remains',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        magicArmour: 8,
        maxMagicArmour: 8,
        normalMaxMagicArmour: 8,
      },
    },
    assert({ sandbox, expectValue }) {
      const ok = sandbox.applyAilment('enemy', 'shock', 1);
      expectValue(ok, false, 'shock blocked by Magic Armour');
      expectValue(!!sandbox.G.enemyStatus.shock, false, 'no shock stacks');
    },
  },
  {
    id: 'AIL-SHK-003',
    name: 'Five Shock stacks at 0 Magic Armour become Paralysed',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: {
        bird: 'crow',
        hp: 100,
        magicArmour: 0,
        maxMagicArmour: 0,
        normalMaxMagicArmour: 0,
      },
    },
    assert({ sandbox, expectValue }) {
      sandbox.G.enemyStatus = { shock: { stacks: 4, turns: 3 } };
      sandbox.G._ailmentApplyCounts = { action: Object.create(null), turn: Object.create(null) };
      const fifth = sandbox.applyAilment('enemy', 'shock', 1);
      expectValue(fifth, true, '5th shock applied');
      expectValue(!!sandbox.G.enemyStatus.shock, false, 'shock cleared on transform');
      expectValue(!!sandbox.G.enemyStatus.paralyzed, true, 'paralysed active');
      expectValue(sandbox.G.enemyStatus.paralyzed.extraEnCost, 1, 'extra EN cost 1');
      expectValue(sandbox.G.enemyStatus.paralyzed.turns, 1, 'paralysis duration 1');
    },
  },
  {
    id: 'AIL-SHK-004',
    name: 'Paralysed skills cost +1 EN',
    setup: {
      player: {
        bird: 'sparrow',
        energy: 4,
        equipment: { mainHand: 'WPN-B04' },
        statuses: { paralyzed: { turns: 1, extraEnCost: 1 } },
      },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'basic');
      const cost = sandbox.getAbilityEnergyCost(ab, ctx.player);
      expectValue(cost, 2, 'basic 1 EN + 1 paralysis surcharge');
      expectValue(sandbox.getParalysisExtraEnCost(sandbox.G.playerStatus), 1, 'helper extra EN');
    },
  },
  {
    id: 'AIL-SHK-005',
    name: 'Paralysis expiry grants 2 turns Control Resistance',
    setup: {
      player: {
        bird: 'sparrow',
        energy: 4,
        equipment: { mainHand: 'WPN-B04' },
        statuses: { paralyzed: { turns: 1, extraEnCost: 1 } },
      },
      enemy: { bird: 'crow', hp: 100, magicArmour: 0 },
    },
    assert({ sandbox, expectValue }) {
      sandbox.tickEndOfTurnAilments('player');
      expectValue(!!sandbox.G.playerStatus.paralyzed, false, 'paralysis cleared');
      expectValue(sandbox.G.playerStatus.controlResistance?.turns, 2, 'CR lasts 2 turns');
      const blocked = sandbox.applyAilment('player', 'shock', 1);
      expectValue(blocked, false, 'shock blocked by Control Resistance');
      const blockedPara = sandbox.applyAilment('player', 'paralyzed', 1);
      expectValue(blockedPara, false, 'direct paralysis blocked by CR');
    },
  },
  {
    id: 'AIL-WKN-001',
    name: 'Weakened applies Moderate Might and Focus Down',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100, atk: 20, matk: 20 },
    },
    assert({ sandbox, expectValue }) {
      const ok = sandbox.applyAilment('enemy', 'weakened', 1);
      expectValue(ok, true, 'weakened applied');
      const es = sandbox.G.enemyStatus;
      expectValue(!!es.weakened, true, 'weakened status present');
      expectValue(sandbox.getWeakenedMightPenalty(es) < 0, true, 'might down');
      expectValue(sandbox.getWeakenedFocusPenalty(es) < 0, true, 'focus down');
    },
  },
  {
    id: 'AIL-FEAR-001',
    name: 'Fear is Major Damage Down on the next damaging action, not a skip',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      sandbox.applyAilment('enemy', 'feared', 1);
      expectValue((sandbox.G.enemyStatus.feared || 0) > 0, true, 'feared applied');
      expectValue(sandbox.getFearDamageMult(sandbox.G.enemyStatus), 0.88, 'major damage down −12%');
    },
  },
  {
    id: 'AIL-CNF-001',
    name: 'Confused is Major Precision Down, not a self-hit roll',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    assert({ sandbox, expectValue }) {
      sandbox.applyAilment('enemy', 'confused', 1);
      const es = sandbox.G.enemyStatus;
      const c = es.confused;
      expectValue(!!c, true, 'confused applied');
      expectValue(c.selfChance == null, true, 'no self-hit chance');
      expectValue(sandbox.getConfusedPrecisionPenalty(es) <= -8, true, 'major precision down');
    },
  },
];
