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
    var id = String(abId || '');
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') {
      id = globalThis.resolveAbilityAliasSourceId(id);
    }
    var row = p && p.skillTrees ? p.skillTrees[id] : null;
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

  function isHybridRow(row) {
    return typeof globalThis.isHybridDamage === 'function' && globalThis.isHybridDamage(row);
  }

  /** Roll row ailment chance and apply. Returns map of applied ailment ids. */
  function tryRollRowAilment(row, targetSide, opts) {
    opts = opts || {};
    var g = globalThis.G;
    var hitsLanded = opts.hitsLanded != null ? opts.hitsLanded : 1;
    var totalDmg = opts.totalDmg || 0;
    var ab = opts.ab || null;
    if (opts.requireHit !== false && hitsLanded <= 0) return {};
    if (!row || !(row.ailmentChance > 0) || !ailmentIdsFromRow(row).length) return {};
    var isMagic = isMagicCategory(row.category);
    var isHybrid = isHybridRow(row);
    var aids = ailmentIdsFromRow(row);
    var aid = aids[Math.floor(Math.random() * aids.length)];
    var ailCh = row.ailmentChance;
    if (g && g.player && targetSide === 'enemy' && typeof Avian !== 'undefined'
        && Avian.mutations && typeof Avian.mutations.getMechanicsRollup === 'function') {
      var eqM = Avian.mutations.getMechanicsRollup(g.player);
      if (isMagic || isHybrid) ailCh += (Number(eqM.magicAilmentChance) || 0);
      if (!isMagic || isHybrid) ailCh += (Number(eqM.physicalAilmentChance) || 0);
    }
    if (g && g.playerStatus && targetSide === 'enemy') {
      if (isMagic || isHybrid) ailCh += (Number(g.playerStatus.magicAilmentChanceBuff) || 0);
      if (!isMagic || isHybrid) ailCh += (Number(g.playerStatus.physicalAilmentChanceBuff) || 0);
    }
    var magicShift = 0;
    if (targetSide === 'enemy' && g && g.player && (isMagic || isHybrid)) {
      var attackerMatk = g.player.stats.matk || 8;
      var targetMdef = (g.enemy && g.enemy.stats) ? (g.enemy.stats.mdef || 8) : 8;
      magicShift = (attackerMatk - targetMdef) * 1.5;
    } else if (targetSide === 'player' && g && g.enemy && isMagic) {
      magicShift = ((g.enemy.stats.matk || 8) - (g.player.stats.mdef || 8)) * 1.5;
    }
    var passiveAilBonus = (targetSide === 'enemy' && g && g.playerStatus) ? (Number(g.playerStatus.passiveAilmentBonus) || 0) : 0;
    var controlBoost = (targetSide === 'enemy' && g && g.player && typeof getPassiveEvolutionBonuses === 'function')
      ? Math.floor((getPassiveEvolutionBonuses(g.player).controlPct || 0) * 100) : 0;
    var rollPct = typeof resolveAilmentChance === 'function'
      ? resolveAilmentChance(ailCh + magicShift + controlBoost + passiveAilBonus, targetSide, g, {})
      : Math.max(5, ailCh + magicShift + controlBoost + passiveAilBonus);
    var ailmentsApplied = {};
    if (typeof chance === 'function' && chance(rollPct)) {
      var applied = false;
      if (aid === 'delayed' && typeof applyDelayedDamage === 'function') {
        var atkWeight = ab && typeof getAbilityAttackWeight === 'function' ? getAbilityAttackWeight(ab, g.player) : null;
        var enCost = row.enCost || row.apCost || 1;
        applied = applyDelayedDamage(targetSide, totalDmg, { attackWeight: atkWeight, enCost: enCost });
      } else if (typeof applyAilment === 'function') {
        applied = applyAilment(targetSide, aid, 1);
      }
      if (applied) {
        ailmentsApplied[aid] = true;
      }
    }
    return ailmentsApplied;
  }

  globalThis.tryRollRowAilment = tryRollRowAilment;

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

  function applyEnemyFlatDebuff(statKey, flatAmt, sourceId) {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats) return false;
    var es = g.enemyStatus = g.enemyStatus || {};
    var stats = g.enemy.stats;
    if (!es._dispatcherDebuffBySource) es._dispatcherDebuffBySource = Object.create(null);
    var slotKey = statKey + ':flat:' + String(sourceId || 'unknown');
    var prev = es._dispatcherDebuffBySource[slotKey];
    if (prev && prev.amt) {
      stats[statKey] = Math.round(((Number(stats[statKey]) || 0) + (prev.amt || 0)) * 100) / 100;
    }
    var cur = Number(stats[statKey]) || 0;
    var amt = Math.max(0, Number(flatAmt) || 0);
    if (amt <= 0) return false;
    stats[statKey] = Math.max(0, Math.round((cur - amt) * 100) / 100);
    es._dispatcherDebuffBySource[slotKey] = { statKey: statKey, amt: amt, turns: 1, sourceId: String(sourceId || ''), flat: true };
    spawnTrendFloat('enemy', 'debuff');
    return true;
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

  function applyPlayerStatDebuff(statKey, pct, sourceId) {
    var g = globalThis.G;
    if (!g || !g.player || !g.player.stats) return false;
    var ps = g.playerStatus = g.playerStatus || {};
    var stats = g.player.stats;
    if (!ps._dispatcherDebuffBySource) ps._dispatcherDebuffBySource = Object.create(null);
    var slotKey = statKey + ':' + String(sourceId || 'unknown');
    var prev = ps._dispatcherDebuffBySource[slotKey];
    if (prev && prev.amt) {
      stats[statKey] = Math.round(((Number(stats[statKey]) || 0) + (prev.amt || 0)) * 100) / 100;
    }
    var cur = Number(stats[statKey]) || 0;
    var amt = Math.round(cur * (Number(pct) || 0) / 100 * 100) / 100;
    if (amt <= 0) return false;
    amt = Math.max(prev ? (prev.amt || 0) : 0, amt);
    stats[statKey] = Math.max(0, Math.round((cur - amt) * 100) / 100);
    ps._dispatcherDebuffBySource[slotKey] = { statKey: statKey, amt: amt, turns: 1, sourceId: String(sourceId || '') };
    spawnTrendFloat('player', 'debuff');
    return true;
  }

  function applyPlayerFlatDebuff(statKey, flatAmt, sourceId) {
    var g = globalThis.G;
    if (!g || !g.player || !g.player.stats) return false;
    var ps = g.playerStatus = g.playerStatus || {};
    var stats = g.player.stats;
    if (!ps._dispatcherDebuffBySource) ps._dispatcherDebuffBySource = Object.create(null);
    var slotKey = statKey + ':flat:' + String(sourceId || 'unknown');
    var prev = ps._dispatcherDebuffBySource[slotKey];
    if (prev && prev.amt) {
      stats[statKey] = Math.round(((Number(stats[statKey]) || 0) + (prev.amt || 0)) * 100) / 100;
    }
    var cur = Number(stats[statKey]) || 0;
    var amt = Math.max(0, Number(flatAmt) || 0);
    if (amt <= 0) return false;
    stats[statKey] = Math.max(0, Math.round((cur - amt) * 100) / 100);
    ps._dispatcherDebuffBySource[slotKey] = { statKey: statKey, amt: amt, turns: 1, sourceId: String(sourceId || ''), flat: true };
    spawnTrendFloat('player', 'debuff');
    return true;
  }

  function rowHasGuardBreak(row) {
    var riders = row && row.riders;
    if (!riders) return false;
    for (var i = 0; i < riders.length; i++) {
      if (riders[i] && riders[i].kind === 'guardBreak') return true;
    }
    return false;
  }

  function applyGuardBreakToEnemy() {
    var g = globalThis.G;
    if (!g || !g.enemy || !g.enemy.stats) return;
    var stats = g.enemy.stats;
    var es = g.enemyStatus = g.enemyStatus || {};
    var shield = Number(stats.shieldHp) || 0;
    if (shield > 0) {
      var cut = Math.max(1, Math.floor((Number(stats.maxHp) || 1) * 8 / 100));
      stats.shieldHp = Math.max(0, Math.round((shield - cut) * 100) / 100);
      if (stats.shieldHp <= 0) {
        stats.shieldHp = 0;
        stats.maxShieldHp = 0;
        delete es.shieldHpTurns;
        delete es.shieldHpSourceId;
        delete es.shieldHpSourceKind;
      }
    }
    if (es.guarded) delete es.guarded;
    if ((es.defending || 0) > 0) es.defending = Math.max(0, es.defending - 1);
    spawnTrendFloat('enemy', 'debuff');
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
    ps.dispatcherAcc = 0;
    var slots = ps._dispatcherDisplaySlots;
    if (!slots) return;
    for (var k in slots) {
      var s = slots[k];
      if (!s || (s.turns || 0) <= 0) continue;
      if (s.kind === 'gainDodge') ps.dispatcherDodge = Math.max(ps.dispatcherDodge || 0, s.value || 0);
      if (s.kind === 'gainCritChance') ps.dispatcherCrit = Math.max(ps.dispatcherCrit || 0, s.value || 0);
      if (s.kind === 'gainCritDamage') ps.dispatcherCritDmg = Math.max(ps.dispatcherCritDmg || 0, s.value || 0);
      if (s.kind === 'gainAcc') ps.dispatcherAcc = Math.max(ps.dispatcherAcc || 0, s.value || 0);
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

  function applyGuardedFromRow(row, riderValue, ab, side) {
    side = side || 'player';
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
    apply(side, { physReducPct: pct, turns: turns, sourceAbilityId: row && row.id ? row.id : '', sourceKind: 'ability' });
    spawnTrendFloat(side, 'buff');
  }

  function applyShieldFromRow(row, riderValue, ab, side) {
    side = side || 'player';
    var apply = (typeof globalThis.applyShieldHp === 'function') ? globalThis.applyShieldHp : null;
    if (!apply) return;
    var pct = Number(riderValue) || 0;
    if (pct <= 0 && row && row.riders) {
      for (var si = 0; si < row.riders.length; si++) {
        var sr = row.riders[si];
        if (sr && sr.kind === 'gainShield' && sr.value) { pct = Number(sr.value) || pct; break; }
      }
    }
    var turns = 1;
    if (row && row.riders) {
      for (var ti = 0; ti < row.riders.length; ti++) {
        var tr = row.riders[ti];
        if (tr && tr.kind === 'gainShield' && tr.turns != null) { turns = Math.max(1, Math.floor(Number(tr.turns) || 1)); break; }
      }
    }
    var tier = null;
    var text = String(row && (row.displayText || row.shortDesc || row.riderText) || '');
    var tm = text.match(/\b(minor|major|grand|epic|legendary)\b/i);
    if (tm) tier = tm[1].toLowerCase();
    apply(side, {
      pct: pct > 0 ? pct : undefined,
      tier: tier,
      turns: turns,
      sourceId: row && row.id ? row.id : (ab && ab.id) || '',
      sourceKind: 'ability',
    });
    spawnTrendFloat(side, 'buff');
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
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
    var text = String(row.riderText || row.shortDesc || row.displayText || '');
    if (/guard|brace|damage reduction/i.test(text)) return true;
    if (/guard/i.test(String(row.category || ''))) return true;
    return rowGrantsGuardedViaRider(row);
  }

  // ---- riders -----------------------------------------------------------
  function makeStatRiderHandlers(sourceId, row, ab, owner) {
    owner = owner || {};
    var side = owner.side || 'player';
    var floatSide = side;
    var shouldLoanDisplayStat = side === 'enemy';
    function debuffOpponentStat(statKey, pct) {
      if (side === 'enemy') applyPlayerStatDebuff(statKey, pct, sourceId);
      else applyEnemyStatDebuff(statKey, pct, sourceId);
    }
    function debuffOpponentFlat(statKey, flatAmt) {
      if (side === 'enemy') applyPlayerFlatDebuff(statKey, flatAmt, sourceId);
      else applyEnemyFlatDebuff(statKey, flatAmt, sourceId);
    }
    function applyDisplayOrStat(ps, entity, kind, statKey, value) {
      applyDispatcherDisplaySlot(ps, sourceId, kind, value);
      if (shouldLoanDisplayStat && statKey) applyDispatcherStatLoan(ps, entity, statKey, sourceId + ':' + kind, value);
      spawnTrendFloat(floatSide, 'buff');
    }
    return {
      gainDodge: function (n, ps, p) { applyDisplayOrStat(ps, p, 'gainDodge', 'dodge', n); },
      gainAccFlat: function (n, ps, p) { applyDisplayOrStat(ps, p, 'gainAcc', 'acc', n); },
      gainDodgeFlat: function (n, ps, p) { applyDisplayOrStat(ps, p, 'gainDodge', 'dodge', n); },
      gainAcc: function (n, ps, p) { applyDisplayOrStat(ps, p, 'gainAcc', 'acc', n); },
      gainSpeed: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'spd', sourceId, n); spawnTrendFloat(floatSide, 'buff'); },
      gainCritChance: function (n, ps, p) { applyDisplayOrStat(ps, p, 'gainCritChance', 'critChance', n); },
      gainCritDamage: function (n, ps) { applyDispatcherDisplaySlot(ps, sourceId, 'gainCritDamage', n); spawnTrendFloat(floatSide, 'buff'); },
      gainAtk: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'atk', sourceId, n); spawnTrendFloat(floatSide, 'buff'); },
      gainMatk: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'matk', sourceId, n); spawnTrendFloat(floatSide, 'buff'); },
      gainDef: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'def', sourceId, n); spawnTrendFloat(floatSide, 'buff'); },
      gainMdef: function (n, ps, p) { applyDispatcherStatLoanPct(ps, p, 'mdef', sourceId, n); spawnTrendFloat(floatSide, 'buff'); },
      gainGuard: function (n, ps, p) {
        var pct = Number(n) || 8;
        applyDispatcherStatLoanPct(ps, p, 'def', sourceId, pct);
        spawnTrendFloat(floatSide, 'buff');
      },
      gainGuarded: function (n) { applyGuardedFromRow(row, n, ab, side); },
      gainBrace: function (n) { applyGuardedFromRow(row, n, ab, side); },
      gainShield: function (n) { applyShieldFromRow(row, n, ab, side); },
      gainShieldFromDamage: function (n, _ps, _p, _r, ctx) {
        var dmg = (ctx && ctx.totalDmg) || 0;
        if (dmg <= 0) return;
        var apply = (typeof globalThis.applyShieldHp === 'function') ? globalThis.applyShieldHp : null;
        if (!apply) return;
        var amount = Math.max(1, Math.floor(dmg * (Number(n) || 0) / 100));
        apply(side, {
          amount: amount,
          turns: 1,
          sourceId: row && row.id ? row.id : (ab && ab.id) || '',
          sourceKind: 'ability',
        });
        spawnTrendFloat(floatSide, 'buff');
        if (typeof refreshBattleUI === 'function') refreshBattleUI();
      },
      purgeEnemyMinorBuff: function () {
        var g = globalThis.G;
        if (!g || !g.enemyStatus) return;
        if (typeof globalThis.applyTagRidersFromRow === 'function') {
          var purgeRow = { tags: ['Purge'], riderText: 'purge', shortDesc: 'purge' };
          globalThis.applyTagRidersFromRow(purgeRow, {});
        }
      },
      gainCounter: function (_n, ps) { ps.counterInstinct = Math.max(ps.counterInstinct || 0, 1); spawnTrendFloat(floatSide, 'buff'); },
      gainTaunt: function (_n, ps) { ps.dispatcherTaunt = 1; ps.dispatcherTauntT = 1; spawnTrendFloat(floatSide, 'buff'); },
      reduceEnemyDodge: function (n) { debuffOpponentStat('dodge', n); },
      reduceEnemyAcc: function (n) { debuffOpponentStat('acc', n); },
      reduceEnemyAtk: function (n) { debuffOpponentStat('atk', n); },
      reduceEnemyMatk: function (n) { debuffOpponentStat('matk', n); },
      reduceEnemySpd: function (n) { debuffOpponentStat('spd', n); },
      reduceEnemyCrit: function (n) { debuffOpponentStat('critChance', n); },
      reduceEnemyDef: function (n) { debuffOpponentStat('def', n); },
      reduceEnemyMdef: function (n) { debuffOpponentStat('mdef', n); },
      gainMagicAilmentChance: function (n, ps) {
        ps.magicAilmentChanceBuff = Math.max(ps.magicAilmentChanceBuff || 0, Number(n) || 0);
        spawnTrendFloat(floatSide, 'buff');
      },
      gainPhysicalAilmentChance: function (n, ps) {
        ps.physicalAilmentChanceBuff = Math.max(ps.physicalAilmentChanceBuff || 0, Number(n) || 0);
        spawnTrendFloat(floatSide, 'buff');
      },
      reduceEnemyAccFlat: function (n) { debuffOpponentFlat('acc', n); },
      exposeGuard: function (n, _ps, _p, r) {
        var g = globalThis.G;
        var targetStatus = side === 'enemy' ? (g && g.playerStatus) : (g && g.enemyStatus);
        if (!targetStatus) return;
        var pct = Number(n) || 0;
        if (pct <= 0) pct = 18;
        if (pct > 1) pct = pct / 100;
        var turns = (r && r.turns) || 2;
        targetStatus.exposedGuard = { pct: pct, turns: Math.max(1, Math.floor(Number(turns) || 2)) };
        spawnTrendFloat(side === 'enemy' ? 'player' : 'enemy', 'debuff');
      },
    };
  }

  var riderHandlers = {
    healMaxHpPct: function (n, _ps, p, _r, ctx) {
      if (!p || !p.stats) return;
      var side = (ctx && ctx.ownerSide) || 'player';
      var heal = Math.round((Number(p.stats.maxHp) || 0) * (Number(n) || 0) / 100 * 100) / 100;
      if (heal <= 0) return;
      p.stats.hp = Math.min(Number(p.stats.maxHp) || 0, Math.round(((Number(p.stats.hp) || 0) + heal) * 100) / 100);
      if (typeof setHpBar === 'function') setHpBar(side, p.stats.hp, p.stats.maxHp);
      if (typeof spawnFloat === 'function') spawnFloat(side, '+' + heal, 'fn-heal');
      spawnTrendFloat(side, 'buff');
    },
    gainAccNextHit: function (n, ps, _p, r) {
      if (r && r.when === 'onEnemyMissBeforeTurn') {
        ps._dispatcherAccNextHitWatch = Math.max(ps._dispatcherAccNextHitWatch || 0, Number(n) || 0);
      } else {
        ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, Number(n) || 0);
      }
    },
    refundApOnCrit: function (_n, ps) { ps._dispatcherRefundApOnCrit = 1; },
    gainApNextTurn: function (n, ps) { ps._dispatcherApNextTurn = (ps._dispatcherApNextTurn || 0) + n; },
    bonusVsAilment: function () { /* read by applyConditionalDamageBonus */ },
    bonusVsLowHp: function () { /* handled in conditional bonus */ },
    tagFlag: function () { /* tags don't mutate state directly */ },
    guardBreak: function () { applyGuardBreakToEnemy(); },
    raw: function () { /* unresolved free-text; safe no-op */ },
  };

  function playerActingFirst() {
    var g = globalThis.G;
    if (!g || !g.player || !g.enemy) return false;
    return (g.player.stats.spd || 0) >= (g.enemy.stats.spd || 0);
  }

  function playerUsedMagicThisTurn() {
    var g = globalThis.G;
    return !!(g && g._lastPlayerAbilityCategory === 'magic');
  }

  function enemyHasAnyAilment() {
    var g = globalThis.G;
    if (!g || !g.enemyStatus) return false;
    var es = g.enemyStatus;
    return (es.poison && es.poison.stacks > 0) ||
      (es.bleed && es.bleed.stacks > 0) ||
      (es.chilled && es.chilled.stacks > 0) ||
      (es.burning && es.burning.stacks > 0) ||
      (es.delayed && (es.delayed.stacks > 0 || es.delayed > 0)) ||
      (typeof globalThis.getWeakenStacks === 'function' && globalThis.getWeakenStacks(es) > 0) ||
      (es.paralyzed > 0) || !!es.confused || (es.accDebuff > 0);
  }

  function resolveRiderOwnerSide(ctx) {
    return ctx && ctx.ownerSide === 'enemy' ? 'enemy' : 'player';
  }

  function sideIsGuarding(side) {
    var g = globalThis.G;
    if (!g) return false;
    var ps = side === 'enemy' ? g.enemyStatus : g.playerStatus;
    if (side === 'player' && typeof globalThis.playerIsGuarding === 'function') {
      return globalThis.playerIsGuarding(ps);
    }
    if ((ps && ps.defending) > 0) return true;
    return typeof globalThis.getGuardedPhysReducPct === 'function' && globalThis.getGuardedPhysReducPct(ps) > 0;
  }

  function sideHasShield(side) {
    var g = globalThis.G;
    if (!g) return false;
    var entity = side === 'enemy' ? g.enemy : g.player;
    return (entity && entity.stats && Number(entity.stats.shieldHp) > 0);
  }

  function riderWhenMatches(r, ctx) {
    var w = r.when;
    if (!w) return true;
    if (w === 'onHit') return ctx.hitsLanded > 0;
    if (w === 'actingFirst') return playerActingFirst();
    if (w === 'afterMagicThisTurn') return playerUsedMagicThisTurn();
    if (w === 'allHitsLanded') return (ctx.hitsAttempted || 0) > 1 && ctx.hitsLanded === ctx.hitsAttempted;
    if (w === 'targetHasAilment') return enemyHasAnyAilment();
    if (w === 'targetWeakened') {
      var g = globalThis.G;
      return g && g.enemyStatus && typeof globalThis.getWeakenStacks === 'function' && globalThis.getWeakenStacks(g.enemyStatus) > 0;
    }
    if (w === 'targetDelayed') {
      var g2 = globalThis.G;
      var es = g2 && g2.enemyStatus;
      return !!(es && es.delayed && (es.delayed.stacks > 0 || es.delayed > 0));
    }
    if (w === 'onAilmentFail') return ctx.ailmentFailed === true;
    if (w === 'onEnemyMissBeforeTurn') return true;
    if (w === 'alternatingAttackType') {
      var g3 = globalThis.G;
      return !!(g3 && g3._playerAlternatedAttackTypeThisTurn);
    }
    if (w.indexOf('onAilment:') === 0) {
      var aid = w.slice('onAilment:'.length);
      return ctx.ailmentsApplied && ctx.ailmentsApplied[aid];
    }
    if (w === 'guardActive') return sideIsGuarding(resolveRiderOwnerSide(ctx));
    if (w === 'guardInactive') return !sideIsGuarding(resolveRiderOwnerSide(ctx));
    if (w === 'shieldActive') return sideHasShield(resolveRiderOwnerSide(ctx));
    if (w === 'shieldInactive') return !sideHasShield(resolveRiderOwnerSide(ctx));
    return false;
  }

  function runRidersForSide(side, row, ctx, ab) {
    var g = globalThis.G;
    if (!g || !row || !row.riders) return 0;
    side = side === 'enemy' ? 'enemy' : 'player';
    var ps = side === 'enemy' ? (g.enemyStatus = g.enemyStatus || {}) : (g.playerStatus = g.playerStatus || {});
    var p = side === 'enemy' ? g.enemy : g.player;
    if (!p) return 0;
    var sourceId = row.id || (ctx && ctx.sourceAbilityId) || 'unknown';
    var statHandlers = makeStatRiderHandlers(sourceId, row, ab, { side: side });
    ctx = ctx || {};
    ctx.ownerSide = side;
    ctx.applied = ctx.applied || Object.create(null);
    var appliedCount = 0;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'refundApOnCrit' || r.kind === 'gainApNextTurn' || r.kind === 'bonusVsAilment' || r.kind === 'bonusVsLowHp' || r.kind === 'tagFlag' || r.kind === 'raw') continue;
      if (!riderWhenMatches(r, ctx)) continue;
      var rKey = sourceId + '|' + r.kind + '|' + (r.when || '') + '|' + (r.value || '');
      if (ctx.applied[rKey]) continue;
      var fn = statHandlers[r.kind] || riderHandlers[r.kind];
      if (fn) {
        fn(r.value, ps, p, r, ctx);
        ctx.applied[rKey] = true;
        appliedCount++;
      }
    }
    return appliedCount;
  }

  function runRiders(row, ctx, ab) {
    if (!row || !row.riders || !row.riders.length) return 0;
    var selfRiders = [];
    var enemyRiders = [];
    for (var ri = 0; ri < row.riders.length; ri++) {
      var rr = row.riders[ri];
      if (rr && rr.scope === 'enemy') enemyRiders.push(rr);
      else selfRiders.push(rr);
    }
    ctx = ctx || {};
    ctx.applied = ctx.applied || Object.create(null);
    var count = 0;
    if (selfRiders.length) {
      count += runRidersForSide('player', Object.assign({}, row, { riders: selfRiders }), ctx, ab);
    }
    if (enemyRiders.length) {
      count += runRidersForSide('player', Object.assign({}, row, { riders: enemyRiders }), ctx, ab);
    }
    return count;
  }

  function runAttackRiders(attackerSide, row, ctx, ab) {
    if (!row || !row.riders || !row.riders.length) return 0;
    attackerSide = attackerSide === 'enemy' ? 'enemy' : 'player';
    var selfRiders = [];
    var oppRiders = [];
    for (var ri = 0; ri < row.riders.length; ri++) {
      var rr = row.riders[ri];
      if (rr && rr.scope === 'enemy') oppRiders.push(rr);
      else selfRiders.push(rr);
    }
    ctx = ctx || {};
    ctx.attackerSide = attackerSide;
    ctx.applied = ctx.applied || Object.create(null);
    var count = 0;
    if (selfRiders.length) {
      count += runRidersForSide(attackerSide, Object.assign({}, row, { riders: selfRiders }), ctx, ab);
    }
    if (oppRiders.length) {
      var defenderSide = attackerSide === 'enemy' ? 'player' : 'enemy';
      count += runRidersForSide(defenderSide, Object.assign({}, row, { riders: oppRiders }), ctx, ab);
    }
    return count;
  }

  function runPreRiders(row, ab) {
    runRiders(row, { hitsLanded: 0, hitsAttempted: 0, ailmentsApplied: {} }, ab);
    if (shouldAutoApplyGuarded(row) && !rowGrantsGuardedViaRider(row)) {
      applyGuardedFromRow(row, 0, ab);
    }
  }
  // NOTE: Conditional dispatcher damage bonuses (marked +12%, finisher/bloodied +15%,
  // bonusVsAilment, bonusVsLowHp) are now folded into the single capped Bonus_Mod via
  // game.js collectDispatcherConditionalBonusFractions(). This helper is retained as a
  // no-op for backward compatibility so it never double-applies an uncapped multiplier.
  function applyConditionalDamageBonus(row, dmg) {
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

    // Pre-damage riders only for self / no-damage abilities (handled in no-damage branch below)

    var anyCrit = false;
    var hitsLanded = 0;
    var totalDmg = 0;

    if (row.noDamage || row.target === 'self') {
      if (g) {
        g._lastAbilityHitsLanded = 0;
        g._lastAbilityAnyCrit = false;
        g._lastAbilityAilmentFailed = false;
      }
      var utilOk = typeof globalThis.applyTagRidersFromRow === 'function'
        ? globalThis.applyTagRidersFromRow(row, { utilitySucceeded: false })
        : false;
      runPreRiders(row, ab);
      var utilAilments = tryRollRowAilment(row, 'enemy', { hitsLanded: 1, totalDmg: 0, ab: ab, requireHit: false });
      if (g) g._lastAbilityAilmentFailed = (row.ailmentChance > 0 && ailmentIdsFromRow(row).length > 0)
        && !Object.keys(utilAilments).length;
      if (g) g._lastAbilityUtilitySucceeded = !!utilOk;
      if (typeof Avian !== 'undefined' && Avian.mutationEffects && typeof Avian.mutationEffects.onUtilityUsed === 'function') {
        Avian.mutationEffects.onUtilityUsed(!!utilOk);
      }
      if (typeof logMsg === 'function') logMsg('🛡 ' + (row.name || ab.id) + (row.riderText ? ' — ' + row.riderText : ''), 'player-action');
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      return;
    }

    var hits = Math.max(1, row.hits || row.hitCount || 1);
    var isMagic = isMagicCategory(row.category);
    var isHybrid = isHybridRow(row);

    if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);

    if (rowHasGuardBreak(row)) applyGuardBreakToEnemy();

    var enemyDodge = (typeof getEffectiveEnemyDodgeForPlayerHit === 'function')
      ? getEffectiveEnemyDodgeForPlayerHit()
      : ((g && g.enemy && g.enemy.stats) ? (g.enemy.stats.dodge || 0) : 0);
    var hitPct = (typeof getPlayerHitPercentForAttack === 'function')
      ? getPlayerHitPercentForAttack(ab)
      : (function () {
        var playerAcc = (typeof getPlayerEffectiveAcc === 'function') ? getPlayerEffectiveAcc() : 80;
        var accPenalty = (typeof globalThis.calculateAbilityAccuracyPenalty === 'function')
          ? globalThis.calculateAbilityAccuracyPenalty(row) : 0;
        return (typeof calculateAbilityHitChancePct === 'function')
          ? calculateAbilityHitChancePct(playerAcc, enemyDodge, accPenalty) : 85;
      })();
    var baseHitFrac = hitPct / 100;

    var usesMaster = typeof globalThis.usesMasterDamage === 'function' && globalThis.usesMasterDamage(row);

    // Master multi-hit (spec section 14): compute the full damage budget ONCE and
    // split it across hits via calculateMultiHitDamage, rather than dealing full
    // damage per hit. Crit is rolled once for the whole ability so the total stays
    // controlled. Each hit still rolls its own miss; a missed hit forfeits its chunk.
    var masterSplit = null;
    var masterIsCrit = false;
    if (usesMaster && row.hybridPerHit && typeof globalThis.computeMasterOutgoingDamage === 'function') {
      masterSplit = [];
      for (var hi = 0; hi < hits; hi++) {
        row._hybridHitStat = hi === 0 ? 'ATK' : 'MATK';
        if (g) {
          g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
          g._dispatcherCombatRow = row;
        } else {
          G._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
          G._dispatcherCombatRow = row;
        }
        var perHitTotal = globalThis.computeMasterOutgoingDamage(isMagic, src, { hitSucceeded: true });
        if (g) g._dispatcherCombatRow = null; else G._dispatcherCombatRow = null;
        masterSplit.push(perHitTotal ? perHitTotal.damage : 0);
        if (perHitTotal && perHitTotal.isCrit) masterIsCrit = true;
      }
      delete row._hybridHitStat;
    } else if (usesMaster && typeof globalThis.computeMasterOutgoingDamage === 'function') {
      if (g) {
        g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        g._dispatcherCombatRow = row;
      } else {
        G._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        G._dispatcherCombatRow = row;
      }
      var masterTotal = globalThis.computeMasterOutgoingDamage(isMagic, src, { hitSucceeded: true });
      if (g) g._dispatcherCombatRow = null; else G._dispatcherCombatRow = null;
      if (masterTotal) {
        masterIsCrit = !!masterTotal.isCrit;
        masterSplit = (hits > 1 && typeof globalThis.calculateMultiHitDamage === 'function')
          ? globalThis.calculateMultiHitDamage(masterTotal.damage, hits)
          : [masterTotal.damage];
      }
    }

    for (var i = 0; i < hits; i++) {
      if (Math.random() >= baseHitFrac) {
        if (typeof doMiss === 'function') await doMiss('player');
        continue;
      }
      // Pierce: feed the % so the legacy dealDamage fallback path can use it.
      if (g) {
        g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        g._dispatcherCombatRow = row;
      } else {
        G._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        G._dispatcherCombatRow = row;
      }
      var dealFn = resolveDealDamage();
      var dealOpts = null;
      if (masterSplit) {
        dealOpts = { precomputedDamage: masterSplit[i] || 0, isCrit: masterIsCrit };
      }
      var res = dealFn
        ? dealFn('enemy', 0, dealOpts ? dealOpts.isCrit : false, isMagic, src, dealOpts)
        : { dmgDealt: 0, wasDodged: false, wasBlocked: false, isCrit: false };
      if (g) g._dispatcherCombatRow = null;
      else G._dispatcherCombatRow = null;
      if (res && !res.wasDodged && isHybrid && typeof globalThis.calculateHybridDisplaySplit === 'function') {
        var splitRow = Object.assign({}, row, { hitIndex: row.hybridPerHit ? i : null });
        var hitSplit = globalThis.calculateHybridDisplaySplit((res.dmgDealt) || 0, splitRow);
        res.hybridSplit = { physical: hitSplit.physical, magic: hitSplit.magic };
      }
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
      ailmentsApplied = tryRollRowAilment(row, 'enemy', { hitsLanded: hitsLanded, totalDmg: totalDmg, ab: ab });
    }

    var ailmentFailed = ailmentAttempted && !Object.keys(ailmentsApplied).length;
    var riderCtx = { hitsLanded: hitsLanded, hitsAttempted: hits, totalDmg: totalDmg, ailmentsApplied: ailmentsApplied, ailmentFailed: ailmentFailed };
    runRiders(row, riderCtx, ab);
    if (typeof globalThis.applyTagRidersFromRow === 'function') {
      globalThis.applyTagRidersFromRow(row, riderCtx);
    }

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
      if (hitsLanded > 0 && g.playerStatus && g.playerStatus._dispatcherAccNextHit) {
        delete g.playerStatus._dispatcherAccNextHit;
      }
    }

    if (typeof Avian !== 'undefined' && Avian.mutationEffects) {
      if (isMagic && typeof Avian.mutationEffects.onSongOrCall === 'function') {
        Avian.mutationEffects.onSongOrCall(hitsLanded > 0);
      }
      if (typeof Avian.mutationEffects.onAfterPlayerAttack === 'function') {
        var atkWeight2 = typeof getAbilityAttackWeight === 'function' ? getAbilityAttackWeight(ab, g && g.player) : null;
        Avian.mutationEffects.onAfterPlayerAttack({
          attackWeight: atkWeight2, isMagic: isMagic, isHybrid: isHybrid,
          hitsLanded: hitsLanded, anyCrit: anyCrit,
        });
      }
    }

    if (typeof logMsg === 'function') {
      var label = isHybrid ? '⚔🎶' : (isMagic ? '🎶' : '⚔');
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

  dispatcher.applySelfRiders = function applySelfRiders(side, row, ab, ctx) {
    side = side === 'enemy' ? 'enemy' : 'player';
    if (!row) return false;
    var riderCtx = Object.assign({ hitsLanded: 1, hitsAttempted: 1, totalDmg: 0, ailmentsApplied: {} }, ctx || {});
    var appliedCount = runRidersForSide(side, row, riderCtx, ab);
    var autoGuarded = false;
    if (shouldAutoApplyGuarded(row) && !rowGrantsGuardedViaRider(row)) {
      applyGuardedFromRow(row, 0, ab, side);
      autoGuarded = true;
    }
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
    return appliedCount > 0 || autoGuarded;
  };

  dispatcher.runAttackRiders = function (attackerSide, row, ctx, ab) {
    return runAttackRiders(attackerSide, row, ctx, ab);
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
    g._playerLastAttackCategoryThisTurn = null;
    g._playerAlternatedAttackTypeThisTurn = false;
    var ps = g.playerStatus;
    if (ps) {
      delete ps.magicAilmentChanceBuff;
      delete ps.physicalAilmentChanceBuff;
      delete ps._dispatcherAccNextHitWatch;
      delete ps._dispatcherAccNextHit;
    }
  };

  dispatcher.trackAlternatingAttackCategory = function trackAlternatingAttackCategory(effActKind, row) {
    var g = globalThis.G;
    if (!g) return;
    var cat = effActKind === 'spell' ? 'magic'
      : (effActKind === 'physical' || effActKind === 'ranged') ? 'physical' : null;
    if (!cat && row && String(row.category || '').toLowerCase() === 'hybrid') cat = 'hybrid';
    if (!cat) return;
    var last = g._playerLastAttackCategoryThisTurn;
    if (cat === 'physical' && last === 'magic') g._playerAlternatedAttackTypeThisTurn = true;
    else if (cat === 'magic' && last === 'physical') g._playerAlternatedAttackTypeThisTurn = true;
    else if (cat === 'hybrid' && (last === 'physical' || last === 'magic')) g._playerAlternatedAttackTypeThisTurn = true;
    if (cat === 'physical' || cat === 'magic') g._playerLastAttackCategoryThisTurn = cat;
  };

  dispatcher.onEnemyMissedPlayer = function onEnemyMissedPlayer() {
    var g = globalThis.G;
    var ps = g && g.playerStatus;
    if (!ps || !(ps._dispatcherAccNextHitWatch > 0)) return;
    ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, ps._dispatcherAccNextHitWatch);
    delete ps._dispatcherAccNextHitWatch;
    spawnTrendFloat('player', 'buff');
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
    delete ps._dispatcherAccNextHitWatch;
    if ((ps.dispatcherTauntT || 0) > 0) { ps.dispatcherTauntT--; if (ps.dispatcherTauntT <= 0) { delete ps.dispatcherTaunt; delete ps.dispatcherTauntT; } }
    revertEnemyDispatcherDebuffs();
  };

  dispatcher.onAfterPlayerTurn = function onAfterPlayerTurn(enemy) {
    if (!enemy || !enemy.stats) return;
    var g = globalThis.G;
    var es = (g && g.enemyStatus) || null;
    if (!es) return;
    if (typeof globalThis.decaySourceStatLoans === 'function') {
      globalThis.decaySourceStatLoans(es, enemy, '_dispatcherStatLoans');
    }
    if (typeof globalThis.decayWorkbookDebuffLoans === 'function') {
      globalThis.decayWorkbookDebuffLoans(enemy);
    }
    decayDispatcherDisplaySlots(es);
    delete es._dispatcherAccNextHitWatch;
    if ((es.dispatcherTauntT || 0) > 0) { es.dispatcherTauntT--; if (es.dispatcherTauntT <= 0) { delete es.dispatcherTaunt; delete es.dispatcherTauntT; } }
  };

  // Crit / dodge surface read by combat helpers via legacy aug fields.
  dispatcher.modifyCritChance = function modifyCritChance(base) {
    var ps = (globalThis.G && globalThis.G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherCrit || 0);
  };
  dispatcher.modifyAcc = function modifyAcc(base) {
    var ps = (globalThis.G && globalThis.G.playerStatus) || null;
    if (!ps) return base;
    var acc = base + (ps.dispatcherAcc || 0);
    if (ps._dispatcherAccNextHit > 0) acc += ps._dispatcherAccNextHit;
    return acc;
  };
  dispatcher.modifyDodge = function modifyDodge(base) {
    var ps = (globalThis.G && globalThis.G.playerStatus) || null;
    if (!ps) return base;
    return base + (ps.dispatcherDodge || 0);
  };
  dispatcher.applyConditionalDamageBonus = applyConditionalDamageBonus;

  Avian.systems.dispatcher = dispatcher;
  // Expose at top-level for terse access used by other systems / debug.
  Avian.dispatcher = dispatcher;
  globalThis.spawnTrendFloat = spawnTrendFloat;
})();
