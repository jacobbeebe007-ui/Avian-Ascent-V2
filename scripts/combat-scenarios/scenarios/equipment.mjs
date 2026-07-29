/** I. Equipment action scenarios — starting weapons + family skills. */

import { STARTING_WEAPONS } from '../fixtures.mjs';

const CLASS_BIRDS = {
  rogue: 'sparrow',
  mage: 'barnowl',
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
];
