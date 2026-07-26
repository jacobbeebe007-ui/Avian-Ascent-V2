/* Workbook class perks — one fixed perk per class/bird from master workbook. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.classPerks = Avian.classPerks || Object.create(null);

  var PERK_BY_NAME = Object.freeze({
    'Rogue Tempo': { id: 'rogueTempo', dmgBonus: 0.06, basicAttackOnly: true, needsActingFirst: true },
    'Bulwark Oath': { id: 'bulwarkOath', damageReduction: 0.06, aboveHalfHp: true, firstHitPerTurn: false },
    'Arcane Pressure': { id: 'arcanePressure', mdefPen: 0.10 },
    'Verse and Chorus': { id: 'verseAndChorus', nextMagicBonus: 0.10 },
    'Judgement Leech': { id: 'judgementLeech', missingEnRestorePct: 0.04, hitHealCooldown: 1 },
    'Resonant Hex': { id: 'resonantHex', debuffTurnBonus: 1, statDebuffOnly: true },
    'Cursed Call': { id: 'cursedCall', debuffTurnBonus: 1 },
    'Retaliating Hide': { id: 'retaliatingHide', nextPhysicalBonus: 0.10, afterMagicDamage: true },
    'Crushing Momentum': { id: 'crushingMomentum', nextPhysicalBonus: 0.10, afterAnyDamage: true },
    'Duke Ascension': { id: 'dukeAscension', killDamageBonus: 0.05, stacking: true },
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
    def = Object.assign({}, def);
    if (isV2()) {
      if (def.id === 'bulwarkOath') {
        def.aboveHalfHp = false;
        def.firstHitPerTurn = true;
      }
      if (def.id === 'judgementLeech') {
        def.missingEnRestorePct = 0.04;
        def.hitHealCooldown = 1;
        def.onHitHealPct = 0;
        def.killHealPct = 0;
      }
    }
    return def;
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
    entity._classPerkMdefPen = perk.def.id === 'arcanePressure' ? (perk.def.mdefPen || 0.10) : 0;
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
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (perk && perk.def.id === 'arcanePressure') {
      g.player._classPerkMdefPen = perk.def.mdefPen || 0.10;
    }
    if (g.enemy) {
      ns.applyClassPerkMetadata(g.enemy);
      var ePerk = ns.getClassPerkForEntity(g.enemy);
      if (ePerk && ePerk.def.id === 'arcanePressure') {
        g.enemy._classPerkMdefPen = ePerk.def.mdefPen || 0.10;
      }
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

  function onEntityAbilityUse(entity, side, ab, ctx) {
    var g = globalThis.G;
    if (!g || !entity || !ab) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return;
    var st = state(side);
    ctx = ctx || {};

    if (perk.def.id === 'verseAndChorus' && abIsPhysical(ab)) {
      st.verseChorusPending = true;
      ctx.classPerkTriggered = 'verseAndChorus';
    }

    if (perk.def.id === 'judgementLeech' && isV2() && (ctx.hitsLanded || 0) > 0 && enemyHasAnyDebuff()) {
      var cd = st.judgementLeechCd || 0;
      if (cd <= 0) {
        var enPct = perk.def.missingEnRestorePct != null ? Number(perk.def.missingEnRestorePct) : 0.04;
        var maxEn = Number(entity.maxEnergy != null ? entity.maxEnergy : entity.stats && entity.stats.maxEn) || 6;
        var curEn = Number(entity.energy != null ? entity.energy : entity.stats && entity.stats.en) || 0;
        var missing = Math.max(0, maxEn - curEn);
        var restore = Math.max(0, Math.floor(missing * enPct));
        if (restore > 0) {
          var nextEn = Math.min(maxEn, curEn + restore);
          if (entity.energy != null) entity.energy = nextEn;
          if (entity.stats && entity.stats.en != null) entity.stats.en = nextEn;
          if (typeof spawnFloat === 'function') spawnFloat(side, '+' + restore + ' EN', 'fn-buff');
          if (typeof logMsg === 'function') {
            logMsg(perk.name + ': restored ' + restore + ' EN.', side === 'player' ? 'player-action' : 'enemy-action');
          }
          if (typeof refreshBattleUI === 'function') refreshBattleUI();
        }
        st.judgementLeechCd = perk.def.hitHealCooldown || 1;
      }
    }
  }

  function onEntityDamaged(entity, side, damage, isMagic) {
    var g = globalThis.G;
    if (!g || !entity || damage <= 0) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return;
    var st = state(side);
    if (perk.def.id === 'retaliatingHide' && isMagic) {
      st.retaliatingHidePending = true;
    }
    if (perk.def.id === 'crushingMomentum' && isV2()) {
      st.crushingMomentumPending = true;
    }
    if (perk.def.id === 'bulwarkOath' && isV2() && perk.def.firstHitPerTurn && !st.bulwarkOathUsed) {
      st.bulwarkOathTriggered = true;
    }
  }

  ns.onPlayerAbilityUse = function onPlayerAbilityUse(ab, ctx) {
    var g = globalThis.G;
    onEntityAbilityUse(g && g.player, 'player', ab, ctx);
  };

  ns.onEnemyAbilityUse = function onEnemyAbilityUse(ab, ctx) {
    var g = globalThis.G;
    onEntityAbilityUse(g && g.enemy, 'enemy', ab, ctx);
  };

  ns.onPlayerDamaged = function onPlayerDamaged(damage, isMagic) {
    var g = globalThis.G;
    onEntityDamaged(g && g.player, 'player', damage, isMagic);
  };

  ns.onEnemyDamaged = function onEnemyDamaged(damage, isMagic) {
    var g = globalThis.G;
    onEntityDamaged(g && g.enemy, 'enemy', damage, isMagic);
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
    var isMag = abIsMagic(ab);

    if (perk.def.id === 'rogueTempo' && !st.rogueTempoUsed && isBasicAttack(ab)) {
      if (!perk.def.needsActingFirst || entityActingFirst(entity)) {
        out.push(perk.def.dmgBonus != null ? perk.def.dmgBonus : 0.06);
        st.rogueTempoUsed = true;
      }
    }
    if (perk.def.id === 'verseAndChorus' && st.verseChorusPending && isMag) {
      out.push(perk.def.nextMagicBonus || 0.10);
      st.verseChorusPending = false;
      if (typeof Avian.passives !== 'undefined' && typeof Avian.passives.onClassPerkTriggered === 'function') {
        Avian.passives.onClassPerkTriggered('verseAndChorus', ab, side);
      }
    }
    if (perk.def.id === 'retaliatingHide' && st.retaliatingHidePending && isPhys) {
      out.push(perk.def.nextPhysicalBonus || 0.10);
      st.retaliatingHidePending = false;
    }
    if (perk.def.id === 'crushingMomentum' && st.crushingMomentumPending && isPhys) {
      out.push(perk.def.nextPhysicalBonus || 0.10);
      st.crushingMomentumPending = false;
    }
    if (perk.def.id === 'dukeAscension' && (entity._classPerkDukeStacks || 0) > 0) {
      out.push((entity._classPerkDukeStacks || 0) * (perk.def.killDamageBonus || 0.05));
    }
    return out;
  };

  ns.collectOutgoingDamageBonusFractions = function collectOutgoingDamageBonusFractions(ab, ctx) {
    var g = globalThis.G;
    return ns.collectOutgoingDamageBonusFractionsForEntity(g && g.player, ab, ctx);
  };

  ns.getIncomingDamageMultiplierForEntity = function getIncomingDamageMultiplierForEntity(entity) {
    if (!entity || !entity.stats) return 1;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'bulwarkOath') return 1;
    var side = (globalThis.G && globalThis.G.player === entity) ? 'player' : 'enemy';
    var st = state(side) || {};
    if (isV2() && perk.def.firstHitPerTurn) {
      if (st.bulwarkOathUsed) return 1;
      return 1 - (perk.def.damageReduction != null ? perk.def.damageReduction : 0.06);
    }
    var hp = entity.stats.hp || 0;
    var maxHp = entity.stats.maxHp || 1;
    if (hp > maxHp * 0.5) return 1 - (perk.def.damageReduction != null ? perk.def.damageReduction : 0.06);
    return 1;
  };

  ns.markBulwarkOathConsumed = function markBulwarkOathConsumed(entity) {
    if (!entity) return;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk || perk.def.id !== 'bulwarkOath' || !isV2()) return;
    var side = (globalThis.G && globalThis.G.player === entity) ? 'player' : 'enemy';
    var st = state(side);
    if (st) st.bulwarkOathUsed = true;
  };

  ns.getIncomingDamageMultiplier = function getIncomingDamageMultiplier() {
    var g = globalThis.G;
    return ns.getIncomingDamageMultiplierForEntity(g && g.player);
  };

  ns.getExtraMdefPierceForEntity = function getExtraMdefPierceForEntity(entity, ab) {
    if (!entity || !ab) return 0;
    if (!abIsMagic(ab)) return 0;
    var pen = Number(entity._classPerkMdefPen) || 0;
    if (isV2() && Avian.combat && typeof Avian.combat.clampPen === 'function') {
      return Avian.combat.clampPen(pen);
    }
    return pen;
  };

  ns.getExtraMdefPierce = function getExtraMdefPierce(ab) {
    var g = globalThis.G;
    return ns.getExtraMdefPierceForEntity(g && g.player, ab);
  };

  ns.adjustDebuffDurationForEntity = function adjustDebuffDurationForEntity(entity, baseTurns, ailmentId) {
    if (!entity) return baseTurns;
    var perk = ns.getClassPerkForEntity(entity);
    if (!perk) return baseTurns;
    if (perk.def.id === 'cursedCall') return baseTurns + (perk.def.debuffTurnBonus || 1);
    if (perk.def.id === 'resonantHex' && isV2()) {
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
    if (perk.def.id === 'judgementLeech' && !isV2()) {
      var heal = Math.max(1, Math.floor((g.player.stats.maxHp || 1) * (perk.def.killHealPct || 0.10)));
      g.player.stats.hp = Math.min(g.player.stats.maxHp || 1, (g.player.stats.hp || 0) + heal);
      if (typeof setHpBar === 'function') setHpBar('player', g.player.stats.hp, g.player.stats.maxHp);
      if (typeof spawnFloat === 'function') spawnFloat('player', '+' + heal, 'fn-heal');
      if (typeof logMsg === 'function') logMsg(perk.name + ': restored ' + heal + ' HP.', 'player-action');
    }
    if (perk.def.id === 'dukeAscension') {
      g.player._classPerkDukeStacks = (g.player._classPerkDukeStacks || 0) + 1;
      if (typeof logMsg === 'function') logMsg(perk.name + ': +5% all damage this combat.', 'player-action');
    }
  };

  ns.onPlayerTurnStart = function onPlayerTurnStart() {
    var st = state('player');
    if (!st) return;
    st.rogueTempoUsed = false;
    st.bulwarkOathUsed = false;
    if ((st.judgementLeechCd || 0) > 0) st.judgementLeechCd--;
  };

  ns.onEnemyTurnStart = function onEnemyTurnStart() {
    var st = state('enemy');
    if (!st) return;
    st.rogueTempoUsed = false;
    st.bulwarkOathUsed = false;
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
