/** A. Energy scenarios — foundational; every action depends on EN. */

const SKILLED_WEAPON = 'WPN-001'; /* Dagger Pinion — has Skill 1 + Skill 2 */

export default [
  {
    id: 'EN-001',
    name: 'Combat begins with 4 EN',
    useStartEnergy: true,
    setup: {
      playerEnergyTurnIndex: 0,
      player: { bird: 'sparrow', equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'playerTurnStart', tickCooldowns: false, tickProtection: false },
    expect: { playerEnergy: 4 },
  },
  {
    id: 'EN-002',
    name: 'Basic Attack spends 1 EN',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { actor: 'player', type: 'basicAttack', target: 'enemy' },
    rng: { hit: true, critical: false },
    expect: {
      immediate: {
        playerEnergy: 3,
        enemyWasHit: true,
      },
    },
  },
  {
    id: 'EN-003',
    name: 'Skill 1 costs its authored EN',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponA' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponA');
      if (!ab) throw new Error('weaponA ability missing — equip a weapon with Skill 1');
      const cost = typeof sandbox.getAbilityEnergyCost === 'function'
        ? sandbox.getAbilityEnergyCost(ab, ctx.player)
        : (ab.energyCost || 2);
      expectValue(result.actionRejected, false, 'skill1 accepted');
      expectValue(result.energySpent, cost, 'skill1 authored EN spent');
      expectValue(result.energyAfter, 6 - cost, 'energy after skill1');
    },
  },
  {
    id: 'EN-004',
    name: 'Skill 2 costs its authored EN',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      if (!ab) throw new Error('weaponB ability missing — equip a weapon with Skill 2');
      const cost = typeof sandbox.getAbilityEnergyCost === 'function'
        ? sandbox.getAbilityEnergyCost(ab, ctx.player)
        : (ab.energyCost || 3);
      expectValue(result.actionRejected, false, 'skill2 accepted');
      expectValue(result.energySpent, cost, 'skill2 authored EN spent');
      expectValue(result.energyAfter, 6 - cost, 'energy after skill2');
    },
  },
  {
    id: 'EN-005',
    name: 'EN cannot fall below 0',
    setup: {
      player: { bird: 'sparrow', energy: 1, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'basicAttack' },
    rng: { hit: true, critical: false },
    expect: { playerEnergy: 0 },
    assert({ result, expectValue }) {
      expectValue(result.energyAfter >= 0, true, 'energy non-negative');
    },
  },
  {
    id: 'EN-006',
    name: 'Unaffordable skill does not execute',
    setup: {
      player: { bird: 'sparrow', energy: 2, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB' },
    expect: {
      playerEnergy: 2,
      enemyHpChange: 0,
      actionRejected: true,
    },
  },
  {
    id: 'EN-007',
    name: 'Rejected action does not spend EN',
    setup: {
      player: { bird: 'sparrow', energy: 1, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponA' },
    expect: {
      playerEnergy: 1,
      actionRejected: true,
    },
  },
  {
    id: 'EN-008',
    name: 'Player recovers 3 EN at turn start',
    setup: {
      player: { bird: 'sparrow', energy: 1, energyMax: 6, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
      playerEnergyTurnIndex: 1,
    },
    action: { type: 'playerTurnStart', tickCooldowns: false, tickProtection: false },
    expect: { playerEnergy: 4 },
  },
  {
    id: 'EN-009',
    name: 'EN does not exceed maximum',
    setup: {
      player: { bird: 'sparrow', energy: 5, energyMax: 6, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
      playerEnergyTurnIndex: 1,
    },
    action: { type: 'playerTurnStart', tickCooldowns: false, tickProtection: false },
    expect: { playerEnergy: 6 },
  },
  {
    id: 'EN-010',
    name: 'Frozen turn recovers 0 EN',
    setup: {
      player: {
        bird: 'sparrow',
        energy: 2,
        energyMax: 6,
        equipment: { mainHand: 'WPN-B04' },
        statuses: { frozen: { turns: 1, pendingSkip: true } },
      },
      enemy: { bird: 'crow', hp: 100 },
      playerEnergyTurnIndex: 1,
    },
    action: { type: 'playerTurnStart', tickCooldowns: false, tickProtection: false },
    expect: { playerEnergy: 2 },
  },
  {
    id: 'EN-011',
    name: 'Standard EN recovery is 3 without perk modifiers',
    setup: {
      player: { bird: 'sparrow', energy: 0, energyMax: 6, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
      playerEnergyTurnIndex: 2,
    },
    action: { type: 'playerTurnStart', tickCooldowns: false, tickProtection: false },
    assert({ sandbox, ctx, expectValue }) {
      const regen = sandbox.computePlayerEnergyRegen(ctx.player);
      expectValue(regen, 3, 'base energy regen');
      expectValue(ctx.player.energy, 3, 'energy after standard regen');
    },
  },
];
