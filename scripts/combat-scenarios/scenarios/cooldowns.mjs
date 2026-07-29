/** B. Cooldown scenarios — compare runtime CD against authored skill values. */

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
    name: '2 EN skill has authored cooldown (usually 0)',
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
      expectValue(result.cooldown, templ, 'weaponA cooldown matches authored');
    },
  },
  {
    id: 'CD-003',
    name: '3 EN damage skill receives authored cooldown',
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
      expectValue(result.cooldown, templ, 'weaponB cooldown matches authored');
      expectValue(templ >= 1, true, '3 EN skill typically has ≥1 CD');
    },
  },
  {
    id: 'CD-004',
    name: 'Skill cannot be selected while cooling down',
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
        expect: { actionRejected: true },
      },
    ],
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const cost = sandbox.getAbilityEnergyCost(ab, ctx.player);
      expectValue(ctx.player.energy, 6 - cost, 'only first cast spent EN');
      expectValue(sandbox.getAbilityCooldown(ab.id) > 0, true, 'still on cooldown');
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
    name: 'Missed attack still starts cooldown after valid use',
    setup: {
      player: { bird: 'sparrow', energy: 6, equipment: { mainHand: SKILLED_WEAPON } },
      enemy: { bird: 'crow', hp: 100 },
    },
    action: { type: 'weaponB', forceHit: false },
    assert({ sandbox, ctx, result, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && !a.empty && a.actionSource === 'weaponB');
      const templ = sandbox.getTemplateCooldown(ab);
      expectValue(result.actionRejected, false, 'cast accepted');
      expectValue(result.hitsLanded, 0, 'miss landed no hits');
      expectValue(result.cooldown, templ, 'cooldown applied on miss');
    },
  },
  {
    id: 'CD-007',
    name: 'Cooldown ticks down at owner turn start',
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
      const templ = sandbox.getTemplateCooldown(ab);
      const cd = sandbox.getAbilityCooldown(ab.id);
      expectValue(cd, Math.max(0, templ - 1), 'cooldown decremented by 1');
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
    },
  },
  {
    id: 'CD-009',
    name: 'Bustard Plainshield commits cooldown and rejects immediate re-cast',
    setup: {
      player: { bird: 'bustard', energy: 6, equipment: { mainHand: 'WPN-B02' } },
      enemy: { bird: 'crow', hp: 100 },
    },
    steps: [
      { action: { type: 'utility' } },
      { action: { type: 'utility' }, expect: { actionRejected: true } },
    ],
    assert({ sandbox, ctx, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && a.actionSource === 'utility');
      expectValue(ab?.id, 'innate_bustard', 'Bustard innate id');
      expectValue(sandbox.getTemplateCooldown(ab), 3, 'Plainshield authored CD 3');
      expectValue(sandbox.getAbilityCooldown(ab.id), 3, 'Plainshield runtime CD 3');
      expectValue(!!sandbox.G.playerStatus.fortify, true, 'Fortify applied once');
      expectValue(sandbox.G.playerStatus.fortify?.amount, 6, 'Fortify bonus 6');
    },
  },
];
