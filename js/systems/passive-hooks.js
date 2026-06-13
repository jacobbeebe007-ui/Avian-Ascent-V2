/* Avian Ascent — Passive Perk Hooks (combat rewrite).
 *
 * Replaces the legacy `CLASS_PERK_DEFS` / `BIRDS[].passive` bespoke handlers
 * with a data-driven trigger router.
 *
 * Each bird has exactly one normal-mode passive (Avian.data.combatPack.birdPassives)
 * and up to four Endless ranks (Avian.data.combatPack.endlessPassives.bird) plus
 * 24 generic class-wide Endless upgrades (.generic).
 *
 * Triggers
 * --------
 * Inputs come from `playerAction` after each ability resolves. We expose a
 * single entry point:
 *
 *     Avian.passives.onPlayerAbilityUse(ab, context)
 *
 * which iterates the active bird's passive + any unlocked Endless upgrades and
 * fires their effects.
 *
 * Trigger parsing strategy
 * ------------------------
 * We pattern-match the "Trigger / Condition" string against a small set of
 * known phrasings (multi-hit physical, 1 AP, first Magic Song, first hit
 * lands, low HP, etc.). Each matcher produces a `kind` token. The router
 * gates on `kind` and on cached state (once-per-turn / once-per-battle flags
 * stored on `G.passiveState`).
 *
 * Effect parsing strategy
 * ------------------------
 * The "Base Passive Effect" string is parsed into a small list of riders
 * mirroring the dispatcher's rider taxonomy:
 *   gainDodge, gainSpeed, gainCritChance, gainCritDamage, gainAtk, gainMatk,
 *   ailmentChanceBonus, bonusVsAilment, executeOverHpThreshold.
 *
 * Anything we cannot pattern-match silently no-ops. The aim is graceful
 * degradation rather than a hard error; the importer logs warnings so the
 * spreadsheet author can tighten phrasings if a desired effect is missed.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.passives = Avian.passives || Object.create(null);

  function pack() { return (Avian.data && Avian.data.combatPack) || null; }

  function passiveFor(birdKey) {
    var p = pack();
    if (!p || !p.birdPassives) return null;
    for (var id in p.birdPassives) {
      if (p.birdPassives[id].birdKey === birdKey) return p.birdPassives[id];
    }
    return null;
  }

  function passiveTierScaleRatio(birdKey, tier) {
    var scaling = Avian.data && Avian.data.birdCardPassiveScaling;
    if (!scaling || !scaling[birdKey] || scaling[birdKey].scaling !== 'percentBonus') return 1;
    var grey = Number(scaling[birdKey].grey) || 0;
    if (grey <= 0) return 1;
    var t = String(tier || 'grey').toLowerCase();
    var frac = scaling[birdKey][t];
    if (t === 'orange' && scaling[birdKey].orange && typeof scaling[birdKey].orange === 'object') {
      frac = scaling[birdKey].orange.bonus;
    }
    frac = Number(frac);
    if (!Number.isFinite(frac)) return 1;
    return frac / grey;
  }

  function scalePassiveEffects(effects, birdKey, tier) {
    var ratio = passiveTierScaleRatio(birdKey, tier);
    if (!ratio || ratio === 1) return effects;
    var scaledKinds = {
      gainDodge: 1, gainSpeed: 1, gainCritChance: 1, gainCritDamage: 1, gainAtk: 1, gainMatk: 1,
      flatDamageBonus: 1, bonusVsAilment: 1, ailmentChanceBonus: 1, armorPenetration: 1,
    };
    return effects.map(function (eff) {
      if (!eff || !scaledKinds[eff.kind] || !Number.isFinite(eff.value)) return eff;
      return { kind: eff.kind, value: eff.value * ratio, dmgType: eff.dmgType, ailment: eff.ailment, kindFilter: eff.kindFilter };
    });
  }

  function currentPassiveTier() {
    return (globalThis.G && G.player && G.player._birdCardTier) || 'grey';
  }

  function endlessForBird(birdKey) {
    var p = pack();
    var out = [];
    if (!p || !p.endlessPassives || !p.endlessPassives.bird) return out;
    var bp = p.endlessPassives.bird;
    for (var id in bp) {
      if (bp[id].birdKey === birdKey) out.push(bp[id]);
    }
    out.sort(function (a, b) { return (a.rank || '').localeCompare(b.rank || ''); });
    return out;
  }

  var LEGACY_CLASS_MAP = {
    striker: 'rogue', singer: 'mage', predator: 'inquisitor', trickster: 'bard', tank: 'knight', bruiser: 'knight',
  };

  function normalizeKlass(klass) {
    var k = String(klass || '').toLowerCase().split(/\s+/)[0];
    return LEGACY_CLASS_MAP[k] || k;
  }

  function classGenericEndless(klass) {
    var p = pack();
    var out = [];
    if (!p || !p.endlessPassives || !p.endlessPassives.generic) return out;
    var gp = p.endlessPassives.generic;
    var nk = normalizeKlass(klass);
    for (var id in gp) {
      if (normalizeKlass(gp[id].class) === nk) out.push(gp[id]);
    }
    out.sort(function (a, b) { return (a.rank || '').localeCompare(b.rank || ''); });
    return out;
  }

  function classPerkForBird(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (!bird) return null;
    var pid = bird.passive && bird.passive.id;
    var p = pack();
    if (pid && p && p.birdPassives && p.birdPassives[pid]) return p.birdPassives[pid];
    return null;
  }

  Avian.passives.applyClassPerkAtBattleStart = function applyClassPerkAtBattleStart() {
    if (!globalThis.G || !G.player) return;
    var perk = classPerkForBird(G.player.birdKey);
    if (!perk || !perk.classPerkEffect) return;
    var effects = classifyEffect(perk.classPerkEffect);
    for (var i = 0; i < effects.length; i++) applyEffect('classPerk:' + (perk.classPerk || 'perk'), effects[i]);
    var s = String(perk.classPerkEffect || '');
    var m;
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Max\s*HP/i))) {
      var pct = Number(m[1]) / 100;
      var maxHp = Math.max(1, Math.floor((G.player.stats.maxHp || 1) * (1 + pct)));
      G.player.stats.maxHp = maxHp;
      G.player.stats.hp = Math.min(G.player.stats.hp || maxHp, maxHp);
    }
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e/i))) {
      var defPct = Number(m[1]) / 100;
      G.player.stats.def = Math.floor((G.player.stats.def || 0) * (1 + defPct));
    }
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Armou?r\s*Penetration/i))) {
      G.player.classPerkPenetration = Math.max(G.player.classPerkPenetration || 0, Number(m[1]));
    }
  };

  function rowFor(abId) {
    var p = pack();
    return p && p.skillTrees ? p.skillTrees[abId] : null;
  }

  // ---- trigger matchers -------------------------------------------------
  function classifyTrigger(text) {
    var s = String(text || '').toLowerCase();
    if (!s) return { kind: 'none' };
    if (/first physical attack each turn|first physical ability each turn/.test(s)) return { kind: 'firstPhysicalTurn', cap: 'turn' };
    if (/once per turn after using a multi-hit physical/.test(s)) return { kind: 'afterMultiHitPhysical', cap: 'turn' };
    if (/once per turn after using a 1 ap/.test(s)) return { kind: 'after1ApAbility', cap: 'turn' };
    if (/once per turn after using a 2 ap|after using a 2 ap/.test(s)) return { kind: 'after2ApAbility', cap: 'turn' };
    if (/first magic song used each battle|first song used each battle/.test(s)) return { kind: 'firstMagicSongBattle', cap: 'battle' };
    if (/once per turn when a magic song does not apply its ailment/.test(s)) return { kind: 'magicAilmentFailed', cap: 'turn' };
    if (/once per turn when the first hit of a physical ability lands/.test(s)) return { kind: 'firstHitLanded', cap: 'turn' };
    if (/first damaging physical ability used against an enemy without bleed/.test(s)) return { kind: 'firstAttackVsNonBleeding', cap: 'battle' };
    if (/when using a physical ability against a bleeding enemy|physical ability against a bleeding enemy/.test(s)) return { kind: 'physicalVsBleeding' };
    if (/when the enemy is bleeding/.test(s)) return { kind: 'enemyBleeding' };
    if (/when damaging an enemy that already has any ailment|when attacking an enemy with a debuff or ailment|when damaging a debuffed enemy/.test(s)) return { kind: 'vsAfflictedEnemy' };
    if (/when attacking an enemy below \d+% health|below \d+% health.*physical/.test(s)) return { kind: 'executeLowHp', threshold: 0.4 };
    if (/once per turn when an ability lands a crit|on crit/.test(s)) return { kind: 'onCrit', cap: 'turn' };
    if (/once per turn after using a utility/.test(s)) return { kind: 'afterUtility', cap: 'turn' };
    if (/once per turn at the start of your turn|start of your turn/.test(s)) return { kind: 'turnStart', cap: 'turn' };
    if (/below \d+% health|low\s*hp|low-health|while below \d+% health/.test(s)) return { kind: 'lowHp', threshold: 0.5 };
    if (/once per turn when (?:you|the player) is hit/.test(s)) return { kind: 'onHit', cap: 'turn' };
    if (/once per battle/.test(s)) return { kind: 'oncePerBattle', cap: 'battle' };
    return { kind: 'unknown', text: s };
  }

  // ---- effect matchers --------------------------------------------------
  function classifyEffect(text) {
    var s = String(text || '');
    var out = [];
    var m;
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Dodge/i))) out.push({ kind: 'gainDodge', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Speed/i))) out.push({ kind: 'gainSpeed', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/i))) out.push({ kind: 'gainCritChance', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Crit\s*Damage/i))) out.push({ kind: 'gainCritDamage', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/i))) out.push({ kind: 'gainMatk', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Physical\s*Attack/i))) out.push({ kind: 'gainAtk', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Physical\s*damage/i))) out.push({ kind: 'flatDamageBonus', dmgType: 'physical', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Physical\s*Ailment\s*chance/i))) out.push({ kind: 'ailmentChanceBonus', kindFilter: 'physical', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Armou?r\s*Penetration/i))) out.push({ kind: 'armorPenetration', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Ailment\s*Chance/i))) out.push({ kind: 'ailmentChanceBonus', kindFilter: 'magic', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Bleed\s*chance/i))) out.push({ kind: 'ailmentChanceBonus', ailment: 'bleed', value: Number(m[1]) });
    if ((m = s.match(/deal\s*\+?(\d+(?:\.\d+)?)\s*%\s*Physical\s*damage/i))) out.push({ kind: 'bonusVsAilment', ailment: 'bleed', dmgType: 'physical', value: Number(m[1]) });
    if ((m = s.match(/physical abilities deal\s*\+?(\d+(?:\.\d+)?)\s*%\s*damage/i))) out.push({ kind: 'bonusVsAilment', ailment: 'bleed', dmgType: 'physical', value: Number(m[1]) });
    if ((m = s.match(/mixed abilities deal\s*\+?(\d+(?:\.\d+)?)\s*%\s*damage/i))) out.push({ kind: 'flatDamageBonus', dmgType: 'mixed', value: Number(m[1]) });
    if ((m = s.match(/gain\s*\+?(\d+(?:\.\d+)?)\s*%\s*damage on that ability/i))) out.push({ kind: 'flatDamageBonus', dmgType: 'any', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Damage/i))) out.push({ kind: 'flatDamageBonus', dmgType: 'any', value: Number(m[1]) });
    return out;
  }

  function recomputePassiveDisplays(ps) {
    ps.passiveDodge = 0;
    ps.passiveCrit = 0;
    ps.passiveCritDmg = 0;
    var slots = ps._passiveDisplaySlots;
    if (!slots) return;
    for (var k in slots) {
      var s = slots[k];
      if (!s || (s.turns || 0) <= 0) continue;
      if (s.kind === 'gainDodge') ps.passiveDodge = Math.max(ps.passiveDodge || 0, s.value || 0);
      if (s.kind === 'gainCritChance') ps.passiveCrit = Math.max(ps.passiveCrit || 0, s.value || 0);
      if (s.kind === 'gainCritDamage') ps.passiveCritDmg = Math.max(ps.passiveCritDmg || 0, s.value || 0);
    }
  }

  function recomputePassiveAilmentBonus(ps) {
    ps.passiveAilmentBonus = 0;
    var slots = ps._passiveAilmentBonusSlots;
    if (!slots) return;
    for (var k in slots) {
      var s = slots[k];
      if (!s || (s.turns || 0) <= 0) continue;
      ps.passiveAilmentBonus = Math.max(ps.passiveAilmentBonus || 0, s.value || 0);
    }
  }

  function applyPassiveDisplaySlot(ps, perkId, kind, value) {
    if (!ps._passiveDisplaySlots) ps._passiveDisplaySlots = Object.create(null);
    var key = perkId + ':' + kind;
    var prev = ps._passiveDisplaySlots[key];
    ps._passiveDisplaySlots[key] = {
      kind: kind,
      value: Math.max(prev ? (prev.value || 0) : 0, Number(value) || 0),
      turns: 1,
    };
    recomputePassiveDisplays(ps);
  }

  function decayPassiveSlotBag(ps, bagName, recomputeFn) {
    var bag = ps[bagName];
    if (!bag) return;
    for (var k in bag) {
      var s = bag[k];
      if (!s) continue;
      s.turns = (s.turns || 1) - 1;
      if (s.turns <= 0) delete bag[k];
    }
    if (!Object.keys(bag).length) delete ps[bagName];
    if (recomputeFn) recomputeFn(ps);
  }

  // ---- effect application -----------------------------------------------
  function applyEffect(perkId, effect) {
    if (!effect || typeof effect !== 'object') return;
    if (!globalThis.G || !G.player) return;
    var ps = G.playerStatus = G.playerStatus || {};
    var applyLoan = typeof globalThis.applySourceStatLoan === 'function' ? globalThis.applySourceStatLoan : null;
    var applyLoanPct = typeof globalThis.applySourceStatLoanPct === 'function' ? globalThis.applySourceStatLoanPct : null;
    var slotId = String(perkId || 'passive') + ':' + effect.kind;

    switch (effect.kind) {
      case 'gainDodge':
        applyPassiveDisplaySlot(ps, perkId, 'gainDodge', effect.value);
        break;
      case 'gainSpeed':
        if (applyLoanPct) applyLoanPct(ps, G.player, '_passiveStatLoans', 'spd', slotId, effect.value, 1);
        else if (applyLoan) applyLoan(ps, G.player, '_passiveStatLoans', 'spd', slotId, effect.value, 1);
        break;
      case 'gainCritChance':
        applyPassiveDisplaySlot(ps, perkId, 'gainCritChance', effect.value);
        break;
      case 'gainCritDamage':
        applyPassiveDisplaySlot(ps, perkId, 'gainCritDamage', effect.value);
        break;
      case 'gainAtk':
        if (applyLoanPct) applyLoanPct(ps, G.player, '_passiveStatLoans', 'atk', slotId, effect.value, 1);
        else if (applyLoan) applyLoan(ps, G.player, '_passiveStatLoans', 'atk', slotId, effect.value, 1);
        break;
      case 'gainMatk':
        if (applyLoanPct) applyLoanPct(ps, G.player, '_passiveStatLoans', 'matk', slotId, effect.value, 1);
        else if (applyLoan) applyLoan(ps, G.player, '_passiveStatLoans', 'matk', slotId, effect.value, 1);
        break;
      case 'ailmentChanceBonus': {
        if (!ps._passiveAilmentBonusSlots) ps._passiveAilmentBonusSlots = Object.create(null);
        var prevA = ps._passiveAilmentBonusSlots[perkId];
        ps._passiveAilmentBonusSlots[perkId] = {
          value: Math.max(prevA ? (prevA.value || 0) : 0, Number(effect.value) || 0),
          turns: 1,
          kindFilter: effect.kindFilter || null,
          ailment: effect.ailment || null,
        };
        recomputePassiveAilmentBonus(ps);
        break;
      }
      case 'bonusVsAilment':
      case 'flatDamageBonus':
        /* Conditional damage — evaluated in applyDamageBonus, not stat loans. */
        break;
      default: break;
    }
  }

  function enemyHasAilmentCategory(es, ailment) {
    if (!es) return false;
    if (ailment === 'bleed') return (es.bleed && es.bleed.stacks > 0);
    if (ailment === 'poison') return (es.poison && es.poison.stacks > 0);
    return false;
  }

  function enemyHasAnyAffliction(es) {
    if (!es) return false;
    var burning = es.burning && ((typeof es.burning === 'number' && es.burning > 0) || (typeof es.burning === 'object' && (es.burning.turns || 0) > 0));
    return (es.poison && es.poison.stacks > 0) || (es.bleed && es.bleed.stacks > 0) || (es.feared || 0) > 0
      || (es.weaken || 0) > 0 || (es.paralyzed || 0) > 0 || !!es.confused || burning
      || (es.chilled && es.chilled.stacks > 0) || (es.accDebuff || 0) > 0;
  }

  function triggerMatchesForDamage(trigger, row, ctx) {
    if (!row) return false;
    var es = (G.enemyStatus || {});
    switch (trigger.kind) {
      case 'physicalVsBleeding':
      case 'enemyBleeding':
        return row.category === 'physical' && es.bleed && es.bleed.stacks > 0;
      case 'vsAfflictedEnemy':
        return enemyHasAnyAffliction(es);
      case 'executeLowHp': {
        var enemy = G.enemy && G.enemy.stats;
        if (!enemy) return false;
        return row.category === 'physical' && enemy.hp <= Math.floor((enemy.maxHp || 1) * (trigger.threshold || 0.4));
      }
      case 'lowHp': {
        var p = G.player && G.player.stats;
        if (!p) return false;
        return p.hp <= Math.floor((p.maxHp || 1) * (trigger.threshold || 0.5));
      }
      default:
        return false;
    }
  }

  function damageTypeMatches(row, dmgType, ctx) {
    if (!dmgType || dmgType === 'any') return true;
    if (dmgType === 'mixed') return true;
    if (dmgType === 'physical') return row.category === 'physical';
    if (dmgType === 'magic') return /magic|song|spell/i.test(row.category || '');
    if (ctx && ctx.isAttack && dmgType === 'physical') return true;
    if (ctx && ctx.isSpell && dmgType === 'magic') return true;
    return false;
  }

  Avian.passives.applyDamageBonus = function applyDamageBonus(dmg, ab, ctx) {
    if (!globalThis.G || !G.player || !ab) return dmg;
    var perk = passiveFor(G.player.birdKey);
    if (!perk) return dmg;
    var trigger = classifyTrigger(perk.trigger);
    var row = rowFor(ab.id);
    if (!row) return dmg;
    if (!triggerMatchesForDamage(trigger, row, ctx || {})) return dmg;
    var effects = scalePassiveEffects(classifyEffect(perk.effect), G.player.birdKey, currentPassiveTier());
    var es = G.enemyStatus || {};
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (eff.kind === 'bonusVsAilment') {
        if (eff.ailment === 'bleed' && !enemyHasAilmentCategory(es, 'bleed')) continue;
        if (!damageTypeMatches(row, eff.dmgType, ctx)) continue;
        if (eff.value > 0) dmg = Math.floor(dmg * (1 + eff.value / 100));
      } else if (eff.kind === 'flatDamageBonus') {
        if (!damageTypeMatches(row, eff.dmgType, ctx)) continue;
        if (eff.value > 0) dmg = Math.floor(dmg * (1 + eff.value / 100));
      }
    }
    return dmg;
  };

  // ---- per-trigger gate -------------------------------------------------
  function gate(birdKey, perkId, cap) {
    G.passiveState = G.passiveState || Object.create(null);
    var key = birdKey + ':' + perkId;
    var st = G.passiveState[key] || (G.passiveState[key] = { firedThisTurn: false, firedThisBattle: false });
    if (cap === 'turn' && st.firedThisTurn) return false;
    if (cap === 'battle' && st.firedThisBattle) return false;
    if (cap === 'turn') st.firedThisTurn = true;
    if (cap === 'battle') st.firedThisBattle = true;
    return true;
  }

  // ---- triggers ---------------------------------------------------------
  function matchTrigger(trigger, ab, context) {
    var row = rowFor(ab && ab.id);
    if (!row) return false;
    switch (trigger.kind) {
      case 'afterMultiHitPhysical': return row.category === 'physical' && (row.hits || 1) >= 2;
      case 'after1ApAbility': return (row.apCost || 1) === 1;
      case 'after2ApAbility': return (row.apCost || 1) === 2;
      case 'firstMagicSongBattle': return /magic|song|spell/i.test(row.category);
      case 'magicAilmentFailed': return /magic|song|spell/i.test(row.category) && context && context.ailmentFailed;
      case 'firstHitLanded': return row.category === 'physical' && context && context.firstHitLanded;
      case 'firstAttackVsNonBleeding': {
        var es = (G.enemyStatus || {});
        return row.category === 'physical' && !(es.bleed && es.bleed.stacks > 0);
      }
      case 'physicalVsBleeding':
      case 'enemyBleeding': {
        var es2 = (G.enemyStatus || {});
        return row.category === 'physical' && es2.bleed && es2.bleed.stacks > 0;
      }
      case 'vsAfflictedEnemy': return enemyHasAnyAffliction(G.enemyStatus || {});
      case 'executeLowHp': {
        var enemy = G.enemy && G.enemy.stats;
        return row.category === 'physical' && enemy && enemy.hp <= Math.floor((enemy.maxHp || 1) * (trigger.threshold || 0.4));
      }
      case 'onCrit': return context && context.crit;
      case 'afterUtility': return row.category === 'utility' || row.target === 'self';
      case 'turnStart': return context && context.turnStart;
      case 'lowHp': {
        var p = G.player && G.player.stats;
        if (!p) return false;
        return p.hp <= Math.floor((p.maxHp || 1) * (trigger.threshold || 0.5));
      }
      case 'onHit': return context && context.playerTookHit;
      case 'oncePerBattle': return true;
      default: return false;
    }
  }

  Avian.passives.onPlayerAbilityUse = function onPlayerAbilityUse(ab, context) {
    if (!globalThis.G || !G.player) return;
    var bird = G.player.birdKey;
    if (!bird) return;
    var perk = passiveFor(bird);
    if (!perk) return;
    var trigger = classifyTrigger(perk.trigger);
    if (!matchTrigger(trigger, ab, context || {})) return;
    if (trigger.cap && !gate(bird, perk.id, trigger.cap)) return;
    var effects = scalePassiveEffects(classifyEffect(perk.effect), bird, currentPassiveTier());
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (eff.kind === 'bonusVsAilment' || eff.kind === 'flatDamageBonus') continue;
      applyEffect(perk.id, eff);
    }
  };

  Avian.passives.onBattleStart = function onBattleStart() {
    G.passiveState = Object.create(null);
    if (typeof Avian.passives.applyClassPerkAtBattleStart === 'function') {
      Avian.passives.applyClassPerkAtBattleStart();
    }
  };

  Avian.passives.onPlayerTurnStart = function onPlayerTurnStart(player) {
    if (G.passiveState) {
      for (var k in G.passiveState) G.passiveState[k].firedThisTurn = false;
    }
  };

  Avian.passives.onAfterEnemyTurn = function onAfterEnemyTurn(player) {
    var ps = G.playerStatus = G.playerStatus || {};
    if (typeof globalThis.decaySourceStatLoans === 'function') {
      globalThis.decaySourceStatLoans(ps, player, '_passiveStatLoans');
    }
    decayPassiveSlotBag(ps, '_passiveDisplaySlots', recomputePassiveDisplays);
    decayPassiveSlotBag(ps, '_passiveAilmentBonusSlots', recomputePassiveAilmentBonus);
  };

  Avian.passives.describeFor = function describeFor(birdKey) {
    var perk = passiveFor(birdKey);
    if (!perk) return null;
    var tier =
      (globalThis.G && G.player && G.player.birdKey === birdKey && G.player._birdCardTier) ||
      (typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(birdKey) : 'grey');
    var effectText = perk.effect;
    if (typeof globalThis.formatPassiveEffectForTier === 'function') {
      effectText = globalThis.formatPassiveEffectForTier(birdKey, tier) || perk.effect;
    }
    return { id: perk.id, name: perk.name, desc: effectText, effect: effectText, trigger: perk.trigger, balance: perk.balanceNote };
  };

  Avian.systems.passives = Avian.passives;
})();
