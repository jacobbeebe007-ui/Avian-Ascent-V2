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

  function parseSupplementalRiders(text) {
    var riders = [];
    var t = String(text || '').trim();
    if (!t) return riders;

    function addSelf(kind, n, extra) {
      riders.push(Object.assign({
        kind: kind,
        value: n,
        scope: 'self',
        duration: 'untilNextTurn',
        when: null,
      }, extra || {}));
    }

    var flatAcc = t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s+(?:ACC|Accuracy)(?!\s*%)/gi);
    for (var gm of flatAcc) {
      var slice = gm[0];
      addSelf('gainAccFlat', Number(gm[1]), { when: parseRiderWhen(t, slice) });
    }
    var flatDodge = t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s+Dodge(?!\s*%)/gi);
    for (var gd of flatDodge) {
      var dslice = gd[0];
      addSelf('gainDodgeFlat', Number(gd[1]), { when: parseRiderWhen(t, dslice) });
    }

    for (var gm2 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:ACC|Accuracy)/gi)) {
      addSelf('gainAcc', Number(gm2[1]), { when: parseRiderWhen(t, gm2[0]) });
    }
    for (var gm3 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) {
      addSelf('gainDodge', Number(gm3[1]), { when: parseRiderWhen(t, gm3[0]) });
    }

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
