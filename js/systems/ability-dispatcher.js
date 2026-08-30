/* Avian Ascent — Ability Dispatcher (combat rewrite).
 *
 * Replaces the legacy `ACTIONS[id]` hand-coded handlers. Every ability id in the
 * combat data pack (equipment skills via js/data/equipment/skills.js) is routed through
 * `Avian.dispatcher.execute(ab)` which:
 *
 *   1. Looks up the normalised row from the ability's `_dispatcherRow` or equipment skills.
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
    var id = String(abId || '');
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') {
      id = globalThis.resolveAbilityAliasSourceId(id);
    }
    if (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function') {
      var eqRow = Avian.equipmentActions.skillToAbilityRow(id, null, 'grey');
      if (eqRow) {
        if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(eqRow);
        return eqRow;
      }
    }
    var skills = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
    if (skills && skills[id]) {
      var raw = skills[id];
      if (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function') {
        var built = Avian.equipmentActions.skillToAbilityRow(id, null, 'grey');
        if (built) {
          if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(built);
          return built;
        }
      }
    }
    return null;
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
    if (typeof globalThis.weaponFirstEnabled === 'function' && globalThis.weaponFirstEnabled()
      && typeof globalThis.usesWeaponFirst === 'function' && globalThis.usesWeaponFirst(row)) {
      return 0;
    }
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
    var hitsAttempted = opts.hitsAttempted != null ? opts.hitsAttempted : hitsLanded;
    var healthHits = opts.healthHits != null ? opts.healthHits : hitsLanded;
    var totalDmg = opts.totalDmg || 0;
    var ab = opts.ab || null;
    if (opts.requireHit !== false && hitsLanded <= 0) return {};
    if (!row || !(row.ailmentChance > 0) || !ailmentIdsFromRow(row).length) return {};
    if (row.ailmentWhen && !riderWhenMatches({ when: row.ailmentWhen }, opts)) return {};
    if (row.ailmentRequireBothHitsHealth) {
      var needHits = Math.max(2, hitsAttempted || 2);
      if (healthHits < needHits) return {};
    }
    var isMagic = isMagicCategory(row.category);
    var isHybrid = isHybridRow(row);
    var aids = ailmentIdsFromRow(row);
    var aid = aids[Math.floor(Math.random() * aids.length)];
    var ailCh = row.ailmentChance;
    if (g && g.player && targetSide === 'enemy' && typeof Avian !== 'undefined'
        && Avian.equipment && typeof Avian.equipment.getMechanicsRollup === 'function') {
      var eqM = Avian.equipment.getMechanicsRollup(g.player);
      if (isMagic || isHybrid) ailCh += (Number(eqM.magicAilmentChance) || 0);
      if (!isMagic || isHybrid) ailCh += (Number(eqM.physicalAilmentChance) || 0);
    }
    if (g && g.playerStatus && targetSide === 'enemy') {
      if (isMagic || isHybrid) ailCh += (Number(g.playerStatus.magicAilmentChanceBuff) || 0);
      if (!isMagic || isHybrid) ailCh += (Number(g.playerStatus.physicalAilmentChanceBuff) || 0);
      ailCh += (Number(g.playerStatus._passiveAilmentAppBonus) || 0);
      if (g.playerStatus._passiveAilmentAppBonus) g.playerStatus._passiveAilmentAppBonus = 0;
    }
    if (g && targetSide === 'player' && g.playerStatus) {
      var resistBag = g.playerStatus.hostileMagicAilmentResist;
      if (resistBag && (isMagic || isHybrid)) {
        ailCh -= Number(resistBag.value) || 0;
      }
      if (g.playerStatus._orbAilmentAppResist) {
        ailCh -= Number(g.playerStatus._orbAilmentAppResist) || 0;
      }
    }
    if (g && targetSide === 'enemy' && g.enemyStatus && g.enemyStatus.hostileMagicAilmentResist && (isMagic || isHybrid)) {
      ailCh -= Number(g.enemyStatus.hostileMagicAilmentResist.value) || 0;
    }
    if (typeof Avian !== 'undefined' && Avian.classPerks && typeof Avian.classPerks.consumeCursedCallAppBonus === 'function') {
      var attacker = targetSide === 'enemy' ? (g && g.player) : (g && g.enemy);
      ailCh += Avian.classPerks.consumeCursedCallAppBonus(attacker) || 0;
    }
    if (g && targetSide === 'enemy' && g.enemyStatus && g.enemyStatus.jewelMark
      && (g.enemyStatus.jewelMark.turns || 0) > 0
      && g.enemy && g.enemy.stats && (Number(g.enemy.stats.magicArmour) || 0) <= 0) {
      ailCh += Number(g.enemyStatus.jewelMark.appBonus) || 10;
      delete g.enemyStatus.jewelMark.appBonus;
    }
    var magicShift = 0;
    var authoredChance = Number(row.ailmentChance) || 0;
    var deterministic = typeof isDeterministicOnLandChance === 'function'
      ? isDeterministicOnLandChance(authoredChance, {})
      : (authoredChance >= 100);
    if (!deterministic && targetSide === 'enemy' && g && g.player && (isMagic || isHybrid)) {
      var attackerMatk = Number(g.player.stats.matk) || 0;
      var targetMdef = (g.enemy && g.enemy.stats) ? (Number(g.enemy.stats.mdef) || 0) : 0;
      magicShift = (attackerMatk - targetMdef) * 1.5;
    } else if (!deterministic && targetSide === 'player' && g && g.enemy && isMagic) {
      magicShift = ((Number(g.enemy.stats.matk) || 0) - (Number(g.player.stats.mdef) || 0)) * 1.5;
    }
    var passiveAilBonus = (targetSide === 'enemy' && g && g.playerStatus) ? (Number(g.playerStatus.passiveAilmentBonus) || 0) : 0;
    var controlBoost = (targetSide === 'enemy' && g && g.player && typeof getPassiveEvolutionBonuses === 'function')
      ? Math.floor((getPassiveEvolutionBonuses(g.player).controlPct || 0) * 100) : 0;
    var chanceInput = deterministic
      ? authoredChance
      : (ailCh + magicShift + controlBoost + passiveAilBonus);
    var rollPct = typeof resolveAilmentChance === 'function'
      ? resolveAilmentChance(chanceInput, targetSide, g, deterministic ? { skipResist: true } : {})
      : Math.max(5, chanceInput);
    var ailmentsApplied = {};
    var shouldAttempt = deterministic || (typeof chance === 'function' && chance(rollPct));
    if (shouldAttempt) {
      var applied = false;
      /* v1.2 same-hit ailment gate via Armour / Magic Armour pools. */
      var prot = Avian.protection;
      var protectHit = (typeof G !== 'undefined') ? G._lastProtectionHit : null;
      var gateOk = true;
      if (prot && typeof prot.ailmentApplicationAllowed === 'function') {
        if (protectHit && protectHit.poolKey) {
          var needed = prot.protectionPoolForAilment(aid);
          if (needed && protectHit.poolKey !== needed) {
            /* Mismatched pool on this hit — still allow if the needed pool is already empty
               and Health was damaged (independent pools). */
            var targetStats = targetSide === 'enemy'
              ? (g && g.enemy && g.enemy.stats)
              : (g && g.player && g.player.stats);
            var poolLeft = prot.currentPool(targetStats, needed);
            gateOk = poolLeft <= 0 && !!(protectHit.damagedHealth);
          } else {
            gateOk = prot.ailmentApplicationAllowed(protectHit);
          }
        }
      }
      if (gateOk) {
        if (aid === 'delayed' && typeof applyDelayedDamage === 'function') {
          var atkWeight = ab && typeof getAbilityAttackWeight === 'function' ? getAbilityAttackWeight(ab, g.player) : null;
          var enCost = row.enCost || row.apCost || 1;
          applied = applyDelayedDamage(targetSide, totalDmg, { attackWeight: atkWeight, enCost: enCost });
        } else if (typeof applyAilment === 'function') {
          var stackCount = Math.max(1, Math.floor(Number(row.ailmentStacks) || 1));
          applied = applyAilment(targetSide, aid, stackCount);
        }
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

  function notifyStatDebuffApplied() {
    if (typeof Avian !== 'undefined' && Avian.passives && typeof Avian.passives.onAilmentAppliedByPlayer === 'function') {
      Avian.passives.onAilmentAppliedByPlayer('statDebuff');
    }
  }

  function applyEnemyFlatDebuff(statKey, flatAmt, sourceId, turns) {
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
    es._dispatcherDebuffBySource[slotKey] = {
      statKey: statKey,
      amt: amt,
      turns: Math.max(1, Math.floor(Number(turns) || 1)),
      sourceId: String(sourceId || ''),
      flat: true,
    };
    spawnTrendFloat('enemy', 'debuff');
    notifyStatDebuffApplied();
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
    notifyStatDebuffApplied();
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

  function applyDispatcherDisplaySlot(ps, sourceId, kind, value, turns) {
    if (!ps._dispatcherDisplaySlots) ps._dispatcherDisplaySlots = Object.create(null);
    var key = String(sourceId || 'unknown') + ':' + kind;
    var prev = ps._dispatcherDisplaySlots[key];
    ps._dispatcherDisplaySlots[key] = {
      kind: kind,
      value: Math.max(prev ? (prev.value || 0) : 0, Number(value) || 0),
      turns: Math.max(1, Math.floor(Number(turns) || 1)),
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

  function effectTiersFlatStat() {
    var tiers = Avian.data && Avian.data.effectTiers;
    if (tiers && tiers.flatStat) return true;
    var cfg = Avian.data && Avian.data.combatConfig && Avian.data.combatConfig.effectTiers;
    return !!(cfg && cfg.flatStat);
  }

  var FLAT_CORE_STATS = { atk: 1, matk: 1, def: 1, mdef: 1, spd: 1, dex: 1, vitality: 1, hp: 1 };

  function applyDispatcherStatLoan(ps, player, statKey, sourceId, value, turns) {
    if (typeof globalThis.applySourceStatLoan === 'function') {
      return globalThis.applySourceStatLoan(ps, player, '_dispatcherStatLoans', statKey, String(sourceId || 'unknown') + ':' + statKey, value, turns || 1);
    }
    if (!player || !player.stats) return 0;
    player.stats[statKey] = Math.round(((player.stats[statKey] || 0) + (Number(value) || 0)) * 100) / 100;
    return Number(value) || 0;
  }

  function applyDispatcherStatLoanPct(ps, player, statKey, sourceId, pct, turns) {
    if (typeof globalThis.applySourceStatLoanPct === 'function') {
      return globalThis.applySourceStatLoanPct(ps, player, '_dispatcherStatLoans', statKey, String(sourceId || 'unknown') + ':' + statKey, pct, turns || 1);
    }
    return applyDispatcherStatLoan(ps, player, statKey, sourceId, pct, turns);
  }

  /** Core flat tiers use flat loans; chance stats stay percentage. */
  function applyDispatcherCoreLoan(ps, player, statKey, sourceId, value, turns) {
    var loanTurns = turns || 1;
    var n = Number(value) || 0;
    if (n < 0 || (effectTiersFlatStat() && FLAT_CORE_STATS[statKey])) {
      var amt = applyDispatcherStatLoan(ps, player, statKey, sourceId, n, loanTurns);
      if (amt > 0 && ps) {
        ps._lastCoreBuff = { stat: statKey, amount: amt, turns: loanTurns };
      }
      return amt;
    }
    return applyDispatcherStatLoanPct(ps, player, statKey, sourceId, value, loanTurns);
  }

  function debuffOpponentCore(side, statKey, value, sourceId) {
    if (effectTiersFlatStat() && FLAT_CORE_STATS[statKey]) {
      if (side === 'enemy') applyPlayerFlatDebuff(statKey, value, sourceId);
      else applyEnemyFlatDebuff(statKey, value, sourceId);
      return;
    }
    if (side === 'enemy') applyPlayerStatDebuff(statKey, value, sourceId);
    else applyEnemyStatDebuff(statKey, value, sourceId);
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
    /* Legacy Barrier → Fortify / Ward / restoration (v1.2). */
    side = side || 'player';
    var stats = side === 'enemy'
      ? (typeof G !== 'undefined' && G.enemy ? G.enemy.stats : null)
      : (typeof G !== 'undefined' && G.player ? G.player.stats : null);
    var status = side === 'enemy'
      ? (typeof G !== 'undefined' ? G.enemyStatus : null)
      : (typeof G !== 'undefined' ? G.playerStatus : null);
    var prot = Avian.protection;
    if (!stats || !prot) {
      var legacy = (typeof globalThis.applyShieldHp === 'function') ? globalThis.applyShieldHp : null;
      if (legacy) legacy(side, { pct: Number(riderValue) || 15, turns: 1 });
      return;
    }
    var amount = Math.max(0, Math.floor(Number(riderValue) || 0));
    var text = String(row && (row.displayText || row.shortDesc || row.riderText) || '');
    var isMagic = /magic|ward|aegis|mystic/i.test(text);
    var turns = 2;
    if (row && row.riders) {
      for (var ti = 0; ti < row.riders.length; ti++) {
        var tr = row.riders[ti];
        if (!tr) continue;
        if (tr.kind === 'fortify' || tr.kind === 'ward' || tr.kind === 'bastion' || tr.kind === 'gainShield') {
          if (tr.turns != null) turns = Math.max(1, Math.floor(Number(tr.turns) || 1));
          if (tr.value != null && !(amount > 0)) amount = Math.max(0, Math.floor(Number(tr.value) || 0));
          if (tr.kind === 'ward') isMagic = true;
        }
      }
    }
    if (!(amount > 0)) {
      /* Percentage-of-max-HP legacy → approximate Fortify/Ward points from Max HP%. */
      var pct = Number(riderValue) || 15;
      amount = Math.max(1, Math.floor((Number(stats.maxHp) || 20) * pct / 100));
    }
    if (isMagic) prot.applyWard(stats, status, amount, turns);
    else prot.applyFortify(stats, status, amount, turns);
    spawnTrendFloat(side, 'buff');
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
  }

  function applyProtectionRider(row, rider, ab, side) {
    side = side || 'player';
    var stats = side === 'enemy'
      ? (typeof G !== 'undefined' && G.enemy ? G.enemy.stats : null)
      : (typeof G !== 'undefined' && G.player ? G.player.stats : null);
    var status = side === 'enemy'
      ? (typeof G !== 'undefined' ? G.enemyStatus : null)
      : (typeof G !== 'undefined' ? G.playerStatus : null);
    var prot = Avian.protection;
    if (!stats || !prot || !rider) return;
    var kind = rider.kind;
    var amount = rider.value != null ? Number(rider.value) : Number(rider.amount) || 0;
    var restored = 0;
    var label = '';
    if (kind === 'restoreArmour') {
      restored = prot.restoreArmour(stats, amount) || 0;
      label = 'ARM';
    } else if (kind === 'restoreMagicArmour') {
      restored = prot.restoreMagicArmour(stats, amount) || 0;
      label = 'MARM';
    } else if (kind === 'restoreLowerPool') {
      var lr = typeof prot.restoreLowerPool === 'function'
        ? prot.restoreLowerPool(stats, amount)
        : null;
      restored = (lr && lr.restored) || 0;
      label = (lr && lr.poolKey === 'magicArmour') ? 'MARM' : 'ARM';
    } else if (kind === 'fortify') {
      restored = prot.applyFortify(stats, status, amount, rider.turns || 2) || 0;
      label = 'Fortify';
    } else if (kind === 'ward') {
      restored = prot.applyWard(stats, status, amount, rider.turns || 2) || 0;
      label = 'Ward';
    } else if (kind === 'bastion') {
      var br = prot.applyBastion(
        stats,
        status,
        rider.armour != null ? rider.armour : amount,
        rider.magicArmour != null ? rider.magicArmour : 0,
        rider.turns || 2
      );
      restored = ((br && br.armour) || 0) + ((br && br.magicArmour) || 0);
      label = 'Bastion';
    }
    if (restored > 0 && typeof spawnFloat === 'function') {
      spawnFloat(side, '+' + restored + ' ' + label, 'fn-buff');
    }
    spawnTrendFloat(side, 'buff');
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
  }

  function foeStatsForOwnerSide(ownerSide) {
    var g = globalThis.G;
    if (!g) return null;
    return ownerSide === 'enemy' ? (g.player && g.player.stats) : (g.enemy && g.enemy.stats);
  }

  function foeStatusForOwnerSide(ownerSide) {
    var g = globalThis.G;
    if (!g) return null;
    return ownerSide === 'enemy' ? g.playerStatus : g.enemyStatus;
  }

  function foeSideName(ownerSide) {
    return ownerSide === 'enemy' ? 'player' : 'enemy';
  }

  function applyPoolDamageRider(amount, isMagic, ownerSide, ctx) {
    var g = globalThis.G;
    var stats = foeStatsForOwnerSide(ownerSide);
    var status = foeStatusForOwnerSide(ownerSide);
    if (!g || !stats || !Avian.protection || typeof Avian.protection.applyDamageThroughProtection !== 'function') return;
    var n = Math.max(0, Number(amount) || 0);
    if (n <= 0) return;
    var hit = Avian.protection.applyDamageThroughProtection(stats, status, n, !!isMagic);
    var leftover = hit ? Math.max(0, Number(hit.remaining) || 0) : 0;
    var absorbed = hit ? Math.max(0, Number(hit.absorbed) || 0) : 0;
    if (ctx) {
      if (isMagic) ctx.targetNoMagicArmour = (Number(stats.magicArmour) || 0) <= 0;
      else ctx.targetNoArmour = (Number(stats.armour) || 0) <= 0;
      /* "Deal N (Magic) Armour damage" is pool-only. Leftover never becomes Health
       * damage; it only marks reachedHealth so gated riders (Might/Focus Down) fire. */
      if (leftover > 0) ctx.reachedHealth = true;
    }
    var foe = foeSideName(ownerSide);
    if (absorbed > 0 && typeof spawnFloat === 'function') {
      spawnFloat(foe, '-' + absorbed + (isMagic ? ' MARM' : ' ARM'), 'fn-dmg');
    }
    spawnTrendFloat(foe, 'debuff');
    if (typeof refreshBattleUI === 'function') refreshBattleUI();
  }

  function applyMarkRider(rider, ownerSide) {
    var status = foeStatusForOwnerSide(ownerSide);
    if (!status || !rider) return;
    var mark = String(rider.mark || '').toLowerCase();
    var turns = Math.max(1, Number(rider.turns) || 2);
    if (mark === 'jewel') {
      status.jewelMark = { turns: turns, appBonus: Number(rider.value) || 10 };
    } else if (mark === 'predator') {
      status.predatorMark = { turns: turns, precisionBonus: Number(rider.value) || 10 };
    } else if (mark === 'carrion') {
      status.carrionMark = { turns: turns };
    } else {
      status.marked = { turns: turns, consumed: false };
    }
    spawnTrendFloat(foeSideName(ownerSide), 'debuff');
  }

  function copyEnemyCoreBuff(ps, player, rider, ownerSide) {
    var foeStatus = foeStatusForOwnerSide(ownerSide);
    var best = null;
    var bags = [foeStatus && foeStatus._dispatcherStatLoans, foeStatus && foeStatus._passiveStatLoans];
    for (var bi = 0; bi < bags.length; bi++) {
      var bag = bags[bi];
      if (!bag) continue;
      for (var k in bag) {
        var entry = bag[k];
        if (!entry || !(entry.amt > 0)) continue;
        var sk = String(entry.statKey || '').toLowerCase();
        if (!FLAT_CORE_STATS[sk]) continue;
        if (!best || (entry.amt || 0) > (best.amt || 0)) best = entry;
      }
    }
    if (best) {
      applyDispatcherCoreLoan(ps, player, best.statKey, 'copyEnemyBuff', best.amt, best.turns || 1);
      return;
    }
    var fbKind = (rider && rider.fallbackKind) || 'gainMatk';
    var fbVal = (rider && rider.fallbackValue) || 4;
    var fbStat = fbKind === 'gainMatk' ? 'matk' : 'atk';
    applyDispatcherCoreLoan(ps, player, fbStat, 'copyEnemyBuffFallback', fbVal, (rider && rider.turns) || 2);
  }

  function copyLastSelfCoreBuff(ps, player, rider) {
    var last = ps && ps._lastCoreBuff;
    if (last && last.stat && last.amount > 0) {
      applyDispatcherCoreLoan(ps, player, last.stat, 'copyLastSelfBuff', last.amount, (rider && rider.turns) || last.turns || 1);
      return;
    }
    if (player && player.stats && Avian.protection && typeof Avian.protection.restoreMagicArmour === 'function') {
      Avian.protection.restoreMagicArmour(player.stats, (rider && rider.fallbackValue) || 3);
    }
  }

  function removeNamedAilmentStacks(status, ailment, n) {
    if (!status || !ailment) return 0;
    var key = String(ailment).toLowerCase();
    var bag = status[key];
    var want = Math.max(1, Math.floor(Number(n) || 1));
    if (!bag) return 0;
    if (typeof bag === 'object' && bag.stacks != null) {
      bag.stacks = Math.max(0, (Number(bag.stacks) || 0) - want);
      if (bag.stacks <= 0) delete status[key];
      status._lastCleansedAilment = key;
      return want;
    }
    delete status[key];
    status._lastCleansedAilment = key;
    return 1;
  }

  function shortenMagicalStatDebuffs(status, turnsCut) {
    if (!status) return 0;
    var cut = Math.max(1, Math.floor(Number(turnsCut) || 1));
    var bags = [status._dispatcherDebuffBySource, status._dispatcherStatLoans, status._passiveStatLoans];
    var n = 0;
    for (var bi = 0; bi < bags.length; bi++) {
      var bag = bags[bi];
      if (!bag) continue;
      var keys = Object.keys(bag);
      for (var i = 0; i < keys.length; i++) {
        var e = bag[keys[i]];
        if (!e) continue;
        var sk = String(e.statKey || keys[i].split(':')[0] || '').toLowerCase();
        var isDown = (Number(e.amt) || 0) < 0 || (Number(e.value) || 0) < 0 || e.dir === 'down';
        if ((sk !== 'matk' && sk !== 'mdef' && sk !== 'focus') || !isDown) continue;
        if (e.turns != null) {
          e.turns = Math.max(1, (Number(e.turns) || 1) - cut);
          n++;
        }
      }
    }
    return n;
  }

  function applyChosenCoreStatUp(ps, entity, amount, turns) {
    if (!entity || !entity.stats) return;
    var g = globalThis.G;
    var pick = (g && g._rallyCoreStatChoice) || null;
    if (pick !== 'atk' && pick !== 'dex' && pick !== 'matk') {
      var atk = Number(entity.stats.atk) || 0;
      var dex = Number(entity.stats.dex) || 0;
      var matk = Number(entity.stats.matk) || 0;
      pick = 'matk';
      if (atk >= dex && atk >= matk) pick = 'atk';
      else if (dex >= atk && dex >= matk) pick = 'dex';
    }
    var kind = pick === 'atk' ? 'gainAtk' : (pick === 'dex' ? 'gainDex' : 'gainMatk');
    applyDisplayOrLoanIfAvailable(ps, entity, kind, pick, amount, turns);
  }

  function applyDisplayOrLoanIfAvailable(ps, entity, kind, statKey, amount, turns) {
    if (typeof applySourceStatLoan === 'function') {
      applySourceStatLoan(ps, entity, '_dispatcherStatLoans', statKey, 'chooseCoreStatUp:' + statKey, amount, turns || 2);
      return;
    }
    if (entity && entity.stats) {
      entity.stats[statKey] = (Number(entity.stats[statKey]) || 0) + (Number(amount) || 0);
    }
  }

  function resolveGrimoireRuneRider(ps, entity, r, ctx) {
    var g = globalThis.G;
    var player = g && g.player;
    var itemId = (ctx && ctx.row && ctx.row.equipmentItemId)
      || (player && player.equipment && player.equipment.mainHand);
    var item = null;
    if (typeof Avian !== 'undefined' && Avian.equipment && typeof Avian.equipment.getItem === 'function') {
      item = Avian.equipment.getItem(itemId);
    }
    var rune = item && (item.selectedRune || item.rune || item.uniqueEffect);
    if (!rune) return;
    if (typeof rune === 'object' && rune.kind) {
      var fn = riderHandlers[rune.kind] || (statHandlersSafe && statHandlersSafe[rune.kind]);
      if (fn) fn(rune.value, ps, entity, rune, ctx);
      return;
    }
    if (typeof rune === 'string' && /ward/i.test(rune)) {
      if (Avian.protection && typeof Avian.protection.applyWard === 'function' && entity && entity.stats) {
        Avian.protection.applyWard(entity.stats, ps, 4, 2);
      }
    }
  }

  var statHandlersSafe = null;

  function restorePoolForCleansedAilment(entity, amount, ownerSide) {
    if (!entity || !entity.stats || !Avian.protection) return;
    var status = ownerSide === 'enemy'
      ? (globalThis.G && globalThis.G.enemyStatus)
      : (globalThis.G && globalThis.G.playerStatus);
    var last = status && status._lastCleansedAilment;
    var pool = (Avian.protection.protectionPoolForAilment && Avian.protection.protectionPoolForAilment(last)) || 'magicArmour';
    if (pool === 'armour' && typeof Avian.protection.restoreArmour === 'function') {
      Avian.protection.restoreArmour(entity.stats, amount);
    } else if (typeof Avian.protection.restoreMagicArmour === 'function') {
      Avian.protection.restoreMagicArmour(entity.stats, amount);
    }
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
    if (/\bGuard\s+Up\b|\bGuard\s+Down\b/i.test(text) && !/\bBrace\b/i.test(text)) return false;
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
    function applyDisplayOrStat(ps, entity, kind, statKey, value, rider) {
      applyDispatcherDisplaySlot(ps, sourceId, kind, value, rider && rider.turns);
      if (shouldLoanDisplayStat && statKey) applyDispatcherStatLoan(ps, entity, statKey, sourceId + ':' + kind, value, rider && rider.turns);
      spawnTrendFloat(floatSide, 'buff');
    }
    function applyCoreBuff(ps, p, kind, statKey, n, rider) {
      var amt = Number(n) || 0;
      if (amt < 0) {
        var downKind = {
          spd: 'reduceSpd', atk: 'reduceAtk', matk: 'reduceMatk',
          def: 'reduceDef', mdef: 'reduceMdef', acc: 'reduceAcc', dodge: 'reduceDodge',
        }[statKey] || kind;
        applyDispatcherDisplaySlot(ps, sourceId, downKind, Math.abs(amt), rider && rider.turns);
        applyDispatcherCoreLoan(ps, p, statKey, sourceId, amt, rider && rider.turns);
        spawnTrendFloat(floatSide, 'debuff');
        return;
      }
      applyDispatcherDisplaySlot(ps, sourceId, kind, amt, rider && rider.turns);
      applyDispatcherCoreLoan(ps, p, statKey, sourceId, amt, rider && rider.turns);
      spawnTrendFloat(floatSide, 'buff');
    }
    return {
      gainDodge: function (n, ps, p, r) { applyDisplayOrStat(ps, p, 'gainDodge', 'dodge', n, r); },
      gainAccFlat: function (n, ps, p, r) { applyDisplayOrStat(ps, p, 'gainAcc', 'acc', n, r); },
      gainDodgeFlat: function (n, ps, p, r) { applyDisplayOrStat(ps, p, 'gainDodge', 'dodge', n, r); },
      gainAcc: function (n, ps, p, r) { applyDisplayOrStat(ps, p, 'gainAcc', 'acc', n, r); },
      gainSpeed: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainSpeed', 'spd', n, r); },
      gainDex: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainDex', 'dex', n, r); },
      gainCritChance: function (n, ps, p, r) { applyDisplayOrStat(ps, p, 'gainCritChance', 'critChance', n, r); },
      gainCritDamage: function (n, ps, _p, r) { applyDispatcherDisplaySlot(ps, sourceId, 'gainCritDamage', n, r && r.turns); spawnTrendFloat(floatSide, 'buff'); },
      gainAtk: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainAtk', 'atk', n, r); },
      gainMatk: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainMatk', 'matk', n, r); },
      gainDef: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainDef', 'def', n, r); },
      gainMdef: function (n, ps, p, r) { applyCoreBuff(ps, p, 'gainMdef', 'mdef', n, r); },
      gainGuard: function (n, ps, p, r) {
        var amt = Number(n) || (effectTiersFlatStat() ? 4 : 8);
        applyCoreBuff(ps, p, 'gainDef', 'def', amt, r);
      },
      gainGuarded: function (n) { applyGuardedFromRow(row, n, ab, side); },
      gainBrace: function (n) { applyGuardedFromRow(row, n, ab, side); },
      gainShield: function (n) { applyShieldFromRow(row, n, ab, side); },
      restoreArmour: function (n) { applyProtectionRider(row, { kind: 'restoreArmour', value: n }, ab, side); },
      restoreMagicArmour: function (n) { applyProtectionRider(row, { kind: 'restoreMagicArmour', value: n }, ab, side); },
      restoreLowerPool: function (n) { applyProtectionRider(row, { kind: 'restoreLowerPool', value: n }, ab, side); },
      fortify: function (n, _ps, _p, rider) {
        applyProtectionRider(row, {
          kind: 'fortify',
          value: n,
          turns: (rider && rider.turns) || 2,
        }, ab, side);
      },
      ward: function (n, _ps, _p, rider) {
        applyProtectionRider(row, {
          kind: 'ward',
          value: n,
          turns: (rider && rider.turns) || 2,
        }, ab, side);
      },
      bastion: function (n, _ps, _p, rider) {
        applyProtectionRider(row, rider || { kind: 'bastion', armour: n, magicArmour: n, turns: 2, value: n }, ab, side);
      },
      gainShieldFromDamage: function (n, _ps, _p, _r, ctx) {
        var dmg = (ctx && ctx.totalDmg) || 0;
        if (dmg <= 0) return;
        var amount = Math.max(1, Math.floor(dmg * (Number(n) || 0) / 100));
        var text = String(row && (row.displayText || row.shortDesc || row.riderText) || '');
        var isMagic = /magic|ward|aegis/i.test(text);
        applyProtectionRider(row, {
          kind: isMagic ? 'ward' : 'fortify',
          value: amount,
          turns: 2,
        }, ab, side);
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
      reduceEnemyAtk: function (n) { debuffOpponentCore(side, 'atk', n, sourceId); },
      reduceEnemyMatk: function (n) { debuffOpponentCore(side, 'matk', n, sourceId); },
      reduceEnemySpd: function (n) { debuffOpponentCore(side, 'spd', n, sourceId); },
      reduceEnemyCrit: function (n) { debuffOpponentStat('critChance', n); },
      reduceEnemyDef: function (n) { debuffOpponentCore(side, 'def', n, sourceId); },
      reduceEnemyMdef: function (n) { debuffOpponentCore(side, 'mdef', n, sourceId); },
      gainMagicAilmentChance: function (n, ps) {
        ps.magicAilmentChanceBuff = Math.max(ps.magicAilmentChanceBuff || 0, Number(n) || 0);
        spawnTrendFloat(floatSide, 'buff');
      },
      gainPhysicalAilmentChance: function (n, ps) {
        ps.physicalAilmentChanceBuff = Math.max(ps.physicalAilmentChanceBuff || 0, Number(n) || 0);
        spawnTrendFloat(floatSide, 'buff');
      },
      gainAilmentAppChance: function (n, ps) {
        ps._passiveAilmentAppBonus = (Number(ps._passiveAilmentAppBonus) || 0) + (Number(n) || 0);
        spawnTrendFloat(floatSide, 'buff');
      },
      reduceEnemyAccFlat: function (n, _ps, _p, r) { debuffOpponentFlat('acc', n); },
      nextAttackAccPenalty: function (n, ps) {
        ps._dispatcherAccNextHitPenalty = Math.max(ps._dispatcherAccNextHitPenalty || 0, Number(n) || 0);
      },
      armourDamage: function (n, _ps, _p, _r, ctx) { applyPoolDamageRider(n, false, side, ctx); },
      magicArmourDamage: function (n, _ps, _p, _r, ctx) { applyPoolDamageRider(n, true, side, ctx); },
      applyAilment: function (_n, _ps, _p, r) {
        var ailment = r && r.ailment;
        var applyFn = typeof globalThis.applyAilment === 'function' ? globalThis.applyAilment : null;
        if (!ailment || !applyFn) return;
        var ch = r.chance != null ? Number(r.chance) : 100;
        if (ch < 100 && Math.random() * 100 >= ch) return;
        var target = side === 'enemy' ? 'player' : 'enemy';
        applyFn(target, ailment, Number(r.stacks) || 1);
      },
      applyMark: function (_n, _ps, _p, r) { applyMarkRider(r, side); },
      magicArmourRetaliateOnPhysical: function (n, ps) {
        ps.magicArmourRetaliateOnPhysical = { amount: Number(n) || 2, remaining: 1 };
      },
      copyEnemyBuff: function (_n, ps, p, r) { copyEnemyCoreBuff(ps, p, r, side); },
      copyLastSelfBuff: function (_n, ps, p, r) { copyLastSelfCoreBuff(ps, p, r); },
      restoreMatchingAilmentPool: function (n, _ps, p) {
        restorePoolForCleansedAilment(p, n, side);
      },
      nextSkillAspect: function (_n, ps, _p, r) {
        ps._nextSkillAspect = (r && r.aspect) || 'day';
      },
      nextDayBurnIfHealth: function (n, ps) {
        ps._nextDayBurnIfHealth = Number(n) || 1;
      },
      gainCritNextHit: function (n, ps, _p, r) {
        ps._pendingCritNextHit = { value: Number(n) || 10, gate: (r && r.gate) || 'damaging' };
      },
      ignoreMatchingDefNextHit: function (n, ps, _p, r) {
        ps._pendingMatchingDefIgnore = { amount: Number(n) || 2, gate: (r && r.gate) || 'debuffedOrMarked' };
      },
      cannotRedirectNextSkill: function (_n, ps, _p, r) {
        ps._pendingCannotRedirect = { gate: (r && r.gate) || 'weapon' };
      },
      gainAccThisHit: function (n, ps) {
        ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, Number(n) || 0);
      },
      ignoreGuardThisHit: function (n, ps) {
        ps._nextMatchingDefIgnore = { amount: Number(n) || 4, gate: 'attack' };
      },
      skillPowerThisHit: function (n, ps) {
        ps._thisAttackSkillPowerBonus = (Number(ps._thisAttackSkillPowerBonus) || 0) + (Number(n) || 0);
      },
      piercePercentThisHit: function (n, _ps, _p, r, ctx) {
        var row = ctx && ctx.row;
        if (!row) return;
        var pct = (Number(n) || 0) / 100;
        row.piercePercent = Math.max(Number(row.piercePercent) || 0, pct);
        row.pierceDef = Math.max(Number(row.pierceDef) || 0, Number(n) || 0);
        row.pierceMdef = Math.max(Number(row.pierceMdef) || 0, Number(n) || 0);
      },
      armNextSkill: function (n, ps, _p, r) {
        ps._armedNextSkill = {
          skillPower: Number(n) || Number(r && r.value) || 10,
          precision: Number(r && r.precision) || 0,
          ignoreGuard: Number(r && r.ignoreGuard) || 0,
          gate: (r && r.gate) || 'attack',
          turns: Number(r && r.turns) || 1,
        };
      },
      removeAilmentStack: function (n, ps, _p, r) {
        removeNamedAilmentStacks(ps, (r && r.ailment) || 'dazed', Number(n) || 1);
      },
      shortenMagicalDebuff: function (n, ps) {
        shortenMagicalStatDebuffs(ps, Number(n) || 1);
      },
      resistMagicalAilmentApp: function (n, ps, _p, r) {
        ps.hostileMagicAilmentResist = {
          value: Number(n) || 10,
          turns: Number(r && r.turns) || 2,
        };
      },
      nextMagicalDebuffShorter: function (n, ps) {
        ps._nextMagicalDebuffDurationMinus = Math.max(ps._nextMagicalDebuffDurationMinus || 0, Number(n) || 1);
      },
      resistOrbAilmentApp: function (n, ps) {
        ps._orbAilmentAppResist = Number(n) || 10;
      },
      chooseCoreStatUp: function (n, ps, p, r) {
        applyChosenCoreStatUp(ps, p, Number(n) || 4, (r && r.turns) || 2);
      },
      resolveSourceRider: function (_n, ps, p, r, ctx) {
        resolveGrimoireRuneRider(ps, p, r, ctx);
      },
      delayedDamageSplit: function () { /* applied in execute before hits */ },
      lifestealIfDebuff: function (n, _ps, _p, _r, ctx) {
        var row = ctx && ctx.row;
        if (row && !(row.lifestealPct > 0)) {
          row.lifestealPct = Number(n) || 10;
          row.lifestealWhen = 'targetHasAilment';
        }
      },
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
      } else if (r && r.gate) {
        ps._pendingAccNextHit = { value: Number(n) || 0, gate: r.gate };
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
    gainAccThisHit: function (n, ps) {
      ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, Number(n) || 0);
    },
    ignoreGuardThisHit: function (n, ps) {
      ps._nextMatchingDefIgnore = { amount: Number(n) || 4, gate: 'attack' };
    },
    skillPowerThisHit: function (n, ps) {
      ps._thisAttackSkillPowerBonus = (Number(ps._thisAttackSkillPowerBonus) || 0) + (Number(n) || 0);
    },
    piercePercentThisHit: function () { /* applied in execute / enrichment */ },
    armNextSkill: function (n, ps, _p, r) {
      ps._armedNextSkill = {
        skillPower: Number(n) || Number(r && r.value) || 10,
        precision: Number(r && r.precision) || 0,
        ignoreGuard: Number(r && r.ignoreGuard) || 0,
        gate: (r && r.gate) || 'attack',
        turns: Number(r && r.turns) || 1,
      };
    },
    removeAilmentStack: function (n, ps, _p, r) {
      removeNamedAilmentStacks(ps, (r && r.ailment) || 'dazed', Number(n) || 1);
    },
    shortenMagicalDebuff: function (n, ps) {
      shortenMagicalStatDebuffs(ps, Number(n) || 1);
    },
    resistMagicalAilmentApp: function (n, ps, _p, r) {
      ps.hostileMagicAilmentResist = {
        value: Number(n) || 10,
        turns: Number(r && r.turns) || 2,
      };
    },
    nextMagicalDebuffShorter: function (n, ps) {
      ps._nextMagicalDebuffDurationMinus = Math.max(ps._nextMagicalDebuffDurationMinus || 0, Number(n) || 1);
    },
    resistOrbAilmentApp: function (n, ps) {
      ps._orbAilmentAppResist = Number(n) || 10;
    },
    chooseCoreStatUp: function (n, ps, p, r) {
      applyChosenCoreStatUp(ps, p, Number(n) || 4, (r && r.turns) || 2);
    },
    resolveSourceRider: function (_n, ps, p, r, ctx) {
      resolveGrimoireRuneRider(ps, p, r, ctx);
    },
    delayedDamageSplit: function () { /* applied in execute before hits */ },
    lifestealIfDebuff: function (n, _ps, _p, _r, ctx) {
      var row = ctx && ctx.row;
      if (row && !(row.lifestealPct > 0)) {
        row.lifestealPct = Number(n) || 10;
        row.lifestealWhen = 'targetHasAilment';
      }
    },
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
      (es.paralyzed > 0) || !!es.confused || (es.accDebuff > 0) ||
      !!es.weakened || !!es.feared || !!es.jewelMark || !!es.predatorMark || !!es.carrionMark || !!es.marked;
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
    if (w === 'ifTargetNoMagicArmour' || w === 'targetNoMagicArmour') {
      if (ctx && ctx.targetNoMagicArmour) return true;
      var gM = globalThis.G;
      var magStats = resolveRiderOwnerSide(ctx) === 'enemy' ? (gM && gM.player && gM.player.stats) : (gM && gM.enemy && gM.enemy.stats);
      return !!(magStats && (Number(magStats.magicArmour) || 0) <= 0);
    }
    if (w === 'ifTargetNoArmour' || w === 'targetNoArmour') {
      if (ctx && ctx.targetNoArmour) return true;
      var gA = globalThis.G;
      var armStats = resolveRiderOwnerSide(ctx) === 'enemy' ? (gA && gA.player && gA.player.stats) : (gA && gA.enemy && gA.enemy.stats);
      return !!(armStats && (Number(armStats.armour) || 0) <= 0);
    }
    if (w === 'reachedHealth') return !!(ctx && ctx.reachedHealth);
    if (w === 'ifCleansed') return !!(ctx && (ctx.cleansedCount > 0 || ctx.cleansed));
    if (w === 'userFaster') {
      var gSpd = globalThis.G;
      var selfEnt = resolveRiderOwnerSide(ctx) === 'enemy' ? (gSpd && gSpd.enemy) : (gSpd && gSpd.player);
      var foeEnt = resolveRiderOwnerSide(ctx) === 'enemy' ? (gSpd && gSpd.player) : (gSpd && gSpd.enemy);
      return !!(selfEnt && foeEnt && (Number(selfEnt.stats && selfEnt.stats.spd) || 0) > (Number(foeEnt.stats && foeEnt.stats.spd) || 0));
    }
    if (w === 'dodgedLast') {
      var gDodge = globalThis.G;
      var dodgePs = resolveRiderOwnerSide(ctx) === 'enemy'
        ? (gDodge && gDodge.enemyStatus)
        : (gDodge && gDodge.playerStatus);
      return !!(dodgePs && dodgePs._dodgedLastEnemyAttack);
    }
    if (w === 'targetLowHp') {
      var gHp = globalThis.G;
      var tgt = resolveRiderOwnerSide(ctx) === 'enemy' ? (gHp && gHp.player) : (gHp && gHp.enemy);
      var hp = tgt && tgt.stats ? Number(tgt.stats.hp) || 0 : 0;
      var maxHp = tgt && tgt.stats ? Number(tgt.stats.maxHp) || 0 : 0;
      var thr = (ctx && ctx.lowHpThreshold != null) ? Number(ctx.lowHpThreshold) : 0.3;
      return maxHp > 0 && (hp / maxHp) < thr;
    }
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
    ctx.row = ctx.row || row;
    ctx.applied = ctx.applied || Object.create(null);
    var appliedCount = 0;
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (r.kind === 'refundApOnCrit' || r.kind === 'gainApNextTurn' || r.kind === 'bonusVsAilment'
        || r.kind === 'bonusVsLowHp' || r.kind === 'tagFlag' || r.kind === 'raw'
        || r.kind === 'gainAccThisHit' || r.kind === 'skillPowerThisHit'
        || r.kind === 'ignoreGuardThisHit' || r.kind === 'piercePercentThisHit'
        || r.kind === 'delayedDamageSplit') continue;
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

  function nextHitGateMatches(gate, row, ab) {
    if (!gate || gate === 'damaging' || gate === 'attack') return !!(row && !row.noDamage);
    var id = String((row && row.id) || (ab && (ab.id || ab.equipmentSkillId)) || '');
    var src = String((ab && (ab.actionSource || ab.source || ab.family)) || (row && row.source) || '');
    if (gate === 'weapon') {
      return /^WSK-/i.test(id) || /weapon/i.test(src);
    }
    if (gate === 'strength' || gate === 'strengthWeapon') {
      var scale = String((row && (row.scalingStat || row.scaleStat || row.damageStat)) || (ab && ab.scalingStat) || '').toUpperCase();
      var cat = String((row && (row.damageCategory || row.category)) || (ab && ab.damageCategory) || '');
      return scale === 'ATK' || scale === 'MIGHT' || /strength/i.test(cat);
    }
    if (gate === 'magic') {
      var scaleM = String((row && (row.scalingStat || row.scaleStat || row.damageStat)) || (ab && ab.scalingStat) || '').toUpperCase();
      var catM = String((row && (row.damageCategory || row.category || row.damageType)) || (ab && (ab.damageCategory || ab.damageType)) || '');
      return scaleM === 'MATK' || scaleM === 'FOCUS' || /magic|spell/i.test(catM);
    }
    if (gate === 'finesse') {
      var scaleF = String((row && (row.scalingStat || row.scaleStat || row.damageStat)) || (ab && ab.scalingStat) || '').toUpperCase();
      var catF = String((row && (row.damageCategory || row.category)) || (ab && ab.damageCategory) || '');
      return scaleF === 'DEX' || scaleF === 'DEXTERITY' || /finesse/i.test(catF);
    }
    if (gate === 'night') {
      var asp = String((row && row.aspect) || (ab && (ab.aspect || ab.affinity)) || '').toLowerCase();
      return asp === 'lunae' || asp === 'night';
    }
    if (gate === 'debuffedOrMarked') {
      var gMark = globalThis.G;
      var es = gMark && gMark.enemyStatus;
      if (!es) return false;
      if (es.jewelMark || es.predatorMark || es.carrionMark || es.marked) return true;
      return enemyHasAnyAilment();
    }
    return true;
  }

  function armGatedNextHit(ps, row, ab) {
    if (!ps || !row) return;
    if (ps._pendingAccNextHit && nextHitGateMatches(ps._pendingAccNextHit.gate, row, ab)) {
      ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, Number(ps._pendingAccNextHit.value) || 0);
      delete ps._pendingAccNextHit;
    }
    if (ps._pendingCritNextHit && nextHitGateMatches(ps._pendingCritNextHit.gate, row, ab)) {
      ps._dispatcherCritNextHit = Math.max(ps._dispatcherCritNextHit || 0, Number(ps._pendingCritNextHit.value) || 0);
      delete ps._pendingCritNextHit;
    }
    if (ps._pendingMatchingDefIgnore && nextHitGateMatches(ps._pendingMatchingDefIgnore.gate, row, ab)) {
      ps._nextMatchingDefIgnore = ps._pendingMatchingDefIgnore;
      delete ps._pendingMatchingDefIgnore;
    }
    if (ps._pendingCannotRedirect && nextHitGateMatches(ps._pendingCannotRedirect.gate, row, ab)) {
      ps._cannotRedirectNextSkill = 1;
      delete ps._pendingCannotRedirect;
    }
    if (ps._armedNextSkill && nextHitGateMatches(ps._armedNextSkill.gate, row, ab)) {
      var armed = ps._armedNextSkill;
      if ((Number(armed.skillPower) || 0) > 0) {
        ps._thisAttackSkillPowerBonus = (Number(ps._thisAttackSkillPowerBonus) || 0) + Number(armed.skillPower);
      }
      if ((Number(armed.precision) || 0) > 0) {
        ps._dispatcherAccNextHit = Math.max(ps._dispatcherAccNextHit || 0, Number(armed.precision));
      }
      if ((Number(armed.ignoreGuard) || 0) > 0) {
        ps._nextMatchingDefIgnore = { amount: Number(armed.ignoreGuard), gate: 'attack' };
      }
      delete ps._armedNextSkill;
    }
    if (ps._nextSkillAspect && !row.noDamage) {
      var forced = String(ps._nextSkillAspect);
      if (forced === 'day') forced = 'solis';
      else if (forced === 'night') forced = 'lunae';
      row.aspect = forced;
      delete ps._nextSkillAspect;
    }
  }

  function consumeArmedNextHit(ps) {
    if (!ps) return;
    delete ps._dispatcherAccNextHit;
    delete ps._dispatcherAccNextHitPenalty;
    delete ps._dispatcherCritNextHit;
    delete ps._nextMatchingDefIgnore;
    delete ps._cannotRedirectNextSkill;
    delete ps._thisAttackSkillPowerBonus;
    if (ps._dodgedLastEnemyAttackConsumed) {
      delete ps._dodgedLastEnemyAttack;
      delete ps._dodgedLastEnemyAttackConsumed;
    }
  }

  function applyThisAttackRiders(row, ps, ab) {
    if (!row || !row.riders || !ps) return;
    var ctx = { ownerSide: 'player', row: row };
    for (var i = 0; i < row.riders.length; i++) {
      var r = row.riders[i];
      if (!r) continue;
      if (r.kind !== 'gainAccThisHit' && r.kind !== 'skillPowerThisHit'
        && r.kind !== 'ignoreGuardThisHit' && r.kind !== 'piercePercentThisHit') continue;
      if (r.when === 'targetLowHp') ctx.lowHpThreshold = r.threshold != null ? r.threshold : 0.3;
      if (!riderWhenMatches(r, ctx)) continue;
      if (r.when === 'dodgedLast') ps._dodgedLastEnemyAttackConsumed = true;
      var handlers = makeStatRiderHandlers((row && row.id) || 'thisAttack', row, ab, { side: 'player' });
      var fn = handlers[r.kind] || riderHandlers[r.kind];
      if (fn) fn(r.value, ps, (globalThis.G && globalThis.G.player) || null, r, ctx);
    }
  }

  // ---- core execute -----------------------------------------------------
  dispatcher.execute = async function execute(ab) {
    if (!ab || !ab.id) return;
    var row = (ab && ab._dispatcherRow) || rowFor(ab.id);
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
    var healthHits = 0;
    var totalDmg = 0;

    if (row.noDamage || row.target === 'self') {
      if (g) {
        g._lastAbilityHitsLanded = 1;
        g._lastAbilityAnyCrit = false;
        g._lastAbilityAilmentFailed = false;
        g._lastAbilityTotalDmg = 0;
      }
      var utilCtx = {
        hitsLanded: 1,
        hitsAttempted: 1,
        totalDmg: 0,
        ailmentsApplied: {},
        utilitySucceeded: false,
        ownerSide: 'player',
      };
      var hasApplyAilmentRider = false;
      var poolRiders = [];
      var restRiders = [];
      var origRiders = row.riders || [];
      for (var uri = 0; uri < origRiders.length; uri++) {
        var ur = origRiders[uri];
        if (!ur) continue;
        if (ur.kind === 'applyAilment') hasApplyAilmentRider = true;
        if (ur.kind === 'armourDamage' || ur.kind === 'magicArmourDamage') poolRiders.push(ur);
        else restRiders.push(ur);
      }
      if (poolRiders.length) {
        runRiders(Object.assign({}, row, { riders: poolRiders }), utilCtx, ab);
      }
      var utilOk = typeof globalThis.applyTagRidersFromRow === 'function'
        ? globalThis.applyTagRidersFromRow(row, utilCtx)
        : false;
      if (utilCtx.cleansedCount == null && utilOk) utilCtx.cleansedCount = 1;
      runRiders(Object.assign({}, row, { riders: restRiders }), utilCtx, ab);
      if (shouldAutoApplyGuarded(row) && !rowGrantsGuardedViaRider(row)) {
        applyGuardedFromRow(row, 0, ab);
      }
      var utilAilments = {};
      if (!hasApplyAilmentRider) {
        utilAilments = tryRollRowAilment(row, 'enemy', Object.assign({
          hitsLanded: 1, totalDmg: 0, ab: ab, requireHit: false,
        }, utilCtx));
      }
      if (g) g._lastAbilityAilmentFailed = (row.ailmentChance > 0 && ailmentIdsFromRow(row).length > 0)
        && !Object.keys(utilAilments).length;
      if (g) g._lastAbilityUtilitySucceeded = !!utilOk || (utilCtx.cleansedCount > 0);
      if (typeof Avian !== 'undefined' && Avian.equipmentEffects && typeof Avian.equipmentEffects.onUtilityUsed === 'function') {
        Avian.equipmentEffects.onUtilityUsed(!!utilOk);
      }
      if (typeof logMsg === 'function') logMsg('🛡 ' + (row.name || ab.id) + (row.riderText ? ' — ' + row.riderText : ''), 'player-action');
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      return;
    }

    var hits = Math.max(1, row.hits || row.hitCount || 1);
    var isMagic = isMagicCategory(row.category);
    var isHybrid = isHybridRow(row);

    if (g && g.playerStatus) {
      armGatedNextHit(g.playerStatus, row, ab);
      applyThisAttackRiders(row, g.playerStatus, ab);
    }

    if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);

    if (rowHasGuardBreak(row)) applyGuardBreakToEnemy();

    var enemyDodge = (typeof getEffectiveEnemyDodgeForPlayerHit === 'function')
      ? getEffectiveEnemyDodgeForPlayerHit()
      : ((g && g.enemy && g.enemy.stats) ? (g.enemy.stats.dodge || 0) : 0);
    var hitPct = (typeof getPlayerHitPercentForAttack === 'function')
      ? getPlayerHitPercentForAttack(ab)
      : (function () {
        var playerAcc;
        var prec = row && (row.hitChanceOverride != null ? row.hitChanceOverride : row.precision);
        if (prec != null && Number.isFinite(Number(prec))) {
          var pn = Number(prec);
          playerAcc = pn <= 1.5 ? pn * 100 : pn;
        } else {
          playerAcc = (typeof getPlayerEffectiveAcc === 'function') ? getPlayerEffectiveAcc() : 80;
        }
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
        var fullMaster = masterTotal.damage;
        if (row.delayedDamageSplit) {
          var immPct = Number(row.delayedDamageSplit.immediatePct) || 75;
          var delPct = Number(row.delayedDamageSplit.delayedPct) || 25;
          var immDmg = Math.round(fullMaster * (immPct / 100));
          row._pendingDelayedStore = Math.max(0, Math.round(fullMaster * (delPct / 100)));
          masterSplit = (hits > 1 && typeof globalThis.calculateMultiHitDamage === 'function')
            ? globalThis.calculateMultiHitDamage(immDmg, hits)
            : [immDmg];
        } else {
          masterSplit = (hits > 1 && typeof globalThis.calculateMultiHitDamage === 'function')
            ? globalThis.calculateMultiHitDamage(fullMaster, hits)
            : [fullMaster];
        }
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
      if (res && !res.wasDodged) {
        hitsLanded++;
        if (g && g._lastProtectionHit && g._lastProtectionHit.damagedHealth) healthHits++;
        else if (res.damagedHealth) healthHits++;
        else if ((res.dmgDealt || 0) > 0 && !(g && g._lastProtectionHit)) healthHits++;
      }
      totalDmg += (res && res.dmgDealt) || 0;
      if (g && g.enemy && g.enemy.stats && g.enemy.stats.hp <= 0) break;
    }

    // Ailment roll (post-damage); skip if all hits missed
    var ailmentsApplied = {};
    var ailmentAttempted = hitsLanded > 0 && row.ailmentChance > 0 && ailmentIdsFromRow(row).length > 0;
    if (ailmentAttempted) {
      ailmentsApplied = tryRollRowAilment(row, 'enemy', {
        hitsLanded: hitsLanded,
        hitsAttempted: hits,
        healthHits: healthHits,
        totalDmg: totalDmg,
        ab: ab,
      });
    }

    var ailmentFailed = ailmentAttempted && !Object.keys(ailmentsApplied).length;
    var riderCtx = {
      hitsLanded: hitsLanded,
      hitsAttempted: hits,
      totalDmg: totalDmg,
      ailmentsApplied: ailmentsApplied,
      ailmentFailed: ailmentFailed,
      reachedHealth: healthHits > 0,
      row: row,
    };
    if (row._pendingDelayedStore > 0 && hitsLanded > 0 && typeof applyDelayedDamage === 'function') {
      applyDelayedDamage('enemy', row._pendingDelayedStore, { enCost: row.enCost || row.apCost || 1 });
      delete row._pendingDelayedStore;
    }
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
      if (hitsLanded > 0 && g.playerStatus) {
        consumeArmedNextHit(g.playerStatus);
      }
      g._lastAbilityTotalDmg = totalDmg;
    }

    if (typeof Avian !== 'undefined' && Avian.equipmentEffects) {
      if (isMagic && typeof Avian.equipmentEffects.onSongOrCall === 'function') {
        Avian.equipmentEffects.onSongOrCall(hitsLanded > 0);
      }
      if (typeof Avian.equipmentEffects.onAfterPlayerAttack === 'function') {
        var atkWeight2 = typeof getAbilityAttackWeight === 'function' ? getAbilityAttackWeight(ab, g && g.player) : null;
        Avian.equipmentEffects.onAfterPlayerAttack({
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
    var skills = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
    if (!skills) return 0;
    var table = target || globalThis.ACTIONS;
    if (!table) return 0;
    var count = 0;
    for (var id in skills) {
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
    return base + (ps.dispatcherCrit || 0) + (ps._dispatcherCritNextHit || 0);
  };
  dispatcher.modifyAcc = function modifyAcc(base) {
    var g = globalThis.G;
    var ps = (g && g.playerStatus) || null;
    if (!ps) return base;
    var acc = base + (ps.dispatcherAcc || 0);
    if (ps._dispatcherAccNextHit > 0) acc += ps._dispatcherAccNextHit;
    if (ps._dispatcherAccNextHitPenalty > 0) acc -= ps._dispatcherAccNextHitPenalty;
    if (typeof globalThis.getConfusedPrecisionPenalty === 'function') {
      acc += globalThis.getConfusedPrecisionPenalty(ps);
    }
    var es = g && g.enemyStatus;
    if (es && es.predatorMark && (es.predatorMark.turns || 0) > 0) {
      acc += Number(es.predatorMark.precisionBonus) || 10;
    }
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
