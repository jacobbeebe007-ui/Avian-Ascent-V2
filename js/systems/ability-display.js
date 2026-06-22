/* Ability combat brief + tooltip formatters. */
(function () {
  'use strict';

  function normalizeEnLabel(s) {
    if (typeof globalThis.normalizeCombatEnLabel === 'function') return globalThis.normalizeCombatEnLabel(s);
    return String(s || '').replace(/\b(\d+)\s*AP\b/g, '$1 EN').replace(/\bAP\s*·/g, 'EN ·');
  }

  function resolveRow(ab, row) {
    if (row) return row;
    if (!ab) return null;
    if (typeof globalThis.packRowForAbility === 'function') return globalThis.packRowForAbility(ab);
    if (typeof globalThis.resolveAbilityCombatRow === 'function') return globalThis.resolveAbilityCombatRow(ab);
    var id = ab.id || ab;
    var p = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.combatPack;
    return p && p.skillTrees ? p.skillTrees[id] : null;
  }

  function enrichRow(row) {
    if (!row) return row;
    if (typeof globalThis.Avian !== 'undefined' && globalThis.Avian.combat && typeof globalThis.Avian.combat.enrichCombatRow === 'function') {
      return globalThis.Avian.combat.enrichCombatRow(row);
    }
    if (typeof globalThis.enrichCombatRow === 'function') return globalThis.enrichCombatRow(row);
    return row;
  }

  function conditionLabel(condition) {
    var map = {
      targetBleeding: 'Bleeding',
      targetBurning: 'Burning',
      targetWeakened: 'Weakened',
      targetLowHp: 'low HP',
      targetBloodied: 'Bloodied',
      targetChilled: 'Chilled',
      targetMarked: 'Marked',
    };
    return map[condition] || condition;
  }

  function formatConditionalPowerLine(row) {
    if (!row || !row.condition || row.conditionalAbilityPower == null) return '';
    var label = conditionLabel(row.condition);
    if (row.conditionalAbilityPowerMode === 'replace') {
      return 'If target is ' + label + ', Ability Power becomes ' + Number(row.conditionalAbilityPower).toFixed(2);
    }
    var pct = Math.round((Number(row.conditionalAbilityPower) - 1) * 100);
    if (pct > 0) return 'If target is ' + label + ', +' + pct + '% Ability Power';
    return '';
  }

  function isFluffLine(line) {
    return /^(Mutation:|Sparrow keeps|design note|currently equipped)/i.test(String(line || '').trim());
  }

  function linesFromDisplayText(displayText, skipName) {
    var lines = String(displayText || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (skipName && lines.length > 1) lines = lines.slice(1);
    return lines.filter(function (line) { return !isFluffLine(line); });
  }

  function generatedBriefLines(row) {
    if (!row) return [];
    enrichRow(row);
    var lines = [];
    if (row.noDamage) {
      lines.push((row.enCost || row.apCost || 1) + ' EN Utility');
    } else {
      lines.push((row.enCost || row.apCost || 1) + ' EN ' + String(row.damageType || 'Physical'));
      lines.push('Uses ' + String(row.damageStat || row.scaleStat || 'ATK') + '.');
      lines.push('Normal Ability Power: ' + (Number(row.abilityPower) || 0).toFixed(2));
    }
    var condLine = formatConditionalPowerLine(row);
    if (condLine) lines.push(condLine);
    if (row.ailment) {
      var aid = Array.isArray(row.ailment) ? row.ailment.join('/') : row.ailment;
      lines.push(String(aid) + ' ' + (row.ailmentChance || 0) + '%');
    }
    if ((row.heavyAccuracyPenalty || 0) > 0) lines.push('Heavy accuracy penalty: -' + row.heavyAccuracyPenalty + '.');
    if ((row.recoilPercent || 0) > 0) lines.push('Recoil: ' + Math.round(row.recoilPercent * 100) + '% of damage dealt.');
    if (row.hybridScaling) {
      var parts = [];
      for (var k in row.hybridScaling) {
        if (!Object.prototype.hasOwnProperty.call(row.hybridScaling, k)) continue;
        parts.push(Math.round((Number(row.hybridScaling[k]) || 0) * 100) + '% ' + k);
      }
      if (parts.length) lines.push('Uses ' + parts.join(' and ') + '.');
    }
    return lines;
  }

  function buildAbilityCombatBrief(ab, row) {
    row = enrichRow(resolveRow(ab, row));
    if (!row) return '';
    var displayLines = linesFromDisplayText(row.displayText, true);
    if (displayLines.length >= 2) {
      return displayLines.slice(0, 5).join('\n');
    }
    return generatedBriefLines(row).join('\n');
  }

  function buildAbilityCombatBriefHtml(ab, row) {
    var text = buildAbilityCombatBrief(ab, row);
    if (!text) return '';
    return text.split('\n').map(function (line) {
      return '<div class="btn-desc-line">' + (typeof globalThis.escapeHtmlRoster === 'function'
        ? globalThis.escapeHtmlRoster(line) : line) + '</div>';
    }).join('');
  }

  function familyLabel(row) {
    if (!row || !row.familyId) return '';
    return String(row.familyId).replace(/_FAMILY.*$/i, '').replace(/_/g, ' ');
  }

  function categoryLine(row) {
    if (!row) return '';
    var fam = familyLabel(row);
    var cat = String(row.category || row.damageType || 'physical').toUpperCase();
    if (fam) return fam + ' · ' + cat;
    return cat;
  }

  function mutationNote(row) {
    if (!row || !row.mutationStage) return '';
    return 'Mutation: Stage ' + row.mutationStage + ' mutated-feather version currently equipped.';
  }

  function buildAbilityTooltipDetail(ab, tmpl, row) {
    row = enrichRow(resolveRow(ab, row));
    tmpl = tmpl || null;
    var name = (tmpl && tmpl.name) || (row && row.name) || (ab && ab.name) || '';
    var parts = [];

    if (row && row.displayText) {
      parts.push(normalizeEnLabel(String(row.displayText)));
    } else {
      parts.push(name);
      parts.push((row && (row.enCost || row.apCost || 1)) + ' EN');
      var catLine = categoryLine(row);
      if (catLine) parts.push(catLine);
      var brief = buildAbilityCombatBrief(ab, row);
      if (brief) parts.push(brief);
      if (row && row.designNote) parts.push(row.designNote);
      var mut = mutationNote(row);
      if (mut) parts.push(mut);
    }

    if (row && row.riderText && row.displayText && !String(row.displayText).includes(row.riderText)) {
      parts.push('Rider: ' + normalizeEnLabel(row.riderText));
    }

    return normalizeEnLabel(parts.filter(Boolean).join('\n'));
  }

  function buildAbilityTooltipDetailHtml(ab, tmpl, row) {
    var text = buildAbilityTooltipDetail(ab, tmpl, row);
    if (!text) return '';
    var esc = typeof globalThis.escapeHtmlRoster === 'function' ? globalThis.escapeHtmlRoster : function (s) { return s; };
    return text.split('\n').map(function (line) {
      return esc(line);
    }).join('<br>');
  }

  var api = {
    buildAbilityCombatBrief: buildAbilityCombatBrief,
    buildAbilityCombatBriefHtml: buildAbilityCombatBriefHtml,
    buildAbilityTooltipDetail: buildAbilityTooltipDetail,
    buildAbilityTooltipDetailHtml: buildAbilityTooltipDetailHtml,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.abilityDisplay = api;
  globalThis.buildAbilityCombatBrief = buildAbilityCombatBrief;
  globalThis.buildAbilityCombatBriefHtml = buildAbilityCombatBriefHtml;
  globalThis.buildAbilityTooltipDetail = buildAbilityTooltipDetail;
  globalThis.buildAbilityTooltipDetailHtml = buildAbilityTooltipDetailHtml;
})();
