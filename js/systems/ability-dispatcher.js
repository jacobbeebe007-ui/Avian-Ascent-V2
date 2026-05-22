/* Avian Ascent — Ability Dispatcher (combat rewrite).
 *
 * Replaces the legacy `ACTIONS[id]` hand-coded handlers. Every ability id in the
 * combat data pack (js/data/combat-pack/skill-trees.js) is routed through
 * `Avian.dispatcher.execute(ab)` which:
 *
 *   1. Looks up the normalised row in `Avian.data.combatPack.skillTrees`.
 *   2. Pays Energy via `spendEnergy` (already done by `playerAction`).
 *   3. Resolves target side (Self / Enemy / Self and Enemy).
 *   4. For each hit:
 *        - rolls miss against enemy dodge,
 *        - computes raw damage (Base + ATK/MATK% + Max-HP%),
 *        - rolls crit, sets `G._currentPiercePct` so `dealDamage`'s pierce
 *          accounting reads the row's DEF/MDEF ignore %,
 *        - dispatches `dealDamage` + `doAttack` for animation.
 *   5. Rolls the ailment chance (if any) and calls `applyAilment`.
 *   6. Runs the row's `riders[]` (Dodge/Speed/Crit/Counter/etc) on the player.
 *
 * The dispatcher is intentionally schema-driven: behaviour follows the row's
 * fields, not bespoke per-id JS. New abilities added to the spreadsheet need no
 * code changes — just a re-import via `node scripts/import-combat-content.mjs`.
 *
 * Note: `playerAction` (in js/core/game.js) still handles cooldown checks,
 * energy spend, passive `onAbilityUse`/`onUtilityUse` hooks, action counts,
 * and turn flow. The dispatcher is invoked from inside `ACTIONS[id]`.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  var dispatcher = Object.create(null);

  // ---- helpers ----------------------------------------------------------
  function pack() {
    return (Avian.data && Avian.data.combatPack) || null;
  }
  function rowFor(abId) {
    var p = pack();
    return p && p.skillTrees ? p.skillTrees[abId] : null;
  }
  function statBase(scaleStat) {
    if (!globalThis.G || !G.player || !G.player.stats) return 0;
    if (scaleStat === 'MATK') return G.player.stats.matk || 0;
    return G.player.stats.atk || 0;
  }
  function maxHpForScaling() {
    if (!globalThis.G || !G.player || !G.player.stats) return 0;
    return G.player.stats.maxHp || 0;
  }

  function computeRawHitDamage(row) {
    if (row.noDamage) return 0;
    var b = Number(row.baseFlat) || 0;
    var s = Number(row.scalePct) || 0;
    var stat = statBase(row.scaleStat);
    var soft = (typeof softenMainStatForCombat === 'function') ? softenMainStatForCombat(stat) : stat;
    var hp = Number(row.hpScalePct) || 0;
    var atkMult = (typeof COMBAT_OFFENSIVE_STAT_MULT === 'number') ? COMBAT_OFFENSIVE_STAT_MULT : 0.75;
    var dmg = b + Math.floor(soft * atkMult * (s / 100));
    if (hp > 0) dmg += Math.floor(maxHpForScaling() * (hp / 100));
    // Small variance ±20% to mirror legacy pdmg roll
    var lo = Math.max(1, Math.floor(dmg * 0.85));
    var hi = Math.max(lo, Math.floor(dmg * 1.15));
    var rolled = Math.floor(Math.random() * (hi - lo + 1)) + lo;
    return Math.max(1, rolled);
  }

  function getCritChanceFor(ab) {
    if (typeof getPlayerCritChance === 'function') return getPlayerCritChance(ab);
    if (globalThis.G && G.player && G.player.stats) return G.player.stats.critChance || 5;
    return 5;
  }

  function ailmentIdsFromRow(row) {
    var a = row.ailment;
    if (!a) return [];
    if (Array.isArray(a)) return a.filter(Boolean);
    return [a];
  }

  function isMagicCategory(category) {
    return /magic|song|spell/i.test(String(category || ''));
  }

  function syntheticSrcAbility(row, ab) {
    // Provide a shape that legacy helpers (`dealDamage`, `getPlayerCritChance`)
    // can interrogate without crashing.
    var btnType = isMagicCategory(row.category) ? 'spell' : (row.target === 'self' && row.noDamage ? 'utility' : 'physical');
    return {
      id: row.id,
      name: row.name || (ab && ab.name) || row.id,
      type: btnType,
      btnType: btnType,
      energy: row.apCost,
      energyCost: row.apCost,
      level: (ab && ab.level) || 1,
      pierceDef: row.pierceDef,
      pierceMdef: row.pierceMdef,
      hits: row.hits,
      baseDmgMult: (row.scalePct || 0) / 100,
      _dispatcherRow: row,
    };
  }

  // ---- riders -----------------------------------------------------------
  var riderHandlers = {
    gainDodge: function (n, ps) { ps.dispatcherDodge = Math.max(ps.dispatcherDodge || 0, n); ps.dispatcherDodgeT = 1; },
    gainSpeed: function (n, ps, p) { ps.dispatcherSpeed = Math.max(ps.dispatcherSpeed || 0, n); ps.dispatcherSpeedT = 1; if (p && p.stats) p.stats.spd = (p.stats.spd || 0) + n; ps._dispatcherSpdLoan = (ps._dispatcherSpdLoan || 0) + n; },
    gainCritChance: function (n, ps) { ps.dispatcherCrit = Math.max(ps.dispatcherCrit || 0, n); ps.dispatcherCritT = 1; },
    gainCritDamage: function (n, ps) { ps.dispatcherCritDmg = Math.max(ps.dispatcherCritDmg || 0, n); ps.dispatcherCritDmgT = 1; },
    gainAtk: function (n, ps, p) { if (!p || !p.stats) return; p.stats.atk = (p.stats.atk || 0) + n; ps._dispatcherAtkLoan = (ps._dispatcherAtkLoan || 0) + n; ps.dispatcherAtkT = 1; },
    gainMatk: function (n, ps, p) { if (!p || !p.stats) return; p.stats.matk = (p.stats.matk || 0) + n; ps._dispatcherMatkLoan = (ps._dispatcherMatkLoan || 0) + n; ps.dispatcherMatkT = 1; },
    gainGuard: function (_n, ps) { ps.defending = Math.max(ps.defending || 0, 1); },
    gainBrace: function (_n, ps) { ps.dispatcherBrace = 1; ps.dispatcherBraceT = 1; },
    gainCounter: function (_n, ps) { ps.counterInstinct = Math.max(ps.counterInstinct || 0, 1); },
    gainTaunt: function (_n, ps) { ps.dispatcherTaunt = 1; ps.dispatcherTauntT = 1; },
    refundApOnCrit: function (_n, ps) { ps._dispatcherRefundApOnCrit = 1; },
    gainApNextTurn: function (n, ps) { ps._dispatcherApNextTurn = (ps._dispatcherApNextTurn || 0) + n; },
    bonusVsAilment: function () { /* read by computeRawHitDamage via cond bonus, see applyConditionalBonus */ },
    bonusVsLowHp: function () { /* handled in conditional bonus */ },
    tagFlag: function () { /* tags don't mutate state directly */ },
    raw: function () { /* unresolved free-text; safe no-op */ },
  };

  function runPreRiders(row, _ab) {
    if (!globalThis.G || !G.player) return;
    var ps = G.playerStatus = G.playerStatus || {};
    var p = G.player;
    if (!row.riders) return;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      var fn = riderHandlers[r.kind];
      if (fn) fn(r.value, ps, p, r);
    }
  }
  function applyConditionalDamageBonus(row, dmg) {
    if (!row.riders) return dmg;
    var es = (globalThis.G && G.enemyStatus) || {};
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'bonusVsAilment' && r.ailment === 'bleed') {
        if ((es.bleed && es.bleed.stacks > 0) && r.value > 0) dmg = Math.floor(dmg * (1 + r.value / 100));
      } else if (r.kind === 'bonusVsLowHp') {
        var enemy = (globalThis.G && G.enemy && G.enemy.stats) || null;
        if (enemy && enemy.hp && enemy.maxHp && enemy.hp <= Math.floor(enemy.maxHp * (r.threshold || 0.35))) {
          if (r.value > 0) dmg = Math.floor(dmg * (1 + r.value / 100));
        }
      }
    }
    return dmg;
  }

  function runPostRiders(row, hitsLanded, hitsAttempted, anyCrit) {
    if (!globalThis.G || !G.player) return;
    var ps = G.playerStatus = G.playerStatus || {};
    if (!row.riders) return;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'refundApOnCrit' && anyCrit && !G._dispatcherRefundedThisTurn) {
        if (typeof gainEnergy === 'function') gainEnergy(G.player, r.value || 1);
        G._dispatcherRefundedThisTurn = true;
      }
      if (r.kind === 'gainApNextTurn' && (r.value || 0) > 0) {
        G._dispatcherApNextTurnPending = (G._dispatcherApNextTurnPending || 0) + (r.value || 0);
      }
    }
  }

  function applyDispatcherHitMods(raw) {
    var r = raw;
    if (globalThis.G && G._pendingStrikeActionMods) {
      var strikeAdd = Number(G._pendingStrikeActionMods.multAdd) || 0;
      if (strikeAdd) r = Math.floor(r * (1 + strikeAdd));
    }
    if (globalThis.G) {
      var __adm = (G.actionDamageHitsRemaining && G.actionDamageHitsRemaining > 0) ? (G.actionDamageMult || 1) : 1;
      r = Math.floor(r * __adm);
      if ((G.actionDamageHitsRemaining || 0) > 0) {
        G.actionDamageHitsRemaining = Math.max(0, G.actionDamageHitsRemaining - 1);
        if (G.actionDamageHitsRemaining === 0) G.actionDamageMult = 1;
      }
    }
    return Math.max(1, r);
  }

  // ---- core execute -----------------------------------------------------
  dispatcher.execute = async function execute(ab) {
    if (!ab || !ab.id) return;
    var row = rowFor(ab.id);
    if (!row) {
      if (typeof logMsg === 'function') logMsg('Dispatcher: no row for ' + ab.id, 'miss');
      return;
    }
    var src = syntheticSrcAbility(row, ab);
    G._activePlayerAbility = src;

    // Pre-damage riders (self buffs etc.)
    runPreRiders(row, ab);

    var anyCrit = false;
    var hitsLanded = 0;
    var totalDmg = 0;

    if (row.noDamage || row.target === 'self') {
      // Self-target utility: no attack animation, just rider effects + ailments self-apply ignored
      if (globalThis.G) {
        G._lastAbilityHitsLanded = 0;
        G._lastAbilityAnyCrit = false;
      }
      if (typeof logMsg === 'function') logMsg('🛡 ' + (row.name || ab.id) + (row.riderText ? ' — ' + row.riderText : ''), 'player-action');
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      return;
    }

    var hits = Math.max(1, row.hits || 1);
    var isMagic = isMagicCategory(row.category);

    var enemyDodge = (globalThis.G && G.enemy && G.enemy.stats) ? (G.enemy.stats.dodge || 0) : 0;
    var playerAcc = (typeof getPlayerEffectiveAcc === 'function') ? getPlayerEffectiveAcc() : 80;
    var baseHitFrac = (typeof calcHitChance === 'function') ? calcHitChance(playerAcc, enemyDodge, 0.85) : 0.85;

    for (var i = 0; i < hits; i++) {
      if (Math.random() >= baseHitFrac) {
        if (typeof doMiss === 'function') await doMiss('player');
        continue;
      }
      var crit = (typeof chance === 'function') ? chance(getCritChanceFor(src)) : false;
      if (crit) anyCrit = true;
      // Pierce: feed the % so dealDamage will use it
      G._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
      var raw = computeRawHitDamage(row);
      raw = applyConditionalDamageBonus(row, raw);
      raw = applyDispatcherHitMods(raw);
      var res = (typeof dealDamage === 'function') ? dealDamage('enemy', raw, crit, isMagic, src) : { dmgDealt: raw, wasDodged: false, wasBlocked: false, isCrit: crit };
      if (typeof doAttack === 'function') await doAttack('player', 'enemy', res);
      if (typeof setHpBar === 'function' && globalThis.G && G.enemy && G.enemy.stats) setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
      if (res && !res.wasDodged) hitsLanded++;
      totalDmg += (res && res.dmgDealt) || 0;
      if (globalThis.G && G.enemy && G.enemy.stats && G.enemy.stats.hp <= 0) break;
    }

    // Ailment roll (post-damage); skip if all hits missed
    if (hitsLanded > 0 && row.ailmentChance > 0) {
      var aids = ailmentIdsFromRow(row);
      if (aids.length) {
        var aid = aids[Math.floor(Math.random() * aids.length)];
        var ailCh = row.ailmentChance;
        if (globalThis.G && G.player && typeof Avian !== 'undefined' && Avian.mutations && typeof Avian.mutations.getMechanicsRollup === 'function') {
          var eqM = Avian.mutations.getMechanicsRollup(G.player);
          if (isMagic) ailCh += (Number(eqM.magicAilmentChance) || 0);
          else ailCh += (Number(eqM.physicalAilmentChance) || 0);
        }
        if (typeof chance === 'function' && chance(ailCh) && typeof applyAilment === 'function') {
          applyAilment('enemy', aid, 1);
          if (typeof renderStatuses === 'function' && globalThis.G && G.enemyStatus) renderStatuses('enemy-status', G.enemyStatus);
        }
      }
    }

    runPostRiders(row, hitsLanded, hits, anyCrit);

    if (globalThis.G) {
      G._lastAbilityHitsLanded = hitsLanded;
      G._lastAbilityAnyCrit = anyCrit;
    }

    if (typeof logMsg === 'function') {
      var label = isMagic ? '🎶' : '⚔';
      logMsg(label + ' ' + (row.name || ab.id) + ': ' + totalDmg + ' damage' + (anyCrit ? ' (CRIT)' : '') + '.', 'player-action');
    }
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
  };

  // ---- ACTIONS table population ----------------------------------------
  // game.js declares `const ACTIONS = {...}`. We patch entries into the
  // same registry at boot. We don't redeclare it; instead we attach a
  // generic proxy function for each new ability id, called by playerAction
  // via `await ACTIONS[ab.id](ab)`.
  dispatcher.registerActions = function registerActions(target) {
    var p = pack();
    if (!p || !p.skillTrees) return 0;
    var table = target || globalThis.ACTIONS;
    if (!table) return 0;
    var count = 0;
    for (var id in p.skillTrees) {
      if (!table[id]) {
        table[id] = (function (boundId) {
          return function (ab) {
            var live = ab || { id: boundId };
            return dispatcher.execute(live);
          };
        })(id);
        count++;
      }
    }
    return count;
  };

  // Status tick: clear dispatcher-loaned stat bonuses at start of player turn.
  dispatcher.onPlayerTurnStart = function onPlayerTurnStart(player) {
    if (!player || !player.stats) return;
    var ps = (globalThis.G && G.playerStatus) || null;
    if (!ps) return;
    // Apply any pending AP/EN gain from last turn
    if (G._dispatcherApNextTurnPending) {
      if (typeof gainEnergy === 'function') gainEnergy(player, G._dispatcherApNextTurnPending);
      G._dispatcherApNextTurnPending = 0;
    }
    G._dispatcherRefundedThisTurn = false;
    // Decay one-turn riders
    if ((ps.dispatcherDodgeT || 0) > 0) { ps.dispatcherDodgeT--; if (ps.dispatcherDodgeT <= 0) { delete ps.dispatcherDodge; delete ps.dispatcherDodgeT; } }
    if ((ps.dispatcherSpeedT || 0) > 0) { ps.dispatcherSpeedT--; if (ps.dispatcherSpeedT <= 0) { if (player.stats && ps._dispatcherSpdLoan) { player.stats.spd = Math.max(0, (player.stats.spd || 0) - ps._dispatcherSpdLoan); } delete ps._dispatcherSpdLoan; delete ps.dispatcherSpeed; delete ps.dispatcherSpeedT; } }
    if ((ps.dispatcherCritT || 0) > 0) { ps.dispatcherCritT--; if (ps.dispatcherCritT <= 0) { delete ps.dispatcherCrit; delete ps.dispatcherCritT; } }
    if ((ps.dispatcherCritDmgT || 0) > 0) { ps.dispatcherCritDmgT--; if (ps.dispatcherCritDmgT <= 0) { delete ps.dispatcherCritDmg; delete ps.dispatcherCritDmgT; } }
    if ((ps.dispatcherAtkT || 0) > 0) { ps.dispatcherAtkT--; if (ps.dispatcherAtkT <= 0) { if (player.stats && ps._dispatcherAtkLoan) player.stats.atk = Math.max(0, (player.stats.atk || 0) - ps._dispatcherAtkLoan); delete ps._dispatcherAtkLoan; delete ps.dispatcherAtkT; } }
    if ((ps.dispatcherMatkT || 0) > 0) { ps.dispatcherMatkT--; if (ps.dispatcherMatkT <= 0) { if (player.stats && ps._dispatcherMatkLoan) player.stats.matk = Math.max(0, (player.stats.matk || 0) - ps._dispatcherMatkLoan); delete ps._dispatcherMatkLoan; delete ps.dispatcherMatkT; } }
    if ((ps.dispatcherBraceT || 0) > 0) { ps.dispatcherBraceT--; if (ps.dispatcherBraceT <= 0) { delete ps.dispatcherBrace; delete ps.dispatcherBraceT; } }
    if ((ps.dispatcherTauntT || 0) > 0) { ps.dispatcherTauntT--; if (ps.dispatcherTauntT <= 0) { delete ps.dispatcherTaunt; delete ps.dispatcherTauntT; } }
  };

  // Crit / dodge surface read by combat helpers via legacy aug fields.
  dispatcher.modifyCritChance = function modifyCritChance(base) {
    var ps = (globalThis.G && G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherCrit || 0);
  };
  dispatcher.modifyDodge = function modifyDodge(base) {
    var ps = (globalThis.G && G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherDodge || 0);
  };

  Avian.systems.dispatcher = dispatcher;
  // Expose at top-level for terse access used by other systems / debug.
  Avian.dispatcher = dispatcher;
})();
