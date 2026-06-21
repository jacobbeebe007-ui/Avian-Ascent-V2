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
    var row = p && p.skillTrees ? p.skillTrees[abId] : null;
    if (row && typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);
    return row;
  }
  function statBase(scaleStat) {
    var g = globalThis.G;
    if (!g || !g.player || !g.player.stats) return 0;
    var st = g.player.stats;
    var key = String(scaleStat || 'ATK').toUpperCase();
    if (key === 'MATK') return st.matk || 0;
    if (key === 'SPD') return st.spd || 0;
    if (key === 'DEF') return st.def || 0;
    if (key === 'MDEF') return st.mdef || 0;
    if (key === 'ACC') return st.acc || 0;
    if (key === 'DODGE') return st.dodge || 0;
    return st.atk || 0;
  }
  function maxHpForScaling() {
    var g = globalThis.G;
    if (!g || !g.player || !g.player.stats) return 0;
    return g.player.stats.maxHp || 0;
  }
  function scaleContribution(scaleStat, scalePct) {
    var pct = Number(scalePct) || 0;
    if (pct <= 0) return 0;
    var stat = statBase(scaleStat);
    var soft = (typeof softenMainStatForCombat === 'function') ? softenMainStatForCombat(stat) : stat;
    var atkMult = (typeof COMBAT_OFFENSIVE_STAT_MULT === 'number') ? COMBAT_OFFENSIVE_STAT_MULT : 0.75;
    return soft * atkMult * (pct / 100);
  }

  function computeRawHitDamage(row, stats) {
    if (row.noDamage) return 0;
    if (typeof globalThis.computeAbilityRawDamage === 'function') {
      return globalThis.computeAbilityRawDamage(row, stats || (globalThis.G && G.player && G.player.stats) || {});
    }
    return 0;
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
    var btnType = (typeof globalThis.resolveCombatRowBtnType === 'function')
      ? globalThis.resolveCombatRowBtnType(row)
      : (isMagicCategory(row.category) ? 'spell' : (row.target === 'self' && row.noDamage ? 'utility' : 'physical'));
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

  function spawnTrendFloat(who, kind) {
    if (typeof spawnFloat !== 'function') return;
    if (kind === 'buff') spawnFloat(who, '▲▲', 'fn-buff-trend');
    else if (kind === 'debuff') spawnFloat(who, '▼▼', 'fn-debuff-trend');
  }

  function applyEnemyStatDebuff(statKey, pct, sourceId) {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats) return false;
    var es = g.enemyStatus = g.enemyStatus || {};
    var stats = g.enemy.stats;
    if (!es._dispatcherDebuffBySource) es._dispatcherDebuffBySource = Object.create(null);
    var slotKey = statKey + ':' + String(sourceId || 'unknown');
    var prev = es._dispatcherDebuffBySource[slotKey];
    if (prev && prev.amt) {
      stats[statKey] = Math.round(((Number(stats[statKey]) || 0) + (prev.amt || 0)) * 100) / 100;
    }
    var cur = Number(stats[statKey]) || 0;
    var amt = Math.round(cur * (Number(pct) || 0) / 100 * 100) / 100;
    if (amt <= 0) return false;
    amt = Math.max(prev ? (prev.amt || 0) : 0, amt);
    stats[statKey] = Math.max(0, Math.round((cur - amt) * 100) / 100);
    es._dispatcherDebuffBySource[slotKey] = { statKey: statKey, amt: amt, turns: 1, sourceId: String(sourceId || '') };
    spawnTrendFloat('enemy', 'debuff');
    return true;
  }

  function revertEnemyDispatcherDebuffs() {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats || !g.enemyStatus || !g.enemyStatus._dispatcherDebuffBySource) return;
    var stats = g.enemy.stats;
    var map = g.enemyStatus._dispatcherDebuffBySource;
    for (var k in map) {
      var d = map[k];
      if (!d) continue;
      d.turns = (d.turns || 1) - 1;
      if (d.turns <= 0) {
        stats[d.statKey] = Math.round(((Number(stats[d.statKey]) || 0) + (d.amt || 0)) * 100) / 100;
        delete map[k];
      }
    }
    if (!Object.keys(map).length) delete g.enemyStatus._dispatcherDebuffBySource;
    if (g.enemyStatus.dispatcherDebuffs) delete g.enemyStatus.dispatcherDebuffs;
  }

  function recomputeDispatcherDisplays(ps) {
    ps.dispatcherDodge = 0;
    ps.dispatcherCrit = 0;
    ps.dispatcherCritDmg = 0;
    var slots = ps._dispatcherDisplaySlots;
    if (!slots) return;
    for (var k in slots) {
      var s = slots[k];
      if (!s || (s.turns || 0) <= 0) continue;
      if (s.kind === 'gainDodge') ps.dispatcherDodge = Math.max(ps.dispatcherDodge || 0, s.value || 0);
      if (s.kind === 'gainCritChance') ps.dispatcherCrit = Math.max(ps.dispatcherCrit || 0, s.value || 0);
      if (s.kind === 'gainCritDamage') ps.dispatcherCritDmg = Math.max(ps.dispatcherCritDmg || 0, s.value || 0);
    }
  }

  function applyDispatcherDisplaySlot(ps, sourceId, kind, value) {
    if (!ps._dispatcherDisplaySlots) ps._dispatcherDisplaySlots = Object.create(null);
    var key = String(sourceId || 'unknown') + ':' + kind;
    var prev = ps._dispatcherDisplaySlots[key];
    ps._dispatcherDisplaySlots[key] = {
      kind: kind,
      value: Math.max(prev ? (prev.value || 0) : 0, Number(value) || 0),
      turns: 1,
    };
    recomputeDispatcherDisplays(ps);
  }

  function decayDispatcherDisplaySlots(ps) {
    var bag = ps._dispatcherDisplaySlots;
    if (!bag) return;
    for (var k in bag) {
      var s = bag[k];
      if (!s) continue;
      s.turns = (s.turns || 1) - 1;
      if (s.turns <= 0) delete bag[k];
    }
    if (!Object.keys(bag).length) delete ps._dispatcherDisplaySlots;
    recomputeDispatcherDisplays(ps);
  }

  function applyDispatcherStatLoan(ps, player, statKey, sourceId, value) {
    if (typeof globalThis.applySourceStatLoan === 'function') {
      return globalThis.applySourceStatLoan(ps, player, '_dispatcherStatLoans', statKey, String(sourceId || 'unknown') + ':' + statKey, value, 1);
    }
    if (!player || !player.stats) return 0;
    player.stats[statKey] = Math.round(((player.stats[statKey] || 0) + (Number(value) || 0)) * 100) / 100;
    return Number(value) || 0;
  }

  function applyDispatcherStatLoanPct(ps, player, statKey, sourceId, pct) {
    if (typeof globalThis.applySourceStatLoanPct === 'function') {
      return globalThis.applySourceStatLoanPct(ps, player, '_dispatcherStatLoans', statKey, String(sourceId || 'unknown') + ':' + statKey, pct, 1);
    }
    return applyDispatcherStatLoan(ps, player, statKey, sourceId, pct);
  }

  function applyGuardedFromRow(row, riderValue, ab) {
    var resolve = (typeof globalThis.resolveGuardedReductionPct === 'function')
      ? globalThis.resolveGuardedReductionPct
      : (typeof resolveGuardedReductionPct === 'function' ? resolveGuardedReductionPct : null);
    var apply = (typeof globalThis.applyGuardedBuff === 'function')
      ? globalThis.applyGuardedBuff
      : (typeof applyGuardedBuff === 'function' ? applyGuardedBuff : null);
    if (!apply) return;
    var pct = resolve ? resolve(row, riderValue, ab) : (Number(riderValue) || 20);
    var turns = 1;
    if (row && row.guardedTurns != null) turns = Math.max(1, Math.floor(Number(row.guardedTurns) || 1));
    else if (row && row.riders) {
      for (var gi = 0; gi < row.riders.length; gi++) {
        var gr = row.riders[gi];
        if (!gr || (gr.kind !== 'gainGuarded' && gr.kind !== 'gainBrace')) continue;
        if (gr.turns != null) { turns = Math.max(1, Math.floor(Number(gr.turns) || 1)); break; }
        if (gr.duration === 'untilEndOfEnemyTurn' || gr.duration === 'enemyTurn') { turns = 1; break; }
      }
    }
    apply('player', { physReducPct: pct, turns: turns, sourceAbilityId: row && row.id ? row.id : '' });
    spawnTrendFloat('player', 'buff');
  }

  function rowGrantsGuardedViaRider(row) {
    var riders = (row && row.riders) || [];
    for (var i = 0; i < riders.length; i++) {
      var k = riders[i] && riders[i].kind;
      if (k === 'gainGuarded' || k === 'gainBrace') return true;
    }
    return false;
  }

  function shouldAutoApplyGuarded(row) {
    if (!row || !row.noDamage) return false;
    if (row.target !== 'self' && row.target !== 'self_and_enemy') return false;
    var text = String(row.riderText || row.shortDesc || '');
    if (/guard|brace|damage reduction/i.test(text)) return true;
    if (/guard/i.test(String(row.category || ''))) return true;
    return rowGrantsGuardedViaRider(row);
  }

  // ---- riders -----------------------------------------------------------
  function makeStatRiderHandlers(sourceId, row, ab) {
    return {
      gainDodge: function (n, ps) { applyDispatcherDisplaySlot(ps, sourceId, 'gainDodge', n); spawnTrendFloat('player', 'buff'); },
      gainSpeed: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'spd', sourceId, n); spawnTrendFloat('player', 'buff'); },
      gainCritChance: function (n, ps) { applyDispatcherDisplaySlot(ps, sourceId, 'gainCritChance', n); spawnTrendFloat('player', 'buff'); },
      gainCritDamage: function (n, ps) { applyDispatcherDisplaySlot(ps, sourceId, 'gainCritDamage', n); spawnTrendFloat('player', 'buff'); },
      gainAtk: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'atk', sourceId, n); spawnTrendFloat('player', 'buff'); },
      gainMatk: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'matk', sourceId, n); spawnTrendFloat('player', 'buff'); },
      gainDef: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'def', sourceId, n); spawnTrendFloat('player', 'buff'); },
      gainMdef: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'mdef', sourceId, n); spawnTrendFloat('player', 'buff'); },
      gainGuard: function (n, ps, p) {
        var pct = Number(n) || 8;
        applyDispatcherStatLoanPct(ps, p, 'def', sourceId, pct);
        spawnTrendFloat('player', 'buff');
      },
      gainGuarded: function (n) { applyGuardedFromRow(row, n, ab); },
      gainBrace: function (n) { applyGuardedFromRow(row, n, ab); },
      gainCounter: function (_n, ps) { ps.counterInstinct = Math.max(ps.counterInstinct || 0, 1); spawnTrendFloat('player', 'buff'); },
      gainTaunt: function (_n, ps) { ps.dispatcherTaunt = 1; ps.dispatcherTauntT = 1; spawnTrendFloat('player', 'buff'); },
      reduceEnemyDodge: function (n) { applyEnemyStatDebuff('dodge', n, sourceId); },
      reduceEnemyAtk: function (n) { applyEnemyStatDebuff('atk', n, sourceId); },
      reduceEnemyMatk: function (n) { applyEnemyStatDebuff('matk', n, sourceId); },
      reduceEnemySpd: function (n) { applyEnemyStatDebuff('spd', n, sourceId); },
      reduceEnemyCrit: function (n) { applyEnemyStatDebuff('critChance', n, sourceId); },
      reduceEnemyDef: function (n) { applyEnemyStatDebuff('def', n, sourceId); },
      reduceEnemyMdef: function (n) { applyEnemyStatDebuff('mdef', n, sourceId); },
    };
  }

  var riderHandlers = {
    healMaxHpPct: function (n, _ps, p) {
      if (!p || !p.stats) return;
      var heal = Math.round((Number(p.stats.maxHp) || 0) * (Number(n) || 0) / 100 * 100) / 100;
      if (heal <= 0) return;
      p.stats.hp = Math.min(Number(p.stats.maxHp) || 0, Math.round(((Number(p.stats.hp) || 0) + heal) * 100) / 100);
      if (typeof setHpBar === 'function') setHpBar('player', p.stats.hp, p.stats.maxHp);
      if (typeof spawnFloat === 'function') spawnFloat('player', '+' + heal, 'fn-heal');
      spawnTrendFloat('player', 'buff');
    },
    refundApOnCrit: function (_n, ps) { ps._dispatcherRefundApOnCrit = 1; },
    gainApNextTurn: function (n, ps) { ps._dispatcherApNextTurn = (ps._dispatcherApNextTurn || 0) + n; },
    bonusVsAilment: function () { /* read by applyConditionalDamageBonus */ },
    bonusVsLowHp: function () { /* handled in conditional bonus */ },
    tagFlag: function () { /* tags don't mutate state directly */ },
    raw: function () { /* unresolved free-text; safe no-op */ },
  };

  function riderWhenMatches(r, ctx) {
    var w = r.when;
    if (!w) return true;
    if (w === 'onHit') return ctx.hitsLanded > 0;
    if (w.indexOf('onAilment:') === 0) {
      var aid = w.slice('onAilment:'.length);
      return ctx.ailmentsApplied && ctx.ailmentsApplied[aid];
    }
    return false;
  }

  function runRiders(row, ctx, ab) {
    var g = globalThis.G;
    if (!g || !g.player || !row.riders) return;
    var ps = g.playerStatus = g.playerStatus || {};
    var p = g.player;
    var sourceId = row.id || (ctx && ctx.sourceAbilityId) || 'unknown';
    var statHandlers = makeStatRiderHandlers(sourceId, row, ab);
    ctx.applied = ctx.applied || Object.create(null);
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'refundApOnCrit' || r.kind === 'gainApNextTurn' || r.kind === 'bonusVsAilment' || r.kind === 'bonusVsLowHp' || r.kind === 'tagFlag' || r.kind === 'raw') continue;
      if (!riderWhenMatches(r, ctx)) continue;
      var rKey = sourceId + '|' + r.kind + '|' + (r.when || '') + '|' + (r.value || '');
      if (ctx.applied[rKey]) continue;
      var fn = statHandlers[r.kind] || riderHandlers[r.kind];
      if (fn) {
        fn(r.value, ps, p, r);
        ctx.applied[rKey] = true;
      }
    }
  }

  function runPreRiders(row, ab) {
    runRiders(row, { hitsLanded: 1, ailmentsApplied: {} }, ab);
    if (shouldAutoApplyGuarded(row) && !rowGrantsGuardedViaRider(row)) {
      applyGuardedFromRow(row, 0, ab);
    }
  }
  function applyConditionalDamageBonus(row, dmg) {
    if (!row.riders) return dmg;
    var g = globalThis.G;
    var es = (g && g.enemyStatus) || {};
    var roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : function(n) { return Math.max(0.01, Math.round(Number(n) * 100) / 100); };
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'bonusVsAilment' && r.ailment === 'bleed') {
        if ((es.bleed && es.bleed.stacks > 0) && r.value > 0) dmg = roundDmg(dmg * (1 + r.value / 100));
      } else if (r.kind === 'bonusVsLowHp') {
        var enemy = (g && g.enemy && g.enemy.stats) || null;
        if (enemy && enemy.hp && enemy.maxHp && enemy.hp <= Math.floor(enemy.maxHp * (r.threshold || 0.35))) {
          if (r.value > 0) dmg = roundDmg(dmg * (1 + r.value / 100));
        }
      }
    }
    return dmg;
  }

  function runPostRiders(row, hitsLanded, hitsAttempted, anyCrit) {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var ps = g.playerStatus = g.playerStatus || {};
    if (!row.riders) return;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'refundApOnCrit' && anyCrit && !g._dispatcherRefundedThisTurn) {
        if (typeof gainEnergy === 'function') gainEnergy(g.player, r.value || 1);
        g._dispatcherRefundedThisTurn = true;
      }
      if (r.kind === 'gainApNextTurn' && (r.value || 0) > 0) {
        g._dispatcherApNextTurnPending = (g._dispatcherApNextTurnPending || 0) + (r.value || 0);
      }
    }
  }

  function applyDispatcherHitMods(raw) {
    var r = raw;
    var g = globalThis.G;
    var roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : function(n) { return Math.max(0.01, Math.round(Number(n) * 100) / 100); };
    if (g && g._pendingStrikeActionMods) {
      var strikeAdd = Number(g._pendingStrikeActionMods.multAdd) || 0;
      if (strikeAdd) r = roundDmg(r * (1 + strikeAdd));
    }
    if (g) {
      var __adm = (g.actionDamageHitsRemaining && g.actionDamageHitsRemaining > 0) ? (g.actionDamageMult || 1) : 1;
      r = roundDmg(r * __adm);
      if ((g.actionDamageHitsRemaining || 0) > 0) {
        g.actionDamageHitsRemaining = Math.max(0, g.actionDamageHitsRemaining - 1);
        if (g.actionDamageHitsRemaining === 0) g.actionDamageMult = 1;
      }
    }
    return roundDmg(r);
  }

  function resolveDealDamage() {
    if (typeof globalThis.dealDamage === 'function') return globalThis.dealDamage;
    if (typeof dealDamage === 'function') return dealDamage;
    return null;
  }

  // ---- core execute -----------------------------------------------------
  dispatcher.execute = async function execute(ab) {
    if (!ab || !ab.id) return;
    var row = rowFor(ab.id);
    if (!row) {
      if (typeof logMsg === 'function') logMsg('Dispatcher: no row for ' + ab.id, 'miss');
      return;
    }
    var g = globalThis.G;
    var src = syntheticSrcAbility(row, ab);
    if (g) g._activePlayerAbility = src;
    else G._activePlayerAbility = src;

    // Pre-damage riders only for self / no-damage abilities
    if (row.noDamage || row.target === 'self') {
      runPreRiders(row, ab);
    }

    var anyCrit = false;
    var hitsLanded = 0;
    var totalDmg = 0;

    if (row.noDamage || row.target === 'self') {
      if (g) {
        g._lastAbilityHitsLanded = 0;
        g._lastAbilityAnyCrit = false;
        g._lastAbilityAilmentFailed = false;
      }
      if (typeof logMsg === 'function') logMsg('🛡 ' + (row.name || ab.id) + (row.riderText ? ' — ' + row.riderText : ''), 'player-action');
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      return;
    }

    var hits = Math.max(1, row.hits || row.hitCount || 1);
    var isMagic = isMagicCategory(row.category);

    if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);

    var enemyDodge = (typeof getEffectiveEnemyDodgeForPlayerHit === 'function')
      ? getEffectiveEnemyDodgeForPlayerHit()
      : ((g && g.enemy && g.enemy.stats) ? (g.enemy.stats.dodge || 0) : 0);
    var playerAcc = (typeof getPlayerEffectiveAcc === 'function') ? getPlayerEffectiveAcc() : 80;
    var enCost = row.enCost || row.apCost || 1;
    var heavyPenalty = (typeof globalThis.calculateHeavyAccuracyPenalty === 'function')
      ? globalThis.calculateHeavyAccuracyPenalty(row) : 0;
    var hitPct = (typeof calculateAbilityHitChancePct === 'function')
      ? calculateAbilityHitChancePct(playerAcc, enemyDodge, enCost) - heavyPenalty
      : 85;
    if (typeof globalThis.clampHitChancePct === 'function') hitPct = globalThis.clampHitChancePct(hitPct);
    var baseHitFrac = hitPct / 100;

    var usesMaster = typeof globalThis.usesMasterDamage === 'function' && globalThis.usesMasterDamage(row);
    var masterHitAmounts = null;
    var masterCrit = false;
    if (usesMaster && typeof globalThis.computeMasterOutgoingDamage === 'function') {
      var masterResult = globalThis.computeMasterOutgoingDamage(isMagic, src, { hitSucceeded: true });
      if (masterResult) {
        masterCrit = masterResult.isCrit;
        if (typeof globalThis.calculateMultiHitDamage === 'function') {
          masterHitAmounts = globalThis.calculateMultiHitDamage(masterResult.damage, hits);
        } else {
          masterHitAmounts = [masterResult.damage];
        }
      }
    }

    for (var i = 0; i < hits; i++) {
      if (Math.random() >= baseHitFrac) {
        if (typeof doMiss === 'function') await doMiss('player');
        continue;
      }
      // Pierce: feed the % so dealDamage will use it
      if (g) {
        g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        g._dispatcherCombatRow = row;
      } else {
        G._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        G._dispatcherCombatRow = row;
      }
      var dealFn = resolveDealDamage();
      var dealOpts = null;
      if (masterHitAmounts && masterHitAmounts[i] != null) {
        dealOpts = { precomputedDamage: masterHitAmounts[i], isCrit: masterCrit };
      }
      var res = dealFn
        ? dealFn('enemy', 0, masterCrit, isMagic, src, dealOpts)
        : { dmgDealt: 0, wasDodged: false, wasBlocked: false, isCrit: false };
      if (g) g._dispatcherCombatRow = null;
      else G._dispatcherCombatRow = null;
      if (res && res.isCrit) anyCrit = true;
      if (typeof doAttack === 'function') await doAttack('player', 'enemy', res);
      if (typeof setHpBar === 'function' && g && g.enemy && g.enemy.stats) setHpBar('enemy', g.enemy.stats.hp, g.enemy.stats.maxHp);
      if (res && !res.wasDodged) hitsLanded++;
      totalDmg += (res && res.dmgDealt) || 0;
      if (g && g.enemy && g.enemy.stats && g.enemy.stats.hp <= 0) break;
    }

    // Ailment roll (post-damage); skip if all hits missed
    var ailmentsApplied = {};
    var ailmentAttempted = hitsLanded > 0 && row.ailmentChance > 0 && ailmentIdsFromRow(row).length > 0;
    if (ailmentAttempted) {
      var aids = ailmentIdsFromRow(row);
      if (aids.length) {
        var aid = aids[Math.floor(Math.random() * aids.length)];
        var ailCh = row.ailmentChance;
        if (g && g.player && typeof Avian !== 'undefined' && Avian.mutations && typeof Avian.mutations.getMechanicsRollup === 'function') {
          var eqM = Avian.mutations.getMechanicsRollup(g.player);
          if (isMagic) ailCh += (Number(eqM.magicAilmentChance) || 0);
          else ailCh += (Number(eqM.physicalAilmentChance) || 0);
        }
        if (typeof chance === 'function' && chance(ailCh)) {
          var applied = false;
          if (aid === 'delayed' && typeof applyDelayedDamage === 'function') {
            applied = applyDelayedDamage('enemy', totalDmg);
          } else if (typeof applyAilment === 'function') {
            applied = applyAilment('enemy', aid, 1);
          }
          if (applied) {
            ailmentsApplied[aid] = true;
            if (typeof renderStatuses === 'function' && g && g.enemyStatus) renderStatuses('enemy-status', g.enemyStatus);
          }
        }
      }
    }

    var riderCtx = { hitsLanded: hitsLanded, ailmentsApplied: ailmentsApplied };
    runRiders(row, riderCtx, ab);

    runPostRiders(row, hitsLanded, hits, anyCrit);

    if (hitsLanded > 0 && typeof globalThis.calculateRecoilDamage === 'function') {
      var recoil = globalThis.calculateRecoilDamage(totalDmg, row);
      if (recoil > 0 && g && g.player && g.player.stats) {
        if (typeof applyFractionalHp === 'function') applyFractionalHp(g.player.stats, -recoil);
        else g.player.stats.hp = Math.max(0, (g.player.stats.hp || 0) - recoil);
        if (typeof spawnFloat === 'function') spawnFloat('player', '-' + recoil + ' recoil', 'fn-dmg');
        if (typeof setHpBar === 'function') setHpBar('player', g.player.stats.hp, g.player.stats.maxHp);
      }
    }

    if (g) {
      g._lastAbilityHitsLanded = hitsLanded;
      g._lastAbilityAnyCrit = anyCrit;
      g._lastAbilityAilmentFailed = ailmentAttempted && !Object.keys(ailmentsApplied).length;
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
  dispatcher.applyDispatcherHitMods = applyDispatcherHitMods;

  dispatcher.applyPostCurveModifiers = function applyPostCurveModifiers(dmg, row) {
    return applyDispatcherHitMods(dmg);
  };

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

  dispatcher.onPlayerTurnStart = function onPlayerTurnStart(player) {
    if (!player || !player.stats) return;
    var g = globalThis.G;
    if (g._dispatcherApNextTurnPending) {
      if (typeof gainEnergy === 'function') gainEnergy(player, g._dispatcherApNextTurnPending);
      g._dispatcherApNextTurnPending = 0;
    }
    g._dispatcherRefundedThisTurn = false;
  };

  dispatcher.onAfterEnemyTurn = function onAfterEnemyTurn(player) {
    if (!player || !player.stats) return;
    var g = globalThis.G;
    var ps = (g && g.playerStatus) || null;
    if (!ps) return;
    if (typeof globalThis.decaySourceStatLoans === 'function') {
      globalThis.decaySourceStatLoans(ps, player, '_dispatcherStatLoans');
    }
    decayDispatcherDisplaySlots(ps);
    if ((ps.dispatcherTauntT || 0) > 0) { ps.dispatcherTauntT--; if (ps.dispatcherTauntT <= 0) { delete ps.dispatcherTaunt; delete ps.dispatcherTauntT; } }
    revertEnemyDispatcherDebuffs();
  };

  // Crit / dodge surface read by combat helpers via legacy aug fields.
  dispatcher.modifyCritChance = function modifyCritChance(base) {
    var ps = (globalThis.G && globalThis.G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherCrit || 0);
  };
  dispatcher.modifyDodge = function modifyDodge(base) {
    var ps = (globalThis.G && globalThis.G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherDodge || 0);
  };

  Avian.systems.dispatcher = dispatcher;
  // Expose at top-level for terse access used by other systems / debug.
  Avian.dispatcher = dispatcher;
})();
