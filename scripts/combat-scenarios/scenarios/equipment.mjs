/** I. Equipment action scenarios — starting weapons + family skills. */

import { STARTING_WEAPONS } from '../fixtures.mjs';

const CLASS_BIRDS = {
  rogue: 'sparrow',
  mage: 'blackbird',
  knight: 'secretary',
  bard: 'robin',
  inquisitor: 'kiwi',
  brute: 'shoebill',
  siren: 'flamingo',
};

const classScenarios = Object.entries(STARTING_WEAPONS).map(([classId, weaponId], i) => {
  const bird = CLASS_BIRDS[classId] || 'sparrow';
  return {
    id: `EQP-${String(i + 1).padStart(3, '0')}`,
    name: `${classId} starting weapon ${weaponId} basic attack succeeds`,
    setup: {
      player: {
        bird,
        class: classId,
        energy: 4,
        equipment: { mainHand: weaponId },
      },
      enemy: { bird: 'crow', hp: 100, armour: 0, magicArmour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { hit: true, critical: false },
    assert({ ctx, result, expectValue }) {
      expectValue(ctx.player.equipment?.mainHand, weaponId, 'mainHand equipped');
      expectValue(result.actionRejected, false, 'action accepted');
      expectValue(result.energySpent, 1, 'basic EN cost 1');
    },
  };
});

export default [
  ...classScenarios,
  {
    id: 'EQP-010',
    name: 'Empty mainHand still resolves a basic fallback',
    setup: {
      player: {
        bird: 'sparrow',
        energy: 4,
        equipment: { mainHand: null },
      },
      enemy: { bird: 'crow', hp: 100, armour: 0 },
    },
    action: { type: 'basicAttack', forceHit: true },
    rng: { hit: true, critical: false },
    assert({ result, expectValue }) {
      /* May spend 1 EN for natural strike / fallback */
      expectValue(result.actionRejected, false, 'fallback basic accepted');
    },
  },
  {
    id: 'EQP-011',
    name: 'Arcane Ward is utility — Ward only, no Health damage',
    setup: {
      player: { bird: 'barnowl', class: 'rogue', energy: 6, equipment: { mainHand: 'WPN-031' } },
      enemy: { bird: 'crow', hp: 80, maxHp: 80, magicArmour: 0 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && /Arcane Ward/i.test(a.name || ''));
      expectValue(!!ab, true, 'Arcane Ward present');
      const hpBefore = sandbox.G.enemy.stats.hp;
      const marmBefore = sandbox.G.player.stats.magicArmour || 0;
      sandbox.Avian.dispatcher.execute(ab);
      expectValue(sandbox.G.enemy.stats.hp, hpBefore, 'Ward skill does not deal Health');
      expectValue((sandbox.G.player.stats.magicArmour || 0) >= marmBefore + 8, true, 'Ward 8 applied');
    },
  },
  {
    id: 'EQP-012',
    name: 'Withering Hex Focus Down only after Health is damaged',
    setup: {
      player: { bird: 'barnowl', class: 'rogue', energy: 6, equipment: { mainHand: 'WPN-037' } },
      enemy: {
        bird: 'crow',
        hp: 80,
        maxHp: 80,
        matk: 20,
        magicArmour: 40,
        maxMagicArmour: 40,
        normalMaxMagicArmour: 40,
      },
    },
    rng: { hit: true, critical: false },
    assert({ ctx, sandbox, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && /Withering Hex/i.test(a.name || ''));
      expectValue(!!ab, true, 'Withering Hex present');
      const matkBefore = sandbox.G.enemy.stats.matk;
      const hpBefore = sandbox.G.enemy.stats.hp;
      sandbox.Avian.dispatcher.execute(ab);
      const healthHit = sandbox.G.enemy.stats.hp < hpBefore;
      if (healthHit) {
        expectValue(sandbox.G.enemy.stats.matk < matkBefore, true, 'Focus Down after Health damage');
      } else {
        expectValue(sandbox.G.enemy.stats.matk, matkBefore, 'Focus Down withheld while Magic Armour holds');
      }
    },
  },
  {
    id: 'EQP-013',
    name: 'Braced Brow grants Guard Up and removes 1 Dazed',
    setup: {
      player: {
        bird: 'secretary',
        class: 'knight',
        energy: 6,
        equipment: { helmet: 'HLM-002', armour: null, offHand: null },
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && /Braced Brow/i.test(a.name || ''));
      expectValue(!!ab, true, 'Braced Brow present');
      sandbox.G.playerStatus.dazed = { stacks: 2, turns: 2 };
      const defBefore = sandbox.G.player.stats.def;
      sandbox.Avian.dispatcher.execute(ab);
      const dazed = sandbox.G.playerStatus.dazed;
      expectValue(!dazed || (dazed.stacks || 0) <= 1, true, '1 Dazed stack removed');
      expectValue(
        sandbox.G.player.stats.def > defBefore || !!(sandbox.G.playerStatus && sandbox.G.playerStatus._dispatcherStatLoans),
        true,
        'Minor Guard Up applied'
      );
    },
  },
  {
    id: 'EQP-014',
    name: 'Breaker’s Focus arms the next Strength skill',
    setup: {
      player: {
        bird: 'secretary',
        class: 'knight',
        energy: 6,
        equipment: { helmet: 'HLM-028' },
      },
      enemy: { bird: 'crow', hp: 50 },
    },
    assert({ ctx, sandbox, expectValue }) {
      const ab = (ctx.player.abilities || []).find((a) => a && /Breaker/i.test(a.name || ''));
      if (!ab) {
        const row = sandbox.Avian.equipmentActions.skillToAbilityRow('ESK-028', null, 'green');
        expectValue(!!row && (row.riders || []).some((r) => r.kind === 'armNextSkill'), true, 'ESK-028 arms next Strength');
        return;
      }
      sandbox.Avian.dispatcher.execute(ab);
      const armed = sandbox.G.playerStatus._armedNextSkill;
      expectValue(!!armed && Number(armed.skillPower) === 15, true, 'next Strength +15 Skill Power armed');
      expectValue(!!armed && Number(armed.ignoreGuard) === 4, true, 'next Strength ignores 4 Guard');
    },
  },
];
