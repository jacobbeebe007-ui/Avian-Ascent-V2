/* Leaf ailment definitions. Loaded as the first entry in js/bootstrap/load-order.json
 * so globalThis.AILMENTS is defined before the rest of the classic shell runs.
 *
 * Aligned with the Ailment Reference sheet from the combat rewrite spreadsheets:
 *   Chilled, Weaken, Delayed, Poison, Burning, Paralysed, Bleed.
 * IDs preserved for compatibility with `applyAilment` in js/core/game.js.
 *
 * Stack vs refresh is enforced at runtime in `applyAilment` / `refreshStatus`:
 * only Poison and Chilled stack counters; all other ailments refresh duration.
 */
(function () {
  globalThis.AILMENTS = {
    chilled: {
      id: 'chilled',
      name: 'Chilled',
      icon: '❄',
      color: '#7fd6ff',
      desc: 'Stacks to 5. −8% Speed per stack. At 5 stacks the target is Frozen and skips its next turn.',
      spdMult: 0.92,
      maxStacks: 5,
    },

    poison: {
      id: 'poison',
      name: 'Poison',
      icon: '☣',
      color: '#4cb44c',
      desc: 'Stacks to 5. 2 damage per stack at end of each turn. Refreshes duration to 3 turns when applied.',
      tick(who, stacks) { return 2 * stacks; },
      maxStacks: 5,
    },

    bleed: {
      id: 'bleed',
      name: 'Bleed',
      icon: '🩸',
      color: '#be384c',
      desc: 'Non-stacking. Reduces healing received by 50%. Reapplying refreshes duration to 3 turns.',
    },

    weaken: {
      id: 'weaken',
      name: 'Weaken',
      icon: '🐔',
      color: '#c9a840',
      desc: 'Non-stacking. −25% outgoing damage and −40% Dodge. Reapplying refreshes duration. Main Singer ailment.',
      dodgeMult: 0.6,
      dmgMult: 0.75,
    },

    paralyzed: {
      id: 'paralyzed',
      name: 'Paralysed',
      icon: '⚡',
      color: '#c8c840',
      desc: '20% chance to skip turn each round (3 turns). Tank signature: also disrupts AP recovery via Tank abilities.',
      skipChance: 20,
    },

    burning: {
      id: 'burning',
      name: 'Burning',
      icon: '🔥',
      color: '#dc641e',
      desc: 'Non-stacking. 7 flat damage at end of target turn; −20% DEF and −20% MDEF while burning.',
      hitBonus: 0,
      critBonus: 0,
    },

    delayed: {
      id: 'delayed',
      name: 'Delayed',
      icon: '🎵',
      color: '#c850c8',
      desc: 'Non-stacking. Stored damage detonates at end of target next turn. Reapplying refreshes — primary Singer payoff.',
    },
  };
})();
