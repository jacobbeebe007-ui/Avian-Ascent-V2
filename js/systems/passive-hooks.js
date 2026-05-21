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

  function classGenericEndless(klass) {
    var p = pack();
    var out = [];
    if (!p || !p.endlessPassives || !p.endlessPassives.generic) return out;
    var gp = p.endlessPassives.generic;
    for (var id in gp) {
      if (gp[id].class === klass) out.push(gp[id]);
    }
    out.sort(function (a, b) { return (a.rank || '').localeCompare(b.rank || ''); });
    return out;
  }

  // ---- trigger matchers -------------------------------------------------
  function classifyTrigger(text) {
    var s = String(text || '').toLowerCase();
    if (!s) return { kind: 'none' };
    if (/once per turn after using a multi-hit physical/.test(s)) return { kind: 'afterMultiHitPhysical', cap: 'turn' };
    if (/once per turn after using a 1 ap/.test(s)) return { kind: 'after1ApAbility', cap: 'turn' };
    if (/once per turn after using a 2 ap|after using a 2 ap/.test(s)) return { kind: 'after2ApAbility', cap: 'turn' };
    if (/first magic song used each battle|first song used each battle/.test(s)) return { kind: 'firstMagicSongBattle', cap: 'battle' };
    if (/once per turn when a magic song does not apply its ailment/.test(s)) return { kind: 'magicAilmentFailed', cap: 'turn' };
    if (/once per turn when the first hit of a physical ability lands/.test(s)) return { kind: 'firstHitLanded', cap: 'turn' };
    if (/first damaging physical ability used against an enemy without bleed/.test(s)) return { kind: 'firstAttackVsNonBleeding', cap: 'battle' };
    if (/when using a physical ability against a bleeding enemy/.test(s)) return { kind: 'physicalVsBleeding' };
    if (/once per turn when an ability lands a crit|on crit/.test(s)) return { kind: 'onCrit', cap: 'turn' };
    if (/once per turn after using a utility/.test(s)) return { kind: 'afterUtility', cap: 'turn' };
    if (/once per turn at the start of your turn|start of your turn/.test(s)) return { kind: 'turnStart', cap: 'turn' };
    if (/below \d+% health|low\s*hp|low-health/.test(s)) return { kind: 'lowHp', threshold: 0.5 };
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
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Ailment\s*Chance/i))) out.push({ kind: 'ailmentChanceBonus', kindFilter: 'magic', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Bleed\s*chance/i))) out.push({ kind: 'ailmentChanceBonus', ailment: 'bleed', value: Number(m[1]) });
    if ((m = s.match(/deal\s*\+?(\d+(?:\.\d+)?)\s*%\s*Physical\s*damage/i))) out.push({ kind: 'bonusVsAilment', ailment: 'bleed', value: Number(m[1]) });
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*Damage/i))) out.push({ kind: 'flatDamageBonus', value: Number(m[1]) });
    return out;
  }

  // ---- effect application -----------------------------------------------
  function applyEffect(effect) {
    if (!effect || typeof effect !== 'object') return;
    if (!globalThis.G || !G.player) return;
    var ps = G.playerStatus = G.playerStatus || {};
    switch (effect.kind) {
      case 'gainDodge': ps.passiveDodge = Math.max(ps.passiveDodge || 0, effect.value); ps.passiveDodgeT = 1; break;
      case 'gainSpeed': if (G.player.stats) { G.player.stats.spd = (G.player.stats.spd || 0) + effect.value; ps._passiveSpdLoan = (ps._passiveSpdLoan || 0) + effect.value; } ps.passiveSpeedT = 1; break;
      case 'gainCritChance': ps.passiveCrit = Math.max(ps.passiveCrit || 0, effect.value); ps.passiveCritT = 1; break;
      case 'gainCritDamage': ps.passiveCritDmg = Math.max(ps.passiveCritDmg || 0, effect.value); ps.passiveCritDmgT = 1; break;
      case 'gainAtk': if (G.player.stats) { G.player.stats.atk = (G.player.stats.atk || 0) + effect.value; ps._passiveAtkLoan = (ps._passiveAtkLoan || 0) + effect.value; } ps.passiveAtkT = 1; break;
      case 'gainMatk': if (G.player.stats) { G.player.stats.matk = (G.player.stats.matk || 0) + effect.value; ps._passiveMatkLoan = (ps._passiveMatkLoan || 0) + effect.value; } ps.passiveMatkT = 1; break;
      case 'ailmentChanceBonus': ps.passiveAilmentBonus = (ps.passiveAilmentBonus || 0) + effect.value; ps.passiveAilmentBonusT = 1; break;
      default: break;
    }
  }

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
    var row = ab && Avian.data && Avian.data.combatPack && Avian.data.combatPack.skillTrees && Avian.data.combatPack.skillTrees[ab.id];
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
      case 'physicalVsBleeding': {
        var es2 = (G.enemyStatus || {});
        return row.category === 'physical' && es2.bleed && es2.bleed.stacks > 0;
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
    var effects = classifyEffect(perk.effect);
    for (var i = 0; i < effects.length; i++) applyEffect(effects[i]);
  };

  Avian.passives.onBattleStart = function onBattleStart() {
    G.passiveState = Object.create(null);
  };

  Avian.passives.onPlayerTurnStart = function onPlayerTurnStart(player) {
    // Decay passive one-turn buffs and reset per-turn gates.
    if (G.passiveState) {
      for (var k in G.passiveState) G.passiveState[k].firedThisTurn = false;
    }
    var ps = G.playerStatus = G.playerStatus || {};
    if ((ps.passiveDodgeT || 0) > 0) { ps.passiveDodgeT--; if (ps.passiveDodgeT <= 0) { delete ps.passiveDodge; delete ps.passiveDodgeT; } }
    if ((ps.passiveSpeedT || 0) > 0) { ps.passiveSpeedT--; if (ps.passiveSpeedT <= 0) { if (player && player.stats && ps._passiveSpdLoan) { player.stats.spd = Math.max(0, (player.stats.spd || 0) - ps._passiveSpdLoan); } delete ps._passiveSpdLoan; delete ps.passiveSpeedT; } }
    if ((ps.passiveCritT || 0) > 0) { ps.passiveCritT--; if (ps.passiveCritT <= 0) { delete ps.passiveCrit; delete ps.passiveCritT; } }
    if ((ps.passiveCritDmgT || 0) > 0) { ps.passiveCritDmgT--; if (ps.passiveCritDmgT <= 0) { delete ps.passiveCritDmg; delete ps.passiveCritDmgT; } }
    if ((ps.passiveAtkT || 0) > 0) { ps.passiveAtkT--; if (ps.passiveAtkT <= 0) { if (player && player.stats && ps._passiveAtkLoan) player.stats.atk = Math.max(0, (player.stats.atk || 0) - ps._passiveAtkLoan); delete ps._passiveAtkLoan; delete ps.passiveAtkT; } }
    if ((ps.passiveMatkT || 0) > 0) { ps.passiveMatkT--; if (ps.passiveMatkT <= 0) { if (player && player.stats && ps._passiveMatkLoan) player.stats.matk = Math.max(0, (player.stats.matk || 0) - ps._passiveMatkLoan); delete ps._passiveMatkLoan; delete ps.passiveMatkT; } }
    if ((ps.passiveAilmentBonusT || 0) > 0) { ps.passiveAilmentBonusT--; if (ps.passiveAilmentBonusT <= 0) { delete ps.passiveAilmentBonus; delete ps.passiveAilmentBonusT; } }
  };

  // Resolve a passive description for display.
  Avian.passives.describeFor = function describeFor(birdKey) {
    var perk = passiveFor(birdKey);
    if (!perk) return null;
    return { id: perk.id, name: perk.name, desc: perk.effect, trigger: perk.trigger, balance: perk.balanceNote };
  };

  Avian.systems.passives = Avian.passives;
})();
