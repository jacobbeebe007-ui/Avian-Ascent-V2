/* Canonical combat-result and bounded combat-history service.
 * Formula code supplies the numbers it actually used; this module never predicts damage. */
(function initCombatBreakdown(global) {
  'use strict';
  var Avian = global.Avian = global.Avian || {};
  Avian.systems = Avian.systems || {};
  var MAX_EVENTS = 100;
  var MAX_ACTIONS = 30;
  var state = { battleId: null, context: {}, events: [], actions: [], pending: null, sequence: 0 };

  function now() {
    return global.performance && typeof global.performance.now === 'function'
      ? global.performance.now() : Date.now();
  }
  function copy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function entityId(entity, fallback) {
    return String(entity && (entity.id || entity.birdKey || entity.enemyKey || entity.name) || fallback || 'unknown');
  }
  function abilityId(ability) { return String(ability && (ability.id || ability.actionId) || 'unknown-action'); }
  function abilityName(ability) { return String(ability && (ability.name || ability.displayName || ability.id) || 'Combat Action'); }
  function damageType(ability) {
    var raw = String(ability && (ability.damageType || ability.category || ability.type) || 'martial').toLowerCase();
    return raw === 'magic' || raw === 'spell' ? 'magic' : (raw === 'hybrid' || raw === 'combo' ? 'hybrid' : 'martial');
  }
  function statName(ability) {
    var raw = ability && (ability.scaleStat || ability.damageStat || ability.scalingStat);
    if (!raw && Array.isArray(ability && ability.scaling) && ability.scaling.length === 1) raw = ability.scaling[0].ledgerKey || ability.scaling[0].stat;
    return raw == null ? null : String(raw).toLowerCase();
  }
  function weaponRange(ability, params) {
    var source = params && (params.weaponDamageRange || params.weaponRange) || ability && (ability.weaponDamageRange || ability.weaponRange);
    if (Array.isArray(source)) return { min: Number(source[0]) || 0, max: Number(source[1]) || Number(source[0]) || 0 };
    var min = Number(ability && (ability.weaponDamageMin != null ? ability.weaponDamageMin : ability.minDamage));
    var max = Number(ability && (ability.weaponDamageMax != null ? ability.weaponDamageMax : ability.maxDamage));
    return Number.isFinite(min) || Number.isFinite(max) ? { min: Number.isFinite(min) ? min : max, max: Number.isFinite(max) ? max : min } : null;
  }
  function makeModifier(sourceType, sourceId, sourceName, stage, operation, value, displayValue) {
    return {
      sourceType: sourceType || 'system', sourceId: sourceId || null,
      sourceName: sourceName || sourceId || 'Combat rule', stage: stage || 'other',
      operation: operation || 'add', value: Number(value) || 0,
      displayValue: displayValue || String(value),
    };
  }

  function fromCalculation(calculation, params) {
    params = params || {};
    calculation = calculation || {};
    var ability = params.ability || {};
    var c = calculation.components || {};
    var hit = params.hitSucceeded !== false;
    var critical = !!params.isCriticalHit;
    var critMultiplier = critical ? Number(params.critMultiplier) || 1.5 : 1;
    var relevantStat = Number(c.relevantStat) || 0;
    var power = c.skillPowerPct != null ? Number(c.skillPowerPct) : Math.round((Number(c.abilityPower) || 0) * 100);
    var weaponRoll = c.weaponDamage != null ? Number(c.weaponDamage) : null;
    var base = Number(c.enBase) || weaponRoll || 0;
    var finalDamage = hit ? Number(calculation.damage) || 0 : 0;
    var effectiveDef = Number(calculation.effectiveDef);
    if (!Number.isFinite(effectiveDef)) effectiveDef = Number(c.defStat) || 0;
    var piercePct = ability.piercePercent != null ? Number(ability.piercePercent) : Number(damageType(ability) === 'magic' ? ability.pierceMdef : ability.pierceDef) / 100;
    var flatPen = Number(params.flatPen != null ? params.flatPen : ability.flatPen) || 0;
    var result = {
      actionId: abilityId(ability), actionName: abilityName(ability),
      actorId: entityId(params.attacker, 'actor'), targetId: entityId(params.target, 'target'),
      hit: hit, dodged: !hit, critical: critical,
      energySpent: Number(ability.enCost != null ? ability.enCost : ability.apCost) || 0,
      cooldownApplied: Number(ability.cooldown) || 0,
      accuracy: copy(params.accuracy || null),
      damage: {
        type: damageType(ability), weaponRange: weaponRange(ability, params), weaponRoll: weaponRoll,
        baseDamage: base, scalingStat: statName(ability), scalingValue: relevantStat,
        scalingContribution: c.weaponFirst ? (weaponRoll == null ? 0 : weaponRoll * relevantStat * 0.025) : 0,
        skillPowerPercent: power, preModifierDamage: Number(calculation.preMitigation) || 0,
        bonuses: [], penalties: [], affinityMultiplier: Number(c.typeMod) || 1,
        affinityRelationship: c.aspectRelationship || 'neutral', criticalMultiplier: critMultiplier,
        penetration: { stat: damageType(ability) === 'magic' ? 'resolve' : 'guard', amount: flatPen, percent: Number(piercePct) || 0 },
        defenceValue: Number(c.defStat) || 0, effectiveDefence: effectiveDef,
        defenceMultiplier: Number(c.defMod) || 1, rawBeforeRounding: Number(calculation.rawDamage != null ? calculation.rawDamage : finalDamage),
        finalRawDamage: finalDamage, armourDamage: 0, magicArmourDamage: 0,
        healthDamage: 0, totalDamage: finalDamage,
      },
      hits: [], effects: [], modifiers: [], events: [], calculationStages: [],
    };
    if (Number(c.bonusMod) !== 1) result.modifiers.push(makeModifier('structuredEffect', null, 'Damage bonuses', 'offensiveModifiers', 'multiply', Number(c.bonusMod) || 1, '×' + (Number(c.bonusMod) || 1).toFixed(2)));
    if (Number(c.typeMod) !== 1) result.modifiers.push(makeModifier('affinity', null, 'Affinity', 'affinity', 'multiply', Number(c.typeMod), '×' + Number(c.typeMod).toFixed(2)));
    if (critical) result.modifiers.push(makeModifier('critical', null, 'Critical', 'critical', 'multiply', critMultiplier, '×' + critMultiplier.toFixed(2)));
    result.calculationStages = [
      { stage: 'weaponRoll', value: weaponRoll }, { stage: 'scaling', value: result.damage.scalingContribution },
      { stage: 'skillPower', value: power }, { stage: 'preModifierDamage', value: result.damage.preModifierDamage },
      { stage: 'affinity', value: result.damage.affinityMultiplier }, { stage: 'critical', value: critMultiplier },
      { stage: 'defence', value: effectiveDef }, { stage: 'finalRawDamage', value: finalDamage },
    ];
    return result;
  }

  function emit(type, result, extra) {
    var event = Object.assign({ turn: Number(global.G && global.G.turn) || 0, actor: result && result.actorId || 'system', type: type, actionId: result && result.actionId || null, result: result || null, timestamp: now() }, extra || {});
    state.events.push(event);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    return event;
  }
  function captureCalculation(result) {
    if (!result || !result.breakdown) return result;
    state.pending = result.breakdown;
    return result;
  }
  function routeDamage(route) {
    var result = state.pending;
    if (!result || !result.damage) return null;
    route = route || {};
    result.damage.armourDamage = route.isMagic ? 0 : Number(route.absorbed) || 0;
    result.damage.magicArmourDamage = route.isMagic ? Number(route.absorbed) || 0 : 0;
    result.damage.healthDamage = Number(route.remaining) || 0;
    result.damage.protectionPoolBefore = Number(route.poolBefore) || 0;
    result.damage.protectionPoolAfter = Number(route.poolAfter) || 0;
    result.damage.blockedByProtection = result.damage.healthDamage === 0 && (Number(route.absorbed) || 0) > 0;
    result.events.push({ type: 'protectionDamage', pool: route.poolKey, amount: Number(route.absorbed) || 0 });
    result.events.push({ type: 'healthDamage', amount: result.damage.healthDamage });
    finalize(result);
    return result;
  }
  function finalize(result) {
    result = result || state.pending;
    if (!result) return null;
    result.sequence = ++state.sequence;
    result.timestamp = now();
    state.actions.push(result);
    if (state.actions.length > MAX_ACTIONS) state.actions.splice(0, state.actions.length - MAX_ACTIONS);
    emit(result.hit ? 'damage' : 'miss', result);
    if (state.pending === result) state.pending = null;
    if (Avian.ui && Avian.ui.combatLog && typeof Avian.ui.combatLog.refresh === 'function') Avian.ui.combatLog.refresh();
    return result;
  }
  function recordEffect(effect) {
    var result = state.pending || state.actions[state.actions.length - 1];
    if (!result) return null;
    result.effects.push(copy(effect));
    emit(effect && effect.applied ? 'ailmentApplied' : 'ailmentAttempt', result, { effect: copy(effect) });
    return effect;
  }
  function beginAction(meta) {
    meta = meta || {};
    var result = {
      actionId: abilityId(meta.ability || meta), actionName: abilityName(meta.ability || meta),
      actorId: entityId(meta.actor, meta.actorId || 'actor'), targetId: entityId(meta.target, meta.targetId || 'target'),
      hit: meta.hit !== false, dodged: meta.hit === false, critical: !!meta.critical,
      energySpent: Number(meta.energySpent) || 0, cooldownApplied: Number(meta.cooldownApplied) || 0,
      damage: { type: meta.damageType || 'martial', armourDamage: 0, magicArmourDamage: 0, healthDamage: 0, totalDamage: 0 },
      hits: [], effects: [], modifiers: [], events: [], calculationStages: [],
    };
    state.pending = result;
    return {
      result: result,
      record: function (stage) { result.calculationStages.push(copy(stage)); return this; },
      recordModifier: function (modifier) { result.modifiers.push(copy(modifier)); return this; },
      recordHit: function (hit) { result.hits.push(copy(hit)); return this; },
      recordDamage: function (damage) {
        damage = damage || {}; result.damage.armourDamage += Number(damage.armour) || 0;
        result.damage.magicArmourDamage += Number(damage.magicArmour) || 0; result.damage.healthDamage += Number(damage.health) || 0;
        result.damage.totalDamage += Number(damage.total != null ? damage.total : (Number(damage.armour) || 0) + (Number(damage.magicArmour) || 0) + (Number(damage.health) || 0)); return this;
      },
      recordEffect: function (effect) { result.effects.push(copy(effect)); return this; },
      finalize: function () { return finalize(result); },
    };
  }
  function reset(context) {
    state = { battleId: context && context.battleId || 'battle-' + Date.now(), context: copy(context || {}), events: [], actions: [], pending: null, sequence: 0 };
    return state.battleId;
  }
  function exportData() {
    return copy({ version: 1, battleId: state.battleId, context: state.context, turns: Number(global.G && global.G.turn) || 0, actions: state.actions, statusEvents: state.events });
  }
  function download() {
    var json = JSON.stringify(exportData(), null, 2);
    if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && global.URL) {
      var url = global.URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      var link = document.createElement('a'); link.href = url; link.download = 'avian-combat-breakdown.json'; link.click();
      global.URL.revokeObjectURL(url);
    }
    return json;
  }
  var api = {
    MAX_EVENTS: MAX_EVENTS, MAX_ACTIONS: MAX_ACTIONS, createModifier: makeModifier, beginAction: beginAction,
    fromCalculation: fromCalculation, captureCalculation: captureCalculation,
    routeDamage: routeDamage, finalize: finalize, recordEffect: recordEffect, emit: emit,
    reset: reset, getHistory: function () { return state.actions.slice(); },
    getEvents: function () { return state.events.slice(); }, export: exportData,
  };
  Avian.systems.combatBreakdown = api;
  Avian.debug = Avian.debug || {};
  Avian.debug.exportCombatBreakdown = download;
})(globalThis);
