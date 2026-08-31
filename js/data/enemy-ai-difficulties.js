/**
 * Enemy AI v2 — intelligence profiles (easy/normal/elite/boss/custom) and behaviour styles.
 */
(function initEnemyAIDifficulties() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.data = Avian.data || {};

  var AI_PROFILE = Object.freeze({
    DEFAULT: 'default',
    EASY: 'easy',
    NORMAL: 'normal',
    ELITE: 'elite',
    BOSS: 'boss',
    CUSTOM: 'custom',
  });

  var AI_BEHAVIOUR = Object.freeze({
    AUTOMATIC: 'automatic',
    BALANCED: 'balanced',
    AGGRESSIVE: 'aggressive',
    DEFENSIVE: 'defensive',
    CONTROL: 'control',
    SUSTAIN: 'sustain',
    KNIGHT: 'knight',
    ROGUE: 'rogue',
    MAGE: 'mage',
    SIREN: 'siren',
    INQUISITOR: 'inquisitor',
    BARD: 'bard',
    BRUTE: 'brute',
  });

  var enemyAIDifficulties = Object.freeze({
    easy: Object.freeze({
      label: 'Easy',
      scoreAccuracy: 0.75,
      randomness: 0.30,
      koAwareness: 0.55,
      protectionAwareness: 0.65,
      ailmentAwareness: 0.55,
      comboAwareness: 0.25,
      enPlanning: 0.20,
      cooldownPlanning: 0.30,
      defensiveUrgency: 0.65,
      lookahead: false,
    }),
    normal: Object.freeze({
      label: 'Normal',
      scoreAccuracy: 1.0,
      randomness: 0.12,
      koAwareness: 1.0,
      protectionAwareness: 1.0,
      ailmentAwareness: 1.0,
      comboAwareness: 0.65,
      enPlanning: 0.55,
      cooldownPlanning: 0.65,
      defensiveUrgency: 1.0,
      lookahead: false,
    }),
    elite: Object.freeze({
      label: 'Elite',
      scoreAccuracy: 1.05,
      randomness: 0.06,
      koAwareness: 1.15,
      protectionAwareness: 1.15,
      ailmentAwareness: 1.20,
      comboAwareness: 1.0,
      enPlanning: 0.9,
      cooldownPlanning: 1.0,
      defensiveUrgency: 1.1,
      lookahead: true,
      lookaheadWeight: 0.25,
    }),
    boss: Object.freeze({
      label: 'Boss',
      scoreAccuracy: 1.1,
      randomness: 0.02,
      koAwareness: 1.25,
      protectionAwareness: 1.25,
      ailmentAwareness: 1.25,
      comboAwareness: 1.15,
      enPlanning: 1.0,
      cooldownPlanning: 1.1,
      defensiveUrgency: 1.2,
      lookahead: true,
      lookaheadWeight: 0.35,
    }),
  });

  /** Strategic weight biases keyed by behaviour style (damage/heavy/control/etc.). */
  var behaviourWeights = Object.freeze({
    balanced: Object.freeze({ damageBias: 1.10, heavyBias: 1.00, controlBias: 1.10, buffBias: 1.00, guardBias: 0.90, healBias: 0.80, finisherBias: 1.05, repeatBias: 0.80 }),
    aggressive: Object.freeze({ damageBias: 1.35, heavyBias: 1.25, controlBias: 0.85, buffBias: 0.60, guardBias: 0.55, healBias: 0.50, finisherBias: 1.20, repeatBias: 0.85 }),
    defensive: Object.freeze({ damageBias: 0.95, heavyBias: 0.90, controlBias: 1.00, buffBias: 0.95, guardBias: 1.35, healBias: 1.15, finisherBias: 0.95, repeatBias: 0.80 }),
    control: Object.freeze({ damageBias: 0.95, heavyBias: 0.85, controlBias: 1.40, buffBias: 1.00, guardBias: 0.85, healBias: 0.75, finisherBias: 1.00, repeatBias: 0.75 }),
    sustain: Object.freeze({ damageBias: 0.95, heavyBias: 0.90, controlBias: 1.00, buffBias: 1.10, guardBias: 1.20, healBias: 1.25, finisherBias: 0.95, repeatBias: 0.80 }),
    knight: Object.freeze({ damageBias: 0.95, heavyBias: 0.90, controlBias: 1.00, buffBias: 0.95, guardBias: 1.35, healBias: 1.15, finisherBias: 0.95, repeatBias: 0.80 }),
    rogue: Object.freeze({ damageBias: 1.15, heavyBias: 1.10, controlBias: 0.95, buffBias: 0.70, guardBias: 0.70, healBias: 0.65, finisherBias: 1.50, repeatBias: 0.80 }),
    mage: Object.freeze({ damageBias: 0.95, heavyBias: 0.80, controlBias: 1.45, buffBias: 1.25, guardBias: 0.85, healBias: 0.70, finisherBias: 0.95, repeatBias: 0.70 }),
    siren: Object.freeze({ damageBias: 0.95, heavyBias: 0.85, controlBias: 1.40, buffBias: 1.00, guardBias: 0.85, healBias: 0.75, finisherBias: 1.00, repeatBias: 0.75 }),
    inquisitor: Object.freeze({ damageBias: 1.05, heavyBias: 0.95, controlBias: 1.20, buffBias: 1.10, guardBias: 0.75, healBias: 1.25, finisherBias: 1.15, repeatBias: 0.80 }),
    bard: Object.freeze({ damageBias: 1.10, heavyBias: 1.00, controlBias: 1.10, buffBias: 1.00, guardBias: 0.90, healBias: 0.80, finisherBias: 1.05, repeatBias: 0.80 }),
    brute: Object.freeze({ damageBias: 1.25, heavyBias: 1.20, controlBias: 0.95, buffBias: 0.70, guardBias: 0.60, healBias: 0.50, finisherBias: 1.30, repeatBias: 0.90 }),
  });

  var PROFILE_LABELS = Object.freeze({
    default: 'Default',
    easy: 'Easy',
    normal: 'Normal',
    elite: 'Elite',
    boss: 'Boss',
    custom: 'Custom',
  });

  var BEHAVIOUR_LABELS = Object.freeze({
    automatic: 'Automatic',
    balanced: 'Balanced',
    aggressive: 'Aggressive',
    defensive: 'Defensive',
    control: 'Control',
    sustain: 'Sustain',
    knight: 'Knight',
    rogue: 'Rogue',
    mage: 'Mage',
    siren: 'Siren',
    inquisitor: 'Inquisitor',
    bard: 'Bard',
    brute: 'Brute',
  });

  Avian.data.enemyAI = Object.freeze({
    profiles: AI_PROFILE,
    behaviours: AI_BEHAVIOUR,
    difficulties: enemyAIDifficulties,
    behaviourWeights: behaviourWeights,
    profileLabels: PROFILE_LABELS,
    behaviourLabels: BEHAVIOUR_LABELS,
  });

  Avian.data.enemyAIDifficulties = enemyAIDifficulties;

  global.AI_PROFILE = AI_PROFILE;
  global.AI_BEHAVIOUR = AI_BEHAVIOUR;
  global.ENEMY_AI_BEHAVIOUR_WEIGHTS = behaviourWeights;
})();
