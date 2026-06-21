/* Workbook class perks — one fixed perk per class/bird from master workbook. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.classPerks = Avian.classPerks || Object.create(null);

  var PERK_BY_NAME = Object.freeze({
    'Rogue Tempo': { id: 'rogueTempo', dmgBonus: 0.10, first1EnPhysical: true },
    'Bulwark Oath': { id: 'bulwarkOath', damageReduction: 0.10, aboveHalfHp: true },
    'Arcane Pressure': { id: 'arcanePressure', mdefPen: 0.10 },
    'Verse and Chorus': { id: 'verseAndChorus', nextMagicBonus: 0.10 },
    'Judgement Leech': { id: 'judgementLeech', killHealPct: 0.10 },
    'Cursed Call': { id: 'cursedCall', debuffTurnBonus: 1 },
    'Retaliating Hide': { id: 'retaliatingHide', nextPhysicalBonus: 0.10, afterMagicDamage: true },
    'Duke Ascension': { id: 'dukeAscension', killDamageBonus: 0.05, stacking: true },
  });

  function birds() { return globalThis.BIRDS || {}; }
  function classes() { return (Avian.data && Avian.data.combatPack && Avian.data.combatPack.classes) || {}; }

  function resolveClassKey(birdKey) {
    var bd = birds()[birdKey];
    var cls = String(bd && bd.class || '').toLowerCase();
    if (cls === 'striker') return 'rogue';
    if (cls === 'singer') return 'mage';
    if (cls === 'predator') return 'inquisitor';
    if (cls === 'trickster') return 'bard';
    if (cls === 'tank' || cls === 'bruiser') return cls === 'bruiser' ? 'brute' : 'knight';
    return cls;
  }

  ns.getClassPerkForBird = function getClassPerkForBird(birdKey) {
    var bd = birds()[birdKey];
    if (!bd) return null;
    var name = bd.classPerk || (classes()[resolveClassKey(birdKey)] && classes()[resolveClassKey(birdKey)].classPerk) || '';
    var def = PERK_BY_NAME[name];
    if (!def) return null;
    return {
      id: def.id,
      name: name,
      effect: bd.classPerkEffect || (classes()[resolveClassKey(birdKey)] && classes()[resolveClassKey(birdKey)].classPerkEffect) || '',
      def: def,
    };
  };

  function state() {
    var g = globalThis.G;
    if (!g) return null;
    g.playerStatus = g.playerStatus || {};
    if (!g.playerStatus._classPerkState) g.playerStatus._classPerkState = Object.create(null);
    return g.playerStatus._classPerkState;
  }

  ns.onBattleStart = function onBattleStart() {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var st = state();
    if (st) {
      for (var k in st) delete st[k];
    }
    g.player._classPerkMdefPen = 0;
    g.player._classPerkDukeStacks = 0;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (perk && perk.def.id === 'arcanePressure') {
      g.player._classPerkMdefPen = perk.def.mdefPen || 0.10;
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
      row = Avian.data.combatPack.skillTrees && Avian.data.combatPack.skillTrees[id];
    }
    return Math.max(1, Math.min(4, Number(row && (row.enCost != null ? row.enCost : row.apCost) != null ? (row.enCost != null ? row.enCost : row.apCost) : (ab && (ab.energy || ab.energyCost)) || 1)));
  }

  ns.onPlayerAbilityUse = function onPlayerAbilityUse(ab, ctx) {
    var g = globalThis.G;
    if (!g || !g.player || !ab) return;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk) return;
    var st = state();
    if (perk.def.id === 'verseAndChorus' && abIsPhysical(ab)) {
      st.verseChorusPending = true;
    }
  };

  ns.onPlayerDamaged = function onPlayerDamaged(damage, isMagic) {
    var g = globalThis.G;
    if (!g || !g.player || damage <= 0) return;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk || perk.def.id !== 'retaliatingHide') return;
    if (isMagic) {
      var st = state();
      st.retaliatingHidePending = true;
    }
  };

  ns.collectOutgoingDamageBonusFractions = function collectOutgoingDamageBonusFractions(ab, ctx) {
    var g = globalThis.G;
    if (!g || !g.player || !ab) return [];
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk) return [];
    var st = state() || {};
    var out = [];
    var isPhys = abIsPhysical(ab);
    var isMag = abIsMagic(ab);

    if (perk.def.id === 'rogueTempo' && !st.rogueTempoUsed && isPhys && abEnCost(ab) === 1) {
      out.push(perk.def.dmgBonus || 0.10);
      st.rogueTempoUsed = true;
    }
    if (perk.def.id === 'verseAndChorus' && st.verseChorusPending && isMag) {
      out.push(perk.def.nextMagicBonus || 0.10);
      st.verseChorusPending = false;
    }
    if (perk.def.id === 'retaliatingHide' && st.retaliatingHidePending && isPhys) {
      out.push(perk.def.nextPhysicalBonus || 0.10);
      st.retaliatingHidePending = false;
    }
    if (perk.def.id === 'dukeAscension' && (g.player._classPerkDukeStacks || 0) > 0) {
      out.push((g.player._classPerkDukeStacks || 0) * (perk.def.killDamageBonus || 0.05));
    }
    return out;
  };

  ns.getIncomingDamageMultiplier = function getIncomingDamageMultiplier() {
    var g = globalThis.G;
    if (!g || !g.player) return 1;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk || perk.def.id !== 'bulwarkOath') return 1;
    var hp = g.player.stats.hp || 0;
    var maxHp = g.player.stats.maxHp || 1;
    if (hp > maxHp * 0.5) return 1 - (perk.def.damageReduction || 0.10);
    return 1;
  };

  ns.getExtraMdefPierce = function getExtraMdefPierce(ab) {
    var g = globalThis.G;
    if (!g || !g.player || !ab) return 0;
    if (!abIsMagic(ab)) return 0;
    return Number(g.player._classPerkMdefPen) || 0;
  };

  ns.adjustDebuffDuration = function adjustDebuffDuration(baseTurns) {
    var g = globalThis.G;
    if (!g || !g.player) return baseTurns;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk || perk.def.id !== 'cursedCall') return baseTurns;
    return baseTurns + (perk.def.debuffTurnBonus || 1);
  };

  ns.onEnemyDefeated = function onEnemyDefeated() {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var perk = ns.getClassPerkForBird(g.player.birdKey);
    if (!perk) return;
    if (perk.def.id === 'judgementLeech') {
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
    var st = state();
    if (!st) return;
    st.rogueTempoUsed = false;
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
