/* Parse ability rider/condition text from combat-pack rows (runtime enrichment). */
(function () {
  'use strict';

  function mergeAbilityText(row) {
    if (!row) return '';
    return [row.riderText, row.shortDesc, row.displayText].filter(function (s) {
      return s && String(s).trim() && !/^none$/i.test(String(s).trim());
    }).join('\n');
  }

  function sentenceAround(text, slice) {
    var t = String(text || '');
    var s = String(slice || '');
    if (!s) return t;
    var lower = t.toLowerCase();
    var idx = lower.indexOf(s.toLowerCase());
    if (idx < 0) return s;
    var start = Math.max(t.lastIndexOf('.', idx), t.lastIndexOf('!', idx), t.lastIndexOf('?', idx));
    start = start < 0 ? 0 : start + 1;
    var after = idx + s.length;
    var endDots = [t.indexOf('.', after), t.indexOf('!', after), t.indexOf('?', after)].filter(function (n) {
      return n >= 0;
    });
    var end = endDots.length ? Math.min.apply(null, endDots) : t.length;
    return t.slice(start, end);
  }

  function parseRiderWhen(text, localSlice) {
    var combined = localSlice ? sentenceAround(text, localSlice) : String(text || '');
    if (/if (?:a |the )?debuff is cleansed|if (?:you )?cleansed/i.test(combined)) return 'ifCleansed';
    if (/blocked while the target has magic armour|blocked by magic armour|while the target has magic armour/i.test(combined)) {
      return 'ifTargetNoMagicArmour';
    }
    if (/blocked while the target has armour|blocked by armour(?!\s+restoration)/i.test(combined)) return 'ifTargetNoArmour';
    if (/if (?:the effect |it )?reaches health/i.test(combined)) return 'reachedHealth';
    if (/higher Agility than the target|user has higher Agility|faster than the target|acting before the target|act before the target|if you act before/i.test(combined)) {
      return /higher Agility|user has higher Agility/i.test(combined) ? 'userFaster' : 'actingFirst';
    }
    if (/[Dd]odged the opponent|[Dd]odged (?:the )?(?:opponent|enemy)(?:['’]s)? previous/i.test(combined)) return 'dodgedLast';
    if (/(?:Magic\s+)?Armour is broken and Health is damaged/i.test(combined)) return 'reachedHealth';
    if (/\bon hit\b/i.test(combined) && /gain |apply |restore /i.test(combined)) return 'onHit';
    if (/after a magic ability|used after a magic|after using a magic ability|after a magic attack/i.test(combined)) return 'afterMagicThisTurn';
    if (/if both hit|both hits land|if both hits land/i.test(combined)) return 'allHitsLanded';
    if (/target is already delayed|already delayed/i.test(combined)) return 'targetDelayed';
    if (/target is weakened|target has weaken/i.test(combined)) return 'targetWeakened';
    if (/target has an ailment|the target has an ailment/i.test(combined)) return 'targetHasAilment';
    if (/if it fails|when it fails|if the ailment fails/i.test(combined)) return 'onAilmentFail';
    if (/alternating attack type|alternated attack type/i.test(combined)) return 'alternatingAttackType';
    if (/target misses before your next turn|if the target misses before/i.test(combined)) return 'onEnemyMissBeforeTurn';
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
    if (/guard\s+is\s+(?:already\s+)?active|already\s+guarded|while\s+guard(?:ing)?|if\s+(?:you\s+)?(?:are\s+)?(?:already\s+)?guard(?:ing)?|while\s+guarded/i.test(combined)) return 'guardActive';
    if (/guard\s+is\s+not\s+active|(?:if|when)\s+(?:you\s+)?(?:do\s+not|don't|are\s+not)\s+(?:have\s+)?guard|(?:otherwise|instead|else)\s+gain\s+(?:a\s+)?(?:minor|major|grand|epic|legendary|moderate\s+)?guard/i.test(combined)) return 'guardInactive';
    if (/(?:have|has|with)\s+(?:a\s+)?(?:active\s+)?shield|shield\s+is\s+(?:already\s+)?active|while\s+shielded/i.test(combined)) return 'shieldActive';
    if (/shield\s+is\s+not\s+active|(?:if|when)\s+(?:you\s+)?(?:do\s+not|don't|have\s+no)\s+(?:have\s+)?(?:a\s+)?shield/i.test(combined)) return 'shieldInactive';
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
    return [r.kind, r.when || '', r.value || '', r.ailment || '', r.scope || '', r.guardTier || ''].join('|');
  }

  function riderKindScopeKey(r) {
    return [r.kind, r.scope || '', r.ailment || '', r.guardTier || '', r.mark || ''].join('|');
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

  function normalizeTierLabel(tier) {
    return String(tier || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  var V06_TIER_FALLBACK = { minor: 6, moderate: 8, major: 12 };
  var LEGACY_TIER_ALIAS = {
    grand: 'major', epic: 'major', legendary: 'major',
    crippling: 'major', ruinous: 'major', fatal: 'major',
    severe: 'major', critical: 'major', lethal: 'major'
  };

  function resolveTierKey(tier) {
    var key = normalizeTierLabel(tier);
    if (!key) return 'minor';
    if (V06_TIER_FALLBACK[key] != null) return key;
    return LEGACY_TIER_ALIAS[key] || key;
  }

  function tierBuffPctValue(tier) {
    var buff = (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers && globalThis.Avian.data.effectTiers.buff)
      || V06_TIER_FALLBACK;
    var key = resolveTierKey(tier);
    return buff[key] != null ? buff[key] : (V06_TIER_FALLBACK[key] != null ? V06_TIER_FALLBACK[key] : null);
  }

  function tierDebuffPctValue(tier) {
    var debuff = (globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers && globalThis.Avian.data.effectTiers.debuff)
      || V06_TIER_FALLBACK;
    var key = resolveTierKey(tier);
    return debuff[key] != null ? debuff[key] : (V06_TIER_FALLBACK[key] != null ? V06_TIER_FALLBACK[key] : null);
  }

  function tierBuffPct(tier) {
    return tierBuffPctValue(tier);
  }

  function tierDebuffPct(tier) {
    return tierDebuffPctValue(tier);
  }

  function isTierGuardPhrase(slice) {
    return /(minor|moderate|major|grand|epic|legendary)\s+guard\b/i.test(String(slice || ''));
  }

    var NAMED_AILMENT =
    'Bleed|Burn|Scorched|Poison|Toxic|Chilled|Frost|Shock|Paralys(?:ed|ed)?|Weakened|Weaken'
    + '|Fear|Confused|Fracture|Shattered|Crippled|Immobilis(?:ed|ed)|Dazed|Concussed';

  function normalizeAilmentId(raw) {
    var s = String(raw || '').toLowerCase().trim();
    if (!s) return null;
    if (/^bleed/.test(s)) return 'bleed';
    if (/^burn|^scorch/.test(s)) return 'burning';
    if (/^poison|^toxic|^venom/.test(s)) return 'poison';
    if (/^chill|^frost|^frozen/.test(s)) return 'chilled';
    if (/^shock/.test(s)) return 'shock';
    if (/^paralys|^paraly/.test(s)) return 'paralyzed';
    if (/^weakened/.test(s)) return 'weakened';
    if (/^weaken/.test(s)) return 'weaken';
    if (/^fear/.test(s)) return 'feared';
    if (/^confus/.test(s)) return 'confused';
    if (/^delay/.test(s)) return 'delayed';
    if (/^blind/.test(s)) return 'blinded';
    if (/^fracture|^shatter/.test(s)) return 'fracture';
    if (/^crippl/.test(s)) return 'crippled';
    if (/^immobilis|^immobiliz/.test(s)) return 'immobilised';
    if (/^dazed|^daze/.test(s)) return 'dazed';
    if (/^concuss/.test(s)) return 'concussed';
    return s;
  }

  /**
   * Parse skill rider text for ailment rolls:
   * "roll a 50% chance to apply Bleed", "On hit, apply 1 Poison stack",
   * "If Armour is broken … apply 2 Fracture stacks",
   * "Orb's ailment", "weapon's magical ailment chance".
   */
  function parseAilmentFieldsFromText(row, text) {
    if (!row) return;
    var t = String(text || '');
    if (!t) return;

    if (/both hits damage Health/i.test(t)) {
      row.ailmentRequireBothHitsHealth = true;
    }

    var guaranteed = t.match(new RegExp(
      '(?:On hit,?\\s*)?apply\\s+(\\d+)\\s+(' + NAMED_AILMENT + ')\\s+stacks?',
      'i'
    ));
    if (guaranteed) {
      if (!row.ailment) row.ailment = normalizeAilmentId(guaranteed[2]);
      if (!(row.ailmentChance > 0)) row.ailmentChance = 100;
      if (!(row.ailmentStacks > 0)) row.ailmentStacks = Number(guaranteed[1]) || 1;
      return;
    }

    var orbChance = t.match(/(\d+(?:\.\d+)?)\s*%\s*chance to apply(?:\s+\d+\s+stacks?)?\s+(?:of\s+)?(?:the\s+)?Orb['’]?s\s+ailment/i);
    if (orbChance) {
      if (!(row.ailmentChance > 0)) row.ailmentChance = Number(orbChance[1]) || 60;
      row.ailmentFromOrb = true;
      return;
    }

    if (/roll the weapon['’]?s magical ailment chance/i.test(t)) {
      row.ailmentFromWeapon = true;
      if (!(row.ailmentChance > 0)) row.ailmentChance = 50;
      return;
    }

    var rollNamed = t.match(new RegExp(
      '(\\d+(?:\\.\\d+)?)\\s*%\\s*chance to apply\\s+(?:(\\d+)\\s+stacks?\\s+of\\s+)?(' + NAMED_AILMENT + ')\\b',
      'i'
    ));
    if (rollNamed) {
      if (!row.ailment) row.ailment = normalizeAilmentId(rollNamed[3]);
      if (!(row.ailmentChance > 0)) row.ailmentChance = Number(rollNamed[1]) || 0;
      if (rollNamed[2] && !(row.ailmentStacks > 0)) row.ailmentStacks = Number(rollNamed[2]) || 1;
    }
  }

  function parseHybridFieldsFromText(row, text) {
    if (!row || !text) return;
    if (!row.hybridScaling) {
      var hsM = text.match(/Uses\s+(\d+(?:\.\d+)?)\s*%\s*ATK\s+and\s+(\d+(?:\.\d+)?)\s*%\s*MATK/i);
      if (hsM) {
        row.hybridScaling = { ATK: Number(hsM[1]) / 100, MATK: Number(hsM[2]) / 100 };
      }
    }
    if (!row.hybridPerHit && /First hit uses ATK,\s*second uses MATK/i.test(text)) {
      row.hybridPerHit = true;
    }
    if (!row.lifestealPct) {
      var lsM = text.match(/(?:Heal for |)(Minor|Major|Grand|Epic|Legendary)\s+Lifesteal/i);
      if (lsM) {
        var lp = tierBuffPct(lsM[1]);
        if (lp != null) row.lifestealPct = lp;
      }
      if (!row.lifestealPct) {
        var lsDm = text.match(/Heal for\s+(\d+(?:\.\d+)?)\s*%\s*of damage dealt/i)
          || text.match(/heal(?:s| Health)?(?: equal to)?\s+(\d+(?:\.\d+)?)\s*%\s*of(?: Health)? damage dealt/i);
        if (lsDm) row.lifestealPct = Number(lsDm[1]);
      }
    }
    parseAilmentFieldsFromText(row, text);
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
    for (var gd2 of t.matchAll(/\band\s+\+?\s*(\d+(?:\.\d+)?)\s+Dodge(?!\s*%)/gi)) {
      addSelf('gainDodgeFlat', Number(gd2[1]), { when: parseRiderWhen(t, gd2[0]) });
    }

    // Percentage self gains. Skip matches that sit inside an enemy-debuff
    // clause ("Enemy loses 8% Speed") so the player isn't buffed by mistake.
    function inEnemyLossClause(idx) {
      var pre = t.slice(Math.max(0, idx - 28), idx);
      return /enemy\s+loses|reduce\s+enemy/i.test(pre);
    }
    for (var gm2 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:ACC|Accuracy)/gi)) { if (!inEnemyLossClause(gm2.index)) addSelf('gainAcc', Number(gm2[1]), { when: parseRiderWhen(t, gm2[0]) }); }
    for (var gm3 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) { if (!inEnemyLossClause(gm3.index)) addSelf('gainDodge', Number(gm3[1]), { when: parseRiderWhen(t, gm3[0]) }); }
    for (var gm4 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Speed|SPD)\b/gi)) { if (!inEnemyLossClause(gm4.index)) addSelf('gainSpeed', Number(gm4[1])); }
    for (var gm5 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/gi)) { if (!inEnemyLossClause(gm5.index)) addSelf('gainCritChance', Number(gm5[1])); }
    for (var gm6 of t.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Damage/gi)) { if (!inEnemyLossClause(gm6.index)) addSelf('gainCritDamage', Number(gm6[1])); }

    // Named magnitude tiers (point stats: Precision / Evasion / Crit)
    for (var nm1 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+(?:ACC|Precision)\s+Up\b/gi)) {
      var n1 = resolveMagnitude('acc', 'up', nm1[1]); if (n1 != null) addSelf('gainAcc', n1);
      else { var n1b = tierBuffPct(nm1[1]); if (n1b != null) addSelf('gainAcc', n1b); }
    }
    for (var nm3 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+(?:Dodge|Evasion)\s+Up\b/gi)) {
      var n3 = resolveMagnitude('dodge', 'up', nm3[1]); if (n3 != null) addSelf('gainDodge', n3);
      else { var n3b = tierBuffPct(nm3[1]); if (n3b != null) addSelf('gainDodge', n3b); }
    }
    for (var nm5 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Crit\s+Chance\s+Up\b/gi)) {
      var n5 = resolveMagnitude('critChance', 'up', nm5[1]); if (n5 != null) addSelf('gainCritChance', n5);
      else { var n5b = tierBuffPct(nm5[1]); if (n5b != null) addSelf('gainCritChance', n5b); }
    }
    for (var nm6 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Crit\s+Damage\s+Up\b/gi)) {
      var n6 = resolveMagnitude('critDamage', 'up', nm6[1]); if (n6 != null) addSelf('gainCritDamage', n6);
      else { var n6b = tierBuffPct(nm6[1]); if (n6b != null) addSelf('gainCritDamage', n6b); }
    }

    // Combined ATK + MATK gains (+8% ATK and MATK, +12% ATK/MATK)
    for (var atkMatk of t.matchAll(/(?:gain|grants?)\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*ATK\s*(?:and|\/)?\s*MATK/gi)) {
      var amV = Number(atkMatk[1]);
      var amWhen = parseRiderWhen(t, atkMatk[0]);
      addSelf('gainAtk', amV, { when: amWhen });
      addSelf('gainMatk', amV, { when: amWhen });
    }
    for (var accAnd of t.matchAll(/\band\s+\+?\s*(\d+(?:\.\d+)?)\s+(?:ACC|Accuracy)(?!\s*%)/gi)) {
      addSelf('gainAccFlat', Number(accAnd[1]), { when: parseRiderWhen(t, accAnd[0]) });
    }
    for (var statAnd of t.matchAll(/\band\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(ATK|MATK|DEF|MDEF)\b/gi)) {
      var statMap = { ATK: 'gainAtk', MATK: 'gainMatk', DEF: 'gainDef', MDEF: 'gainMdef' };
      var sk = statMap[String(statAnd[2]).toUpperCase()];
      if (sk) addSelf(sk, Number(statAnd[1]), { when: parseRiderWhen(t, statAnd[0]) });
    }

    // Tier-based buffs: legacy ATK/MATK/DEF/MDEF + v0.6 Might/Focus/Guard/Resolve/Agility/Evasion
    var tierWord = '(Minor|Moderate|Major|Grand|Epic|Legendary)';
    var statBuffMap = [
      { re: new RegExp('\\b' + tierWord + '\\s+(?:Physical\\s+)?(?:ATK|Might)\\s+Up\\b', 'gi'), kind: 'gainAtk' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:Magic\\s+)?(?:MATK|Focus)\\s+Up\\b', 'gi'), kind: 'gainMatk' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:DEF|Guard)\\s+Up\\b', 'gi'), kind: 'gainDef' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:MDEF|Resolve)\\s+Up\\b', 'gi'), kind: 'gainMdef' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:SPD|Agility)\\s+Up\\b', 'gi'), kind: 'gainSpeed' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:DEX|Dexterity)\\s+Up\\b', 'gi'), kind: 'gainDex' },
      { re: new RegExp('\\b' + tierWord + '\\s+(?:Martial\\s+)?Damage\\s+Up\\b', 'gi'), kind: 'gainAtk' },
    ];
    for (var sbi = 0; sbi < statBuffMap.length; sbi++) {
      var sb = statBuffMap[sbi];
      for (var sbm of t.matchAll(sb.re)) {
        var sbV = tierBuffPct(sbm[1]);
        if (sbV != null) addSelf(sb.kind, sbV, { when: parseRiderWhen(t, sbm[0]) });
      }
    }

    // Conditional ailment-based self buffs
    for (var ailMatk of t.matchAll(/if the target has an ailment,\s*gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*MATK/gi)) {
      addSelf('gainMatk', Number(ailMatk[1]), { when: 'targetHasAilment' });
    }
    for (var ailAtk of t.matchAll(/if the target has an ailment,\s*gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*ATK/gi)) {
      addSelf('gainAtk', Number(ailAtk[1]), { when: 'targetHasAilment' });
    }
    // Tier-based debuffs (legacy + v0.6 Resolve/Guard/Might/Focus Down)
    var debuffWord = '(Minor|Moderate|Major|Crippling|Ruinous|Fatal|Severe|Critical|Lethal|Grand|Epic|Legendary)';
    var statDebuffMap = [
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:MDEF|Resolve)\\s+Down\\b', 'gi'), kind: 'reduceEnemyMdef' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:DEF|Guard)\\s+Down\\b', 'gi'), kind: 'reduceEnemyDef' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:ATK|Might|Damage)\\s+Down\\b', 'gi'), kind: 'reduceEnemyAtk' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:MATK|Focus)\\s+Down\\b', 'gi'), kind: 'reduceEnemyMatk' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:SPD|Agility)\\s+Down\\b', 'gi'), kind: 'reduceEnemySpd' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:ACC|Precision)\\s+Down\\b', 'gi'), kind: 'reduceEnemyAcc' },
      { re: new RegExp('\\b(?:Apply|apply)?\\s*' + debuffWord + '\\s+(?:Dodge|Evasion)\\s+Down\\b', 'gi'), kind: 'reduceEnemyDodge' },
    ];
    for (var sdi = 0; sdi < statDebuffMap.length; sdi++) {
      var sd = statDebuffMap[sdi];
      for (var sdm of t.matchAll(sd.re)) {
        var sdV = tierDebuffPct(sdm[1]);
        if (sdV != null) addEnemy(sd.kind, sdV, { when: parseRiderWhen(t, sdm[0]) });
      }
    }

    // "reduce MDEF by 8%" style clauses
    for (var redMdef of t.matchAll(/reduce\s+(?:enemy\s+)?MDEF\s+by\s+(\d+(?:\.\d+)?)\s*%/gi)) {
      addEnemy('reduceEnemyMdef', Number(redMdef[1]), { when: parseRiderWhen(t, redMdef[0]) });
    }
    for (var redDef of t.matchAll(/reduce\s+(?:enemy\s+)?DEF\s+by\s+(\d+(?:\.\d+)?)\s*%/gi)) {
      addEnemy('reduceEnemyDef', Number(redDef[1]), { when: parseRiderWhen(t, redDef[0]) });
    }
    for (var redMdef2 of t.matchAll(/reduces?\s+MDEF\s+by\s+(\d+(?:\.\d+)?)\s*%/gi)) {
      addEnemy('reduceEnemyMdef', Number(redMdef2[1]), { when: parseRiderWhen(t, redMdef2[0]) });
    }

    for (var gm7 of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/gi)) addSelf('gainMatk', Number(gm7[1]));
    for (var gm8 of t.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Magic\s*Defen[cs]e/gi)) addSelf('gainMdef', Number(gm8[1]));
    for (var gm9 of t.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e(?!\s*and)/gi)) {
      if (!/Magic\s*Defen/i.test(gm9[0])) addSelf('gainDef', Number(gm9[1]));
    }
    for (var gm10 of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Physical\s*)?Attack(?!\s*Damage)/gi)) {
      if (!/Magic\s*Attack/i.test(gm10[0])) addSelf('gainAtk', Number(gm10[1]));
    }
    for (var gAtk of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*ATK\b/gi)) {
      addSelf('gainAtk', Number(gAtk[1]), { when: parseRiderWhen(t, gAtk[0]) });
    }
    for (var gMatk of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*MATK\b/gi)) {
      addSelf('gainMatk', Number(gMatk[1]), { when: parseRiderWhen(t, gMatk[0]) });
    }
    for (var gDef of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*DEF\b/gi)) {
      addSelf('gainDef', Number(gDef[1]), { when: parseRiderWhen(t, gDef[0]) });
    }
    for (var gMdef of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*MDEF\b/gi)) {
      addSelf('gainMdef', Number(gMdef[1]), { when: parseRiderWhen(t, gMdef[0]) });
    }
    for (var redEAtk of t.matchAll(/reduce\s+enemy\s+ATK\s+by\s+(\d+(?:\.\d+)?)\s*%/gi)) {
      addEnemy('reduceEnemyAtk', Number(redEAtk[1]), { when: parseRiderWhen(t, redEAtk[0]) });
    }
    for (var redEMatk of t.matchAll(/reduce\s+enemy\s+MATK\s+by\s+(\d+(?:\.\d+)?)\s*%/gi)) {
      addEnemy('reduceEnemyMatk', Number(redEMatk[1]), { when: parseRiderWhen(t, redEMatk[0]) });
    }
    if (/guard break|reduce it by one strength level/i.test(t)) {
      riders.push({ kind: 'guardBreak', scope: 'enemy', when: when || 'onHit' });
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

    for (var ailMag of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Magical|Magic(?:al)?)\s+Ailment\s+chance/gi)) {
      addSelf('gainMagicAilmentChance', Number(ailMag[1]), { when: parseRiderWhen(t, ailMag[0]) });
    }
    for (var ailPhys of t.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*Physical\s+Ailment\s+chance/gi)) {
      addSelf('gainPhysicalAilmentChance', Number(ailPhys[1]), { when: parseRiderWhen(t, ailPhys[0]) });
    }
    for (var reAccFlat of t.matchAll(/reduce\s+enemy\s+ACC\s+by\s+(\d+(?:\.\d+)?)(?!\s*%)/gi)) {
      addEnemy('reduceEnemyAccFlat', Number(reAccFlat[1]), { when: parseRiderWhen(t, reAccFlat[0]) });
    }
    for (var suffAcc of t.matchAll(/suffer\s+-?\s*(\d+(?:\.\d+)?)\s+ACC/gi)) {
      addEnemy('reduceEnemyAccFlat', Number(suffAcc[1]));
    }

    for (var suffCombo of t.matchAll(/suffer\s+-?\s*(\d+(?:\.\d+)?)\s*%\s*MDEF\s+and\s+-?\s*(\d+(?:\.\d+)?)\s*(?:%\s*)?ACC/gi)) {
      addEnemy('reduceEnemyMdef', Number(suffCombo[1]));
      var accVal = Number(suffCombo[2]);
      if (/%/.test(suffCombo[0].slice(suffCombo[0].indexOf('ACC') - 5))) addEnemy('reduceEnemyAcc', accVal);
      else addEnemy('reduceEnemyAccFlat', accVal);
    }
    for (var nextAcc of t.matchAll(/next\s+(?:Physical|Magic|Heavy)\s+hit\s+gains?\s+\+?\s*(\d+(?:\.\d+)?)\s+(?:ACC|Accuracy)/gi)) {
      riders.push({ kind: 'gainAccNextHit', value: Number(nextAcc[1]), scope: 'self', when: parseRiderWhen(t) });
    }

    // Guarded stance / Brace — not the Guard stat ("Minor Guard Up/Down").
    for (var tg of t.matchAll(/\b(?:gain|gains?)\s+(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b(?!\s+(?:Up|Down))/gi)) {
      addSelf('gainGuarded', 0, { guardTier: normalizeTierLabel(tg[1]), when: parseRiderWhen(t, tg[0]) });
    }
    if (!hasRiderKind(riders, 'gainGuarded')) {
      for (var tg2 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b(?!\s+(?:Up|Down))/gi)) {
        addSelf('gainGuarded', 0, { guardTier: normalizeTierLabel(tg2[1]), when: parseRiderWhen(t, tg2[0]) });
        break;
      }
    }
    if (/\bguard\b/i.test(t) && /defen[cs]e/i.test(t) && !isTierGuardPhrase(t)) addSelf('gainGuard', 1);
    if (/^guard$/i.test(t.trim()) && !hasRiderKind(riders, 'gainGuarded') && !hasRiderKind(riders, 'gainGuard')) {
      addSelf('gainGuarded', 0, { guardTier: 'minor', when: when || 'onHit' });
    }
    var drM = t.match(/(\d+(?:\.\d+)?)\s*%\s*damage\s*reduction/i);
    if (drM) addSelf('gainGuarded', Number(drM[1]));
    else if (/brace|damage reduction/i.test(t) && !isTierGuardPhrase(t)) addSelf('gainGuarded', 0);
    for (var exg of t.matchAll(/\bexpose(?:s|d)?\s+(?:the\s+)?(?:enemy(?:'?s)?\s+)?guard\b|\bguard\s+exposed\b|\bexpose\s+guard\b/gi)) {
      var exPctM = t.match(/(?:take|deal|deals?|takes?)\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:more\s+)?damage/i)
        || t.match(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*damage(?:\s+taken)?/i);
      addEnemy('exposeGuard', exPctM ? Number(exPctM[1]) : 18, { when: parseRiderWhen(t, exg[0]) || 'onHit' });
    }
    for (var shDmg of t.matchAll(/gain a Shield equal to (\d+(?:\.\d+)?)\s*%\s*of damage dealt/gi)) {
      addSelf('gainShieldFromDamage', Number(shDmg[1]), { when: parseRiderWhen(t, shDmg[0]) });
    }

    // Protection pools (Armour / Magic Armour restore, Fortify, Ward, Bastion)
    if (!hasRiderKind(riders, 'bastion') && !hasRiderKind(riders, 'restoreArmour')
      && !hasRiderKind(riders, 'restoreMagicArmour') && !hasRiderKind(riders, 'restoreLowerPool')
      && !hasRiderKind(riders, 'fortify') && !hasRiderKind(riders, 'ward')) {
      var dualBastion = t.match(
        /(?:restore|gain)\s+(\d+)\s+(?:fortified\s+)?(?:armour|armor)(?:\s*\([^)]*\))?\s*(?:and|&|,)\s+(\d+)\s+(?:ward\s+)?magic\s+(?:armour|armor)/i
      ) || t.match(
        /gain\s+(\d+)\s+fortified\s+(?:armour|armor)(?:\s*\([^)]*\))?\s*(?:,?\s*and|,)\s*(\d+)\s+ward(?:\s+magic)?\s*(?:armour|armor)/i
      );
      var lowerPool = t.match(/restore\s+(\d+)\s+to\s+(?:the\s+)?(?:lower|whichever)\s+(?:protection\s+)?pool/i);
      var restoreBoth = t.match(/restore\s+(\d+)\s+(?:armour|armor)\s+and\s+(\d+)\s+magic\s+(?:armour|armor)/i);
      var restoreArm = t.match(/restore\s+(\d+)\s+(?:armour|armor)(?!\s+and\s+\d+\s+magic)/i);
      var restoreMag = t.match(/restore\s+(\d+)\s+magic\s+(?:armour|armor)/i);
      var fortifyM = t.match(/(?:gain|gains?)\s+(\d+)\s+fortified\s+(?:armour|armor)/i)
        || t.match(/\bfortify\s+(\d+)\b/i);
      var wardM = t.match(/(?:gain|gains?)\s+(\d+)\s+ward(?:\s+magic)?\s*(?:armour|armor)/i)
        || t.match(/\bward\s+(\d+)\b/i);
      if (dualBastion) {
        riders.push({
          kind: 'bastion',
          armour: Number(dualBastion[1]) || 0,
          magicArmour: Number(dualBastion[2]) || 0,
          value: Number(dualBastion[1]) || 0,
          turns: 2,
          scope: 'self',
          when: null,
        });
      } else if (lowerPool) {
        riders.push({ kind: 'restoreLowerPool', value: Number(lowerPool[1]) || 0, scope: 'self', when: null });
      } else if (restoreBoth) {
        riders.push({ kind: 'restoreArmour', value: Number(restoreBoth[1]) || 0, scope: 'self', when: null });
        riders.push({ kind: 'restoreMagicArmour', value: Number(restoreBoth[2]) || 0, scope: 'self', when: null });
      } else {
        if (restoreArm && !/fortified\s+(?:armour|armor)/i.test(restoreArm[0])) {
          riders.push({ kind: 'restoreArmour', value: Number(restoreArm[1]) || 0, scope: 'self', when: null });
        }
        if (restoreMag) {
          riders.push({ kind: 'restoreMagicArmour', value: Number(restoreMag[1]) || 0, scope: 'self', when: null });
        }
      }
      if (!hasRiderKind(riders, 'bastion')) {
        if (fortifyM) riders.push({ kind: 'fortify', value: Number(fortifyM[1]) || 0, turns: 2, scope: 'self', when: null });
        if (wardM) riders.push({ kind: 'ward', value: Number(wardM[1]) || 0, turns: 2, scope: 'self', when: null });
      }
    }

    var dealMag = t.match(/Deal\s+(\d+)\s+Magic\s+(?:Armour|Armor)\s+damage/i);
    var dealArm = t.match(/Deal\s+(\d+)\s+(?:Armour|Armor)\s+damage/i);
    if (dealMag && !hasRiderKind(riders, 'magicArmourDamage') && !hasRiderKind(riders, 'magicArmourRetaliateOnPhysical')) {
      if (/first enemy physical hit while Ward remains/i.test(t)) {
        riders.push({ kind: 'magicArmourRetaliateOnPhysical', value: Number(dealMag[1]) || 0, scope: 'self', when: null });
      } else {
        riders.push({ kind: 'magicArmourDamage', value: Number(dealMag[1]) || 0, scope: 'enemy', when: null });
      }
    } else if (dealArm && !hasRiderKind(riders, 'armourDamage') && !/Magic\s+(?:Armour|Armor)/i.test(dealArm[0])) {
      riders.push({ kind: 'armourDamage', value: Number(dealArm[1]) || 0, scope: 'enemy', when: null });
    }

    if (/Apply Jewel Mark/i.test(t) && !hasRiderKind(riders, 'applyMark')) {
      riders.push({ kind: 'applyMark', mark: 'jewel', turns: 2, value: 10, scope: 'enemy', when: null });
    }
    if (/Apply Predator Mark/i.test(t) && !hasRiderKind(riders, 'applyMark')) {
      riders.push({ kind: 'applyMark', mark: 'predator', turns: 2, value: 10, scope: 'enemy', when: null });
    }
    if (/Apply Carrion Mark/i.test(t) && !hasRiderKind(riders, 'applyMark')) {
      riders.push({ kind: 'applyMark', mark: 'carrion', turns: 2, scope: 'enemy', when: null });
    }

    if (/\bshield\b/i.test(t) && /temp|temporary|max\s*hp|max\s*health|health/i.test(t)) {
      var shM = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:max\s*)?(?:hp|health)/i);
      addSelf('gainShield', shM ? Number(shM[1]) : 0, { when: parseRiderWhen(t, shM ? shM[0] : t) });
    } else if (/\b(?:gain a |gain )\s*(minor|major|grand|epic|legendary|moderate)\s+shield\b/i.test(t)) {
      var shTierM = t.match(/\b(?:gain a |gain )\s*(minor|major|grand|epic|legendary|moderate)\s+shield\b/i);
      addSelf('gainShield', 0, { when: parseRiderWhen(t, shTierM ? shTierM[0] : t) });
    } else if (/\b(minor|major|grand|epic|legendary|moderate)\s+shield\b/i.test(t)) {
      var shTierM2 = t.match(/\b(minor|major|grand|epic|legendary|moderate)\s+shield\b/i);
      addSelf('gainShield', 0, { when: parseRiderWhen(t, shTierM2 ? shTierM2[0] : t) });
    } else if (/\b(?:gain|gains?)\s+(minor|major|grand|epic|legendary)\s+shield\b/i.test(t)) {
      var shTierM3 = t.match(/\b(?:gain|gains?)\s+(minor|major|grand|epic|legendary)\s+shield\b/i);
      addSelf('gainShield', 0, { when: parseRiderWhen(t, shTierM3 ? shTierM3[0] : t) });
    } else if (/\bgain\s+shield\b/i.test(t)) {
      var shPlainM = t.match(/\bgain\s+shield\b/i);
      addSelf('gainShield', 0, { when: parseRiderWhen(t, shPlainM ? shPlainM[0] : t) });
    }

    if (/if the target has a minor buff,\s*remove it/i.test(t)) {
      riders.push({ kind: 'purgeEnemyMinorBuff', scope: 'enemy', when: when || 'onHit' });
    }
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
    var skillPowerLow = t.match(/\+?\s*(\d+(?:\.\d+)?)\s+Skill Power if the target is below\s+(\d+(?:\.\d+)?)\s*%/i);
    if (skillPowerLow) {
      riders.push({
        kind: 'skillPowerThisHit',
        value: Number(skillPowerLow[1]) || 20,
        threshold: (Number(skillPowerLow[2]) || 30) / 100,
        when: 'targetLowHp',
        scope: 'self',
      });
    } else if (/low\s*HP|below\s+\d+%\s+Health|low-Health/i.test(t) && !/\+?\s*\d+\s+Skill Power/i.test(t)) {
      var lowM = t.match(/below\s+(\d+(?:\.\d+)?)\s*%/i);
      var lowPctM = t.match(/\+?\s*(\d+(?:\.\d+)?)\s*%(?!\s*(?:Finesse|Strength|Magic|weapon))/i);
      riders.push({
        kind: 'bonusVsLowHp',
        threshold: lowM ? Number(lowM[1]) / 100 : 0.35,
        value: lowPctM ? Number(lowPctM[1]) : 15,
      });
    }

    var dodgeSp = t.match(/\+?\s*(\d+(?:\.\d+)?)\s+Skill Power if the user [Dd]odged/i);
    if (dodgeSp) {
      riders.push({
        kind: 'skillPowerThisHit',
        value: Number(dodgeSp[1]) || 20,
        when: 'dodgedLast',
        scope: 'self',
      });
    }

    var precIfAgi = t.match(/\+?\s*(\d+(?:\.\d+)?)\s+Precision if the user has higher Agility/i);
    var precThis = t.match(/with\s+\+?\s*(\d+(?:\.\d+)?)\s+Precision/i);
    if (precIfAgi) {
      riders.push({ kind: 'gainAccThisHit', value: Number(precIfAgi[1]) || 10, when: 'userFaster', scope: 'self' });
    } else if (precThis && !hasRiderKind(riders, 'gainAccThisHit') && !hasRiderKind(riders, 'gainAccNextHit')) {
      riders.push({ kind: 'gainAccThisHit', value: Number(precThis[1]) || 10, scope: 'self', when: null });
    }

    var ignGuard = t.match(/ignore\s+(\d+(?:\.\d+)?)\s+Guard(?:\s+for this attack)?/i);
    if (ignGuard && !hasRiderKind(riders, 'ignoreGuardThisHit') && !hasRiderKind(riders, 'ignoreMatchingDefNextHit')) {
      riders.push({ kind: 'ignoreGuardThisHit', value: Number(ignGuard[1]) || 4, scope: 'self', when: null });
    }

    var armNext = t.match(/[Tt]he next (Strength|Magic|Finesse) skill[^.]*gains?\s+\+?\s*(\d+(?:\.\d+)?)\s+Skill Power/i);
    if (armNext) {
      var armGate = String(armNext[1]).toLowerCase();
      var armTurns = /end of the next turn/i.test(t) ? 2 : 1;
      var armPrec = t.match(/\+?\s*(\d+(?:\.\d+)?)\s+Precision/i);
      var armIgn = t.match(/ignores?\s+(\d+(?:\.\d+)?)\s+Guard/i);
      riders.push({
        kind: 'armNextSkill',
        value: Number(armNext[2]) || 10,
        gate: armGate,
        precision: armPrec ? Number(armPrec[1]) : 0,
        ignoreGuard: armIgn ? Number(armIgn[1]) : 0,
        turns: armTurns,
        scope: 'self',
        when: null,
      });
    }

    var rmStack = t.match(/remove\s+(\d+)\s+(Dazed|Crippled|Fracture) stack/i);
    if (rmStack) {
      riders.push({
        kind: 'removeAilmentStack',
        value: Number(rmStack[1]) || 1,
        ailment: String(rmStack[2]).toLowerCase(),
        scope: 'self',
        when: null,
      });
    }

    if (/reduce(?: its remaining)?(?: magical)?(?: stat)? debuff(?: remaining)? duration by\s+(\d+)/i.test(t)
      || /If affected by a magical stat debuff, reduce its remaining duration/i.test(t)) {
      var shM = t.match(/duration by\s+(\d+)/i);
      riders.push({
        kind: 'shortenMagicalDebuff',
        value: shM ? Number(shM[1]) : 1,
        scope: 'self',
        when: null,
      });
    }

    var resistApp = t.match(/reduce hostile magical ailment application chance by\s+(\d+)/i);
    if (resistApp) {
      riders.push({
        kind: 'resistMagicalAilmentApp',
        value: Number(resistApp[1]) || 10,
        turns: /for\s+2\s+turns/i.test(t) ? 2 : 2,
        scope: 'self',
        when: null,
      });
    }

    if (/next magical debuff applied has its duration reduced by\s+(\d+)/i.test(t)) {
      var ndM = t.match(/duration reduced by\s+(\d+)/i);
      riders.push({
        kind: 'nextMagicalDebuffShorter',
        value: ndM ? Number(ndM[1]) : 1,
        scope: 'self',
        when: null,
      });
    }

    if (/reduce application chance of the Orb['’]?s matching ailment by\s+(\d+)/i.test(t)) {
      var orbR = t.match(/by\s+(\d+)\s+percentage/i);
      riders.push({
        kind: 'resistOrbAilmentApp',
        value: orbR ? Number(orbR[1]) : 10,
        scope: 'self',
        when: null,
      });
    }

    if (/choose Might, Dexterity, or Focus/i.test(t)) {
      riders.push({ kind: 'chooseCoreStatUp', value: 4, turns: 2, scope: 'self', when: 'onHit' });
    }

    if (/resolve the Grimoire['’]?s selected rune/i.test(t)) {
      riders.push({ kind: 'resolveSourceRider', value: 0, source: 'grimoireRune', scope: 'self', when: 'onHit' });
    }

    var echoSplit = t.match(/Deal\s+(\d+(?:\.\d+)?)\s*% of this technique['’]?s total damage immediately and store\s+(\d+(?:\.\d+)?)\s*% as Delayed/i);
    if (echoSplit) {
      riders.push({
        kind: 'delayedDamageSplit',
        value: Number(echoSplit[2]) || 25,
        immediatePct: Number(echoSplit[1]) || 75,
        scope: 'enemy',
        when: 'onHit',
      });
    }

    var ignPct = t.match(/[Ii]gnore\s+(\d+(?:\.\d+)?)\s*%\s+(?:Guard or Resolve|Resolve)/i);
    if (ignPct) {
      riders.push({
        kind: 'piercePercentThisHit',
        value: Number(ignPct[1]) || 12,
        scope: 'self',
        when: null,
      });
    }

    if (/if the target has a debuff, heal for\s+(\d+(?:\.\d+)?)\s*%/i.test(t)) {
      var lsDeb = t.match(/heal for\s+(\d+(?:\.\d+)?)\s*%/i);
      riders.push({
        kind: 'lifestealIfDebuff',
        value: lsDeb ? Number(lsDeb[1]) : 10,
        scope: 'self',
        when: 'onHit',
      });
    }

    applyGuardShieldBranchWhen(riders, t);
    return riders;
  }

  function applyGuardShieldBranchWhen(riders, text) {
    if (!Array.isArray(riders) || !/if\s+guard[\s\S]{0,120}(?:otherwise|instead|else)[\s\S]{0,120}shield/i.test(String(text || ''))) return;
    riders.forEach(function (r) {
      if (!r || r.when) return;
      if (r.kind === 'gainGuarded' || r.kind === 'gainGuard') r.when = 'guardInactive';
      else if (r.kind === 'gainShield' || r.kind === 'gainShieldFromDamage') r.when = 'guardActive';
    });
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
    mapBonusVsLowHpToCondition(row);
  }

  function mapBonusVsLowHpToCondition(row) {
    if (!row || row.condition) return;
    if (!row.riders || !row.riders.length) return;
    for (var j = 0; j < row.riders.length; j++) {
      var lr = row.riders[j];
      if (lr.kind !== 'bonusVsLowHp') continue;
      row.condition = 'targetLowHp';
      row.conditionalAbilityPower = 1 + (Number(lr.value) || 15) / 100;
      row.conditionalAbilityPowerMode = row.conditionalAbilityPowerMode || 'multiply';
      break;
    }
  }

  function applyTextEnrichment(row) {
    if (!row || row._textEnriched) return row;
    var text = mergeAbilityText(row);
    parseHybridFieldsFromText(row, text);
    var cond = parseConditionalAbilityFromText(text);
    if (cond && cond.condition) {
      row.condition = cond.condition;
      row.conditionalAbilityPower = cond.conditionalAbilityPower;
      row.conditionalAbilityPowerMode = cond.conditionalAbilityPowerMode;
    }

    var supplemental = parseSupplementalRiders(text);
    row.riders = Array.isArray(row.riders) ? row.riders.slice() : [];
    var existing = Object.create(null);
    var existingKind = Object.create(null);
    row.riders.forEach(function (r) {
      existing[riderKey(r)] = true;
      existingKind[riderKindScopeKey(r)] = r;
    });
    supplemental.forEach(function (r) {
      if (r.kind === 'raw') return;
      var key = riderKey(r);
      var ks = riderKindScopeKey(r);
      if (existing[key]) return;
      var have = existingKind[ks];
      if (have) {
        /* Prefer a gated structured rider over an ungated text duplicate. */
        if (have.when && !r.when) return;
        if (!have.when && r.when) {
          var idx = row.riders.indexOf(have);
          if (idx >= 0) row.riders[idx] = r;
          existingKind[ks] = r;
          existing[riderKey(r)] = true;
        }
        return;
      }
      /* Dual-restore text must not add Bastion on top of restoreArmour + restoreMagicArmour.
         Incomplete bastion (value only, no Ward amount) is upgraded from text. */
      if (r.kind === 'bastion' && row.riders.some(function (x) {
        return x && (x.kind === 'restoreArmour' || x.kind === 'restoreMagicArmour');
      })) return;
      if (r.kind === 'bastion') {
        var existingBastion = row.riders.find(function (x) { return x && x.kind === 'bastion'; });
        if (existingBastion) {
          if (existingBastion.armour == null && existingBastion.magicArmour == null && (r.armour != null || r.magicArmour != null)) {
            existingBastion.armour = r.armour;
            existingBastion.magicArmour = r.magicArmour;
            if (r.value != null) existingBastion.value = r.value;
          }
          return;
        }
      }
      if ((r.kind === 'restoreArmour' || r.kind === 'restoreMagicArmour' || r.kind === 'restoreLowerPool')
        && row.riders.some(function (x) { return x && (x.kind === r.kind || x.kind === 'bastion'); })) return;
      row.riders.push(r);
      existing[key] = true;
      existingKind[ks] = r;
    });

    // Drop lone raw riders when supplemental parsing found handlers
    if (row.riders.length > 1) {
      row.riders = row.riders.filter(function (r) {
        return r.kind !== 'raw' || row.riders.length === 1;
      });
    }

    if (!row.riders.some(function (x) { return x && x.kind === 'skillPowerThisHit'; })) {
      mapBonusVsAilmentToCondition(row);
    }

    /* Unequal Fortify + Ward must not stay as a single equal bastion. */
    var fortWard = text.match(
      /Gain\s+(\d+)\s+Fortified\s+(?:Armour|Armor)[\s\S]{0,80}?(\d+)\s+Ward(?:\s+Magic)?\s*(?:Armour|Armor)/i
    );
    if (fortWard && Number(fortWard[1]) !== Number(fortWard[2])) {
      row.riders = row.riders.filter(function (x) { return !x || x.kind !== 'bastion'; });
      if (!hasRiderKind(row.riders, 'fortify')) {
        row.riders.push({ kind: 'fortify', value: Number(fortWard[1]) || 0, turns: 2, scope: 'self', when: null });
      }
      if (!hasRiderKind(row.riders, 'ward')) {
        row.riders.push({ kind: 'ward', value: Number(fortWard[2]) || 0, turns: 2, scope: 'self', when: null });
      }
    }

    for (var pi = 0; pi < row.riders.length; pi++) {
      var pr = row.riders[pi];
      if (!pr) continue;
      if (pr.kind === 'ignoreGuardThisHit' && !(row.flatPen > 0)) row.flatPen = Number(pr.value) || 0;
      if (pr.kind === 'piercePercentThisHit' && !(row.piercePercent > 0)) {
        row.piercePercent = (Number(pr.value) || 0) / 100;
        row.pierceDef = Math.max(Number(row.pierceDef) || 0, Number(pr.value) || 0);
        row.pierceMdef = Math.max(Number(row.pierceMdef) || 0, Number(pr.value) || 0);
      }
      if (pr.kind === 'lifestealIfDebuff' && !(row.lifestealPct > 0)) {
        row.lifestealPct = Number(pr.value) || 10;
        row.lifestealWhen = 'targetHasAilment';
      }
      if (pr.kind === 'delayedDamageSplit') {
        row.delayedDamageSplit = {
          immediatePct: Number(pr.immediatePct) || 75,
          delayedPct: Number(pr.value) || 25,
        };
      }
    }

    /* applyAilment riders → row.ailment / ailmentChance for tryRollRowAilment. */
    if ((!row.ailment || !(row.ailmentChance > 0)) && Array.isArray(row.riders)) {
      for (var ari = 0; ari < row.riders.length; ari++) {
        var ar = row.riders[ari];
        if (!ar || ar.kind !== 'applyAilment' || !ar.ailment) continue;
        if (!row.ailment) row.ailment = normalizeAilmentId(ar.ailment);
        if (!(row.ailmentChance > 0)) {
          row.ailmentChance = ar.chance != null ? Number(ar.chance) : 100;
        }
        if (ar.when && !row.ailmentWhen) row.ailmentWhen = ar.when;
        break;
      }
    }

    if (/^guard$/i.test(String(row.riderText || '').trim())
      && !/\bGuard\s+Up\b/i.test(text)
      && !hasRiderKind(row.riders, 'gainGuarded') && !hasRiderKind(row.riders, 'gainGuard')) {
      var tierGuardOnly = text.match(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b/i);
      row.riders.push({
        kind: 'gainGuarded',
        value: 0,
        scope: 'self',
        guardTier: tierGuardOnly ? normalizeTierLabel(tierGuardOnly[1]) : 'minor',
        when: row.noDamage ? null : 'onHit',
      });
    }
    row._textEnriched = true;
    return row;
  }

  var api = {
    mergeAbilityText: mergeAbilityText,
    parseRiderWhen: parseRiderWhen,
    parseConditionalAbilityFromText: parseConditionalAbilityFromText,
    parseSupplementalRiders: parseSupplementalRiders,
    parseAilmentFieldsFromText: parseAilmentFieldsFromText,
    normalizeAilmentId: normalizeAilmentId,
    applyTextEnrichment: applyTextEnrichment,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.abilityRiderParser = api;
  globalThis.applyAbilityTextEnrichment = applyTextEnrichment;
})();
