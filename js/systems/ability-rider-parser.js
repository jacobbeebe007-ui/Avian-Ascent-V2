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

  var BUFF_TIER_PCT = { minor: 6, major: 8, grand: 12, epic: 18, legendary: 25 };
  var DEBUFF_TIER_PCT = { minor: 6, major: 8, severe: 12, critical: 18, lethal: 25, crippling: 12, ruinous: 18, fatal: 25 };

  function normalizeTierLabel(tier) {
    return String(tier || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function tierBuffPct(tier) {
    return BUFF_TIER_PCT[normalizeTierLabel(tier)] != null ? BUFF_TIER_PCT[normalizeTierLabel(tier)] : null;
  }

  function tierDebuffPct(tier) {
    return DEBUFF_TIER_PCT[normalizeTierLabel(tier)] != null ? DEBUFF_TIER_PCT[normalizeTierLabel(tier)] : null;
  }

  function isTierGuardPhrase(slice) {
    return /(minor|moderate|major|grand|epic|legendary)\s+guard\b/i.test(String(slice || ''));
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
        var lsDm = text.match(/Heal for\s+(\d+(?:\.\d+)?)\s*%\s*of damage dealt/i);
        if (lsDm) row.lifestealPct = Number(lsDm[1]);
      }
    }
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

    // Tier-based ATK / MATK / DEF / MDEF buffs (Gain Major ATK Up, etc.)
    for (var atkUp of t.matchAll(/\b(?:Gain|gains?)\s+(Minor|Major|Grand|Epic|Legendary)\s+(?:Physical\s+)?ATK\s+Up\b/gi)) {
      var atkV = tierBuffPct(atkUp[1]); if (atkV != null) addSelf('gainAtk', atkV, { when: parseRiderWhen(t, atkUp[0]) });
    }
    for (var matkUp of t.matchAll(/\b(?:Gain|gains?)\s+(Minor|Major|Grand|Epic|Legendary)\s+(?:Magic\s+)?MATK\s+Up\b/gi)) {
      var matkV = tierBuffPct(matkUp[1]); if (matkV != null) addSelf('gainMatk', matkV, { when: parseRiderWhen(t, matkUp[0]) });
    }
    for (var defUp of t.matchAll(/\b(?:Gain|gains?)\s+(Minor|Major|Grand|Epic|Legendary)\s+DEF\s+Up\b/gi)) {
      var defV = tierBuffPct(defUp[1]); if (defV != null) addSelf('gainDef', defV);
    }
    for (var mdefUp of t.matchAll(/\b(?:Gain|gains?)\s+(Minor|Major|Grand|Epic|Legendary)\s+MDEF\s+Up\b/gi)) {
      var mdefV = tierBuffPct(mdefUp[1]); if (mdefV != null) addSelf('gainMdef', mdefV);
    }
    for (var atkUp2 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+(?:Physical\s+)?ATK\s+Up\b/gi)) {
      var atkV2 = tierBuffPct(atkUp2[1]); if (atkV2 != null) addSelf('gainAtk', atkV2, { when: parseRiderWhen(t, atkUp2[0]) });
    }
    for (var matkUp2 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+(?:Magic\s+)?MATK\s+Up\b/gi)) {
      var matkV2 = tierBuffPct(matkUp2[1]); if (matkV2 != null) addSelf('gainMatk', matkV2, { when: parseRiderWhen(t, matkUp2[0]) });
    }
    for (var defUp2 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+DEF\s+Up\b/gi)) {
      var defV2 = tierBuffPct(defUp2[1]); if (defV2 != null) addSelf('gainDef', defV2);
    }
    for (var mdefUp2 of t.matchAll(/\b(Minor|Major|Grand|Epic|Legendary)\s+MDEF\s+Up\b/gi)) {
      var mdefV2 = tierBuffPct(mdefUp2[1]); if (mdefV2 != null) addSelf('gainMdef', mdefV2);
    }

    // Conditional ailment-based self buffs
    for (var ailMatk of t.matchAll(/if the target has an ailment,\s*gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*MATK/gi)) {
      addSelf('gainMatk', Number(ailMatk[1]), { when: 'targetHasAilment' });
    }
    for (var ailAtk of t.matchAll(/if the target has an ailment,\s*gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*ATK/gi)) {
      addSelf('gainAtk', Number(ailAtk[1]), { when: 'targetHasAilment' });
    }
    for (var dmgUp of t.matchAll(/\b(?:Gain|gains?)\s+(Minor|Major|Grand|Epic|Legendary)\s+Damage\s+Up\b/gi)) {
      var dmgV = tierBuffPct(dmgUp[1]); if (dmgV != null) addSelf('gainAtk', dmgV);
    }

    // Tier-based debuffs (Apply Major MDEF Down, Crippling Damage Down, etc.)
    for (var mdefDn of t.matchAll(/\b(?:Apply|apply)\s+(Minor|Major|Crippling|Ruinous|Fatal|Severe|Critical|Lethal)\s+MDEF\s+Down\b/gi)) {
      var mdefDv = tierDebuffPct(mdefDn[1]); if (mdefDv != null) addEnemy('reduceEnemyMdef', mdefDv);
    }
    for (var defDn of t.matchAll(/\b(?:Apply|apply)\s+(Minor|Major|Crippling|Ruinous|Fatal|Severe|Critical|Lethal)\s+DEF\s+Down\b/gi)) {
      var defDv = tierDebuffPct(defDn[1]); if (defDv != null) addEnemy('reduceEnemyDef', defDv);
    }
    for (var dmgDn of t.matchAll(/\b(?:Apply|apply)\s+(Minor|Major|Crippling|Ruinous|Fatal|Severe|Critical|Lethal)\s+Damage\s+Down\b/gi)) {
      var dmgDv = tierDebuffPct(dmgDn[1]); if (dmgDv != null) addEnemy('reduceEnemyAtk', dmgDv);
    }
    for (var accDn of t.matchAll(/\b(?:Apply|apply)\s+(Minor|Major|Crippling|Ruinous|Fatal|Severe|Critical|Lethal)\s+ACC\s+Down\b/gi)) {
      var accDv = tierDebuffPct(accDn[1]); if (accDv != null) addEnemy('reduceEnemyAcc', accDv);
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

    // Guard / brace / counter / taunt — tier Guard uses gainGuarded(0); % resolved via AP/level in resolveGuardedReductionPct
    for (var tg of t.matchAll(/\b(?:gain|gains?)\s+(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b/gi)) {
      addSelf('gainGuarded', 0, { guardTier: normalizeTierLabel(tg[1]), when: parseRiderWhen(t, tg[0]) });
    }
    if (!hasRiderKind(riders, 'gainGuarded')) {
      for (var tg2 of t.matchAll(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b/gi)) {
        addSelf('gainGuarded', 0, { guardTier: normalizeTierLabel(tg2[1]), when: parseRiderWhen(t, tg2[0]) });
        break;
      }
    }
    if (/\bguard\b/i.test(t) && /defen[cs]e/i.test(t) && !isTierGuardPhrase(t)) addSelf('gainGuard', 1);
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
    if (/\bshield\b/i.test(t) && /temp|temporary|max\s*hp|max\s*health|health/i.test(t)) {
      var shM = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:max\s*)?(?:hp|health)/i);
      addSelf('gainShield', shM ? Number(shM[1]) : 0);
    } else if (/\b(?:gain a |gain )\s*(minor|major|grand|epic|legendary|moderate)\s+shield\b/i.test(t)) {
      addSelf('gainShield', 0);
    } else if (/\b(minor|major|grand|epic|legendary|moderate)\s+shield\b/i.test(t)) {
      addSelf('gainShield', 0);
    } else if (/\b(?:gain|gains?)\s+(minor|major|grand|epic|legendary)\s+shield\b/i.test(t)) {
      addSelf('gainShield', 0);
    } else if (/\bgain\s+shield\b/i.test(t)) addSelf('gainShield', 0);

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
    if (row.noDamage && /^guard$/i.test(String(row.riderText || '').trim()) && !hasRiderKind(row.riders, 'gainGuarded')) {
      var tierGuardM = text.match(/\b(Minor|Moderate|Major|Grand|Epic|Legendary)\s+Guard\b/i);
      row.riders.push({
        kind: 'gainGuarded',
        value: 0,
        scope: 'self',
        guardTier: tierGuardM ? normalizeTierLabel(tierGuardM[1]) : 'minor',
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
    applyTextEnrichment: applyTextEnrichment,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.abilityRiderParser = api;
  globalThis.applyAbilityTextEnrichment = applyTextEnrichment;
})();
