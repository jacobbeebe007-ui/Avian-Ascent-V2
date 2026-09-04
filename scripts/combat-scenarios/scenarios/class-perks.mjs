/** Class perk dedicated file — runtime hooks for each workbook perk. */

export default [
  {
    id: 'CLS-001',
    name: 'Rogue class resolves with starting weapon WPN-007',
    setup: {
      player: { bird: 'sparrow', class: 'rogue', energy: 4, equipment: { mainHand: 'WPN-007' } },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      expectValue(ctx.player.class, 'rogue', 'class is rogue');
      const rules = sandbox.Avian?.data?.equipment?.coreRules?.basicStartingWeapons
        || sandbox.Avian?.data?.equipment?.startingWeapons?.byClass;
      if (rules) expectValue(rules.rogue, 'WPN-007', 'authored starting weapon');
    },
  },
  {
    id: 'CLS-002',
    name: 'Rogue Tempo grants +10 Precision when acting first on Weapon Skill 1',
    setup: {
      player: { bird: 'sparrow', class: 'rogue', energy: 4, spd: 30, equipment: { mainHand: 'WPN-B04' } },
      enemy: { bird: 'crow', hp: 50, spd: 5 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const Avian = sandbox.Avian;
      Avian.classPerks.applyClassPerkMetadata(ctx.player);
      sandbox.G.playerStatus = sandbox.G.playerStatus || {};
      sandbox.G.playerStatus._classPerkState = {};
      const peek = Avian.classPerks.peekRogueTempoPrecision(ctx.player, {
        id: 'WSK-001',
        actionSource: 'weaponA',
        energy: 2,
        energyCost: 2,
        btnType: 'physical',
      });
      expectValue(peek, 10, 'Rogue Tempo precision');
    },
  },
  {
    id: 'CLS-003',
    name: 'Bulwark Oath grants +4 Guard after Fortify',
    setup: {
      player: { bird: 'crow', class: 'knight', energy: 4, def: 10, equipment: { mainHand: 'WPN-B02' } },
      enemy: { bird: 'sparrow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const Avian = sandbox.Avian;
      Avian.classPerks.applyClassPerkMetadata(ctx.player);
      sandbox.G.playerStatus = sandbox.G.playerStatus || {};
      sandbox.G.playerStatus._classPerkState = {};
      const before = ctx.player.stats.def;
      Avian.classPerks.onPlayerAbilityUse({
        id: 'innate_bushturkey',
        name: 'Mound Guard',
        barSlot: 'Fortify',
        riderText: 'Gain 5 Fortified Armour for 2 turns.',
        btnType: 'utility',
      }, {});
      expectValue(ctx.player.stats.def, before + 4, 'Bulwark Guard Up');
    },
  },
  {
    id: 'CLS-004',
    name: 'Duke Ascension restores protection after a kill',
    setup: {
      player: { bird: 'dukeBlakiston', class: 'duke', energy: 4, equipment: { mainHand: 'WPN-B01' } },
      enemy: { bird: 'crow', hp: 1 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const Avian = sandbox.Avian;
      Avian.classPerks.applyClassPerkMetadata(ctx.player);
      ctx.player.stats.armour = 0;
      ctx.player.stats.normalMaxArmour = 8;
      ctx.player.stats.maxArmour = 8;
      ctx.player.stats.magicArmour = 0;
      ctx.player.stats.normalMaxMagicArmour = 8;
      ctx.player.stats.maxMagicArmour = 8;
      Avian.classPerks.onEnemyDefeated();
      expectValue(ctx.player.stats.armour > 0, true, 'Duke restore Armour');
      expectValue((ctx.player._classPerkDukeStacks || 0) >= 1, true, 'Duke damage stack');
    },
  },
];
