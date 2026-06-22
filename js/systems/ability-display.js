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

  // ---- effect colour helpers ------------------------------------------------
  // Stat palette mirrors the combat stats panel (css/main.css .stat-*).
  var STAT_COLORS = {
    atk: '#ff6e6e', matk: '#c995ff', def: '#7db4ff', mdef: '#b88cff',
    dodge: '#8fe8ff', mdodge: '#9fd1ff', acc: '#f3cf6d', spd: '#8ee889',
    cc: '#ffb880', cd: '#ffe08a', hp: '#c8a878',
  };
  var AILMENT_FALLBACK_COLORS = {
    chilled: '#7fd6ff', poison: '#4cb44c', toxic: '#2d8a2d', bleed: '#be384c',
    weaken: '#c9a840', paralyzed: '#c8c840', burning: '#dc641e', scorched: '#ff4500',
    frozen: '#a8d8ff', delayed: '#c850c8', blinded: '#888888', decreed: '#6f88c2',
    marked: '#e8c040',
  };
  // Prose aliases -> canonical ailment id, longest spellings first.
  var AILMENT_PROSE = [
    ['scorched', 'scorched|scorch'],
    ['burning', 'burning|burns|burn'],
    ['chilled', 'chilled|chills|chill'],
    ['frozen', 'frozen|freeze'],
    ['poison', 'poisoned|poison'],
    ['toxic', 'toxic'],
    ['bleed', 'bleeding|bleeds|bleed'],
    ['weaken', 'weakened|weakness|weaken'],
    ['paralyzed', 'paralysed|paralyzed|paralyse|paralyze|paralysis'],
    ['blinded', 'blinded|blind'],
    ['delayed', 'delayed'],
    ['marked', 'marked'],
    ['decreed', 'decreed'],
  ];

  function ailmentColor(id) {
    var key = String(id || '').toLowerCase();
    var A = globalThis.AILMENTS;
    if (A && A[key] && A[key].color) return A[key].color;
    return AILMENT_FALLBACK_COLORS[key] || null;
  }
  function ailmentName(id) {
    var key = String(id || '').toLowerCase();
    var A = globalThis.AILMENTS;
    if (A && A[key] && A[key].name) return A[key].name;
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
  }
  function statColorForName(stat) {
    var s = String(stat || '').toLowerCase().replace(/[^a-z]/g, '');
    if (s === 'accuracy') s = 'acc';
    if (s === 'critchance' || s === 'crit') s = 'cc';
    if (s === 'critdamage' || s === 'critdmg') s = 'cd';
    if (s === 'speed') s = 'spd';
    if (s === 'attack') s = 'atk';
    if (s === 'magicattack') s = 'matk';
    if (s === 'defence' || s === 'defense') s = 'def';
    if (s === 'magicdefence' || s === 'magicdefense') s = 'mdef';
    return STAT_COLORS[s] || null;
  }
  function whenSuffix(when) {
    if (!when || when === 'onHit') return '';
    if (when === 'actingFirst') return ' if faster';
    if (when === 'afterMagicThisTurn') return ' after a Song';
    if (String(when).indexOf('onAilment:') === 0) {
      var aid = String(when).slice('onAilment:'.length);
      return ' if ' + ailmentName(aid) + ' applies';
    }
    return '';
  }
  function pctOf(v) {
    var n = Number(v) || 0;
    if (n > 0 && n <= 1) return Math.round(n * 100);
    return n;
  }
  function riderSegment(r) {
    if (!r) return null;
    var v = Number(r.value) || 0;
    var w = whenSuffix(r.when);
    function seg(text, statKey) { return { text: text, color: statKey ? STAT_COLORS[statKey] : null }; }
    switch (r.kind) {
      case 'gainDodge': return seg('+' + v + '% Dodge' + w, 'dodge');
      case 'gainDodgeFlat': return seg('+' + v + ' Dodge' + w, 'dodge');
      case 'gainAcc': return seg('+' + v + '% ACC' + w, 'acc');
      case 'gainAccFlat': return seg('+' + v + ' ACC' + w, 'acc');
      case 'gainSpeed': return seg('+' + v + '% Speed' + w, 'spd');
      case 'gainCritChance': return seg('+' + v + '% Crit Chance' + w, 'cc');
      case 'gainCritDamage': return seg('+' + pctOf(v) + '% Crit Damage' + w, 'cd');
      case 'gainAtk': return seg('+' + v + '% Attack' + w, 'atk');
      case 'gainMatk': return seg('+' + v + '% Magic Attack' + w, 'matk');
      case 'gainDef': return seg('+' + v + '% Defence' + w, 'def');
      case 'gainMdef': return seg('+' + v + '% Magic Defence' + w, 'mdef');
      case 'gainGuard': return seg('Guard' + w, 'def');
      case 'gainGuarded':
      case 'gainBrace': return v > 0 ? seg(v + '% Damage Reduction' + w, 'def') : seg('Brace' + w, 'def');
      case 'gainCounter': return seg('Counter' + w, null);
      case 'gainTaunt': return seg('Taunt' + w, null);
      case 'reduceEnemyDodge': return seg('Enemy -' + v + '% Dodge' + w, 'dodge');
      case 'reduceEnemyAcc': return seg('Enemy -' + v + '% ACC' + w, 'acc');
      case 'reduceEnemyAtk': return seg('Enemy -' + v + '% Attack' + w, 'atk');
      case 'reduceEnemyMatk': return seg('Enemy -' + v + '% Magic Attack' + w, 'matk');
      case 'reduceEnemySpd': return seg('Enemy -' + v + '% Speed' + w, 'spd');
      case 'reduceEnemyCrit': return seg('Enemy -' + v + '% Crit Chance' + w, 'cc');
      case 'reduceEnemyDef': return seg('Enemy -' + v + '% Defence' + w, 'def');
      case 'reduceEnemyMdef': return seg('Enemy -' + v + '% Magic Defence' + w, 'mdef');
      case 'healMaxHpPct': return seg('Heal ' + v + '% Max HP' + w, 'hp');
      case 'gainApNextTurn': return seg('+' + v + ' EN next turn' + w, null);
      case 'refundApOnCrit': return seg('Refund 1 EN on crit', null);
      default: return null;
    }
  }
  function ailmentSegments(row) {
    if (!row || !row.ailment) return [];
    var ids = Array.isArray(row.ailment) ? row.ailment : [row.ailment];
    var chance = row.ailmentChance || 0;
    var out = [];
    ids.filter(Boolean).forEach(function (id) {
      out.push({ text: ailmentName(id) + ' ' + chance + '%', color: ailmentColor(id) });
    });
    return out;
  }
  function riderSegments(row) {
    var rs = (row && row.riders) || [];
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < rs.length; i++) {
      var s = riderSegment(rs[i]);
      if (!s || seen[s.text]) continue;
      seen[s.text] = 1;
      out.push(s);
    }
    return out;
  }
  function escHtml(s) {
    return typeof globalThis.escapeHtmlRoster === 'function' ? globalThis.escapeHtmlRoster(s) : String(s);
  }
  function segToHtml(seg) {
    var t = escHtml(seg.text);
    if (seg.color) return '<div class="btn-desc-line"><span style="color:' + seg.color + '">' + t + '</span></div>';
    return '<div class="btn-desc-line">' + t + '</div>';
  }
  /** Wrap known ailment + buff/debuff phrases in coloured spans (escaped input). */
  function colorizeEffectKeywords(escaped) {
    if (!escaped) return escaped;
    var out = String(escaped);
    AILMENT_PROSE.forEach(function (pair) {
      var color = ailmentColor(pair[0]);
      if (!color) return;
      var re = new RegExp('\\b(' + pair[1] + ')\\b', 'gi');
      out = out.replace(re, function (m) { return '<span style="color:' + color + '">' + m + '</span>'; });
    });
    out = out.replace(
      /\b(Minor|Major|Grand|Epic|Severe|Critical|Lethal|Legendary)\s+(ACC|Accuracy|Dodge|Crit\s+Chance|Crit\s+Damage|Speed|Magic\s+Attack|Attack|Magic\s+Defence|Magic\s+Defense|Defence|Defense)\s+(Up|Down)\b/gi,
      function (m, _tier, stat) {
        var c = statColorForName(stat);
        return c ? '<span style="color:' + c + '">' + m + '</span>' : m;
      }
    );
    return out;
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
    var s = String(line || '').trim();
    if (!s) return true;
    if (/^Mutation:/i.test(s)) return true;
    if (/mutated-feather version currently equipped/i.test(s)) return true;
    if (/ keeps a /i.test(s) && !/^If /i.test(s)) return true;
    return false;
  }

  function isMechanicalBriefLine(line) {
    var s = String(line || '').trim();
    if (!s || isFluffLine(s)) return false;
    return /^\d+\s*EN\b/i.test(s)
      || /^Uses /i.test(s)
      || /Ability Power:/i.test(s)
      || /^If target is /i.test(s)
      || /^If used after /i.test(s)
      || /^If faster than /i.test(s)
      || /^Normal Ability Power:/i.test(s)
      || /^(bleed|burning|weaken|chilled|poison|delayed|paralyzed)\b/i.test(s)
      || /^Heavy accuracy penalty:/i.test(s)
      || /^Recoil:/i.test(s);
  }

  function mechanicalLinesFromDisplayText(displayText, skipName) {
    var lines = linesFromDisplayText(displayText, skipName);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (isFluffLine(line)) break;
      if (isMechanicalBriefLine(line)) out.push(line);
      else if (/^If /i.test(line)) out.push(line);
    }
    return out;
  }

  function briefLinesToHtml(lines) {
    if (!lines || !lines.length) return '';
    return lines.map(function (line) {
      return '<div class="btn-desc-line">' + (typeof globalThis.escapeHtmlRoster === 'function'
        ? globalThis.escapeHtmlRoster(line) : line) + '</div>';
    }).join('');
  }

  function briefTextToHtml(text) {
    if (!text) return '';
    return text.split('\n').map(function (line) {
      return '<div class="btn-desc-line">' + (typeof globalThis.escapeHtmlRoster === 'function'
        ? globalThis.escapeHtmlRoster(line) : line) + '</div>';
    }).join('');
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
    var generated = generatedBriefLines(row);
    if (generated.length >= 2) return generated.slice(0, 6).join('\n');
    var mechanical = mechanicalLinesFromDisplayText(row.displayText, true);
    if (mechanical.length >= 2) return mechanical.slice(0, 6).join('\n');
    if (generated.length) return generated.join('\n');
    return mechanical.join('\n');
  }

  function buildAbilityCombatBriefHtml(ab, row) {
    return briefTextToHtml(buildAbilityCombatBrief(ab, row));
  }

  function formatTemplateCombatBriefHtml(tmpl) {
    if (!tmpl) return '';
    var text = normalizeEnLabel(String(tmpl.combatBrief || '').trim());
    if (text) return briefTextToHtml(text);
    return '';
  }

  function formatAbilityBlurbHtml(ab, tmpl, row) {
    row = row || resolveRow(ab, null);
    tmpl = tmpl || null;
    var fromRow = buildAbilityCombatBriefHtml(ab, row);
    if (fromRow) return fromRow;
    var fromTmpl = formatTemplateCombatBriefHtml(tmpl);
    if (fromTmpl) return fromTmpl;
    var generated = generatedBriefLines(enrichRow(resolveRow(ab, row)));
    if (generated.length) return briefLinesToHtml(generated.slice(0, 6));
    return '';
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
    formatTemplateCombatBriefHtml: formatTemplateCombatBriefHtml,
    formatAbilityBlurbHtml: formatAbilityBlurbHtml,
    buildAbilityTooltipDetail: buildAbilityTooltipDetail,
    buildAbilityTooltipDetailHtml: buildAbilityTooltipDetailHtml,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.abilityDisplay = api;
  globalThis.buildAbilityCombatBrief = buildAbilityCombatBrief;
  globalThis.buildAbilityCombatBriefHtml = buildAbilityCombatBriefHtml;
  globalThis.formatTemplateCombatBriefHtml = formatTemplateCombatBriefHtml;
  globalThis.formatAbilityBlurbHtml = formatAbilityBlurbHtml;
  globalThis.buildAbilityTooltipDetail = buildAbilityTooltipDetail;
  globalThis.buildAbilityTooltipDetailHtml = buildAbilityTooltipDetailHtml;
})();
