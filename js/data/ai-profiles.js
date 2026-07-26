/**
 * Data-driven enemy AI personality, archetype, and difficulty modifiers.
 */
(function initAIProfiles() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.data = Avian.data || {};
  Avian.data.aiProfiles = Object.freeze({
    personalities: Object.freeze({
      aggressive: Object.freeze({ damageBias: 1.35, heavyBias: 1.25, controlBias: 0.85, buffBias: 0.60, guardBias: 0.55, healBias: 0.50, finisherBias: 1.20, repeatBias: 0.85 }),
      tactical: Object.freeze({ damageBias: 1.10, heavyBias: 1.00, controlBias: 1.10, buffBias: 1.00, guardBias: 0.90, healBias: 0.80, finisherBias: 1.05, repeatBias: 0.80 }),
      opportunistic: Object.freeze({ damageBias: 1.15, heavyBias: 1.10, controlBias: 0.95, buffBias: 0.70, guardBias: 0.70, healBias: 0.65, finisherBias: 1.50, repeatBias: 0.80 }),
      control: Object.freeze({ damageBias: 0.95, heavyBias: 0.85, controlBias: 1.40, buffBias: 1.00, guardBias: 0.85, healBias: 0.75, finisherBias: 1.00, repeatBias: 0.75 }),
      tank: Object.freeze({ damageBias: 0.95, heavyBias: 0.90, controlBias: 1.00, buffBias: 0.95, guardBias: 1.35, healBias: 1.15, finisherBias: 0.95, repeatBias: 0.80 }),
      duelist: Object.freeze({ damageBias: 1.25, heavyBias: 1.20, controlBias: 0.95, buffBias: 0.70, guardBias: 0.60, healBias: 0.50, finisherBias: 1.30, repeatBias: 0.90 }),
      executioner: Object.freeze({ damageBias: 1.25, heavyBias: 1.30, controlBias: 1.05, buffBias: 0.55, guardBias: 0.50, healBias: 0.45, finisherBias: 1.65, repeatBias: 0.95 }),
      seer: Object.freeze({ damageBias: 0.95, heavyBias: 0.80, controlBias: 1.45, buffBias: 1.25, guardBias: 0.85, healBias: 0.70, finisherBias: 0.95, repeatBias: 0.70 }),
      reaper: Object.freeze({ damageBias: 1.05, heavyBias: 0.95, controlBias: 1.20, buffBias: 1.10, guardBias: 0.75, healBias: 1.25, finisherBias: 1.15, repeatBias: 0.80 }),
      scavenger: Object.freeze({ damageBias: 1.10, heavyBias: 1.10, controlBias: 1.00, buffBias: 0.75, guardBias: 0.65, healBias: 0.60, finisherBias: 1.45, repeatBias: 0.80 }),
      predator: Object.freeze({ damageBias: 1.20, heavyBias: 1.15, controlBias: 1.20, buffBias: 0.90, guardBias: 0.75, healBias: 0.65, finisherBias: 1.40, repeatBias: 0.85 }),
    }),
    archetypeIntentWeights: Object.freeze({
      striker: Object.freeze({ attack: 60, pressure: 25, buff: 10, control: 5, finish: 0 }),
      predator: Object.freeze({ attack: 35, pressure: 30, control: 15, buff: 20, finish: 0 }),
      bruiser: Object.freeze({ attack: 40, buff: 30, pressure: 20, control: 10, finish: 0 }),
      tank: Object.freeze({ buff: 40, attack: 30, pressure: 20, control: 10, finish: 0 }),
      trickster: Object.freeze({ pressure: 40, control: 30, attack: 20, buff: 10, finish: 0 }),
      singer: Object.freeze({ control: 40, attack: 30, buff: 20, pressure: 10, finish: 0 }),
    }),
    difficultyModifiers: Object.freeze({
      fletchling: Object.freeze({
        spendCapMin: 0.85, spendCapMax: 1.0, intentRandomness: 1.35,
        enEfficiencyWeight: 0.6, finisherPrecision: 0.7, evDefenseWeight: 0.75,
      }),
      juvenile: Object.freeze({
        spendCapMin: 0.90, spendCapMax: 1.0, intentRandomness: 1.0,
        enEfficiencyWeight: 1.0, finisherPrecision: 1.0, evDefenseWeight: 1.0,
      }),
      predator: Object.freeze({
        spendCapMin: 0.95, spendCapMax: 1.0, intentRandomness: 0.85,
        enEfficiencyWeight: 1.25, finisherPrecision: 1.15, evDefenseWeight: 1.1,
      }),
      murder: Object.freeze({
        spendCapMin: 1.0, spendCapMax: 1.0, intentRandomness: 0.65,
        enEfficiencyWeight: 1.45, finisherPrecision: 1.35, evDefenseWeight: 1.2,
      }),
    }),
  });

  global.AI_PERSONALITY_PROFILES = Avian.data.aiProfiles.personalities;
  global.ARCHETYPE_INTENT_WEIGHTS = Avian.data.aiProfiles.archetypeIntentWeights;
  global.DIFFICULTY_AI_MODIFIERS = Avian.data.aiProfiles.difficultyModifiers;
})();
