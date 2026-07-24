/* Leaf ailment definitions. Affinity Arsenal v0.6 copy.
 * Loaded after ailment-rules.js so globalThis.AILMENTS can reference rule constants.
 */
(function () {
  var R = globalThis.AILMENT_RULES || {};

  globalThis.AILMENTS = {
    chilled: {
      id: 'chilled',
      name: 'Chilled',
      icon: '❄',
      color: '#7fd6ff',
      desc: 'Stacks to 5. −3% Agility per stack. At 5 stacks the target becomes Frozen.',
      maxStacks: (R.chilled && R.chilled.maxStacks) || 5,
    },

    poison: {
      id: 'poison',
      name: 'Poison',
      icon: '☣',
      color: '#4cb44c',
      desc: 'Stacks to 5. 0.75% Max Health per stack at end of turn (ignores Guard/Resolve). At 5 stacks converts to Toxic.',
      maxStacks: (R.poison && R.poison.maxStacks) || 5,
    },

    toxic: {
      id: 'toxic',
      name: 'Toxic',
      icon: '☠',
      color: '#2d8a2d',
      desc: 'Non-stacking. 5% Max Health damage per tick for 2 turns. Ignores Guard/Resolve.',
    },

    bleed: {
      id: 'bleed',
      name: 'Bleed',
      icon: '🩸',
      color: '#be384c',
      desc: 'Stacks to 3. Each stack: 1% Max Health Martial DoT and −10% healing received (30% at cap).',
      maxStacks: (R.bleed && R.bleed.maxStacks) || 3,
    },

    weaken: {
      id: 'weaken',
      name: 'Weaken',
      icon: '🐔',
      color: '#c9a840',
      desc: 'Stacks to 3. Each stack: −8% outgoing damage and −4 Evasion.',
      maxStacks: (R.weaken && R.weaken.maxStacks) || 3,
    },

    weakened: {
      id: 'weakened',
      name: 'Weakened',
      icon: '📉',
      color: '#c9a840',
      desc: 'Moderate Might Down and Moderate Focus Down until end of next turn.',
    },

    paralyzed: {
      id: 'paralyzed',
      name: 'Paralysed',
      icon: '⚡',
      color: '#c8c840',
      desc: 'After EN recovery, current Energy is capped at 2 for that turn. Then grants Control Resistance.',
      enCapAfterRecovery: (R.paralyzed && R.paralyzed.enCapAfterRecovery) || 2,
    },

    shock: {
      id: 'shock',
      name: 'Shock',
      icon: '⚡',
      color: '#e8d020',
      desc: 'Stacks to 5. −2 Precision points per stack. At 5 stacks the target becomes Paralysed.',
      maxStacks: (R.shock && R.shock.maxStacks) || 5,
    },

    burning: {
      id: 'burning',
      name: 'Burn',
      icon: '🔥',
      color: '#dc641e',
      desc: 'Stacks to 5. 1% Max Health Magic damage per stack at end of turn. At 5 stacks becomes Incinerating.',
      maxStacks: (R.burning && R.burning.maxStacks) || 5,
    },

    incinerating: {
      id: 'incinerating',
      name: 'Incinerating',
      icon: '🔥',
      color: '#ff6a00',
      desc: 'At end of next turn, take 6% Max Health as Magic damage, then become Scorched.',
    },

    scorched: {
      id: 'scorched',
      name: 'Scorched',
      icon: '🔥',
      color: '#ff4500',
      desc: 'Minor Guard Down and Minor Resolve Down until end of next turn.',
    },

    frozen: {
      id: 'frozen',
      name: 'Frozen',
      icon: '🧊',
      color: '#a8d8ff',
      desc: 'Skip the next turn. After it resolves, gain Control Resistance.',
    },

    controlResistance: {
      id: 'controlResistance',
      name: 'Control Resistance',
      icon: '🛡',
      color: '#a0c0e0',
      desc: 'Cannot gain Chilled or Shock stacks until the end of the next completed turn.',
    },

    delayed: {
      id: 'delayed',
      name: 'Delayed',
      icon: '🎵',
      color: '#c850c8',
      desc: 'Stores exact damage to resolve at the end of the target\'s next turn.',
    },

    fear: {
      id: 'fear',
      name: 'Fear',
      icon: '😱',
      color: '#8050a0',
      desc: 'Next damaging action receives Major Damage Down (−12%).',
    },

    confused: {
      id: 'confused',
      name: 'Confused',
      icon: '💫',
      color: '#d0a040',
      desc: 'Next hostile action receives Major Precision Down (−8 points).',
    },

    blinded: {
      id: 'blinded',
      name: 'Blinded',
      icon: '👁',
      color: '#606060',
      desc: 'Precision penalty while active.',
    },

    decreed: {
      id: 'decreed',
      name: 'Decreed',
      icon: '📜',
      color: '#c0a060',
      desc: 'Marked by decree effects.',
    },

    /* Legacy post-upgrade windows — disabled under v0.6 Control Resistance model. */
    frostGuard: {
      id: 'frostGuard',
      name: 'Frost Guard',
      icon: '❄',
      color: '#a8d8ff',
      desc: 'Legacy chill protection window (superseded by Control Resistance).',
    },
    emberGuard: {
      id: 'emberGuard',
      name: 'Ember Guard',
      icon: '🔥',
      color: '#ff4500',
      desc: 'Legacy burn protection window (superseded by resolved-state lockouts).',
    },
    toxicResistance: {
      id: 'toxicResistance',
      name: 'Toxic Resistance',
      icon: '☣',
      color: '#2d8a2d',
      desc: 'Legacy poison protection window (superseded by resolved-state lockouts).',
    },
  };
})();
