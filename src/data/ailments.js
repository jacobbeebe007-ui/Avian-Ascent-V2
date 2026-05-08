/** Leaf data: consumed by legacy shell via globalThis (see src/main.ts). */
export const AILMENTS = {
  chilled: {
    id: 'chilled',
    name: 'Chilled',
    icon: '❄',
    color: '#7fd6ff',
    desc: 'Stacks to 5: −8% SPD per stack. At 5 stacks becomes Frozen.',
    spdMult: 0.92,
  },

  poison: {
    id: 'poison',
    name: 'Poison',
    icon: '☣',
    color: '#4cb44c',
    desc: 'Stacks to 5. 2 damage per stack. Ticks at end of player turn and enemy turn.',
    tick(who, stacks) {
      return 2 * stacks;
    },
  },
  bleed: {
    id: 'bleed',
    name: 'Bleed',
    icon: '🩸',
    color: '#be384c',
    desc: 'Non-stacking. Healing received reduced 50%. Refresh duration only.',
  },
  weaken: {
    id: 'weaken',
    name: 'Chicken Pox',
    icon: '🐔',
    color: '#c9a840',
    desc: 'Refresh only. −25% damage and −40% Dodge. Reserved for songs/calls.',
    dodgeMult: 0.6,
    dmgMult: 0.75,
  },
  paralyzed: {
    id: 'paralyzed',
    name: 'Paralysis',
    icon: '⚡',
    color: '#c8c840',
    desc: '20% chance to skip turn each round. 3 turns.',
    skipChance: 20,
  },
  burning: {
    id: 'burning',
    name: 'Feather Disease',
    icon: '🔥',
    color: '#dc641e',
    desc: 'Non-stacking. 7 flat damage at end of enemy turn; −20% DEF and MDEF while burning.',
    hitBonus: 0,
    critBonus: 0,
  },
  delayed: {
    id: 'delayed',
    name: 'Resonance',
    icon: '🎵',
    color: '#c850c8',
    desc: 'Non-stacking. Stored damage detonates at end of target next turn; reapply refreshes.',
  },
};
