/* Leaf ailment definitions. Loaded as the first entry in js/bootstrap/load-order.json
 * so globalThis.AILMENTS is defined before the rest of the classic shell runs.
 *
 * Aligned with the Master Ailment List (combat rewrite).
 * Stack vs refresh is enforced at runtime in applyAilment / ailment-engine.js.
 */
(function () {
  var R = globalThis.AILMENT_RULES || {};

  globalThis.AILMENTS = {
    chilled: {
      id: 'chilled',
      name: 'Chilled',
      icon: '❄',
      color: '#7fd6ff',
      desc: 'Stacks to 5. −6% Speed per stack. At 5 stacks the target becomes Frozen.',
      maxStacks: (R.chilled && R.chilled.maxStacks) || 5,
    },

    poison: {
      id: 'poison',
      name: 'Poison',
      icon: '☣',
      color: '#4cb44c',
      desc: 'Stacks to 5. 1 damage per stack at end of turn. At 5 stacks converts to Toxic.',
      maxStacks: (R.poison && R.poison.maxStacks) || 5,
    },

    toxic: {
      id: 'toxic',
      name: 'Toxic',
      icon: '☠',
      color: '#2d8a2d',
      desc: 'Non-stacking. 8% Max HP damage per tick (cap 12 normal / 8 boss). Ignores DEF/MDEF.',
    },

    bleed: {
      id: 'bleed',
      name: 'Bleed',
      icon: '🩸',
      color: '#be384c',
      desc: 'Stacks to 3. Each stack: 2% Max HP DoT and −15% healing received.',
      maxStacks: (R.bleed && R.bleed.maxStacks) || 3,
    },

    weaken: {
      id: 'weaken',
      name: 'Weaken',
      icon: '🐔',
      color: '#c9a840',
      desc: 'Stacks to 3. Each stack: −8% outgoing damage and −4 Dodge.',
      maxStacks: (R.weaken && R.weaken.maxStacks) || 3,
    },

    paralyzed: {
      id: 'paralyzed',
      name: 'Paralysed',
      icon: '⚡',
      color: '#c8c840',
      desc: '20% chance to skip turn at start of turn (2 turns). Removed if action is lost.',
      skipChance: (R.paralyzed && R.paralyzed.skipChance) || 20,
    },

    burning: {
      id: 'burning',
      name: 'Burning',
      icon: '🔥',
      color: '#dc641e',
      desc: 'Stacks to 3. 3 flat damage per stack; −4% DEF/MDEF per stack. At 3 stacks converts to Scorched.',
      maxStacks: (R.burning && R.burning.maxStacks) || 3,
    },

    scorched: {
      id: 'scorched',
      name: 'Scorched',
      icon: '🔥',
      color: '#ff4500',
      desc: 'Non-stacking. 8 flat damage per tick; −12% DEF and MDEF.',
    },

    frozen: {
      id: 'frozen',
      name: 'Frozen',
      icon: '🧊',
      color: '#a8d8ff',
      desc: 'Skips next action. After triggering, target gains Frost Guard for 1 turn.',
    },

    delayed: {
      id: 'delayed',
      name: 'Delayed',
      icon: '🎵',
      color: '#c850c8',
      desc: 'Stores 25–50% of triggering damage. Detonates at end of target next turn.',
    },

    blinded: {
      id: 'blinded',
      name: 'Blinded',
      icon: '👁',
      color: '#888888',
      desc: 'Non-stacking. −12 Accuracy for 2 turns.',
    },

    decreed: {
      id: 'decreed',
      name: 'Decreed',
      icon: '📜',
      color: '#6f88c2',
      desc: 'Duke mark. Duke next Magic hit gains +12% damage (+18% if target has an ailment).',
    },

    marked: {
      id: 'marked',
      name: 'Marked',
      icon: '🎯',
      color: '#e8c040',
      desc: 'Next ability that checks Marked gains its payoff, then consumes Marked.',
    },

    frostGuard: {
      id: 'frostGuard',
      name: 'Frost Guard',
      icon: '🛡',
      color: '#7fd6ff',
      desc: 'Cannot gain Chilled while active.',
    },

    emberGuard: {
      id: 'emberGuard',
      name: 'Ember Guard',
      icon: '🛡',
      color: '#dc641e',
      desc: 'Cannot become Scorched while active. Burning may still apply.',
    },

    toxicResistance: {
      id: 'toxicResistance',
      name: 'Toxic Resistance',
      icon: '🛡',
      color: '#4cb44c',
      desc: 'Cannot become Toxic while active. Poison may still apply.',
    },
  };
})();
