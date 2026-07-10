/* Workbook passive effect/trigger parser + applier (master workbook vocabulary). */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.workbookEffects = Avian.workbookEffects || Object.create(null);

  function effectTiers() {
    return (Avian.data && Avian.data.effectTiers) || { buff: { minor: 6, major: 8 }, debuff: { minor: 6, major: 8 }, ailmentChance: { minor: 5, major: 10 } };
  }

  function tierPct(bucket, tierName) {
    var b = effectTiers()[bucket] || {};
    var t = String(tierName || 'minor').toLowerCase();
    return Number(b[t]) || (t === 'major' ? 8 : 6);
  }

  function rowFor(abId) {
    var p = Avian.data && Avian.data.combatPack;
    var id = String(abId || '');
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') id = globalThis.resolveAbilityAliasSourceId(id);
    return p && p.skillTrees ? p.skillTrees[id] : null;
  }

  function abMeta(ab) {
    var row = rowFor(ab && ab.id);
    var kind = String(ab && (ab.btnType || ab.type) || row && row.category || '').toLowerCase();
    var en = Number(row && (row.enCost != null ? row.enCost : row.apCost) != null ? (row.enCost != null ? row.enCost : row.apCost) : (ab && (ab.energy || ab.energyCost)) || 1);
    var tags = (row && row.tags) || [];
    var tagStr = tags.join(' ').toLowerCase();
    var text = String(row && (row.riderText || row.shortDesc || row.displayText || '') || '').toLowerCase();
    var role = String(row && row.role || '').toLowerCase();
    return {
      row: row,
      kind: kind,
      en: Math.max(1, Math.min(4, en)),
      isPhysical: kind === 'physical' || kind === 'ranged',
      isMagic: kind === 'spell' || kind === 'magic' || /magic|song|spell/i.test(kind),
      isUtility: kind === 'utility' || (row && row.noDamage) || row && row.target === 'self' && row.noDamage,
      isHeavy: en >= 3 || /heavy/i.test(tagStr) || /heavy/i.test(text) || /heavy/i.test(role),
      isSongOrCall: /song|call|bard/i.test(tagStr) || /song|call/i.test(role) || kind === 'spell',
      isControl: /control|debuff|fear|weaken|acc down|slow|stun|paraly/i.test(tagStr + ' ' + role + ' ' + text),
      isSupport: /support|heal|guard|shield|cleanse|purge|brace/i.test(tagStr + ' ' + role + ' ' + text),
      isDefensiveUtility: /guard|shield|brace|defensive utility|damage resist/i.test(tagStr + ' ' + role + ' ' + text),
      isMovement: /movement|dash|fly|charge|evade/i.test(tagStr + ' ' + role + ' ' + text),
      isLure: /lure/i.test(tagStr + ' ' + role + ' ' + text),
      aspect: String(row && row.aspectAffinity || row && row.aspect || ab && ab.aspect || '').toLowerCase(),
      tags: tags,
    };
  }

  function playerActingFirst() {
    var g = globalThis.G;
    if (!g || !g.player || !g.enemy) return false;
    return (g.player.stats.spd || 0) >= (g.enemy.stats.spd || 0);
  }

  function playerHpRatio() {
    var g = globalThis.G;
    if (!g || !g.player || !g.player.stats) return 1;
    return (g.player.stats.hp || 0) / Math.max(1, g.player.stats.maxHp || 1);
  }

  function enemyHpRatio() {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats) return 1;
    return (g.enemy.stats.hp || 0) / Math.max(1, g.enemy.stats.maxHp || 1);
  }

  function enemyHasWeaken() {
    var es = (globalThis.G && G.enemyStatus) || {};
    return (typeof globalThis.getWeakenStacks === 'function') ? globalThis.getWeakenStacks(es) > 0 : (es.weaken || 0) > 0;
  }

  function enemyHasBurning() {
    var es = (globalThis.G && G.enemyStatus) || {};
    return es.burning && ((typeof es.burning === 'number' && es.burning > 0) || (typeof es.burning === 'object' && ((es.burning.stacks || 0) > 0 || (es.burning.turns || 0) > 0)));
  }

  function enemyIsBloodied() {
    return typeof globalThis.isBloodiedTarget === 'function' && globalThis.G && globalThis.G.enemy
      ? globalThis.isBloodiedTarget(G.enemy) : enemyHpRatio() <= 0.5;
  }

  function enemyHasAnyDebuff() {
    var es = (globalThis.G && G.enemyStatus) || {};
    return (es.poison && es.poison.stacks > 0) || (es.bleed && es.bleed.stacks > 0) || (es.feared || 0) > 0
      || enemyHasWeaken() || (es.paralyzed || 0) > 0 || !!es.confused || enemyHasBurning()
      || (es.chilled && es.chilled.stacks > 0) || (es.accDebuff || 0) > 0;
  }

  function aspectMatches(text, meta) {
    var a = String(text || '').toLowerCase();
    if (!a || a.indexOf('solis') < 0 && a.indexOf('terra') < 0 && a.indexOf('maris') < 0 && a.indexOf('lunae') < 0 && a.indexOf('tempest') < 0 && a.indexOf('aeris') < 0) return true;
    var birdAspect = String((globalThis.G && G.player && G.player.aspect) || (globalThis.BIRDS && G.player && BIRDS[G.player.birdKey] && BIRDS[G.player.birdKey].aspect) || '').toLowerCase();
    var rowAsp = String(meta && meta.aspect || '').toLowerCase();
    var hay = birdAspect + ' ' + rowAsp + ' ' + String(meta && meta.row && meta.row.damageType || '').toLowerCase();
    if (a.indexOf('solis') >= 0) return hay.indexOf('solis') >= 0;
    if (a.indexOf('terra') >= 0) return hay.indexOf('terra') >= 0;
    if (a.indexOf('maris') >= 0) return hay.indexOf('maris') >= 0;
    if (a.indexOf('lunae') >= 0) return hay.indexOf('lunae') >= 0;
    if (a.indexOf('tempest') >= 0) return hay.indexOf('tempest') >= 0;
    if (a.indexOf('aeris') >= 0) return hay.indexOf('aeris') >= 0;
    return true;
  }

  ns.parseTrigger = function parseTrigger(text) {
    var s = String(text || '').trim();
    var low = s.toLowerCase();
    if (!s) return { kind: 'none' };
    if (/always active for heavy physical/.test(low)) return { kind: 'alwaysHeavyPhysical' };
    if (/first physical attack each turn|first solis physical attack each turn/.test(low)) return { kind: 'firstPhysicalTurn', cap: 'turn' };
    if (/first support or song ability each turn|first song each turn/.test(low)) return { kind: 'firstSupportOrSongTurn', cap: 'turn' };
    if (/after using a 1 en physical/.test(low)) return { kind: 'after1EnPhysical', cap: 'turn' };
    if (/after using two 1 en abilities/.test(low)) return { kind: 'afterTwo1EnAbilities', cap: 'turn' };
    if (/after using a 2 en|after using a heavy/.test(low)) return { kind: 'afterHeavyOr2En', cap: 'turn' };
    if (/after using a song or call/.test(low)) return { kind: 'afterSongOrCall', cap: 'turn' };
    if (/after using a control ability/.test(low)) return { kind: 'afterControl', cap: 'turn' };
    if (/after using a support ability|after using defensive utility/.test(low)) return { kind: 'afterSupport', cap: 'turn' };
    if (/after using guard or shield|after gaining guard|after gaining a defensive effect/.test(low)) return { kind: 'afterDefensiveUtility', cap: 'turn' };
    if (/after using a lure ability/.test(low)) return { kind: 'afterLure', cap: 'turn' };
    if (/after using a solis ability|after using a maris ability|after using a tempest ability|after using a magic ability|after using a lunae magic/.test(low)) return { kind: 'afterMagicFamily', cap: 'turn', family: (low.match(/solis|maris|tempest|lunae|magic/) || ['magic'])[0] };
    if (/after using a movement ability/.test(low)) return { kind: 'afterMovement', cap: 'turn' };
    if (/when acting before the target|if you act before the target|if acting before the target/.test(low)) return { kind: 'actingFirst' };
    if (/after applying chilled/.test(low)) return { kind: 'afterAppliedAilment', ailment: 'chilled', cap: 'turn' };
    if (/after applying acc down/.test(low)) return { kind: 'afterAppliedAilment', ailment: 'accDebuff', cap: 'turn' };
    if (/when applying a debuff/.test(low)) return { kind: 'onApplyDebuff', cap: 'turn' };
    if (/when attacking weakened targets|attacks against weakened targets|against weakened targets/.test(low)) return { kind: 'vsWeakened' };
    if (/when attacking burning targets/.test(low)) return { kind: 'vsBurning' };
    if (/when damaging a debuffed target|after damaging a debuffed target|after damaging with a tempest ability/.test(low)) return { kind: 'vsDebuffedTarget', cap: 'turn' };
    if (/when attacking an enemy below \d+% hp|while the enemy is below \d+% hp|enemy is below \d+% hp/.test(low)) return { kind: 'enemyLowHp', threshold: 0.5 };
    if (/while below \d+% hp/.test(low)) return { kind: 'playerLowHp' };
    if (/while above \d+% hp|above \d+% hp/.test(low) && /taking damage|gain/.test(low)) return { kind: 'playerHighHp' };
    if (/after taking physical damage/.test(low)) return { kind: 'onPhysicalDamage', cap: 'turn' };
    if (/after taking damage while above/.test(low)) return { kind: 'onDamagedHighHp', cap: 'turn' };
    if (/after taking damage/.test(low)) return { kind: 'onDamaged', cap: 'turn' };
    if (/after being targeted by an enemy attack/.test(low)) return { kind: 'onTargeted', cap: 'turn' };
    if (/after dodging an attack/.test(low)) return { kind: 'onDodge', cap: 'turn' };
    if (/after landing a critical hit|on crit/.test(low)) return { kind: 'onCrit', cap: 'turn' };
    if (/after defeating an enemy/.test(low)) return { kind: 'onKill', cap: 'battle' };
    if (/when using heavy physical attacks against bleeding or weakened/.test(low)) return { kind: 'heavyVsBleedOrWeaken' };
    if (/heavy physical attacks against slower targets/.test(low)) return { kind: 'heavyVsSlower' };
    if (/when using lunae magic or attacking weakened targets/.test(low)) return { kind: 'lunaeOrWeakened' };
    if (/when gaining guard below \d+% hp/.test(low)) return { kind: 'guardWhileLowHp' };
    if (/using a magic ability/.test(low)) return { kind: 'onMagicUse', cap: 'turn' };
    if (/attacking an enemy below/.test(low)) return { kind: 'enemyLowHp' };
    return { kind: 'unknown', text: low };
  };

  function statKindFromPhrase(phrase) {
    var p = String(phrase || '').toLowerCase();
    if (/dodge/.test(p)) return 'gainDodge';
    if (/accuracy|acc\b/.test(p)) return 'gainAcc';
    if (/speed|spd/.test(p)) return 'gainSpeed';
    if (/crit chance/.test(p)) return 'gainCritChance';
    if (/crit damage/.test(p)) return 'gainCritDamage';
    if (/magic penetration|mdef penetration/.test(p)) return 'gainMdefPen';
    if (/matk|magic attack/.test(p)) return 'gainMatk';
    if (/physical attack|\batk\b/.test(p)) return 'gainAtk';
    if (/\bdef\b|defense|defence/.test(p) && !/penetration/.test(p)) return 'gainDef';
    if (/mdef/.test(p)) return 'gainMdef';
    if (/damage down/.test(p)) return 'enemyDamageDown';
    if (/acc down|accuracy down/.test(p)) return 'reduceEnemyAcc';
    if (/ailment chance/.test(p)) return 'ailmentChanceBonus';
    if (/damage up|damage\b/.test(p)) return 'flatDamageBonus';
    if (/weaken/.test(p)) return 'applyWeaken';
    if (/lifesteal/.test(p)) return 'lifesteal';
    if (/heal/.test(p)) return 'healMaxHpPct';
    if (/physical damage resist/.test(p)) return 'physicalDr';
    return null;
  }

  ns.parseEffectClauses = function parseEffectClauses(text) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    var parts = raw.split(/\.\s+(?=If |After |When |While |Your |The |Gain |Using |Attacks |Heavy |Defeating |Landing )/i);
    if (parts.length === 1) parts = [raw];
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var clause = parts[i].trim().replace(/\.$/, '');
      if (!clause) continue;
      var when = null;
      var mIf = /^if (.+?), (.+)$/i.exec(clause);
      if (mIf) { when = mIf[1]; clause = mIf[2]; }
      var mYour = /^your (.+)$/i.exec(clause);
      if (mYour) clause = mYour[1];
      var pctMatch = /(\d+(?:\.\d+)?)\s*%\s+more\s+(physical|magic|terra|solis|maris|lunae|tempest|heavy physical|damage|physical damage)/i.exec(clause);
      if (/always|heavy physical abilities deal/i.test(clause) && pctMatch) {
        out.push({ kind: 'alwaysDamageBonus', value: Number(pctMatch[1]), dmgType: pctMatch[2], when: when, heavy: /heavy/i.test(clause) });
        continue;
      }
      var mPerm = /permanently increases all damage dealt by (\d+(?:\.\d+)?)\%/i.exec(clause);
      if (mPerm) {
        out.push({ kind: 'permanentDamageBonus', value: Number(mPerm[1]), when: when });
        continue;
      }
      var mDefPen = /ignore[s]?\s+(\d+(?:\.\d+)?)\s*%\s*def/i.exec(clause);
      if (mDefPen) {
        out.push({ kind: 'pendingDefPen', value: Number(mDefPen[1]), when: when });
        continue;
      }
      var mPhysDr = /take[s]?\s+(\d+(?:\.\d+)?)\s*%\s*less\s+physical damage/i.exec(clause);
      if (mPhysDr) {
        out.push({ kind: 'physicalDr', value: Number(mPhysDr[1]), when: when });
        continue;
      }
      var mHeal = /heal[s]?\s+(minor|major|grand)\s+hp/i.exec(clause);
      if (mHeal) {
        out.push({ kind: 'healMaxHpPct', tier: mHeal[1], value: tierPct('buff', mHeal[1]), when: when });
        continue;
      }
      var mHeals = /heals?\s+(minor|major|grand)\s+hp/i.exec(clause);
      if (mHeals) {
        out.push({ kind: 'healMaxHpPct', tier: mHeals[1], value: tierPct('buff', mHeals[1]), when: when });
        continue;
      }
      var mApply = /apply\s+(minor|major|crippling)\s+(acc down|weaken|damage down)/i.exec(clause);
      if (mApply) {
        var debKind = statKindFromPhrase(mApply[2]);
        out.push({ kind: debKind || 'reduceEnemyAcc', tier: mApply[1], value: tierPct('debuff', mApply[1]), when: when });
        continue;
      }
      var mGain = /gain[s]?\s+(minor|major|grand|epic|legendary|crippling|ruinous|fatal)\s+(.+?)(?:\s+until|\s+while|\s+for|$)/i.exec(clause);
      if (mGain) {
        var tier = mGain[1];
        var phrase = mGain[2];
        var sk = statKindFromPhrase(phrase);
        if (sk) out.push({ kind: sk, tier: tier, value: tierPct(/ailment chance/i.test(phrase) ? 'ailmentChance' : 'buff', tier), when: when, duration: /until your next turn|until end of next turn/i.test(clause) ? 2 : 1 });
        continue;
      }
      if (/your next (physical|magic|terra|solis|maris|lunae|tempest|physical attack|magic attack|1 en physical ability|song or call|debuff|terra ability|physical ability)/i.test(clause)) {
        var nextType = (clause.match(/your next ([^.]+)/i) || [])[1] || 'attack';
        var tierM = /(minor|major|grand|crippling)\s+(.+?)(?:\.|$)/i.exec(clause);
        if (tierM) {
          var nsk = statKindFromPhrase(tierM[2]);
          out.push({ kind: nsk || 'flatDamageBonus', tier: tierM[1], value: tierPct('buff', tierM[1]), pending: nextType, when: when, consume: true });
        } else if (pctMatch) {
          out.push({ kind: 'flatDamageBonus', value: Number(pctMatch[1]), pending: nextType, when: when, consume: true });
        }
        continue;
      }
      var mDeal = /deal[s]?\s+(\d+(?:\.\d+)?)\s*%\s+more\s+damage/i.exec(clause);
      if (mDeal) {
        out.push({ kind: 'flatDamageBonus', value: Number(mDeal[1]), when: when });
        continue;
      }
      var mGrant = /grants?\s+(minor|major)\s+(.+)/i.exec(clause);
      if (mGrant) {
        var gsk = statKindFromPhrase(mGrant[2]);
        if (gsk) out.push({ kind: gsk, tier: mGrant[1], value: tierPct('buff', mGrant[1]), when: when });
      }
    }
    return out;
  };

  function whenMatches(when, ctx) {
    if (!when) return true;
    var w = String(when).toLowerCase();
    if (/faster than the target|acting before the target|act before the target/.test(w)) return !!ctx.actingFirst;
    if (/weakened/.test(w)) return enemyHasWeaken();
    if (/bleeding/.test(w)) {
      var es = (globalThis.G && G.enemyStatus) || {};
      return es.bleed && es.bleed.stacks > 0;
    }
    if (/bloodied/.test(w)) return enemyIsBloodied();
    if (/burning/.test(w)) return enemyHasBurning();
    if (/below \d+% hp/.test(w)) return playerHpRatio() <= 0.5;
    return true;
  }

  function ensurePending(ps) {
    if (!ps._workbookPassivePending) ps._workbookPassivePending = Object.create(null);
    return ps._workbookPassivePending;
  }

  function applyDisplay(ps, sourceId, kind, value, turns) {
    if (!ps._passiveDisplaySlots) ps._passiveDisplaySlots = Object.create(null);
    var key = sourceId + ':' + kind;
    ps._passiveDisplaySlots[key] = { kind: kind, value: Math.max(Number(value) || 0, (ps._passiveDisplaySlots[key] && ps._passiveDisplaySlots[key].value) || 0), turns: turns || 1 };
    ps.passiveDodge = ps.passiveDodge || 0;
    ps.passiveCrit = ps.passiveCrit || 0;
    ps.passiveAcc = ps.passiveAcc || 0;
    if (kind === 'gainDodge') ps.passiveDodge = Math.max(ps.passiveDodge, value);
    if (kind === 'gainCritChance') ps.passiveCrit = Math.max(ps.passiveCrit, value);
    if (kind === 'gainAcc') ps.passiveAcc = Math.max(ps.passiveAcc, value);
  }

  function applyLoanPct(ps, player, statKey, sourceId, pct, turns) {
    if (typeof globalThis.applySourceStatLoanPct === 'function') {
      globalThis.applySourceStatLoanPct(ps, player, '_passiveStatLoans', statKey, sourceId + ':' + statKey, pct, turns || 1);
    } else if (player && player.stats) {
      player.stats[statKey] = Math.round(((player.stats[statKey] || 0) * (1 + pct / 100)) * 100) / 100;
    }
  }

  function applyEnemyDebuff(statKey, pct, sourceId) {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats) return;
    var stats = g.enemy.stats;
    var cur = Number(stats[statKey]) || 0;
    var amt = Math.round(cur * (Number(pct) || 0) / 100 * 100) / 100;
    if (amt <= 0) return;
    stats[statKey] = Math.max(0, Math.round((cur - amt) * 100) / 100);
    g.enemyStatus = g.enemyStatus || {};
    if (!g.enemyStatus._workbookDebuffLoans) g.enemyStatus._workbookDebuffLoans = Object.create(null);
    g.enemyStatus._workbookDebuffLoans[statKey + ':' + sourceId] = { statKey: statKey, amt: amt, turns: 1 };
    if (typeof spawnFloat === 'function') spawnFloat('enemy', '▼', 'fn-debuff-trend');
  }

  ns.applyClause = function applyClause(sourceId, clause, ctx) {
    if (!clause || !globalThis.G || !G.player) return;
    if (!whenMatches(clause.when, ctx || {})) return;
    var ps = G.playerStatus = G.playerStatus || {};
    var p = G.player;
    var kind = clause.kind;
    var val = Number(clause.value) || 0;

    if (clause.consume && clause.pending) {
      var pend = ensurePending(ps);
      pend.next = pend.next || Object.create(null);
      var pk = String(clause.pending).toLowerCase();
      pend.next[pk] = { kind: kind, value: val, tier: clause.tier, dmgType: clause.dmgType, sourceId: sourceId };
      return;
    }
    if (kind === 'alwaysDamageBonus' || (kind === 'flatDamageBonus' && !clause.consume)) {
      var always = ensurePending(ps);
      always.always = always.always || [];
      always.always.push({ value: val, heavy: clause.heavy, dmgType: clause.dmgType, aspect: clause.dmgType, sourceId: sourceId });
      return;
    }
    if (kind === 'permanentDamageBonus') {
      p._workbookPermanentDmgBonus = (p._workbookPermanentDmgBonus || 0) + val / 100;
      return;
    }
    if (kind === 'pendingDefPen') {
      ensurePending(ps).defPen = Math.max(ensurePending(ps).defPen || 0, val);
      return;
    }
    if (kind === 'physicalDr') {
      p._workbookPhysicalDr = Math.max(p._workbookPhysicalDr || 0, val / 100);
      return;
    }
    if (kind === 'healMaxHpPct') {
      var heal = Math.max(1, Math.floor((p.stats.maxHp || 1) * val / 100));
      p.stats.hp = Math.min(p.stats.maxHp || 1, (p.stats.hp || 0) + heal);
      if (typeof setHpBar === 'function') setHpBar('player', p.stats.hp, p.stats.maxHp);
      if (typeof spawnFloat === 'function') spawnFloat('player', '+' + heal, 'fn-heal');
      return;
    }
    if (kind === 'lifesteal') {
      p._workbookLifestealPct = Math.max(p._workbookLifestealPct || 0, val);
      return;
    }
    if (kind === 'applyWeaken') {
      if (typeof globalThis.applyAilment === 'function') globalThis.applyAilment('enemy', 'weaken', 1);
      return;
    }
    if (kind === 'reduceEnemyAcc' || kind === 'enemyDamageDown') {
      applyEnemyDebuff(kind === 'reduceEnemyAcc' ? 'acc' : 'atk', val, sourceId);
      return;
    }
    if (kind === 'ailmentChanceBonus') {
      if (!ps._passiveAilmentBonusSlots) ps._passiveAilmentBonusSlots = Object.create(null);
      ps._passiveAilmentBonusSlots[sourceId] = { value: val, turns: clause.duration || 1 };
      ps.passiveAilmentBonus = Math.max(ps.passiveAilmentBonus || 0, val);
      return;
    }
    if (kind === 'gainDodge' || kind === 'gainCritChance' || kind === 'gainAcc') {
      applyDisplay(ps, sourceId, kind, val, clause.duration || 1);
      return;
    }
    if (kind === 'gainSpeed') { applyLoanPct(ps, p, 'spd', sourceId, val, clause.duration || 1); return; }
    if (kind === 'gainAtk') { applyLoanPct(ps, p, 'atk', sourceId, val, clause.duration || 1); return; }
    if (kind === 'gainMatk') { applyLoanPct(ps, p, 'matk', sourceId, val, clause.duration || 1); return; }
    if (kind === 'gainDef') { applyLoanPct(ps, p, 'def', sourceId, val, clause.duration || 1); return; }
    if (kind === 'gainMdef') { applyLoanPct(ps, p, 'mdef', sourceId, val, clause.duration || 1); return; }
    if (kind === 'gainMdefPen') {
      p._workbookMdefPenPct = Math.max(p._workbookMdefPenPct || 0, val);
      return;
    }
  };

  ns.matchTrigger = function matchTrigger(trigger, ab, ctx) {
    ctx = ctx || {};
    var meta = abMeta(ab);
    var row = meta.row;
    if (!row && trigger.kind !== 'onDamaged' && trigger.kind !== 'onTargeted' && trigger.kind !== 'onDodge' && trigger.kind !== 'playerLowHp' && trigger.kind !== 'playerHighHp' && trigger.kind !== 'enemyLowHp') return false;
    switch (trigger.kind) {
      case 'alwaysHeavyPhysical': return meta.isPhysical && meta.isHeavy;
      case 'firstPhysicalTurn': return meta.isPhysical && ctx.firstPhysicalThisTurn !== false && !ctx.firstPhysicalUsed;
      case 'firstSupportOrSongTurn': return (meta.isSupport || meta.isSongOrCall) && !ctx.firstSupportUsed;
      case 'after1EnPhysical': return meta.isPhysical && meta.en === 1;
      case 'afterTwo1EnAbilities': return meta.en === 1 && (ctx.oneEnCountThisTurn || 0) >= 2;
      case 'afterHeavyOr2En': return meta.isHeavy || meta.en >= 2;
      case 'afterSongOrCall': return meta.isSongOrCall;
      case 'afterControl': return meta.isControl;
      case 'afterSupport': return meta.isSupport || meta.isDefensiveUtility;
      case 'afterDefensiveUtility': return meta.isDefensiveUtility;
      case 'afterLure': return meta.isLure;
      case 'afterMovement': return meta.isMovement;
      case 'afterMagicFamily': {
        if (!meta.isMagic) return false;
        var fam = trigger.family || 'magic';
        if (fam === 'magic') return true;
        return aspectMatches(fam, meta) || String(meta.row && meta.row.damageType || '').toLowerCase().indexOf(fam) >= 0;
      }
      case 'actingFirst': return playerActingFirst();
      case 'afterAppliedAilment': return ctx.appliedAilment === trigger.ailment;
      case 'onApplyDebuff': return ctx.appliedDebuff;
      case 'vsWeakened': return enemyHasWeaken();
      case 'vsBurning': return enemyHasBurning();
      case 'vsDebuffedTarget': return enemyHasAnyDebuff();
      case 'enemyLowHp': return enemyHpRatio() <= (trigger.threshold || 0.5);
      case 'playerLowHp': return playerHpRatio() <= 0.5;
      case 'playerHighHp': return playerHpRatio() > 0.5;
      case 'onDamaged': return (ctx.damage || 0) > 0;
      case 'onDamagedHighHp': return (ctx.damage || 0) > 0 && playerHpRatio() > 0.5;
      case 'onPhysicalDamage': return (ctx.damage || 0) > 0 && ctx.isPhysical;
      case 'onTargeted': return !!ctx.targeted;
      case 'onDodge': return !!ctx.dodged;
      case 'onCrit': return !!ctx.crit;
      case 'onKill': return !!ctx.kill;
      case 'heavyVsBleedOrWeaken': {
        var esH = (globalThis.G && G.enemyStatus) || {};
        return meta.isHeavy && meta.isPhysical && ((esH.bleed && esH.bleed.stacks > 0) || enemyHasWeaken());
      }
      case 'heavyVsSlower': return meta.isHeavy && meta.isPhysical && !playerActingFirst();
      case 'lunaeOrWeakened': return (meta.isMagic && aspectMatches('lunae', meta)) || enemyHasWeaken();
      case 'guardWhileLowHp': return meta.isDefensiveUtility && playerHpRatio() <= 0.5;
      case 'onMagicUse': return meta.isMagic;
      default: return false;
    }
  };

  ns.collectDamageBonusFractions = function collectDamageBonusFractions(ab, ctx) {
    var fractions = [];
    var ps = (globalThis.G && G.playerStatus) || {};
    var pend = ps._workbookPassivePending;
    var meta = abMeta(ab);
    if (pend && pend.always) {
      for (var i = 0; i < pend.always.length; i++) {
        var a = pend.always[i];
        if (a.heavy && !meta.isHeavy) continue;
        if (a.dmgType && !aspectMatches(a.dmgType, meta) && a.dmgType !== 'physical' && a.dmgType !== 'magic') continue;
        if (a.dmgType === 'physical' && !meta.isPhysical) continue;
        if (a.dmgType === 'magic' && !meta.isMagic) continue;
        fractions.push((a.value || 0) / 100);
      }
    }
    if (pend && pend.next) {
      for (var k in pend.next) {
        var n = pend.next[k];
        if (!n || n.kind !== 'flatDamageBonus') continue;
        var match = false;
        var lk = k.toLowerCase();
        if (/physical/.test(lk) && meta.isPhysical) match = true;
        if (/magic|song/.test(lk) && meta.isMagic) match = true;
        if (/terra/.test(lk) && aspectMatches('terra', meta)) match = true;
        if (/solis/.test(lk) && aspectMatches('solis', meta)) match = true;
        if (/maris/.test(lk) && aspectMatches('maris', meta)) match = true;
        if (/debuff/.test(lk) && meta.isControl) match = true;
        if (/1 en physical/.test(lk) && meta.isPhysical && meta.en === 1) match = true;
        if (/attack|ability/.test(lk) && (meta.isPhysical || meta.isMagic)) match = true;
        if (match) {
          fractions.push((n.value || 0) / 100);
          delete pend.next[k];
        }
      }
    }
    if (globalThis.G && G.player && G.player._workbookPermanentDmgBonus) fractions.push(G.player._workbookPermanentDmgBonus);
    if (pend && pend.defPen && meta.isPhysical && typeof globalThis.getPhysicalPierceFractionForDamage === 'function') {
      G._workbookPassiveDefPen = pend.defPen;
    }
    return fractions;
  };

  ns.onTurnStart = function onTurnStart(perk, ctx) {
    if (!perk || !globalThis.G) return;
    var trigger = ns.parseTrigger(perk.trigger);
    if (trigger.kind === 'playerLowHp' || trigger.kind === 'enemyLowHp') {
      if (ns.matchTrigger(trigger, null, ctx)) {
        var clauses = ns.parseEffectClauses(perk.effect);
        for (var i = 0; i < clauses.length; i++) ns.applyClause(perk.id, clauses[i], ctx);
      }
    }
    if (trigger.kind === 'firstPhysicalTurn' || trigger.kind === 'firstSupportOrSongTurn') {
      if (ns.matchTrigger(trigger, ctx.dummyAb || { id: '', type: trigger.kind === 'firstPhysicalTurn' ? 'physical' : 'spell' }, ctx)) {
        var cls = ns.parseEffectClauses(perk.effect);
        for (var j = 0; j < cls.length; j++) ns.applyClause(perk.id, cls[j], ctx);
      }
    }
  };

  function decayWorkbookDebuffLoans(enemy) {
    var g = globalThis.G;
    if (!g || !enemy || !enemy.stats || !g.enemyStatus || !g.enemyStatus._workbookDebuffLoans) return;
    var bag = g.enemyStatus._workbookDebuffLoans;
    for (var k in bag) {
      var entry = bag[k];
      if (!entry) continue;
      entry.turns = (entry.turns || 1) - 1;
      if (entry.turns <= 0) {
        var sk = entry.statKey || String(k).split(':')[0];
        enemy.stats[sk] = Math.round(((Number(enemy.stats[sk]) || 0) + (entry.amt || 0)) * 100) / 100;
        delete bag[k];
      }
    }
    if (!Object.keys(bag).length) delete g.enemyStatus._workbookDebuffLoans;
  }

  ns.decayWorkbookDebuffLoans = decayWorkbookDebuffLoans;
  globalThis.decayWorkbookDebuffLoans = decayWorkbookDebuffLoans;

  globalThis.Avian = Avian;
})();
