/* Workbook class perks — one fixed perk per class/bird from master workbook. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.classPerks = Avian.classPerks || Object.create(null);

  var PERK_BY_NAME = Object.freeze({
    'Rogue Tempo': {
      id: 'rogueTempo',
      precisionBonus: 10,
      weaponSkill1Only: true,
      needsActingFirst: true,
      armourBreakAgility: 4,
    },
    'Bulwark Oath': {
      id: 'bulwarkOath',
      guardBonus: 4,
      afterArmourRestoreOrFortify: true,
    },
    'Arcane Pressure': {
      id: 'arcanePressure',
      magicArmourDamageBonus: 0.10,
      firstMagicWeaponSkillPerTurn: true,
    },
    'Verse and Chorus': {
      id: 'verseAndChorus',
      restoreLowerPool: 2,
      skillPowerBonus: 10,
      alternateMartialMagic: true,
    },
    'Judgement Leech': {
      id: 'judgementLeech',
      restoreLowerPool: 2,
      healMaxHpPct: 0.05,
      oncePerTurn: true,
    },
    'Resonant Hex': { id: 'resonantHex', debuffTurnBonus: 1, statDebuffOnly: true },
    'Cursed Call': {
      id: 'cursedCall',
      afterMagicArmourBreak: true,
      appChanceBonus: 10,
      debuffTurnBonus: 1,
      oncePerTurn: true,
    },
    'Retaliating Hide': { id: 'retaliatingHide', nextPhysicalBonus: 0.10, afterMagicDamage: true },
    'Crushing Momentum': {
      id: 'crushingMomentum',
      skillPowerBonus: 10,
      afterArmourAbsorb: true,
      strengthWeaponOnly: true,
    },
    'Duke Ascension': {
      id: 'dukeAscension',
      killDamageBonus: 0.05,
      restoreProtectionPct: 0.25,
      stacking: true,
    },
  });

  function isV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function birds() { return globalThis.BIRDS || {}; }

  function classes() {
    if (isV2() && Avian.data && Avian.data.combatPack && Avian.data.combatPack.classes) {
      return Avian.data.combatPack.classes;
    }
    return (Avian.data && Avian.data.combatPack && Avian.data.combatPack.classes) || {};
  }

  function resolveClassKey(birdKey) {
    var bd = birds()[birdKey];
    if (isV2() && typeof Avian.getBirdV2 === 'function') {
      var v2 = Avian.getBirdV2(birdKey);
      if (v2 && v2.class) return String(v2.class).toLowerCase();
    }
    var cls = String(bd && bd.class || '').toLowerCase();
    if (cls === 'striker') return 'rogue';
    if (cls === 'singer') return 'mage';
    if (cls === 'predator') return 'inquisitor';
    if (cls === 'trickster') return 'bard';
    if (cls === 'tank' || cls === 'bruiser') return cls === 'bruiser' ? 'brute' : 'knight';
    return cls;
  }

  function perkDefFromClassRow(clsRow) {
    if (!clsRow) return null;
    var name = clsRow.classPerk || '';
    var def = PERK_BY_NAME[name];
    if (!def) return null;
    return Object.assign({}, def);
  }

  ns.getClassPerkForBird = function getClassPerkForBird(birdKey) {
    var bd = birds()[birdKey];
    if (!bd) return null;
    var classKey = resolveClassKey(birdKey);
    var clsRow = classes()[classKey];
    var name = bd.classPerk || (clsRow && clsRow.classPerk) || '';
    var def = PERK_BY_NAME[name] || perkDefFromClassRow(clsRow);
    if (!def) return null;
    if (isV2() && clsRow) def = perkDefFromClassRow(clsRow) || def;
    return {
      id: def.id,
      name: name || (clsRow && clsRow.classPerk) || '',
      effect: bd.classPerkEffect || (clsRow && clsRow.classPerkEffect) || '',
      def: def,
      parsed: clsRow && clsRow.classPerkParsed,
    };
  };

  ns.getClassPerkForEntity = function getClassPerkForEntity(entity) {
    if (!entity) return null;
    if (entity._classPerk && entity._classPerk.def) return entity._classPerk;
    return ns.getClassPerkForBird(entity.birdKey);
  };

  ns.applyClassPerkMetadata = function applyClassPerkMetadata(entity) {
    if (!entity) return entity;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return entity;
    entity._classPerk = perk;
    entity.classPerk = perk.name;
    entity.classPerkEffect = perk.effect;
    /* Arcane Pressure no longer grants Resolve penetration — Magic Armour damage only. */
    entity._classPerkMdefPen = 0;
    if (entity.stats) {
      entity.stats.classPerk = perk.name;
      entity.stats.classPerkEffect = perk.effect;
    }
    return entity;
  };

  function state(side) {
    var g = globalThis.G;
    if (!g) return null;
    var status = side === 'enemy' ? (g.enemyStatus = g.enemyStatus || {}) : (g.playerStatus = g.playerStatus || {});
    if (!status._classPerkState) status._classPerkState = Object.create(null);
    return status._classPerkState;
  }

  ns.onBattleStart = function onBattleStart() {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var st = state('player');
    if (st) {
      for (var k in st) delete st[k];
    }
    var est = state('enemy');
    if (est) {
      for (var ek in est) delete est[ek];
    }
    g.player._classPerkMdefPen = 0;
    g.player._classPerkDukeStacks = 0;
    ns.applyClassPerkMetadata(g.player);
    if (g.enemy) {
      ns.applyClassPerkMetadata(g.enemy);
      if (g.enemy) g.enemy._classPerkMdefPen = 0;
    }
  };

  function abIsPhysical(ab) {
    var kind = String(ab && (ab.btnType || ab.type) || '').toLowerCase();
    return kind === 'physical' || kind === 'ranged';
  }

  function abIsMagic(ab) {
    var kind = String(ab && (ab.btnType || ab.type) || '').toLowerCase();
    return kind === 'spell' || kind === 'magic';
  }

  function abEnCost(ab) {
    var row = null;
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function' && Avian.data && Avian.data.combatPack) {
      var id = globalThis.resolveAbilityAliasSourceId(ab && ab.id);
      row = (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function')
        ? Avian.equipmentActions.skillToAbilityRow(id, null, 'grey')
        : null;
    }
    var enMax = isV2() ? 6 : 4;
    return Math.max(1, Math.min(enMax, Number(row && (row.enCost != null ? row.enCost : row.apCost) != null ? (row.enCost != null ? row.enCost : row.apCost) : (ab && (ab.energy || ab.energyCost)) || 1)));
  }

  function isBasicAttack(ab) {
    if (!ab) return false;
    if (ab.actionSource === 'basic' || ab.isMainAttack) return true;
    var id = String(ab.id || ab.equipmentSkillId || '');
    if (/^BASIC_(PHYSICAL|MAGIC)$/i.test(id)) return true;
    var name = String(ab.name || '');
    return /^(Beak Jab|Tail Wand|Natural Strike|Basic Attack)/i.test(name);
  }

  function isWeaponSkill1(ab) {
    if (!ab) return false;
    if (isBasicAttack(ab)) return false;
    var bar = String(ab.barSlot || ab.skillType || '').toLowerCase();
    if (bar.indexOf('weapon skill 1') >= 0 || bar === 'skill 1' || /skill\s*1/.test(bar)) return true;
    var id = String(ab.id || ab.equipmentSkillId || '');
    if (/^WSK-\d+$/i.test(id)) {
      /* Odd WSK ids are Skill 1 in the catalogue (001,003,...); even are Skill 2. */
      var n = parseInt(id.replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && n % 2 === 1) return true;
    }
    var en = abEnCost(ab);
    /* Weapon Skill 1 is typically 2 EN. */
    if (en === 2 && (ab.actionSource === 'weapon' || ab.family || /weapon/i.test(String(ab.source || '')))) return true;
    return false;
  }

  function rogueTempoEligible(entity, ab) {
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'rogueTempo') return false;
    var g = globalThis.G;
    var side = entity === (g && g.enemy) ? 'enemy' : 'player';
    var st = state(side) || {};
    if (st.rogueTempoUsed) return false;
    if (!isWeaponSkill1(ab)) return false;
    if (perk.def.needsActingFirst && !entityActingFirst(entity)) return false;
    return true;
  }

  ns.peekRogueTempoPrecision = function peekRogueTempoPrecision(entity, ab) {
    if (!rogueTempoEligible(entity, ab)) return 0;
    var perk = ns.getClassPerkForEntity(entity);
    return Number(perk && perk.def && perk.def.precisionBonus) || 10;
  };

  ns.markRogueTempoPrecisionUsed = function markRogueTempoPrecisionUsed(entity) {
    var g = globalThis.G;
    if (!g || !entity) return;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    st.rogueTempoUsed = true;
    st.rogueTempoArmourBreakPending = true;
  };

  ns.onRogueTempoArmourBreak = function onRogueTempoArmourBreak(entity) {
    var g = globalThis.G;
    if (!g || !entity) return;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    if (!st.rogueTempoArmourBreakPending) return;
    st.rogueTempoArmourBreakPending = false;
    var perk = ns.getClassPerkForEntity(entity);
    var bonus = Number(perk && perk.def && perk.def.armourBreakAgility) || 4;
    if (!entity.stats) return;
    entity.stats.spd = (Number(entity.stats.spd) || 0) + bonus;
    st.rogueTempoAgilityBonus = bonus;
    if (side === 'player') {
      g.playerStatus = g.playerStatus || {};
      g.playerStatus.rogueTempoAgility = { turns: 1, amount: bonus };
    }
  };

  function entityActingFirst(entity) {
    var g = globalThis.G;
    if (!g || !g.player || !g.enemy || !entity) return false;
    var foe = entity === g.enemy ? g.player : g.enemy;
    return ((entity.stats && entity.stats.spd) || 0) >= ((foe.stats && foe.stats.spd) || 0);
  }

  function playerActingFirst() {
    var g = globalThis.G;
    return entityActingFirst(g && g.player);
  }

  function enemyHasAnyDebuff() {
    var es = (globalThis.G && G.enemyStatus) || {};
    var burning = es.burning && ((typeof es.burning === 'number' && es.burning > 0) || (typeof es.burning === 'object' && ((es.burning.stacks || 0) > 0 || (es.burning.turns || 0) > 0)));
    return (es.poison && es.poison.stacks > 0) || (es.bleed && es.bleed.stacks > 0) || (es.feared || 0) > 0
      || (typeof globalThis.getWeakenStacks === 'function' ? globalThis.getWeakenStacks(es) > 0 : (es.weaken || 0) > 0)
      || (es.paralyzed || 0) > 0 || !!es.confused || burning
      || (es.chilled && es.chilled.stacks > 0) || (es.accDebuff || 0) > 0;
  }

  function restoreLowerProtectionPool(entity, amount) {
    if (!entity || !entity.stats || !Avian.protection) return { restored: 0, healed: false };
    var stats = entity.stats;
    if (typeof Avian.protection.ensureProtectionFields === 'function') {
      Avian.protection.ensureProtectionFields(stats);
    }
    var arm = Math.max(0, Number(stats.armour) || 0);
    var armMax = Math.max(0, Number(stats.normalMaxArmour != null ? stats.normalMaxArmour : stats.maxArmour) || 0);
    var mag = Math.max(0, Number(stats.magicArmour) || 0);
    var magMax = Math.max(0, Number(stats.normalMaxMagicArmour != null ? stats.normalMaxMagicArmour : stats.maxMagicArmour) || 0);
    var armRoom = Math.max(0, armMax - arm);
    var magRoom = Math.max(0, magMax - mag);
    if (armRoom <= 0 && magRoom <= 0) return { restored: 0, healed: false, bothFull: true };
    var useMagic = magRoom > 0 && (armRoom <= 0 || mag < arm);
    var n = Math.max(0, Math.floor(Number(amount) || 0));
    if (useMagic) {
      if (typeof Avian.protection.restoreMagicArmour === 'function') Avian.protection.restoreMagicArmour(stats, n);
      else stats.magicArmour = Math.min(magMax, mag + n);
    } else {
      if (typeof Avian.protection.restoreArmour === 'function') Avian.protection.restoreArmour(stats, n);
      else stats.armour = Math.min(armMax, arm + n);
    }
    return { restored: n, healed: false, bothFull: false };
  }

  function isStrengthWeaponSkill(ab) {
    if (!ab) return false;
    var cat = String(ab.damageCategory || ab.category || '').toLowerCase();
    if (cat.indexOf('strength') >= 0) return true;
    var scale = String(ab.scalingStat || ab.scaleStat || ab.damageStat || '').toUpperCase();
    return scale === 'ATK' || scale === 'MIGHT' || scale === 'DEF' || scale === 'GUARD';
  }

  function isMagicWeaponSkill(ab) {
    if (!abIsMagic(ab)) return false;
    if (isBasicAttack(ab)) return false;
    var src = String(ab.source || ab.actionSource || ab.family || '').toLowerCase();
    return /weapon|wand|staff|orb|sceptre|grimoire|song|hex/i.test(src)
      || /^WSK-/i.test(String(ab.id || ab.equipmentSkillId || ''))
      || Number(ab.en || ab.enCost || ab.energy || 0) >= 2;
  }

  function isFortifyOrArmourRestore(ab) {
    if (!ab) return false;
    var name = String(ab.name || ab.id || '');
    var bar = String(ab.barSlot || ab.skillType || ab.riderText || '');
    if (/fortify|armour restoration|armor restoration|restore armour|restore armor/i.test(name + ' ' + bar)) {
      return true;
    }
    var row = ab._dispatcherRow || ab;
    var riders = row.riders || row.protectionRiders || ab.riders || ab.protectionRiders || [];
    for (var i = 0; i < riders.length; i++) {
      var k = riders[i] && (riders[i].kind || riders[i].type);
      if (k === 'fortify' || k === 'restoreArmour' || k === 'bastion' || k === 'restoreLowerPool') return true;
    }
    var text = String(row.riderText || ab.riderText || ab.effect || '').toLowerCase();
    return /\bfortify\b/.test(text) || /restore\s+\d+\s+(?:armour|armor)/.test(text);
  }

  function targetQualifiesForJudgement(status) {
    if (!status) return false;
    var burning = status.burning && ((typeof status.burning === 'number' && status.burning > 0) || (typeof status.burning === 'object' && ((status.burning.stacks || 0) > 0 || (status.burning.turns || 0) > 0)));
    if ((status.poison && status.poison.stacks > 0) || (status.bleed && status.bleed.stacks > 0) || (status.feared || 0) > 0
      || (typeof globalThis.getWeakenStacks === 'function' ? globalThis.getWeakenStacks(status) > 0 : (status.weaken || 0) > 0)
      || (status.paralyzed || 0) > 0 || !!status.confused || burning
      || (status.chilled && status.chilled.stacks > 0) || (status.accDebuff || 0) > 0) return true;
    if (status.marked || status.carrionMark || status.jewelMark || status.predatorMark) return true;
    if (status._marks && Object.keys(status._marks).length) return true;
    return false;
  }

  function onEntityAbilityUse(entity, side, ab, ctx) {
    var g = globalThis.G;
    if (!g || !entity || !ab) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return;
    var st = state(side);
    ctx = ctx || {};

    /* Bulwark Oath: after Armour Restoration or Fortify → +4 Guard until next turn. */
    if (perk.def.id === 'bulwarkOath' && !st.bulwarkOathUsed && isFortifyOrArmourRestore(ab)) {
      st.bulwarkOathUsed = true;
      var guardBonus = perk.def.guardBonus || 4;
      entity.stats = entity.stats || {};
      entity.stats.def = (Number(entity.stats.def) || 0) + guardBonus;
      st.bulwarkGuardBonus = guardBonus;
      if (typeof spawnFloat === 'function') spawnFloat(side, '+' + guardBonus + ' Guard', 'fn-buff');
      if (typeof logMsg === 'function') {
        logMsg(perk.name + ': +' + guardBonus + ' Guard until next turn.', side === 'player' ? 'player-action' : 'enemy-action');
      }
      ctx.classPerkTriggered = 'bulwarkOath';
    }

    /* Ensure Arcane / Verse flags are armed even when damage path skipped prepare. */
    ns.prepareOutgoingAbilityBonuses(entity, ab);

    if (perk.def.id === 'arcanePressure' && st.arcanePressureActive) {
      ctx.classPerkTriggered = 'arcanePressure';
    }

    if (perk.def.id === 'verseAndChorus' && st.versePreparedThisAction) {
      ctx.classPerkTriggered = 'verseAndChorus';
      st.versePreparedThisAction = false;
    }

    if (perk.def.id === 'crushingMomentum' && st.crushingMomentumConsumedThisAction) {
      ctx.classPerkTriggered = 'crushingMomentum';
      st.crushingMomentumConsumedThisAction = false;
    }

    /* Judgement Leech: once/turn after Health damage to ailmented/debuffed/Marked target. */
    var healthHit = (ctx.healthDamage != null)
      ? (Number(ctx.healthDamage) || 0) > 0
      : ((ctx.hitsLanded || 0) > 0 && !!(g._lastProtectionHit && g._lastProtectionHit.damagedHealth));
    if (perk.def.id === 'judgementLeech' && !st.judgementLeechUsed && healthHit) {
      var foeStatus = side === 'player' ? (g.enemyStatus || {}) : (g.playerStatus || {});
      if (targetQualifiesForJudgement(foeStatus)) {
        st.judgementLeechUsed = true;
        var jr = restoreLowerProtectionPool(entity, perk.def.restoreLowerPool || 2);
        if (jr.bothFull) {
          var heal = Math.max(1, Math.floor((entity.stats.maxHp || 1) * (perk.def.healMaxHpPct || 0.05)));
          entity.stats.hp = Math.min(entity.stats.maxHp || 1, (entity.stats.hp || 0) + heal);
          if (typeof spawnFloat === 'function') spawnFloat(side, '+' + heal, 'fn-heal');
          if (typeof setHpBar === 'function') setHpBar(side, entity.stats.hp, entity.stats.maxHp);
          if (typeof logMsg === 'function') {
            logMsg(perk.name + ': healed ' + heal + ' HP (pools full).', side === 'player' ? 'player-action' : 'enemy-action');
          }
        } else if (jr.restored > 0) {
          if (typeof spawnFloat === 'function') spawnFloat(side, '+' + jr.restored + ' Prot', 'fn-buff');
          if (typeof logMsg === 'function') {
            logMsg(perk.name + ': restored ' + jr.restored + ' to the lower protection pool.', side === 'player' ? 'player-action' : 'enemy-action');
          }
        }
        ctx.classPerkTriggered = 'judgementLeech';
      }
    }
  }

  /**
   * Call before damage/skill-power resolution so Verse Skill Power and Arcane Pressure
   * apply to the skill that triggers them (not after the hit resolves).
   */
  ns.prepareOutgoingAbilityBonuses = function prepareOutgoingAbilityBonuses(entity, ab) {
    var g = globalThis.G;
    if (!g || !entity || !ab) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side);
    if (!st) return;

    if (perk.def.id === 'arcanePressure' && !st.arcanePressureUsed && isMagicWeaponSkill(ab)) {
      st.arcanePressureActive = true;
    }

    if (perk.def.id === 'verseAndChorus' && !st.versePreparedThisAction) {
      var channel = abIsPhysical(ab) ? 'martial' : (abIsMagic(ab) ? 'magic' : null);
      var isDamaging = channel && !ab.noDamage;
      if (isDamaging) {
        if (!st.verseLastChannel) {
          st.verseLastChannel = channel;
        } else if (st.verseLastChannel !== channel && !st.verseChorusUsed) {
          st.verseChorusUsed = true;
          st.versePreparedThisAction = true;
          var vr = restoreLowerProtectionPool(entity, perk.def.restoreLowerPool || 2);
          if (vr.bothFull) {
            st.verseChorusSkillPower = perk.def.skillPowerBonus || 10;
            if (typeof logMsg === 'function') {
              logMsg(perk.name + ': +' + (perk.def.skillPowerBonus || 10) + ' Skill Power (pools full).', side === 'player' ? 'player-action' : 'enemy-action');
            }
          } else if (vr.restored > 0) {
            if (typeof spawnFloat === 'function') spawnFloat(side, '+' + vr.restored + ' Prot', 'fn-buff');
            if (typeof logMsg === 'function') {
              logMsg(perk.name + ': restored ' + vr.restored + ' to the lower protection pool.', side === 'player' ? 'player-action' : 'enemy-action');
            }
          }
          if (typeof Avian.passives !== 'undefined' && typeof Avian.passives.onClassPerkTriggered === 'function') {
            Avian.passives.onClassPerkTriggered('verseAndChorus', ab, side);
          }
          st.verseLastChannel = channel;
        } else {
          st.verseLastChannel = channel;
        }
      }
    }
  };

  function onEntityDamaged(entity, side, damage, isMagic, opts) {
    var g = globalThis.G;
    if (!g || !entity || damage <= 0) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return;
    var st = state(side);
    opts = opts || {};
    if (perk.def.id === 'retaliatingHide' && isMagic) {
      st.retaliatingHidePending = true;
    }
    /* Crushing Momentum: after Armour absorbs physical damage (once pending per absorb window). */
    if (perk.def.id === 'crushingMomentum' && !isMagic && (opts.armourAbsorbed || opts.protectionAbsorbed)) {
      if (!st.crushingMomentumArmedThisTurn) {
        st.crushingMomentumPending = true;
        st.crushingMomentumArmedThisTurn = true;
      }
    }
  }

  /** Called when a hostile Magic skill depletes the defender's Magic Armour. */
  ns.onMagicArmourBroken = function onMagicArmourBroken(attacker, defender) {
    var g = globalThis.G;
    if (!g || !attacker) return;
    var perk = ns.getClassPerkForEntity(attacker);
    if (!perk || perk.def.id !== 'cursedCall') return;
    var side = attacker === g.enemy ? 'enemy' : 'player';
    var st = state(side);
    if (!st || st.cursedCallUsed) return;
    st.cursedCallPending = true;
    st.cursedCallUsed = true;
  };

  /** Peek / consume Cursed Call application bonus for the next ailment/debuff. */
  ns.consumeCursedCallAppBonus = function consumeCursedCallAppBonus(entity) {
    var g = globalThis.G;
    if (!g || !entity) return 0;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'cursedCall') return 0;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    if (!st.cursedCallPending) return 0;
    st.cursedCallPending = false;
    st.cursedCallDurationPending = true;
    return perk.def.appChanceBonus || 10;
  };

  ns.peekArcanePressureMagicArmourBonus = function peekArcanePressureMagicArmourBonus(entity, ab) {
    var g = globalThis.G;
    if (!g || !entity) return 0;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'arcanePressure') return 0;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    if (st.arcanePressureActive) return perk.def.magicArmourDamageBonus || 0.10;
    if (!st.arcanePressureUsed && ab && isMagicWeaponSkill(ab)) return perk.def.magicArmourDamageBonus || 0.10;
    return 0;
  };

  ns.consumeArcanePressureFlag = function consumeArcanePressureFlag(entity) {
    var g = globalThis.G;
    if (!g || !entity) return;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side);
    if (st) {
      st.arcanePressureActive = false;
      st.arcanePressureUsed = true;
    }
  };

  ns.peekCrushingMomentumSkillPower = function peekCrushingMomentumSkillPower(entity, ab) {
    var g = globalThis.G;
    if (!g || !entity) return 0;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'crushingMomentum') return 0;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    if (!st.crushingMomentumPending) return 0;
    if (ab && !isStrengthWeaponSkill(ab)) return 0;
    st.crushingMomentumPending = false;
    st.crushingMomentumConsumedThisAction = true;
    return perk.def.skillPowerBonus || 10;
  };

  ns.peekVerseChorusSkillPower = function peekVerseChorusSkillPower(entity) {
    var g = globalThis.G;
    if (!g || !entity) return 0;
    var side = entity === g.enemy ? 'enemy' : 'player';
    var st = state(side) || {};
    var n = st.verseChorusSkillPower || 0;
    st.verseChorusSkillPower = 0;
    return n;
  };

  /** Flat Skill Power points from class perks for the current outgoing ability. */
  ns.getOutgoingSkillPowerBonus = function getOutgoingSkillPowerBonus(entity, ab) {
    if (!entity || !ab) return 0;
    ns.prepareOutgoingAbilityBonuses(entity, ab);
    var n = 0;
    n += ns.peekCrushingMomentumSkillPower(entity, ab) || 0;
    n += ns.peekVerseChorusSkillPower(entity) || 0;
    return n;
  };

  ns.onPlayerAbilityUse = function onPlayerAbilityUse(ab, ctx) {
    var g = globalThis.G;
    onEntityAbilityUse(g && g.player, 'player', ab, ctx);
  };

  ns.onEnemyAbilityUse = function onEnemyAbilityUse(ab, ctx) {
    var g = globalThis.G;
    onEntityAbilityUse(g && g.enemy, 'enemy', ab, ctx);
  };

  ns.onPlayerDamaged = function onPlayerDamaged(damage, isMagic, opts) {
    var g = globalThis.G;
    onEntityDamaged(g && g.player, 'player', damage, isMagic, opts);
  };

  ns.onEnemyDamaged = function onEnemyDamaged(damage, isMagic, opts) {
    var g = globalThis.G;
    onEntityDamaged(g && g.enemy, 'enemy', damage, isMagic, opts);
  };

  /** Notify Armour absorption for Crushing Momentum / species hooks. */
  ns.onArmourAbsorbed = function onArmourAbsorbed(entity, amount) {
    if (!entity || !(amount > 0)) return;
    var g = globalThis.G;
    var side = entity === (g && g.enemy) ? 'enemy' : 'player';
    onEntityDamaged(entity, side, amount, false, { armourAbsorbed: true, protectionAbsorbed: true });
  };

  ns.collectOutgoingDamageBonusFractionsForEntity = function collectOutgoingDamageBonusFractionsForEntity(entity, ab, ctx) {
    var g = globalThis.G;
    if (!g || !entity || !ab) return [];
    var side = entity === g.enemy ? 'enemy' : 'player';
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return [];
    var st = state(side) || {};
    var out = [];
    var isPhys = abIsPhysical(ab);

    if (perk.def.id === 'retaliatingHide' && st.retaliatingHidePending && isPhys) {
      out.push(perk.def.nextPhysicalBonus || 0.10);
      st.retaliatingHidePending = false;
    }
    /* Crushing Momentum / Verse Chorus Skill Power are applied via skillPower hooks, not flat damage %. */
    if (perk.def.id === 'dukeAscension' && (entity._classPerkDukeStacks || 0) > 0) {
      out.push((entity._classPerkDukeStacks || 0) * (perk.def.killDamageBonus || 0.05));
    }
    return out;
  };

  ns.collectOutgoingDamageBonusFractions = function collectOutgoingDamageBonusFractions(ab, ctx) {
    var g = globalThis.G;
    return ns.collectOutgoingDamageBonusFractionsForEntity(g && g.player, ab, ctx);
  };

  /* Bulwark Oath no longer reduces incoming damage — Guard Up after Fortify/restoration. */
  ns.getIncomingDamageMultiplierForEntity = function getIncomingDamageMultiplierForEntity(entity) {
    return 1;
  };

  ns.markBulwarkOathConsumed = function markBulwarkOathConsumed(entity) {
    /* No-op retained for callers; Bulwark now marks used on Fortify/restore. */
    if (!entity) return;
    var side = (globalThis.G && globalThis.G.player === entity) ? 'player' : 'enemy';
    var st = state(side);
    if (st) st.bulwarkOathUsed = true;
  };

  ns.getIncomingDamageMultiplier = function getIncomingDamageMultiplier() {
    return 1;
  };

  ns.getExtraMdefPierceForEntity = function getExtraMdefPierceForEntity(entity, ab) {
    /* Arcane Pressure no longer grants Resolve penetration. */
    return 0;
  };

  ns.getExtraMdefPierce = function getExtraMdefPierce(ab) {
    return 0;
  };

  ns.adjustDebuffDurationForEntity = function adjustDebuffDurationForEntity(entity, baseTurns, ailmentId) {
    if (!entity) return baseTurns;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return baseTurns;
    var g = globalThis.G;
    var side = entity === (g && g.enemy) ? 'enemy' : 'player';
    var st = state(side) || {};
    if (perk.def.id === 'cursedCall' && st.cursedCallDurationPending) {
      st.cursedCallDurationPending = false;
      return baseTurns + (perk.def.debuffTurnBonus || 1);
    }
    if (perk.def.id === 'resonantHex') {
      var statDebuffs = { accDebuff: 1, weaken: 1 };
      if (!ailmentId || statDebuffs[ailmentId]) return baseTurns + (perk.def.debuffTurnBonus || 1);
    }
    return baseTurns;
  };

  ns.adjustDebuffDuration = function adjustDebuffDuration(baseTurns, ailmentId) {
    var g = globalThis.G;
    return ns.adjustDebuffDurationForEntity(g && g.player, baseTurns, ailmentId);
  };

  ns.onEnemyDefeated = function onEnemyDefeated() {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk) return;
    if (perk.def.id === 'dukeAscension') {
      g.player._classPerkDukeStacks = (g.player._classPerkDukeStacks || 0) + 1;
      var stats = g.player.stats || {};
      var pct = perk.def.restoreProtectionPct || 0.25;
      var armMax = Math.max(0, Number(stats.normalMaxArmour != null ? stats.normalMaxArmour : stats.maxArmour) || 0);
      var magMax = Math.max(0, Number(stats.normalMaxMagicArmour != null ? stats.normalMaxMagicArmour : stats.maxMagicArmour) || 0);
      var armRestore = Math.floor(armMax * pct);
      var magRestore = Math.floor(magMax * pct);
      if (Avian.protection) {
        if (armRestore > 0 && typeof Avian.protection.restoreArmour === 'function') {
          Avian.protection.restoreArmour(stats, armRestore);
        }
        if (magRestore > 0 && typeof Avian.protection.restoreMagicArmour === 'function') {
          Avian.protection.restoreMagicArmour(stats, magRestore);
        }
      } else {
        stats.armour = Math.min(armMax, (Number(stats.armour) || 0) + armRestore);
        stats.magicArmour = Math.min(magMax, (Number(stats.magicArmour) || 0) + magRestore);
      }
      if (typeof logMsg === 'function') {
        logMsg(perk.name + ': restored protection and +5% all damage this combat.', 'player-action');
      }
    }
  };

  ns.onPlayerTurnStart = function onPlayerTurnStart() {
    var st = state('player');
    if (!st) return;
    st.rogueTempoUsed = false;
    st.bulwarkOathUsed = false;
    st.arcanePressureUsed = false;
    st.arcanePressureActive = false;
    st.judgementLeechUsed = false;
    st.verseChorusUsed = false;
    st.verseLastChannel = null;
    st.versePreparedThisAction = false;
    st.cursedCallUsed = false;
    st.crushingMomentumArmedThisTurn = false;
    /* Expire Bulwark Guard bonus */
    var g = globalThis.G;
    if (st.bulwarkGuardBonus && g && g.player && g.player.stats) {
      g.player.stats.def = Math.max(0, (Number(g.player.stats.def) || 0) - st.bulwarkGuardBonus);
      st.bulwarkGuardBonus = 0;
    }
    if (st.rogueTempoAgilityBonus && g && g.player && g.player.stats) {
      g.player.stats.spd = Math.max(0, (Number(g.player.stats.spd) || 0) - st.rogueTempoAgilityBonus);
      st.rogueTempoAgilityBonus = 0;
    }
  };

  ns.onEnemyTurnStart = function onEnemyTurnStart() {
    var st = state('enemy');
    if (!st) return;
    st.rogueTempoUsed = false;
    st.bulwarkOathUsed = false;
    st.arcanePressureUsed = false;
    st.arcanePressureActive = false;
    st.judgementLeechUsed = false;
    st.verseChorusUsed = false;
    st.verseLastChannel = null;
    st.versePreparedThisAction = false;
    st.cursedCallUsed = false;
    st.crushingMomentumArmedThisTurn = false;
  };

  ns.getClassPerkCombatContext = function getClassPerkCombatContext(birdKey) {
    var perk = ns.getClassPerkForBird(birdKey);
    var out = {
      piercingTempo: false, openingRush: false, predatorRhythm: false, crushingForce: false,
      warBody: false, ironMomentum: false, ironCore: false, holdTheLine: false, slipstream: false,
      falseOpening: false, quickTheft: false, markedForDeath: false, patientHunter: false,
      executionLine: false, arcFocus: false, songline: false, restorativeRhythm: false,
      buffDurationBonus: 0, songHealFlat: 0,
      workbookPerkId: perk && perk.def && perk.def.id,
    };
    if (perk && perk.def.id === 'cursedCall') out.buffDurationBonus = 0;
    return out;
  };

  globalThis.Avian = Avian;
})();
