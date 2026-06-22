/* Parse ability rider/condition text from combat-pack rows (runtime enrichment). */
(function () {
  'use strict';

  function mergeAbilityText(row) {
    if (!row) return '';
    return [row.riderText, row.shortDesc, row.displayText].filter(function (s) {
      return s && String(s).trim() && !/^none$/i.test(String(s).trim());
    }).join('\n');
  }

  function parseRiderWhen(text, localSlice) {
    var combined = String(localSlice || '') + '\n' + String(text || '');
    if (/faster than the target|acting before the target|act before the target|if you act before/i.test(combined)) return 'actingFirst';
    if (/after a magic ability|used after a magic|after using a magic ability|after a magic attack/i.test(combined)) return 'afterMagicThisTurn';
    var slice = localSlice || text || '';
    if (/after\s+attack/i.test(slice)) return 'onHit';
    if (/if\s+(?:this\s+)?hits?|if\s+at\s+least\s+\d+\s+hits?\s+land/i.test(slice)) return 'onHit';
    if (/if\s+weaken\s+applies?|when\s+weaken\s+applies?|target\s+is\s+weakened/i.test(slice)) return 'onAilment:weaken';
    if (/if\s+bleed\s+applies?|when\s+bleed\s+applies?|if\s+bleeding\s+applies?|enemy\s+is\s+already\s+bleeding/i.test(slice)) return 'onAilment:bleed';
    if (/if\s+chilled?\s+applies?|when\s+chilled?\s+applies?|target\s+is\s+chilled?/i.test(slice)) return 'onAilment:chilled';
    if (/if\s+burning\s+applies?|when\s+burning\s+applies?/i.test(slice)) return 'onAilment:burning';
    if (/if\s+poison\s+applies?|when\s+poison\s+applies?/i.test(slice)) return 'onAilment:poison';
    if (/if\s+paralys/i.test(slice)) return 'onAilment:paralyzed';
    if (/if\s+delayed\s+applies?/i.test(slice)) return 'onAilment:delayed';
    return null;
  }

  function parseConditionalAbilityFromText(text) {
    var t = String(text || '');
    var m = t.match(/if\s+target\s+is\s+(Bleeding|Burning|Weakened|Bloodied|Chilled)[^.\n]*Ability\s+Power\s+becomes\s+(\d+(?:\.\d+)?)/i);
    if (m) {
      var condMap = {
        bleeding: 'targetBleeding',
        burning: 'targetBurning',
        weakened: 'targetWeakened',
        bloodied: 'targetBloodied',
        chilled: 'targetChilled',
      };
      return {
        condition: condMap[String(m[1]).toLowerCase()] || null,
        conditionalAbilityPower: Number(m[2]),
        conditionalAbilityPowerMode: 'replace',
      };
    }
    return null;
  }

  function riderKey(r) {
    return [r.kind, r.when || '', r.value || '', r.ailment || '', r.scope || ''].join('|');
  }

  function hasRiderKind(riders, kind, when) {
    if (!Array.isArray(riders)) return false;
    for (var i = 0; i < riders.length; i++) {
      var r = riders[i];
      if (r.kind === kind && (!when || r.when === when)) return true;
    }
    return false;
  }

  function resolveMagnitude(stat, direction, tier) {
    if (typeof globalThis.getCombatStatMagnitude === 'function') {
      var v = globalThis.getCombatStatMagnitude(stat, direction, tier);
      return v != null ? v : null;
    }
    return null;
  }

  function parseSupplementalRiders(text) {
    var riders = [];
    var t = String(text || '').trim();
    if (!t || /^none$/i.test(t)) return riders;
    var when = parseRiderWhen(t);

    function addSelf(kind, n, extra) {
      extra = extra || {};
      riders.push(Object.assign({
        kind: kind,
        value: n,
        scope: 'self',
        duration: 'untilNextTurn',
        when: extra.when != null ? extra.when : when,
      }, extra));
    }
    function addEnemy(kind, n, extra) {
      extra = extra || {};
      riders.push(Object.assign({
        kind: kind,
        value: n,
        scope: 'enemy',
        duration: 'untilNextTurn',
        when: extra.when != null ? extra.when : (when || 'onHit'),
      }, extra));
    }

    // Flat stat gains (e.g. gain +8 Dodge)
    for (var gm of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s+(?:ACC|Accuracy)(?!\s*%)/gi)) {
      addSelf('gainAccFlat', Number(gm[1]), { when: parseRiderWhen(t, gm[0]) });
    }
    for (var gd of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s+Dodge(?!\s*%)/gi)) {
      addSelf('gainDodgeFlat', Number(gd[1]), { when: parseRiderWhen(t, gd[0]) });
    }

    // Percentage self gains. Skip matches that sit inside an enemy-debuff
    // clause ("Enemy loses 8% Speed") so the player isn't buffed by mistake.
    function inEnemyLossClause(idx) {
      var pre = t.slice(Math.max(0, idx - 28), idx);
      return /enemy\s+loses|reduce\s+enemy/i.test(pre);
    }
    for (var gm2 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:ACC|Accuracy)/gi)) { if (!inEnemyLossClause(gm2.index)) addSelf('gainAcc', Number(gm2[1]), { when: parseRiderWhen(t, gm2[0]) }); }
    for (var gm3 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) { if (!inEnemyLossClause(gm3.index)) addSelf('gainDodge', Number(gm3[1]), { when: parseRiderWhen(t, gm3[0]) }); }
    for (var gm4 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Speed/gi)) { if (!inEnemyLossClause(gm4.index)) addSelf('gainSpeed', Number(gm4[1])); }
    for (var gm5 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/gi)) { if (!inEnemyLossClause(gm5.index)) addSelf('gainCritChance', Number(gm5[1])); }
    for (var gm6 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Damage/gi)) { if (!inEnemyLossClause(gm6.index)) addSelf('gainCritDamage', Number(gm6[1])); }

    // Named magnitude tiers (Minor ACC Up, Major Dodge Down, etc.)
    for (var nm1 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+ACC\s+Up\b/gi)) {
      var n1 = resolveMagnitude('acc', 'up', nm1[1]); if (n1 != null) addSelf('gainAcc', n1);
    }
    for (var nm2 of t.matchAll(/\b(Minor|Major|Severe|Critical|Lethal)\s+ACC\s+Down\b/gi)) {
      var n2 = resolveMagnitude('acc', 'down', nm2[1]); if (n2 != null) addEnemy('reduceEnemyAcc', n2);
    }
    for (var nm3 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+Dodge\s+Up\b/gi)) {
      var n3 = resolveMagnitude('dodge', 'up', nm3[1]); if (n3 != null) addSelf('gainDodge', n3);
    }
    for (var nm4 of t.matchAll(/\b(Minor|Major|Severe|Critical|Lethal)\s+Dodge\s+Down\b/gi)) {
      var n4 = resolveMagnitude('dodge', 'down', nm4[1]); if (n4 != null) addEnemy('reduceEnemyDodge', n4);
    }
    for (var nm5 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+Crit\s+Chance\s+Up\b/gi)) {
      var n5 = resolveMagnitude('critChance', 'up', nm5[1]); if (n5 != null) addSelf('gainCritChance', n5);
    }
    for (var nm6 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+Crit\s+Damage\s+Up\b/gi)) {
      var n6 = resolveMagnitude('critDamage', 'up', nm6[1]); if (n6 != null) addSelf('gainCritDamage', n6);
    }

    for (var gm7 of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/gi)) addSelf('gainMatk', Number(gm7[1]));
    for (var gm8 of t.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Magic\s*Defen[cs]e/gi)) addSelf('gainMdef', Number(gm8[1]));
    for (var gm9 of t.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e(?!\s*and)/gi)) {
      if (!/Magic\s*Defen/i.test(gm9[0])) addSelf('gainDef', Number(gm9[1]));
    }
    for (var gm10 of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Physical\s*)?Attack(?!\s*Damage)/gi)) {
      if (!/Magic\s*Attack/i.test(gm10[0])) addSelf('gainAtk', Number(gm10[1]));
    }

    // Enemy debuff riders
    for (var em1 of t.matchAll(/(?:enemy\s+loses|reduce\s+enemy\s+(?:acc|accuracy)\s+by)\s+(\d+(?:\.\d+)?)\s*%\s*(?:ACC|Accuracy)/gi)) addEnemy('reduceEnemyAcc', Number(em1[1]));
    for (var em2 of t.matchAll(/(?:enemy\s+loses|reduce\s+enemy\s+dodge\s+by)\s+(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) addEnemy('reduceEnemyDodge', Number(em2[1]));
    for (var em3 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Attack(?!\s*and)/gi)) {
      if (!/Magic\s*Attack/i.test(em3[0])) addEnemy('reduceEnemyAtk', Number(em3[1]));
    }
    for (var em4 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/gi)) addEnemy('reduceEnemyMatk', Number(em4[1]));
    for (var em5 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Speed/gi)) addEnemy('reduceEnemySpd', Number(em5[1]));
    for (var em6 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/gi)) addEnemy('reduceEnemyCrit', Number(em6[1]));
    for (var em7 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Defen[cs]e/gi)) addEnemy('reduceEnemyMdef', Number(em7[1]));
    for (var em8 of t.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e(?!\s*and)/gi)) {
      if (!/Magic\s*Defen/i.test(em8[0])) addEnemy('reduceEnemyDef', Number(em8[1]));
    }
    var combo = t.match(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Attack\s+and\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/i);
    if (combo) {
      addEnemy('reduceEnemyAtk', Number(combo[1]));
      addEnemy('reduceEnemyMatk', Number(combo[2]));
    }

    // Heal % max HP
    var healM = t.match(/heal\s+(\d+(?:\.\d+)?)\s*%\s*Max\s*Health/i);
    if (healM) riders.push({ kind: 'healMaxHpPct', value: Number(healM[1]), scope: 'self', when: when });

    // Guard / brace / counter / taunt
    if (/\bguard\b/i.test(t) && /defence|defense|gain/i.test(t)) addSelf('gainGuard', 1);
    var drM = t.match(/(\d+(?:\.\d+)?)\s*%\s*damage\s*reduction/i);
    if (drM) addSelf('gainGuarded', Number(drM[1]));
    else if (/brace|damage reduction/i.test(t)) addSelf('gainGuarded', 0);
    if (/counter\s*chance|small counter/i.test(t)) addSelf('gainCounter', 1);
    if (/taunt/i.test(t)) addSelf('gainTaunt', 1);

    // Resource
    if (/refund\s+1\s*(?:AP|EN)\s*once\s*per\s*turn/i.test(t)) riders.push({ kind: 'refundApOnCrit', value: 1, oncePerTurn: true });
    var apM = t.match(/\+?\s*(\d+)\s*(?:AP|EN)\s*recovery\s*(?:next\s*turn|on\s*next\s*turn)/i);
    if (apM) riders.push({ kind: 'gainApNextTurn', value: Number(apM[1]) });

    // Conditional damage vs ailment / low HP
    if (/against\s+burning|vs\s+burning|enemy\s+is\s+burning|burning\s+enemies?|target\s+is\s+burning/i.test(t)) {
      var pmB = t.match(/\+?\s*(\d+(?:\.\d+)?)\s*%/);
      riders.push({ kind: 'bonusVsAilment', ailment: 'burning', value: pmB ? Number(pmB[1]) : 0 });
    }
    if (/against\s+bleeding|vs\s+bleeding|enemy\s+is\s+bleeding|bleeding\s+enemies?|target\s+is\s+bleeding/i.test(t)) {
      var pmL = t.match(/\+?\s*(\d+(?:\.\d+)?)\s*%/);
      if (!hasRiderKind(riders, 'bonusVsAilment')) {
        riders.push({ kind: 'bonusVsAilment', ailment: 'bleed', value: pmL ? Number(pmL[1]) : 0 });
      }
    }
    if (/low\s*HP|below\s+\d+%\s+Health|low-Health/i.test(t)) {
      var lowM = t.match(/below\s+(\d+(?:\.\d+)?)\s*%/i);
      riders.push({ kind: 'bonusVsLowHp', threshold: lowM ? Number(lowM[1]) / 100 : 0.35, value: 0 });
    }

    return riders;
  }

  function mapBonusVsAilmentToCondition(row) {
    if (!row || row.condition) return;
    if (!row.riders || !row.riders.length) return;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind !== 'bonusVsAilment') continue;
      if (r.ailment === 'bleed') {
        row.condition = 'targetBleeding';
        row.conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
        row.conditionalAbilityPowerMode = row.conditionalAbilityPowerMode || 'multiply';
      } else if (r.ailment === 'burning') {
        row.condition = 'targetBurning';
        row.conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
        row.conditionalAbilityPowerMode = row.conditionalAbilityPowerMode || 'multiply';
      }
    }
  }

  function applyTextEnrichment(row) {
    if (!row || row._textEnriched) return row;
    var text = mergeAbilityText(row);
    var cond = parseConditionalAbilityFromText(text);
    if (cond && cond.condition) {
      row.condition = cond.condition;
      row.conditionalAbilityPower = cond.conditionalAbilityPower;
      row.conditionalAbilityPowerMode = cond.conditionalAbilityPowerMode;
    }

    var supplemental = parseSupplementalRiders(text);
    row.riders = Array.isArray(row.riders) ? row.riders.slice() : [];
    var existing = Object.create(null);
    row.riders.forEach(function (r) { existing[riderKey(r)] = true; });
    supplemental.forEach(function (r) {
      if (r.kind === 'raw') return;
      var key = riderKey(r);
      if (!existing[key]) {
        row.riders.push(r);
        existing[key] = true;
      }
    });

    // Drop lone raw riders when supplemental parsing found handlers
    if (row.riders.length > 1) {
      row.riders = row.riders.filter(function (r) {
        return r.kind !== 'raw' || row.riders.length === 1;
      });
    }

    mapBonusVsAilmentToCondition(row);
    row._textEnriched = true;
    return row;
  }

  var api = {
    mergeAbilityText: mergeAbilityText,
    parseRiderWhen: parseRiderWhen,
    parseConditionalAbilityFromText: parseConditionalAbilityFromText,
    parseSupplementalRiders: parseSupplementalRiders,
    applyTextEnrichment: applyTextEnrichment,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.abilityRiderParser = api;
  globalThis.applyAbilityTextEnrichment = applyTextEnrichment;
})();
