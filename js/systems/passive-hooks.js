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
 *   gainAcc, gainDodge, gainSpeed, gainCritChance, gainCritDamage, gainAtk, gainMatk,
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

  function isV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function v2TierPct(tier, dir) {
    var buckets = Avian.data && Avian.data.effectTiers;
    var b = String(dir || 'up') === 'down' ? (buckets && buckets.debuff) : (buckets && buckets.buff);
    if (!b) return tier === 'major' ? 50 : (tier === 'moderate' ? 25 : 10);
    return Number(b[String(tier || 'minor').toLowerCase()]) || 10;
  }

  function effectTiersFlatStat() {
    var buckets = Avian.data && Avian.data.effectTiers;
    if (buckets && buckets.flatStat) return true;
    var cfg = Avian.data && Avian.data.combatConfig && Avian.data.combatConfig.effectTiers;
    return !!(cfg && cfg.flatStat);
  }

  var FLAT_CORE_STATS = { atk: 1, matk: 1, def: 1, mdef: 1, spd: 1, dex: 1, vitality: 1, hp: 1 };

  function passiveFor(birdKey) {
    if (isV2() && typeof Avian.getBirdPassiveV2 === 'function') {
      var p2 = Avian.getBirdPassiveV2(birdKey);
      if (p2) {
        return {
          id: birdKey + '_passive_v2',
          birdKey: birdKey,
          name: p2.name,
          effect: p2.effect,
          trigger: p2.triggerLimit || '',
          parsed: p2.parsed,
          v2: true,
        };
      }
    }
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
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onBattleStart === 'function') {
      Avian.classPerks.onBattleStart();
    }
  };

  function rowFor(abId) {
    var id = String(abId || '');
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') {
      id = globalThis.resolveAbilityAliasSourceId(id);
    }
    if (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function') {
      return Avian.equipmentActions.skillToAbilityRow(id, null, 'grey');
    }
    var skills = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
    return skills && skills[id] ? skills[id] : null;
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
    if ((m = s.match(/\+(\d+(?:\.\d+)?)\s*%\s*(?:ACC|Accuracy)/i))) out.push({ kind: 'gainAcc', value: Number(m[1]) });
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
      case 'gainAcc':
        applyPassiveDisplaySlot(ps, perkId, 'gainAcc', effect.value);
        break;
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
    if (typeof globalThis.isHybridDamage === 'function' && globalThis.isHybridDamage(row)) {
      return dmgType === 'physical' || dmgType === 'magic' || dmgType === 'mixed';
    }
    if (dmgType === 'physical') return row.category === 'physical';
    if (dmgType === 'magic') return /magic|song|spell/i.test(row.category || '');
    if (ctx && ctx.isAttack && dmgType === 'physical') return true;
    if (ctx && ctx.isSpell && dmgType === 'magic') return true;
    return false;
  }

  function statusBagForSide(side) {
    if (side === 'enemy') return (G.enemyStatus = G.enemyStatus || {});
    return (G.playerStatus = G.playerStatus || {});
  }

  function entityForSide(side) {
    return side === 'enemy' ? G.enemy : G.player;
  }

  function foeStatusForSide(side) {
    return side === 'enemy' ? (G.playerStatus || {}) : (G.enemyStatus || {});
  }

  function foeEntityForSide(side) {
    return side === 'enemy' ? G.player : G.enemy;
  }

  function abilityNameMatches(ab, skillName) {
    if (!skillName) return true;
    if (!ab) return false;
    var want = String(skillName).trim().toLowerCase();
    if (!want) return true;
    var names = [ab.name, ab.id, ab.label, ab.skillName, ab.sourceSkillId];
    for (var i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      var got = String(names[i]).trim().toLowerCase().replace(/[_-]+/g, ' ');
      if (got === want || got.indexOf(want) >= 0 || want.indexOf(got) >= 0) return true;
    }
    return false;
  }

  function abilityLooksBasic(ab) {
    if (!ab) return false;
    var id = String(ab.id || '').toLowerCase();
    var name = String(ab.name || '').toLowerCase();
    return /basic|natural.?strike|beak.?jab|tail.?wand|BASIC_PHYSICAL|BASIC_MAGIC/i.test(id + ' ' + name);
  }

  function abilityIsMartial(ab) {
    if (!ab) return false;
    var kind = String(ab.btnType || ab.type || ab.category || ab.damageType || '').toLowerCase();
    return kind === 'physical' || kind === 'ranged' || kind === 'martial';
  }

  function abilityIsMagicCat(ab) {
    if (!ab) return false;
    var kind = String(ab.btnType || ab.type || ab.category || ab.damageType || '').toLowerCase();
    return kind === 'spell' || kind === 'magic' || kind === 'song';
  }

  function abilityIsSong(ab) {
    if (!ab) return false;
    var kind = String(ab.btnType || ab.type || ab.category || '').toLowerCase();
    var name = String(ab.name || ab.id || '').toLowerCase();
    return kind === 'song' || /song|call|verse|chorus|lament/i.test(name);
  }

  function abilityIsBasicAttack(ab) {
    if (!ab) return false;
    if (ab.actionSource === 'basic' || ab.isMainAttack) return true;
    var id = String(ab.id || ab.equipmentSkillId || '');
    return /^BASIC_(PHYSICAL|MAGIC)$/i.test(id);
  }

  function abilityIsWeaponSkill(ab) {
    if (!ab || abilityIsBasicAttack(ab)) return false;
    var src = String(ab.source || ab.actionSource || ab.family || '').toLowerCase();
    if (/weapon|wand|staff|orb|sceptre|grimoire/i.test(src)) return true;
    if (/^WSK-/i.test(String(ab.id || ab.equipmentSkillId || ''))) return true;
    return abilityEnCostLocal(ab) >= 2 && (abilityIsMagicCat(ab) || abilityIsMartial(ab));
  }

  function normalizeAspectId(raw) {
    var s = String(raw || '').toLowerCase();
    if (!s) return '';
    if (Avian.affinity && typeof Avian.affinity.normalize === 'function') {
      return String(Avian.affinity.normalize(s) || s).toLowerCase();
    }
    var map = { day: 'solis', night: 'lunae', earth: 'terra', sky: 'aeris', storm: 'tempest', water: 'maris' };
    return map[s] || s;
  }

  function abilityAspectId(ab, actor) {
    if (ab && (ab.aspect || ab.affinity)) return normalizeAspectId(ab.aspect || ab.affinity);
    if (typeof globalThis.getEntityAspect === 'function' && actor) {
      var fromEntity = globalThis.getEntityAspect(actor);
      if (fromEntity) return normalizeAspectId(fromEntity);
    }
    if (actor && actor.aspect) return normalizeAspectId(actor.aspect);
    var key = actor && actor.birdKey;
    var bird = key && globalThis.BIRDS && globalThis.BIRDS[key];
    if (bird && bird.aspect) return normalizeAspectId(bird.aspect);
    if (typeof Avian.getBirdV2 === 'function' && key) {
      var v2 = Avian.getBirdV2(key);
      if (v2 && v2.aspect) return normalizeAspectId(v2.aspect);
    }
    return '';
  }

  function foeHasBurning(foeStatus) {
    if (!foeStatus) return false;
    var b = foeStatus.burning;
    if (typeof b === 'number') return b > 0;
    if (b && typeof b === 'object') return (b.turns || 0) > 0 || (b.stacks || 0) > 0;
    return !!(foeStatus.scorched || foeStatus.incinerating);
  }

  function abilityExcludedByPassive(parsed, ab) {
    if (!parsed || !ab) return false;
    var list = parsed.excludeSkills || parsed.trigger && parsed.trigger.excludeSkills;
    if (!list || !list.length) return false;
    var name = String(ab.name || '');
    var id = String(ab.id || '');
    for (var i = 0; i < list.length; i++) {
      var ex = String(list[i] || '');
      if (!ex) continue;
      if (name === ex || id === ex || new RegExp(ex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(name)) return true;
    }
    return false;
  }

  function abilityEnCostLocal(ab) {
    if (!ab) return 1;
    var n = ab.enCost != null ? ab.enCost : (ab.apCost != null ? ab.apCost : (ab.energy || ab.energyCost || 1));
    return Math.max(1, Math.floor(Number(n) || 1));
  }

  function isPreHitSpecial(sp) {
    if (!sp || !sp.id) return false;
    if (sp.requiresHealthDamage) return false;
    return /^(skillPower|ignoreGuard|armourDamage|magicArmourDamage|ailmentApp)/.test(sp.id);
  }

  function isPostHitHealthSpecial(sp) {
    if (!sp || !sp.id) return false;
    if (sp.requiresHealthDamage) return true;
    return sp.id === 'healMaxHp' || sp.id === 'restoreLowerProtection';
  }

  function foeHasMarked(foeStatus) {
    if (!foeStatus) return false;
    return !!(foeStatus.marked || foeStatus.carrionMark || foeStatus.jewelMark || foeStatus.predatorMark || foeStatus.mark);
  }

  function foeHasBleed(foeStatus) {
    if (!foeStatus) return false;
    var b = foeStatus.bleed;
    if (typeof b === 'number') return b > 0;
    return !!(b && ((b.stacks || 0) > 0 || (b.turns || 0) > 0));
  }

  function foeHasWeaken(foeStatus) {
    if (!foeStatus) return false;
    if (typeof globalThis.getWeakenStacks === 'function') return globalThis.getWeakenStacks(foeStatus) > 0;
    var w = foeStatus.weaken || foeStatus.weakened;
    if (typeof w === 'number') return w > 0;
    return !!(w && ((w.stacks || 0) > 0 || (w.turns || 0) > 0));
  }

  function abilityIsSupportUtility(ab) {
    if (!ab) return false;
    if (abilityIsSong(ab)) return true;
    var kind = String(ab.btnType || ab.type || ab.category || '').toLowerCase();
    var name = String(ab.name || ab.id || '');
    var bar = String(ab.barSlot || ab.skillType || ab.target || '');
    if (kind === 'utility' || kind === 'support') return true;
    return /support|heal|guard|ward|fortify|restore|hymn|bless|bolster/i.test(name + ' ' + bar);
  }

  function abilityIsDamaging(ab) {
    if (!ab) return false;
    if (ab.noDamage) return false;
    if (abilityIsMartial(ab) || abilityIsMagicCat(ab)) return true;
    var kind = String(ab.btnType || ab.type || ab.category || '').toLowerCase();
    return kind === 'physical' || kind === 'ranged' || kind === 'spell' || kind === 'magic' || kind === 'hybrid';
  }

  function abilityWeaponScale(ab) {
    if (!ab) return '';
    var cat = String(ab.damageCategory || ab.category || ab.weaponClass || ab.family || '').toLowerCase();
    if (/strength|greatblade|hammer|lance|club/i.test(cat)) return 'strength';
    if (/finesse|dagger|talon|rapier|bow/i.test(cat)) return 'finesse';
    var scale = String(ab.scalingStat || ab.scaleStat || ab.damageStat || '').toUpperCase();
    if (scale === 'ATK' || scale === 'MIGHT' || scale === 'DEF' || scale === 'GUARD') return 'strength';
    if (scale === 'DEX' || scale === 'DEXTERITY' || scale === 'AGI' || scale === 'AGILITY') return 'finesse';
    var name = String(ab.name || '');
    if (/crush|smash|slam|cleave|great|hammer|lance/i.test(name)) return 'strength';
    if (/talon|pinion|flurry|stab|pierce|slash/i.test(name)) return 'finesse';
    return '';
  }

  function isFortifyOrArmourRestoreAbility(ab) {
    if (!ab) return false;
    var name = String(ab.name || ab.id || '');
    var bar = String(ab.barSlot || ab.skillType || ab.riderText || '');
    if (/fortify|armour restoration|armor restoration|restore armour|restore armor/i.test(name + ' ' + bar)) return true;
    var text = String(ab.riderText || ab.effect || '').toLowerCase();
    return /\bfortify\b/.test(text) || /restore\s+\d+\s+(?:armour|armor)/.test(text);
  }

  function sideActingFirst(side) {
    var self = entityForSide(side);
    var foe = foeEntityForSide(side);
    if (!self || !foe || !self.stats || !foe.stats) return false;
    return (self.stats.spd || 0) >= (foe.stats.spd || 0);
  }

  function applyV2TierEffect(perkId, eff, durationTurns, side) {
    if (!eff || (eff.kind !== 'tierStat' && eff.kind !== 'flatStat')) return;
    side = side || 'player';
    var actor = entityForSide(side);
    var status = statusBagForSide(side);
    if (!actor || !actor.stats) return;
    var pct = eff.kind === 'flatStat'
      ? Math.abs(Number(eff.amount) || 0)
      : v2TierPct(eff.tier, eff.dir);
    if (eff.kind === 'flatStat' && eff.dir === 'down') pct = -Math.abs(pct);
    else if (eff.kind === 'flatStat' && Number(eff.amount) < 0) pct = Number(eff.amount);
    var stat = String(eff.stat || '').toLowerCase();
    var turns = durationTurns || 1;
    var slotId = perkId + ':v2:' + stat + ':' + (eff.tier || eff.amount || 'flat');
    var targetSide = eff.target === 'enemy' ? (side === 'enemy' ? 'player' : 'enemy') : side;
    var targetEntity = entityForSide(targetSide);
    var targetStatus = statusBagForSide(targetSide);
    if (stat === 'acc' || stat === 'dodge' || stat === 'critchance') {
      var displayKind = stat === 'critchance' ? 'gainCritChance' : (stat === 'acc' ? 'gainAcc' : 'gainDodge');
      /* Precision uses exact points (5/10/20), not core-attribute tiers. */
      applyPassiveDisplaySlot(targetStatus, perkId, displayKind, pct);
      if (stat === 'acc' && targetStatus) {
        targetStatus.passiveAcc = Math.max(0, (Number(targetStatus.passiveAcc) || 0) + (Number(pct) || 0));
      }
      return;
    }
    if (stat === 'damage' || stat === 'magicdamage') {
      if (!status._passiveDamageBonusPending) status._passiveDamageBonusPending = Object.create(null);
      status._passiveDamageBonusPending[slotId] = {
        value: pct / 100,
        dmgType: stat === 'magicdamage' ? 'magic' : 'any',
        turns: turns,
        nextAttack: true,
      };
      return;
    }
    var loanKey = stat;
    if (loanKey === 'critchance') loanKey = 'critChance';
    if (!targetEntity) return;
    var useFlat = effectTiersFlatStat() && FLAT_CORE_STATS[loanKey];
    if (useFlat && typeof globalThis.applySourceStatLoan === 'function') {
      applySourceStatLoan(targetStatus, targetEntity, '_passiveStatLoans', loanKey, slotId, pct, turns);
    } else if (typeof globalThis.applySourceStatLoanPct === 'function') {
      applySourceStatLoanPct(targetStatus, targetEntity, '_passiveStatLoans', loanKey, slotId, pct, turns);
    }
  }

  function matchV2ParsedTrigger(parsed, ab, ctx, side) {
    if (!parsed || !parsed.trigger) return false;
    side = side || 'player';
    var t = parsed.trigger;
    var kind = t.kind;
    var actor = entityForSide(side);
    var foe = foeEntityForSide(side);
    var foeStatus = foeStatusForSide(side);
    switch (kind) {
      case 'afterSkillUse': {
        if (!ab) return false;
        if (t.skill && !abilityNameMatches(ab, t.skill)) return false;
        if (t.skillClass === 'song' && !abilityIsSong(ab)) return false;
        if (t.skillClass === 'supportOrSong' && !abilityIsSupportUtility(ab)) return false;
        if (t.supportUtility && !abilityIsSupportUtility(ab)) return false;
        if (t.magicDamaging && !(abilityIsMagicCat(ab) && abilityIsDamaging(ab))) return false;
        if (t.category === 'magic' && !abilityIsMagicCat(ab)) return false;
        if (t.category === 'physical' && !abilityIsMartial(ab)) return false;
        if (t.damaging && !abilityIsDamaging(ab)) return false;
        if (t.aspect) {
          var afterAsp = abilityAspectId(ab, actor);
          if (!afterAsp || afterAsp !== normalizeAspectId(t.aspect)) return false;
        }
        if (t.nextMartialPen) return true;
        return true;
      }
      case 'vsTargetState': {
        var okState = t.state === 'debuffed' ? enemyHasAnyAffliction(foeStatus) : false;
        if (!okState) return false;
        if (t.aspect) {
          var asp = abilityAspectId(ab, actor);
          if (!asp || asp !== normalizeAspectId(t.aspect)) return false;
        }
        return !!(ctx && (ctx.damage > 0 || ctx.hitsLanded > 0 || ab));
      }
      case 'vsTargetHpBelow': {
        var foeStats = foe && foe.stats;
        return !!(foeStats && foeStats.hp <= Math.floor((foeStats.maxHp || 1) * ((Number(t.pct) || 50) / 100)));
      }
      case 'whileHpBelow': {
        var selfStats = actor && actor.stats;
        if (!(selfStats && selfStats.hp <= Math.floor((selfStats.maxHp || 1) * ((Number(t.pct) || 50) / 100)))) return false;
        if (abilityExcludedByPassive(parsed, ab)) return false;
        if (t.skillClass === 'song') return abilityIsSong(ab);
        if (t.armourTechnique || t.afterArmourRestorationOrFortify) {
          return !!(ctx && ctx.armourTechnique) || isFortifyOrArmourRestoreAbility(ab);
        }
        /* Without an ability context (e.g. onDamaged), only song-gated rows should no-op above. */
        return !!ab;
      }
      case 'onHpBelow': {
        var pl = actor && actor.stats;
        if (!pl) return false;
        var hpThreshold = Math.floor((pl.maxHp || 1) * ((Number(t.pct) || 50) / 100));
        var hpNowOn = pl.hp || 0;
        if (ctx && Number(ctx.damage) > 0) {
          var hpBeforeOn = hpNowOn + (Number(ctx.damage) || 0);
          /* Prefer crossing the threshold on this hit. */
          return hpBeforeOn > hpThreshold && hpNowOn <= hpThreshold;
        }
        return hpNowOn <= hpThreshold;
      }
      case 'onArmourBreakLowHp': {
        if (!(ctx && ctx.brokePool)) return false;
        if (ctx.isMagic) return false;
        var br = actor && actor.stats;
        if (!br) return false;
        return br.hp <= Math.floor((br.maxHp || 1) * ((Number(t.pct) || 50) / 100));
      }
      case 'onDamagedHighHp': {
        if (!(ctx && ctx.damage > 0)) return false;
        var before = actor && actor.stats;
        if (!before) return false;
        var threshold = Math.floor((before.maxHp || 1) * ((Number(t.pct) || 50) / 100));
        var hpNow = before.hp || 0;
        return (hpNow + (Number(ctx.damage) || 0)) > threshold;
      }
      case 'afterDodge':
        return !!(ctx && ctx.dodged);
      case 'skillModifier': {
        if (!ab) return false;
        if (abilityExcludedByPassive(parsed, ab)) return false;
        if (t.skill && !abilityNameMatches(ab, t.skill)) return false;
        if (t.skillClass === 'song' && !abilityIsSong(ab)) return false;
        if (t.skillClass === 'supportOrSong' && !abilityIsSupportUtility(ab)) return false;
        if (t.category === 'magic' && !abilityIsMagicCat(ab)) return false;
        if (t.category === 'physical' && !abilityIsMartial(ab)) return false;
        if (t.damaging && !abilityIsDamaging(ab)) return false;
        if (t.weaponSkill && !abilityIsWeaponSkill(ab)) return false;
        if (t.weaponScale) {
          var scale = abilityWeaponScale(ab);
          if (scale !== String(t.weaponScale).toLowerCase()) return false;
        }
        if (t.aspect) {
          var wantAsp = normalizeAspectId(t.aspect);
          var gotAsp = abilityAspectId(ab, actor);
          if (!gotAsp || gotAsp !== wantAsp) return false;
        }
        if (t.foeState === 'burning' && !foeHasBurning(foeStatus)) return false;
        if (t.foeState === 'debuffed' && !enemyHasAnyAffliction(foeStatus)) return false;
        if (t.foeState === 'debuffedOrMarked' && !(enemyHasAnyAffliction(foeStatus) || foeHasMarked(foeStatus))) return false;
        if (t.foeState === 'bleedingOrWeakened' && !(foeHasBleed(foeStatus) || foeHasWeaken(foeStatus))) return false;
        if (t.foeHpBelow != null) {
          var foeHp = foe && foe.stats;
          if (!(foeHp && foeHp.hp <= Math.floor((foeHp.maxHp || 1) * ((Number(t.foeHpBelow) || 50) / 100)))) return false;
        }
        return true;
      }
      case 'afterArmourTechnique':
        return !!(ctx && ctx.armourTechnique) || isFortifyOrArmourRestoreAbility(ab);
      case 'afterArmourRestorationOrFortify': {
        if (!(ctx && ctx.armourTechnique) && !isFortifyOrArmourRestoreAbility(ab)) return false;
        if (t.whileSelfHpBelow != null) {
          var selfLow = actor && actor.stats;
          if (!(selfLow && selfLow.hp <= Math.floor((selfLow.maxHp || 1) * ((Number(t.whileSelfHpBelow) || 50) / 100)))) return false;
        }
        return true;
      }
      case 'afterArmourAbsorb':
        return !!(ctx && (ctx.armourAbsorbed || ctx.protectionAbsorbed));
      case 'afterDebuffApplied':
        return !!(ctx && ctx.appliedDebuff);
      case 'afterAilmentApplied':
        if (!(ctx && ctx.appliedAilment)) return false;
        if (t.ailment && String(ctx.appliedAilment).toLowerCase() !== String(t.ailment).toLowerCase()) return false;
        return true;
      case 'afterTwoDifferentSkills': {
        if (!ab) return false;
        G._passiveSkillIds = G._passiveSkillIds || Object.create(null);
        var skillBag = G._passiveSkillIds[side] || (G._passiveSkillIds[side] = Object.create(null));
        var sid = String(ab.id || ab.name || '');
        if (!sid) return false;
        skillBag[sid] = true;
        return Object.keys(skillBag).length >= 2;
      }
      case 'afterTwoDifferent1En': {
        if (!ab || abilityEnCostLocal(ab) !== 1) return false;
        G._passiveOneEnIds = G._passiveOneEnIds || Object.create(null);
        var bag = G._passiveOneEnIds[side] || (G._passiveOneEnIds[side] = Object.create(null));
        var id1 = String(ab.id || ab.name || '');
        if (id1) bag[id1] = true;
        return Object.keys(bag).length >= 2;
      }
      case 'onClassPerk':
        return !!(ctx && ctx.classPerkTriggered === (t.perk || 'verseAndChorus'));
      case 'actingFirstMartial':
        return !!(ab && abilityIsMartial(ab) && abilityEnCostLocal(ab) >= (Number(t.minEn) || 2) && sideActingFirst(side));
      case 'actingFirst':
        if (!ab || !sideActingFirst(side)) return false;
        if (t.category === 'magic' && !abilityIsMagicCat(ab)) return false;
        if (t.aspect) {
          var a2 = String((ab && (ab.aspect || ab.affinity)) || (actor && actor.aspect) || '').toLowerCase();
          if (a2 !== String(t.aspect).toLowerCase()) return false;
        }
        return true;
      case 'afterReducedDamage':
        return !!(ctx && ctx.reducedDamage);
      case 'afterSongBuff':
        return !!(ctx && ctx.songBuffGranted);
      case 'noDamageActionLastTurn':
        return !!(ctx && ctx.noDamageActionLastTurn) || !!(G && G._passiveNoDamageLastTurn && G._passiveNoDamageLastTurn[side]);
      default:
        return false;
    }
  }

  function v2DurationTurns(duration) {
    if (!duration) return 1;
    if (duration.kind === 'untilNextTurn') return 1;
    if (duration.kind === 'untilEndOfNextTurn') return 2;
    if (duration.kind === 'turns') return Math.max(1, Number(duration.turns) || 1);
    if (duration.kind === 'nextAttack') return 1;
    if (duration.kind === 'whileCondition') return 1;
    return 1;
  }

  function gateV2(birdKey, perkId, limit, opts) {
    opts = opts || {};
    if (!limit) return true;
    if (limit === 'oncePerTurn') {
      if (opts.peek) {
        G.passiveState = G.passiveState || Object.create(null);
        var tk = birdKey + ':' + perkId;
        var tst = G.passiveState[tk];
        return !(tst && tst.firedThisTurn);
      }
      return gate(birdKey, perkId, 'turn');
    }
    if (limit === 'oncePerCombat') {
      if (opts.peek) {
        G.passiveState = G.passiveState || Object.create(null);
        var bk = birdKey + ':' + perkId;
        var bst = G.passiveState[bk];
        return !(bst && bst.firedThisBattle);
      }
      return gate(birdKey, perkId, 'battle');
    }
    if (limit && typeof limit === 'object' && limit.kind === 'cooldownTurns') {
      G.passiveState = G.passiveState || Object.create(null);
      var key = birdKey + ':' + perkId;
      var st = G.passiveState[key] || (G.passiveState[key] = {
        firedThisTurn: false,
        firedThisBattle: false,
        cooldownRemaining: 0,
      });
      if ((Number(st.cooldownRemaining) || 0) > 0) return false;
      if (opts.peek) return true;
      st.cooldownRemaining = Math.max(1, Number(limit.turns) || 1);
      return true;
    }
    return true;
  }

  function applyV2Specials(perk, specials, side, ab, ctx, filterFn) {
    side = side || 'player';
    var actor = entityForSide(side);
    if (!actor || !actor.stats) return;
    for (var j = 0; j < (specials || []).length; j++) {
      var sp = specials[j];
      if (!sp) continue;
      if (typeof filterFn === 'function' && !filterFn(sp)) continue;
      if ((sp.id === 'penetration' || sp.id === 'ignoreGuardPct') && sp.pct) {
        if (side === 'enemy') {
          G._enemyWorkbookPassiveDefPen = Math.max(G._enemyWorkbookPassiveDefPen || 0, Number(sp.pct) || 0);
        } else {
          G._workbookPassiveDefPen = Math.max(G._workbookPassiveDefPen || 0, Number(sp.pct) || 0);
        }
      }
      if (sp.id === 'ignoreResolvePct' && sp.pct) {
        if (side === 'enemy') G._enemyWorkbookPassiveMdefPen = Math.max(G._enemyWorkbookPassiveMdefPen || 0, Number(sp.pct) || 0);
        else G._workbookPassiveMdefPen = Math.max(G._workbookPassiveMdefPen || 0, Number(sp.pct) || 0);
      }
      if (sp.id === 'healMaxHp' && sp.pct) {
        if (sp.requiresHealthDamage && !(ctx && Number(ctx.healthDamage) > 0)) continue;
        /* Do not revive from 0 HP — lethal damage must stick. */
        if ((Number(actor.stats.hp) || 0) <= 0) continue;
        var heal = Math.max(1, Math.floor((actor.stats.maxHp || 1) * ((Number(sp.pct) || 0) / 100)));
        actor.stats.hp = Math.min(actor.stats.maxHp || 1, (actor.stats.hp || 0) + heal);
        if (typeof setHpBar === 'function') setHpBar(side, actor.stats.hp, actor.stats.maxHp);
        if (typeof spawnFloat === 'function') spawnFloat(side, '+' + heal, 'fn-heal');
      }
      if (sp.id === 'shield' && sp.maxHpPct && typeof globalThis.applyShieldHp === 'function') {
        var shieldAmt = Math.max(1, Math.floor((actor.stats.maxHp || 1) * ((Number(sp.maxHpPct) || 0) / 100)));
        globalThis.applyShieldHp(side, { amount: shieldAmt, sourceId: perk && perk.id });
      }
      if (sp.id === 'damageReduction') {
        var dr = sp.pct != null ? (Number(sp.pct) / 100) : (v2TierPct(sp.tier || 'minor', 'up') / 100);
        if (sp.dmgType === 'physical' || !sp.dmgType) {
          actor._workbookPhysicalDr = Math.max(actor._workbookPhysicalDr || 0, dr);
        }
      }
      if (sp.id === 'cleanse' && typeof globalThis.cleanseDebuffs === 'function') {
        globalThis.cleanseDebuffs(side, sp.count === 'all' ? 99 : (Number(sp.count) || 1));
      }
      if (sp.id === 'copyMightFocus' && ctx && ctx.songBuffStat) {
        var other = String(ctx.songBuffStat).toLowerCase() === 'atk' ? 'matk' : 'atk';
        applyV2TierEffect(perk.id, { kind: 'tierStat', tier: 'minor', stat: other, dir: 'up', target: 'self' }, 1, side);
      }
      if (sp.id === 'restoreArmour' && Avian.protection && typeof Avian.protection.restoreArmour === 'function') {
        Avian.protection.restoreArmour(actor.stats, Number(sp.amount) || 0);
        if (typeof spawnFloat === 'function') spawnFloat(side, '+' + (sp.amount || 0) + ' ARM', 'fn-buff');
      }
      if (sp.id === 'restoreMagicArmour' && Avian.protection && typeof Avian.protection.restoreMagicArmour === 'function') {
        Avian.protection.restoreMagicArmour(actor.stats, Number(sp.amount) || 0);
        if (typeof spawnFloat === 'function') spawnFloat(side, '+' + (sp.amount || 0) + ' MARM', 'fn-buff');
      }
      if ((sp.id === 'restoreArmourMaxPct' || sp.id === 'restoreMagicArmourMaxPct') && sp.pct) {
        var poolStats = actor.stats;
        var isMagPool = sp.id === 'restoreMagicArmourMaxPct';
        var maxPool = isMagPool
          ? Math.max(0, Number(poolStats.normalMaxMagicArmour != null ? poolStats.normalMaxMagicArmour : poolStats.maxMagicArmour) || 0)
          : Math.max(0, Number(poolStats.normalMaxArmour != null ? poolStats.normalMaxArmour : poolStats.maxArmour) || 0);
        var restoreAmt = Math.max(1, Math.floor(maxPool * ((Number(sp.pct) || 0) / 100)));
        if (Avian.protection) {
          if (isMagPool && typeof Avian.protection.restoreMagicArmour === 'function') Avian.protection.restoreMagicArmour(poolStats, restoreAmt);
          else if (!isMagPool && typeof Avian.protection.restoreArmour === 'function') Avian.protection.restoreArmour(poolStats, restoreAmt);
        }
        if (typeof spawnFloat === 'function') spawnFloat(side, '+' + restoreAmt + (isMagPool ? ' MARM' : ' ARM'), 'fn-buff');
      }
      if (sp.id === 'armourDamage' && sp.amount) {
        statusBagForSide(side)._passiveFlatArmourDamage = (Number(statusBagForSide(side)._passiveFlatArmourDamage) || 0) + Number(sp.amount);
      }
      if (sp.id === 'magicArmourDamage' && sp.amount) {
        statusBagForSide(side)._passiveFlatMagicArmourDamage = (Number(statusBagForSide(side)._passiveFlatMagicArmourDamage) || 0) + Number(sp.amount);
      }
      if (sp.id === 'restoreLowerProtection') {
        if (sp.requiresHealthDamage && !(ctx && Number(ctx.healthDamage) > 0)) continue;
        var stats = actor.stats;
        var arm = Math.max(0, Number(stats.armour) || 0);
        var armMax = Math.max(0, Number(stats.normalMaxArmour != null ? stats.normalMaxArmour : stats.maxArmour) || 0);
        var mag = Math.max(0, Number(stats.magicArmour) || 0);
        var magMax = Math.max(0, Number(stats.normalMaxMagicArmour != null ? stats.normalMaxMagicArmour : stats.maxMagicArmour) || 0);
        var n = Math.max(0, Math.floor(Number(sp.amount) || 0));
        var useMagic = (magMax - mag) > 0 && ((armMax - arm) <= 0 || mag < arm);
        if (Avian.protection) {
          if (useMagic && typeof Avian.protection.restoreMagicArmour === 'function') Avian.protection.restoreMagicArmour(stats, n);
          else if (typeof Avian.protection.restoreArmour === 'function') Avian.protection.restoreArmour(stats, n);
        }
        if (typeof spawnFloat === 'function') spawnFloat(side, '+' + n + ' Prot', 'fn-buff');
      }
      if (sp.id === 'ignoreGuardFlat' && sp.amount) {
        if (side === 'enemy') G._enemyWorkbookPassiveDefFlat = Math.max(G._enemyWorkbookPassiveDefFlat || 0, Number(sp.amount) || 0);
        else G._workbookPassiveDefFlat = Math.max(G._workbookPassiveDefFlat || 0, Number(sp.amount) || 0);
      }
      if (sp.id === 'skillPowerBonus' && sp.amount) {
        var status = statusBagForSide(side);
        status._passiveSkillPowerBonus = (Number(status._passiveSkillPowerBonus) || 0) + Number(sp.amount);
      }
      if (sp.id === 'ailmentAppChanceBonus' && sp.amount) {
        var stApp = statusBagForSide(side);
        stApp._passiveAilmentAppBonus = (Number(stApp._passiveAilmentAppBonus) || 0) + Number(sp.amount);
      }
      if (sp.id === 'armourDamagePct' && sp.pct) {
        statusBagForSide(side)._passiveArmourDamagePct = (Number(sp.pct) || 0) / 100;
      }
      if (sp.id === 'magicArmourDamagePct' && sp.pct) {
        statusBagForSide(side)._passiveMagicArmourDamagePct = (Number(sp.pct) || 0) / 100;
      }
      if (sp.id === 'skillPowerVsMagicArmour' && sp.amount) {
        statusBagForSide(side)._passiveSkillPowerBonus = (Number(statusBagForSide(side)._passiveSkillPowerBonus) || 0) + Number(sp.amount);
        statusBagForSide(side)._passiveSkillPowerVsMagicArmour = true;
      }
      if (sp.id === 'skillPowerVsArmour' && sp.amount) {
        statusBagForSide(side)._passiveSkillPowerBonus = (Number(statusBagForSide(side)._passiveSkillPowerBonus) || 0) + Number(sp.amount);
      }
      if ((sp.id === 'fortify' || sp.id === 'ward') && sp.amount && Avian.protection) {
        var stProt = statusBagForSide(side);
        var turns = 2;
        if (sp.id === 'fortify' && typeof Avian.protection.applyFortify === 'function') {
          Avian.protection.applyFortify(actor.stats, stProt, Number(sp.amount) || 0, turns);
        } else if (sp.id === 'ward' && typeof Avian.protection.applyWard === 'function') {
          Avian.protection.applyWard(actor.stats, stProt, Number(sp.amount) || 0, turns);
        }
      }
    }
  }

  function fireV2Passive(perk, ab, context, side) {
    if (!perk || !perk.parsed || !globalThis.G) return;
    side = side || 'player';
    var actor = entityForSide(side);
    if (!actor) return;
    var parsed = perk.parsed;
    if (!parsed.trigger && !(parsed.effects && parsed.effects.length) && !(parsed.specials && parsed.specials.length)) return;
    var ctx = Object.assign({}, context || {});
    if (!matchV2ParsedTrigger(parsed, ab, ctx, side)) return;
    var status = statusBagForSide(side);
    var abKey = ab ? String(ab.id || ab.name || '') : '';
    var isSkillMod = !!(parsed.trigger && parsed.trigger.kind === 'skillModifier');
    var alreadyArmed = !!(isSkillMod && status && status._v2PassiveArmedAbility && abKey && status._v2PassiveArmedAbility === abKey);

    if (alreadyArmed) {
      if (!gateV2(actor.birdKey || perk.birdKey, perk.id, parsed.limit)) {
        status._v2PassiveArmedAbility = null;
        status._v2PassivePendingPost = false;
        return;
      }
      var armedTurns = v2DurationTurns(parsed.duration);
      var armedEffects = parsed.effects || [];
      for (var ei = 0; ei < armedEffects.length; ei++) {
        var armedEff = armedEffects[ei];
        if (armedEff && armedEff.requiresHealthDamage && !(Number(ctx.healthDamage) > 0)) continue;
        if (armedEff && armedEff.requiresHealthDamage) applyV2TierEffect(perk.id, armedEff, armedTurns, side);
        else if (armedEff && !armedEff.requiresHealthDamage) {
          /* Non-RHD effects were eligible at prepare time; skip re-applying here. */
        }
      }
      applyV2Specials(perk, parsed.specials || [], side, ab, ctx, function (sp) {
        return isPostHitHealthSpecial(sp) || !!sp.requiresHealthDamage;
      });
      status._v2PassiveArmedAbility = null;
      status._v2PassivePendingPost = false;
      return;
    }

    if (!gateV2(actor.birdKey || perk.birdKey, perk.id, parsed.limit)) return;
    var turns = v2DurationTurns(parsed.duration);
    var effects = parsed.effects || [];
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (eff && eff.requiresHealthDamage && !(Number(ctx.healthDamage) > 0)) continue;
      applyV2TierEffect(perk.id, eff, turns, side);
    }
    if (parsed.trigger && parsed.trigger.kind === 'afterSkillUse' && parsed.trigger.nextMartialPen) {
      var st = statusBagForSide(side);
      st._passiveNextMartialPen = true;
      st._passiveNextMartialPenSpecials = parsed.specials || [];
    } else if (isSkillMod) {
      /* Prefer prepareOutgoing for Skill Power; still apply remaining specials here. */
      applyV2Specials(perk, parsed.specials || [], side, ab, ctx, function (sp) {
        if (status && status._v2PassivePendingPost && isPreHitSpecial(sp)) return false;
        return true;
      });
      if (status) {
        status._v2PassiveArmedAbility = null;
        status._v2PassivePendingPost = false;
      }
    } else {
      applyV2Specials(perk, parsed.specials || [], side, ab, ctx);
    }
  }

  /**
   * Arm skillModifier pre-hit bonuses (Skill Power, etc.) before damage resolves.
   * Post-hit heals are applied later from onPlayerAbilityUse via fireV2Passive.
   */
  Avian.passives.prepareOutgoingAbilityBonuses = function prepareOutgoingAbilityBonuses(side, ab) {
    if (!globalThis.G || !ab) return;
    side = side || 'player';
    var actor = entityForSide(side);
    if (!actor) return;
    var perk = passiveFor(actor.birdKey);
    if (!perk || !perk.v2 || !perk.parsed) return;
    var parsed = perk.parsed;
    if (!parsed.trigger || parsed.trigger.kind !== 'skillModifier') return;
    if (!matchV2ParsedTrigger(parsed, ab, {}, side)) return;
    if (!gateV2(actor.birdKey || perk.birdKey, perk.id, parsed.limit, { peek: true })) return;
    var status = statusBagForSide(side);
    var abKey = String(ab.id || ab.name || '');
    if (!abKey) return;
    if (status._v2PassiveArmedAbility === abKey) return;
    var turns = v2DurationTurns(parsed.duration);
    var effects = parsed.effects || [];
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (eff && eff.requiresHealthDamage) continue;
      applyV2TierEffect(perk.id, eff, turns, side);
    }
    applyV2Specials(perk, parsed.specials || [], side, ab, {}, isPreHitSpecial);
    status._v2PassiveArmedAbility = abKey;
    status._v2PassivePendingPost = true;
  };

  Avian.passives.onClassPerkTriggered = function onClassPerkTriggered(perkId, ab, side) {
    side = side || 'player';
    var actor = entityForSide(side);
    if (!actor) return;
    var perk = passiveFor(actor.birdKey);
    if (!perk) return;
    firePassive(perk, ab, { classPerkTriggered: perkId }, side);
  };

  Avian.passives.collectPendingDamageBonusFractions = function collectPendingDamageBonusFractions(side, ab, ctx) {
    side = side || 'player';
    var status = statusBagForSide(side);
    var pending = status && status._passiveDamageBonusPending;
    if (!pending) return [];
    var isMag = abilityIsMagicCat(ab) || !!(ctx && ctx.isMagic);
    var isPhys = abilityIsMartial(ab) || !!(ctx && (ctx.isAttack || ctx.isPhysical));
    var out = [];
    var keys = Object.keys(pending);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var row = pending[key];
      if (!row) continue;
      if (row.dmgType === 'magic' && !isMag) continue;
      if (row.dmgType === 'physical' && !isPhys) continue;
      out.push(Number(row.value) || 0);
      if (row.nextAttack || (Number(row.turns) || 1) <= 1) delete pending[key];
      else row.turns = (Number(row.turns) || 1) - 1;
    }
    return out;
  };

  function workbook() { return Avian.workbookEffects || null; }

  function firePassive(perk, ab, context, side) {
    if (!perk || !globalThis.G) return;
    side = side || 'player';
    if (!entityForSide(side)) return;
    if (perk.v2) {
      fireV2Passive(perk, ab, context, side);
      return;
    }
    if (side !== 'player') return;
    var bird = G.player.birdKey;
    var we = workbook();
    var trigger = we ? we.parseTrigger(perk.trigger) : classifyTrigger(perk.trigger);
    var ctx = Object.assign({ actingFirst: G.player && G.enemy && (G.player.stats.spd || 0) >= (G.enemy.stats.spd || 0) }, context || {});
    var matched = we ? we.matchTrigger(trigger, ab, ctx) : matchTrigger(trigger, ab, ctx);
    if (!matched) return;
    if (trigger.cap && !gate(bird, perk.id, trigger.cap)) return;
    var clauses = we ? we.parseEffectClauses(perk.effect) : [];
    if (clauses.length) {
      for (var i = 0; i < clauses.length; i++) we.applyClause(perk.id, clauses[i], ctx);
    } else {
      var effects = classifyEffect(perk.effect);
      for (var j = 0; j < effects.length; j++) {
        var eff = effects[j];
        if (eff.kind === 'bonusVsAilment' || eff.kind === 'flatDamageBonus') continue;
        applyEffect(perk.id, eff);
      }
    }
  }

  Avian.passives.applyDamageBonus = function applyDamageBonus(dmg, ab, ctx) {
    if (!globalThis.G || !G.player || !ab) return dmg;
    var roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : function(n) { return Math.max(0.01, Math.round(Number(n) * 100) / 100); };
    var we = workbook();
    if (we) {
      var fracs = we.collectDamageBonusFractions(ab, ctx || {});
      for (var i = 0; i < fracs.length; i++) dmg = roundDmg(dmg * (1 + fracs[i]));
    }
    var perk = passiveFor(G.player.birdKey);
    if (!perk) return dmg;
    var trigger = we ? we.parseTrigger(perk.trigger) : classifyTrigger(perk.trigger);
    var row = rowFor(ab.id);
    if (!row) return dmg;
    if (!triggerMatchesForDamage(trigger, row, ctx || {})) return dmg;
    var effects = classifyEffect(perk.effect);
    var es = G.enemyStatus || {};
    for (var k = 0; k < effects.length; k++) {
      var eff = effects[k];
      if (eff.kind === 'bonusVsAilment') {
        if (eff.ailment === 'bleed' && !enemyHasAilmentCategory(es, 'bleed')) continue;
        if (!damageTypeMatches(row, eff.dmgType, ctx)) continue;
        if (eff.value > 0) dmg = roundDmg(dmg * (1 + eff.value / 100));
      } else if (eff.kind === 'flatDamageBonus') {
        if (!damageTypeMatches(row, eff.dmgType, ctx)) continue;
        if (eff.value > 0) dmg = roundDmg(dmg * (1 + eff.value / 100));
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
    var ctx = Object.assign({}, context || {});
    if (abilityIsSong(ab) && !ctx.songBuffGranted) {
      ctx.songBuffGranted = true;
      ctx.songBuffStat = ctx.songBuffStat || 'atk';
    }
    if (perk) firePassive(perk, ab, ctx, 'player');
    /* Deferred "next Martial after skill" pen consume on martial hits. */
    if (perk && perk.v2 && G.playerStatus && G.playerStatus._passiveNextMartialPen && abilityIsMartial(ab)) {
      applyV2Specials(perk, G.playerStatus._passiveNextMartialPenSpecials || [], 'player', ab, ctx);
      G.playerStatus._passiveNextMartialPen = false;
      G.playerStatus._passiveNextMartialPenSpecials = null;
    }
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onPlayerAbilityUse === 'function') {
      Avian.classPerks.onPlayerAbilityUse(ab, ctx);
    }
  };

  Avian.passives.onEnemyAbilityUse = function onEnemyAbilityUse(ab, context) {
    if (!globalThis.G || !G.enemy) return;
    var bird = G.enemy.birdKey;
    if (!bird) return;
    var perk = passiveFor(bird);
    var ctx = context || {};
    if (perk) firePassive(perk, ab, ctx, 'enemy');
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onEnemyAbilityUse === 'function') {
      Avian.classPerks.onEnemyAbilityUse(ab, ctx);
    }
  };

  Avian.passives.onPlayerDamaged = function onPlayerDamaged(damage, isMagic, ctx) {
    if (!globalThis.G || !G.player) return;
    var perk = passiveFor(G.player.birdKey);
    if (perk) {
      firePassive(perk, null, Object.assign({
        damage: damage,
        isPhysical: !isMagic,
        isMagic: !!isMagic,
      }, ctx || {}), 'player');
    }
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onPlayerDamaged === 'function') {
      Avian.classPerks.onPlayerDamaged(damage, isMagic, ctx);
    }
  };

  Avian.passives.onEnemyDamaged = function onEnemyDamaged(damage, isMagic, ctx) {
    if (!globalThis.G || !G.enemy) return;
    var perk = passiveFor(G.enemy.birdKey);
    if (perk) {
      firePassive(perk, null, Object.assign({
        damage: damage,
        isPhysical: !isMagic,
        isMagic: !!isMagic,
      }, ctx || {}), 'enemy');
    }
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onEnemyDamaged === 'function') {
      Avian.classPerks.onEnemyDamaged(damage, isMagic, ctx);
    }
  };

  Avian.passives.onArmourAbsorbed = function onArmourAbsorbed(entity, amount) {
    if (!globalThis.G || !entity || !(amount > 0)) return;
    var side = entity === G.enemy ? 'enemy' : 'player';
    var perk = passiveFor(entity.birdKey);
    if (perk) firePassive(perk, null, { armourAbsorbed: true, protectionAbsorbed: true, damage: amount }, side);
  };

  Avian.passives.onPlayerDodged = function onPlayerDodged(ctx) {
    if (!globalThis.G || !G.player) return;
    var perk = passiveFor(G.player.birdKey);
    if (perk) firePassive(perk, null, Object.assign({ dodged: true }, ctx || {}), 'player');
  };

  Avian.passives.onAilmentAppliedByPlayer = function onAilmentAppliedByPlayer(ailmentId) {
    if (!globalThis.G || !G.player) return;
    var perk = passiveFor(G.player.birdKey);
    if (!perk) return;
    var debuffs = { poison: 1, bleed: 1, weaken: 1, feared: 1, paralyzed: 1, burning: 1, chilled: 1, blinded: 1, accDebuff: 1 };
    firePassive(perk, null, {
      appliedAilment: ailmentId,
      appliedDebuff: !!debuffs[ailmentId],
    });
  };

  Avian.passives.onPlayerTurnStartPassive = function onPlayerTurnStartPassive(player) {
    if (!globalThis.G || !player) return;
    var perk = passiveFor(player.birdKey);
    if (!perk) return;
    var we = workbook();
    var ctx = {
      firstPhysicalUsed: !!G._workbookFirstPhysicalUsed,
      firstSupportUsed: !!G._workbookFirstSupportUsed,
      turnStart: true,
      dummyAb: { id: '', type: 'physical' },
    };
    if (we && typeof we.onTurnStart === 'function') we.onTurnStart(perk, ctx);
    var trigger = we ? we.parseTrigger(perk.trigger) : classifyTrigger(perk.trigger);
    if (trigger.kind === 'turnStart') firePassive(perk, null, { turnStart: true });
    G._workbookFirstPhysicalUsed = false;
    G._workbookFirstSupportUsed = false;
    if (G._passiveSkillIds) G._passiveSkillIds.player = Object.create(null);
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onPlayerTurnStart === 'function') {
      Avian.classPerks.onPlayerTurnStart();
    }
  };

  Avian.passives.onBattleStart = function onBattleStart() {
    G.passiveState = Object.create(null);
    G._passiveSkillIds = Object.create(null);
    if (typeof Avian.passives.applyClassPerkAtBattleStart === 'function') {
      Avian.passives.applyClassPerkAtBattleStart();
    }
  };

  Avian.passives.onPlayerTurnStart = function onPlayerTurnStart(player) {
    if (G.passiveState) {
      for (var k in G.passiveState) {
        G.passiveState[k].firedThisTurn = false;
        if ((Number(G.passiveState[k].cooldownRemaining) || 0) > 0) {
          G.passiveState[k].cooldownRemaining -= 1;
        }
      }
    }
    G._workbookOneEnCount = 0;
    if (G._passiveOneEnIds) G._passiveOneEnIds.player = Object.create(null);
    if (G.playerStatus) {
      G.playerStatus._v2PassiveArmedAbility = null;
      G.playerStatus._v2PassivePendingPost = false;
    }
    if (typeof Avian.passives.onPlayerTurnStartPassive === 'function') {
      Avian.passives.onPlayerTurnStartPassive(player);
    }
  };

  Avian.passives.onEnemyTurnStartPassive = function onEnemyTurnStartPassive() {
    if (!globalThis.G || !G.enemy) return;
    if (G._passiveOneEnIds) G._passiveOneEnIds.enemy = Object.create(null);
    if (typeof Avian.classPerks !== 'undefined' && typeof Avian.classPerks.onEnemyTurnStart === 'function') {
      Avian.classPerks.onEnemyTurnStart();
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
    var effectText = perk.effect;
    if (typeof globalThis.getFixedPassiveEffectText === 'function') {
      effectText = globalThis.getFixedPassiveEffectText(birdKey) || perk.effect;
    }
    return { id: perk.id, name: perk.name, desc: effectText, effect: effectText, trigger: perk.trigger || perk.triggerLimit || '', balance: perk.balanceNote };
  };

  Avian.systems.passives = Avian.passives;
})();
