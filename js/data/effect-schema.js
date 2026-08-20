/* Workbook structured-effect schema. Classic script: intentionally no module/IIFE. */
const STRUCTURED_EFFECT_SCHEMA_VERSION = 1;
const STRUCTURED_EFFECT_TYPES = Object.freeze(['damage','applyAilment','restoreProtection','temporaryProtection','modifyStat','chooseStatModifier','cleanse','penetration','lifesteal','modifyAilmentChance','modifyStatusDuration','modifyNextStatusDuration','armNextSkill','resolveSourceRider','customLegacy']);
const STRUCTURED_EFFECT_TRIGGERS = Object.freeze(['onUse','onHit','onHealthDamage','afterHealthDamage','afterAllHits','nextMatchingSkill']);
const STRUCTURED_EFFECT_TARGETS = Object.freeze(['self','enemy','source']);
Avian.data.effectSchemaVersion = STRUCTURED_EFFECT_SCHEMA_VERSION;
Avian.data.effectSchema = Object.freeze({ types: STRUCTURED_EFFECT_TYPES, triggers: STRUCTURED_EFFECT_TRIGGERS, targets: STRUCTURED_EFFECT_TARGETS });

