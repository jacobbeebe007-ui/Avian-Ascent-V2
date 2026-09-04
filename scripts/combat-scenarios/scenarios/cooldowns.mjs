/** B. Cooldown scenarios — Combat Workbook v2.1: ordinary skills have no cooldown.
 *  AP is the primary limiter; once-per-turn / meter gates remain.
 */

const SKILLED_WEAPON = 'WPN-001';

export default [
  {
    id: 'CD-001',
    name: '1 EN basic attack has no cooldown',
    setup: {
      player: { bird: 'sparrow', energy: 4, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'basicAttack' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'basic');
      const templ = typeof sandbox.getTemplateCooldown === 'function'
        ? sandbox.getTemplateCooldown(ab)
        : 0;
      expectValue(templ, 0, 'basic authored cooldown');
      expectValue(result.cooldown, 0, 'basic runtime cooldown');
    },
  },
  {
    id: 'CD-002',
    name: '2 EN skill has no ordinary cooldown (v2.1)',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponA' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponA');
      if (!ab) throw new Error('weaponA missing');
      const templ = sandbox.getTemplateCooldown(ab);
      expectValue(result.actionRejected, false, 'cast accepted');
      expectValue(templ, 0, 'weaponA authored CD is 0');
      expectValue(result.cooldown, 0, 'weaponA runtime cooldown is 0');
    },
  },
  {
    id: 'CD-003',
    name: '3 EN damage skill has no ordinary cooldown (v2.1)',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      if (!ab) throw new Error('weaponB missing');
      const templ = sandbox.getTemplateCooldown(ab);
      expectValue(result.actionRejected, false, 'cast accepted');
      expectValue(templ, 0, 'weaponB authored CD is 0');
      expectValue(result.cooldown, 0, 'weaponB runtime cooldown is 0');
    },
  },
  {
    id: 'CD-004',
    name: '3 EN skill can be repeated when AP allows (no CD gate)',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    steps: [
      {
        action: { type: 'weaponB' },
        rng: { hit: true, critical: false },
      },
      {
        action: { type: 'weaponB' },
        rng: { hit: true, critical: false },
      },
    ],
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const cost = sandbox.getAbilityEnergyCost(ab, ctx.player);
      /* Both casts succeed: AP allows two 3-cost actions from 6 AP, and there is no cooldown. */
      expectValue(ctx.player.energy, 6 - cost * 2, 'both casts spent EN');
      expectValue(sandbox.getAbilityCooldown(ab.id), 0, 'no cooldown after either cast');
    },
  },
  {
    id: 'CD-005',
    name: 'Failed action does not start cooldown',
    setup: {
      player: { bird: 'sparrow', energy: 1, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB' },
    expect: { actionRejected: true },
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const cd = sandbox.getAbilityCooldown(ab.id);
      expectValue(cd, 0, 'no cooldown after rejected cast');
    },
  },
  {
    id: 'CD-006',
    name: 'Missed attack still spends AP with no cooldown',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB', forceHit: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      expectValue(result.actionRejected, false, 'cast accepted');
      expectValue(result.hitsLanded, 0, 'miss landed no hits');
      expectValue(result.cooldown, 0, 'no cooldown on miss');
      expectValue(sandbox.getTemplateCooldown(ab), 0, 'authored CD remains 0');
    },
  },
  {
    id: 'CD-007',
    name: 'Cooldown stays 0 across turn start when none was applied',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    steps: [
      {
        action: { type: 'weaponB' },
        rng: { hit: true, critical: false },
      },
      {
        action: { type: 'playerTurnStart' },
      },
    ],
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const cd = sandbox.getAbilityCooldown(ab.id);
      expectValue(cd, 0, 'cooldown remains 0');
    },
  },
  {
    id: 'CD-008',
    name: 'Cooldown UI value matches runtime value',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB' },
    rng: { hit: true, critical: false },
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const runtime = sandbox.G.abilityCooldowns[ab.id] || 0;
      const viaGetter = sandbox.getAbilityCooldown(ab.id);
      expectValue(viaGetter, runtime, 'getAbilityCooldown === G.abilityCooldowns');
      expectValue(runtime, 0, 'no ordinary cooldown recorded');
    },
  },
  {
    id: 'CD-009',
    name: 'Bustard Plainshield has no ordinary cooldown (v2.1)',
    setup: {
      player: { bird: 'bustard', energy: 6, equipment: { mainHand: 'WPN-B02' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'utility' },
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(ab?.id, 'innate_bustard', 'Bustard innate id');
      expectValue(sandbox.getTemplateCooldown(ab), 0, 'Plainshield authored CD 0 (v2.1)');
      expectValue(sandbox.getAbilityCooldown(ab.id), 0, 'Plainshield runtime CD 0');
      expectValue(!!sandbox.G.playerStatus.fortify, true, 'Fortify applied');
      expectValue(sandbox.G.playerStatus.fortify?.amount, 6, 'Fortify bonus 6');
    },
  },
];
