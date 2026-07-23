/* Avian Ascent — Equipment v0.3 balance sims + combat telemetry (Phase 11).
 *
 * Headless 1v1 duels using real combat formulas (dealDamage, master workbook
 * damage path, planEnemyTurn) where available. VM-friendly: no DOM required.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  Avian.debug = Avian.debug || Object.create(null);

  var SOURCE_KEYS = ['basic', 'utility', 'weaponA', 'weaponB', 'armour', 'ultimate'];

  function mulberry32(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function withSeededRandom(seed, fn) {
    var prev = Math.random;
    Math.random = mulberry32(Number(seed) >>> 0 || 1);
    try {
      return fn();
    } finally {
      Math.random = prev;
    }
  }

  function emptyActionCounts() {
    var out = Object.create(null);
    for (var i = 0; i < SOURCE_KEYS.length; i++) out[SOURCE_KEYS[i]] = 0;
    return out;
  }

  function cloneActionCounts(src) {
    var out = emptyActionCounts();
    if (!src) return out;
    for (var i = 0; i < SOURCE_KEYS.length; i++) {
      var k = SOURCE_KEYS[i];
      out[k] = Number(src[k]) || 0;
    }
    return out;
  }

  /* ---- Combat telemetry ------------------------------------------------ */
  var telemetry = {
    hits: 0,
    misses: 0,
    damageDealt: 0,
    damageTaken: 0,
    meterAwarded: 0,
    actions: { player: 0, enemy: 0 },
    bySource: emptyActionCounts(),
    startedAt: null,
    reset: function reset() {
      this.hits = 0;
      this.misses = 0;
      this.damageDealt = 0;
      this.damageTaken = 0;
      this.meterAwarded = 0;
      this.actions = { player: 0, enemy: 0 };
      this.bySource = emptyActionCounts();
      this.startedAt = Date.now();
    },
    recordHit: function recordHit(side, amount) {
      var dmg = Math.max(0, Number(amount) || 0);
      this.hits++;
      if (side === 'player') this.damageDealt += dmg;
      else this.damageTaken += dmg;
    },
    recordMiss: function recordMiss() {
      this.misses++;
    },
    recordMeter: function recordMeter(amount) {
      this.meterAwarded += Math.max(0, Number(amount) || 0);
    },
    recordAction: function recordAction(side, sourceKey) {
      if (side === 'player') this.actions.player++;
      else this.actions.enemy++;
      var key = sourceKey || 'basic';
      if (this.bySource[key] == null) this.bySource[key] = 0;
      this.bySource[key]++;
    },
    snapshot: function snapshot() {
      return {
        hits: this.hits,
        misses: this.misses,
        meter: this.meterAwarded,
        meterAwarded: this.meterAwarded,
        damageDealt: this.damageDealt,
        damageTaken: this.damageTaken,
        actions: { player: this.actions.player, enemy: this.actions.enemy },
        bySource: cloneActionCounts(this.bySource),
        startedAt: this.startedAt,
        exportedAt: Date.now(),
      };
    },
    exportJson: function exportJson(pretty) {
      return JSON.stringify(this.snapshot(), null, pretty ? 2 : 0);
    },
  };

  Avian.systems.combatTelemetry = telemetry;

  var telemetryHooksAttached = false;

  function attachCombatTelemetryHooks() {
    if (telemetryHooksAttached) return;
    telemetryHooksAttached = true;

    var innerDeal = globalThis.dealDamage;
    if (typeof innerDeal === 'function') {
      globalThis.dealDamage = function dealDamageWithTelemetry(target, amount, isCrit, isMagic, srcAbility, opts) {
        var res = innerDeal.apply(this, arguments);
        try {
          if (res && res.wasDodged) telemetry.recordMiss();
          else if (res && (res.dmgDealt || 0) > 0) {
            telemetry.recordHit(target === 'enemy' ? 'player' : 'enemy', res.dmgDealt);
          }
        } catch (_e) { /* noop */ }
        return res;
      };
    }

    if (typeof globalThis.awardUltimateMeter === 'function') {
      var innerAward = globalThis.awardUltimateMeter;
      globalThis.awardUltimateMeter = function awardUltimateMeterWithTelemetry(side, amount) {
        var out = innerAward.apply(this, arguments);
        try {
          if (side === 'player') telemetry.recordMeter(amount);
        } catch (_e) { /* noop */ }
        return out;
      };
    }

    if (typeof globalThis.spendEnergy === 'function') {
      var innerSpend = globalThis.spendEnergy;
      globalThis.spendEnergy = function spendEnergyWithTelemetry(player, ability) {
        var cost = innerSpend.apply(this, arguments);
        try {
          var g = globalThis.G;
          if (g && player === g.player && ability) {
            telemetry.recordAction('player', ability.actionSource || ability.id);
          }
        } catch (_e) { /* noop */ }
        return cost;
      };
    }
  }

  attachCombatTelemetryHooks();

  /* ---- Sim helpers ----------------------------------------------------- */
  function ensureEquipmentV2() {
    Avian.flags = Avian.flags || Object.create(null);
    Avian.flags.equipmentV2 = true;
    if (typeof globalThis.ABILITY_TEMPLATES_EXTRA === 'undefined') {
      /* Game combat reads this global; sims ensure a safe empty map. */
      Avian.data = Avian.data || Object.create(null);
      if (!Avian.data.abilityTemplatesExtra) {
        Avian.data.abilityTemplatesExtra = Object.create(null);
      }
      Object.defineProperty(globalThis, 'ABILITY_TEMPLATES_EXTRA', {
        value: Avian.data.abilityTemplatesExtra,
        writable: true,
        configurable: true,
      });
    }
  }

  function normalizeRarity(raw) {
    var r = String(raw || 'grey').toLowerCase();
    if (r === 'white') return 'grey';
    if (r === 'grand' || r === 'epic') return 'gold';
    if (r === 'legendary') return 'orange';
    return r;
  }

  function assignReferenceLoadout(entity, classId, rarity) {
    if (!entity || !Avian.equipment) return entity;
    if (typeof Avian.equipment.ensurePlayerEquipmentState === 'function') {
      Avian.equipment.ensurePlayerEquipmentState(entity);
    }
    entity.equipment = Avian.equipment.createEmptyLoadout();
    var ref = Avian.equipment.findReferenceLoadout(classId, normalizeRarity(rarity));
    if (!ref || !ref.equipment) return entity;
    for (var sk in ref.equipment) {
      if (!Object.prototype.hasOwnProperty.call(ref.equipment, sk)) continue;
      entity.equipment[sk] = ref.equipment[sk] || null;
    }
    return entity;
  }

  function statsFromClassReference(classId) {
    var cls = Avian.getClassV2 && Avian.getClassV2(classId);
    var ref = cls && cls.reference ? cls.reference : null;
    if (!ref) {
      return {
        hp: 50, maxHp: 50, atk: 10, def: 10, matk: 8, mdef: 8,
        spd: 10, dodge: 5, acc: 85, critChance: 5,
      };
    }
    return {
      hp: ref.hp, maxHp: ref.hp, atk: ref.atk, def: ref.def,
      matk: ref.matk, mdef: ref.mdef, spd: ref.spd, dodge: ref.dodge,
      acc: ref.acc, critChance: ref.critChance,
    };
  }

  function finalizeCombatant(entity) {
    if (typeof normalizeCombatStats === 'function') normalizeCombatStats(entity.stats);
    entity.stats.hp = entity.stats.maxHp;
    if (typeof Avian.equipment.applyEquipmentStatsToEntity === 'function') {
      Avian.equipment.applyEquipmentStatsToEntity(entity);
    }
    if (typeof Avian.equipmentActions.syncEntityAbilities === 'function') {
      Avian.equipmentActions.syncEntityAbilities(entity);
    }
    if (typeof enforceAbilityCosts === 'function') enforceAbilityCosts(entity);

    var prevPlayer = globalThis.G && G.player;
    if (globalThis.G) G.player = entity;
    entity.energyMax = typeof computePlayerEffectiveMaxEnergy === 'function'
      ? computePlayerEffectiveMaxEnergy(entity)
      : (typeof computePlayerMaxEnergy === 'function' ? computePlayerMaxEnergy() : 6);
    entity.energy = typeof computePlayerStartEnergy === 'function'
      ? computePlayerStartEnergy(entity)
      : Math.min(entity.energyMax, 4);
    entity.energyRegen = typeof computePlayerEnergyRegen === 'function'
      ? computePlayerEnergyRegen(entity)
      : 2;
    if (globalThis.G) G.player = prevPlayer;
    return entity;
  }

  function buildBirdCombatant(birdKey, opts) {
    opts = opts || {};
    var birdDef = typeof Avian.getBirdDef === 'function' ? Avian.getBirdDef(birdKey) : null;
    if (!birdDef) throw new Error('Unknown bird: ' + birdKey);
    var classId = birdDef.class || 'rogue';
    var stats = typeof Avian.buildCombatStatsFromBirdDef === 'function'
      ? Avian.buildCombatStatsFromBirdDef(birdDef, classId)
      : Object.assign({}, birdDef.stats);
    var entity = {
      name: birdDef.name,
      birdKey: birdKey,
      class: classId,
      size: birdDef.realSize || 'medium',
      stats: Object.assign({}, stats),
      equipmentInventory: [],
      autoPickUltimate: true,
      isEnemy: !!opts.isEnemy,
      ultimateMeter: 0,
    };
    assignReferenceLoadout(entity, classId, opts.rarity || 'grey');
    if (typeof Avian.applyBirdV2IdentityToEntry === 'function') {
      Avian.applyBirdV2IdentityToEntry(birdKey, entity);
    }
    return finalizeCombatant(entity);
  }

  function buildClassCombatant(enemyClass, opts) {
    opts = opts || {};
    var classId = String(enemyClass || 'rogue').toLowerCase();
    var stats = statsFromClassReference(classId);
    var entity = {
      id: 'sim-' + classId,
      name: 'Sim ' + classId,
      birdKey: 'sparrow',
      class: classId,
      enemyClass: classId,
      stats: Object.assign({}, stats),
      isEnemy: true,
      autoPickUltimate: true,
      ultimateMeter: 0,
    };
    if (Avian.equipment && typeof Avian.equipment.assignEnemyEquipmentLoadout === 'function') {
      Avian.equipment.assignEnemyEquipmentLoadout(entity, {
        rarity: normalizeRarity(opts.rarity || 'grey'),
        variance: false,
        seed: opts.seed != null ? Number(opts.seed) : 1,
      });
    } else {
      assignReferenceLoadout(entity, classId, opts.rarity || 'grey');
    }
    return finalizeCombatant(entity);
  }

  function resolveCombatRow(ab) {
    if (!ab) return null;
    if (ab._dispatcherRow) return ab._dispatcherRow;
    if (typeof resolveAbilityCombatRow === 'function') return resolveAbilityCombatRow(ab);
    if (typeof globalThis.enrichCombatRow === 'function' && Avian.data && Avian.data.combatPack) {
      var id = ab.id;
      if (typeof resolveAbilityAliasSourceId === 'function') id = resolveAbilityAliasSourceId(id);
      var row = null;
      if (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function') {
        row = Avian.equipmentActions.skillToAbilityRow(id, null, 'grey');
      } else {
        var skills = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
        row = skills && skills[id] ? skills[id] : null;
      }
      if (row) enrichCombatRow(row);
      return row;
    }
    return null;
  }

  function abilityBtnType(ab, row) {
    if (typeof getEffectiveAbilityBtnType === 'function') {
      return getEffectiveAbilityBtnType(ab, row);
    }
    if (typeof resolveCombatRowBtnType === 'function' && row) {
      return resolveCombatRowBtnType(row);
    }
    return 'physical';
  }

  function playerHitPercent(ab, row) {
    row = row || resolveCombatRow(ab);
    try {
      if (typeof calculateAbilityHitChancePct === 'function') {
        var playerAcc = typeof getPlayerEffectiveAcc === 'function' ? getPlayerEffectiveAcc() : 85;
        var enemyDodge = typeof getEffectiveEnemyDodgeForPlayerHit === 'function'
          ? getEffectiveEnemyDodgeForPlayerHit()
          : ((globalThis.G && G.enemy && G.enemy.stats) ? (G.enemy.stats.dodge || 0) : 0);
        var accPenalty = (row && typeof globalThis.calculateAbilityAccuracyPenalty === 'function')
          ? globalThis.calculateAbilityAccuracyPenalty(row) : 0;
        return calculateAbilityHitChancePct(playerAcc, enemyDodge, accPenalty);
      }
    } catch (_e) { /* fallback below */ }
    return 85;
  }

  function simExecutePlayerAbility(ab, counters) {
    var g = globalThis.G;
    if (!g || !g.player || !g.enemy || !ab || ab.empty) return 0;

    if (typeof canUseAbility === 'function' && !canUseAbility(g.player, ab)) return 0;
    if (ab.isUltimate) {
      var meter = typeof getUltimateMeter === 'function' ? getUltimateMeter('player') : (g.playerUltimateMeter || 0);
      var cap = 100;
      if (meter < cap) return 0;
    }

    var srcKey = ab.actionSource || 'basic';
    if (srcKey === 'utility' && g.utilityUsedThisTurn && g.utilityUsedThisTurn[ab.id]) return 0;

    if (typeof spendEnergy === 'function') spendEnergy(g.player, ab);
    else g.player.energy = Math.max(0, (g.player.energy || 0) - (ab.energyCost || ab.enCost || 1));

    counters.actionsUsed[srcKey] = (counters.actionsUsed[srcKey] || 0) + 1;
    g.playerActionsThisTurn = (g.playerActionsThisTurn || 0) + 1;
    telemetry.recordAction('player', srcKey);

    var row = resolveCombatRow(ab);
    var dmgOut = 0;
    var hitsLanded = 0;
    var utilitySucceeded = false;

    if (!row || row.noDamage || row.target === 'self') {
      utilitySucceeded = true;
      if (srcKey === 'utility') {
        g.utilityUsedThisTurn = g.utilityUsedThisTurn || {};
        g.utilityUsedThisTurn[ab.id] = true;
      }
    } else {
      var hits = Math.max(1, row.hits || row.hitCount || 1);
      var btn = abilityBtnType(ab, row);
      var isMagic = btn === 'spell';
      var hitPct = playerHitPercent(ab, row);
      var usesMaster = typeof usesMasterDamage === 'function' && usesMasterDamage(row);
      var masterSplit = null;
      var masterIsCrit = false;

      if (usesMaster && typeof computeMasterOutgoingDamage === 'function') {
        g._dispatcherCombatRow = row;
        g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        var src = { id: ab.id, name: ab.name };
        var masterTotal = computeMasterOutgoingDamage(isMagic, src, { hitSucceeded: true });
        g._dispatcherCombatRow = null;
        if (masterTotal) {
          masterIsCrit = !!masterTotal.isCrit;
          masterSplit = (hits > 1 && typeof calculateMultiHitDamage === 'function')
            ? calculateMultiHitDamage(masterTotal.damage, hits)
            : [masterTotal.damage];
        }
      }

      for (var i = 0; i < hits; i++) {
        if (Math.random() * 100 >= hitPct) {
          counters.misses = (counters.misses || 0) + 1;
          continue;
        }
        g._dispatcherCombatRow = row;
        g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);
        var dealOpts = null;
        var raw = 0;
        if (masterSplit) {
          dealOpts = { precomputedDamage: masterSplit[i] || 0, isCrit: masterIsCrit, masterFullyResolved: true };
          raw = masterSplit[i] || 0;
        } else if (typeof computeEntityAbilityRawDamage === 'function') {
          raw = computeEntityAbilityRawDamage(g.player, ab, null, isMagic);
        }
        var res = typeof dealDamage === 'function'
          ? dealDamage('enemy', raw, dealOpts ? dealOpts.isCrit : false, isMagic, ab, dealOpts)
          : { dmgDealt: 0, wasDodged: true };
        g._dispatcherCombatRow = null;
        if (res && !res.wasDodged) {
          hitsLanded++;
          dmgOut += res.dmgDealt || 0;
          counters.damageDealt += res.dmgDealt || 0;
        } else {
          counters.misses = (counters.misses || 0) + 1;
        }
        if (g.enemy.stats.hp <= 0) break;
      }
    }

    if (typeof computeUltimateMeterAward === 'function' && typeof awardUltimateMeter === 'function') {
      var gain = computeUltimateMeterAward(ab, {
        hitsLanded: hitsLanded,
        utilitySucceeded: utilitySucceeded,
      });
      if (gain > 0) awardUltimateMeter('player', gain);
    }

    if (srcKey === 'utility') {
      g.utilityUsedThisTurn = g.utilityUsedThisTurn || {};
      g.utilityUsedThisTurn[ab.id] = true;
    }

    return dmgOut;
  }

  function simExecuteEnemyAbility(enemy, abilityId, counters) {
    var g = globalThis.G;
    if (!g || !enemy || !abilityId) return 0;
    var ab = (enemy.abilities || []).find(function (a) { return a && a.id === abilityId; })
      || { id: abilityId, level: 1 };
    var row = resolveCombatRow(ab);
    var btn = abilityBtnType(ab, row);
    var cat = typeof classifyKitAbilityForEnemyAI === 'function'
      ? classifyKitAbilityForEnemyAI(abilityId, enemy)
      : 'damage';

    counters.enemyActions = (counters.enemyActions || 0) + 1;
    telemetry.recordAction('enemy', ab.actionSource || abilityId);

    if (cat === 'heal') {
      var healAmt = Math.max(1, Math.floor((enemy.stats.maxHp || 40) * 0.14));
      enemy.stats.hp = Math.min(enemy.stats.maxHp || enemy.stats.hp, (enemy.stats.hp || 0) + healAmt);
      return 0;
    }
    if (cat === 'guard' || cat === 'buff') return 0;

    var isMagic = btn === 'spell';
    if (btn !== 'physical' && btn !== 'ranged' && btn !== 'spell' && btn !== 'hybrid') return 0;

    var usesMaster = row && typeof usesMasterDamage === 'function' && usesMasterDamage(row);
    var raw = typeof computeEntityAbilityRawDamage === 'function'
      ? computeEntityAbilityRawDamage(enemy, ab, null, isMagic)
      : 0;
    g._dispatcherCombatRow = row || null;
    var res = typeof dealDamage === 'function'
      ? dealDamage('player', raw, false, isMagic, ab, { masterFullyResolved: usesMaster })
      : { dmgDealt: 0, wasDodged: true };
    g._dispatcherCombatRow = null;

    if (res && !res.wasDodged) {
      counters.damageTaken += res.dmgDealt || 0;
      return res.dmgDealt || 0;
    }
    counters.misses = (counters.misses || 0) + 1;
    return 0;
  }

  function pickPlayerSimAction(player) {
    var order = ['ultimate', 'weaponA', 'weaponB', 'armour', 'basic', 'utility'];
    var abs = player.abilities || [];
    for (var o = 0; o < order.length; o++) {
      var want = order[o];
      for (var i = 0; i < abs.length; i++) {
        var ab = abs[i];
        if (!ab || ab.empty) continue;
        if ((ab.actionSource || '') !== want) continue;
        if (want === 'utility' && G.utilityUsedThisTurn && G.utilityUsedThisTurn[ab.id]) continue;
        if (ab.isUltimate) {
          var meter = typeof getUltimateMeter === 'function' ? getUltimateMeter('player') : (G.playerUltimateMeter || 0);
          if (meter < 100) continue;
        }
        if (typeof canUseAbility === 'function' && !canUseAbility(player, ab)) continue;
        return ab;
      }
    }
    return null;
  }

  function regenEnergyForTurn(entity, side) {
    var g = globalThis.G;
    var idxKey = side === 'player' ? '_playerEnergyTurnIndex' : '_enemyEnergyTurnIndex';
    var idx = (g[idxKey] | 0);
    if (idx === 0) {
      g[idxKey] = 1;
      if (side === 'player' && typeof computePlayerStartEnergy === 'function') {
        entity.energy = computePlayerStartEnergy(entity);
      }
    } else {
      var regen = side === 'player'
        ? (typeof computePlayerEnergyRegenThisTurn === 'function'
          ? computePlayerEnergyRegenThisTurn(entity, g.playerStatus)
          : (entity.energyRegen || 2))
        : (entity.energyRegen || 2);
      entity.energy = Math.min(entity.energyMax || 6, Math.max(0, (entity.energy || 0) + regen));
    }
  }

  function runPlayerTurnSync(counters) {
    var g = globalThis.G;
    regenEnergyForTurn(g.player, 'player');
    g.playerActionsThisTurn = 0;
    g.utilityUsedThisTurn = {};
    if (typeof Avian.dispatcher.onPlayerTurnStart === 'function') {
      Avian.dispatcher.onPlayerTurnStart(g.player);
    }

    var safety = 0;
    while (safety++ < (globalThis.MAX_PLAYER_ACTIONS_PER_TURN || 6)) {
      var ab = pickPlayerSimAction(g.player);
      if (!ab) break;
      simExecutePlayerAbility(ab, counters);
      if (g.enemy.stats.hp <= 0) break;
      if ((g.player.energy || 0) <= 0) break;
    }
  }

  function runEnemyTurnSync(counters) {
    var g = globalThis.G;
    var e = g.enemy;
    regenEnergyForTurn(e, 'enemy');

    var plan = typeof planEnemyTurn === 'function' ? planEnemyTurn(e, g.player) : { actions: [] };
    var actions = (plan.actions || []).slice(0, globalThis.MAX_ENEMY_ACTIONS_PER_TURN || 3);
    for (var i = 0; i < actions.length; i++) {
      if ((e.energy || 0) <= 0) break;
      var action = actions[i];
      var cost = typeof getEnemyActionEnergyCost === 'function' ? getEnemyActionEnergyCost(action) : 1;
      if ((e.energy || 0) < cost) break;
      e.energy -= cost;
      if (action.type === 'ability' && action.abilityId) {
        simExecuteEnemyAbility(e, action.abilityId, counters);
      }
      if (g.player.stats.hp <= 0 || e.stats.hp <= 0) break;
    }
  }

  function withSimUiStubs(fn) {
    var saved = Object.create(null);
    var noopAsync = function () { return Promise.resolve(); };
    var noop = function () {};
    var names = [
      'spawnFloat', 'doAttack', 'doMiss', 'doSpell', 'doHeal', 'doShield',
      'logMsg', 'setHpBar', 'refreshBattleUI', 'renderActions', 'renderStatuses',
      'spawnTrendFloat', 'playAvatarAnim', 'setEnergyBar', 'renderEnemyPlan',
      'lockActionUI', 'renderEnergyOrbs',
    ];
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (typeof globalThis[name] === 'function') {
        saved[name] = globalThis[name];
        globalThis[name] = name === 'logMsg' ? noop : noopAsync;
      }
    }
    if (typeof globalThis.delay === 'function') {
      saved.delay = globalThis.delay;
      globalThis.delay = function () { return Promise.resolve(); };
    }
    if (typeof globalThis.SFX === 'object' && globalThis.SFX) {
      saved.SFX = globalThis.SFX;
      var silentSfx = Object.create(null);
      Object.defineProperty(globalThis, 'SFX', {
        value: new Proxy(silentSfx, { get: function () { return noop; } }),
        writable: true,
        configurable: true,
      });
    }
    try {
      return fn();
    } finally {
      for (var k in saved) {
        if (Object.prototype.hasOwnProperty.call(saved, k)) globalThis[k] = saved[k];
      }
    }
  }

  function saveBattleContext() {
    var g = globalThis.G;
    if (!g) return null;
    return {
      player: g.player,
      enemy: g.enemy,
      turn: g.turn,
      battleOver: g.battleOver,
      playerStatus: g.playerStatus,
      enemyStatus: g.enemyStatus,
      playerActionsThisTurn: g.playerActionsThisTurn,
      enemyActionsThisTurn: g.enemyActionsThisTurn,
      turnPhase: g.turnPhase,
      phase: g.phase,
      utilityUsedThisTurn: g.utilityUsedThisTurn,
      playerUltimateMeter: g.playerUltimateMeter,
      enemyUltimateMeter: g.enemyUltimateMeter,
      _playerEnergyTurnIndex: g._playerEnergyTurnIndex,
      _enemyEnergyTurnIndex: g._enemyEnergyTurnIndex,
    };
  }

  function restoreBattleContext(saved) {
    if (!saved || !globalThis.G) return;
    var g = globalThis.G;
    g.player = saved.player;
    g.enemy = saved.enemy;
    g.turn = saved.turn;
    g.battleOver = saved.battleOver;
    g.playerStatus = saved.playerStatus;
    g.enemyStatus = saved.enemyStatus;
    g.playerActionsThisTurn = saved.playerActionsThisTurn;
    g.enemyActionsThisTurn = saved.enemyActionsThisTurn;
    g.turnPhase = saved.turnPhase;
    g.phase = saved.phase;
    g.utilityUsedThisTurn = saved.utilityUsedThisTurn;
    g.playerUltimateMeter = saved.playerUltimateMeter;
    g.enemyUltimateMeter = saved.enemyUltimateMeter;
    g._playerEnergyTurnIndex = saved._playerEnergyTurnIndex;
    g._enemyEnergyTurnIndex = saved._enemyEnergyTurnIndex;
  }

  function pacingWarning(turns) {
    var cfg = Avian.data && Avian.data.combatConfig && Avian.data.combatConfig.pacing;
    if (!cfg) return null;
    var minT = Number(cfg.targetTurnsMin) || 2;
    var maxT = Number(cfg.targetTurnsMax) || 4;
    if (turns >= minT && turns <= maxT) return null;
    return '[sim pacing] duel length ' + turns + ' turns outside target ' + minT + '–' + maxT;
  }

  function simulateDuelCore(opts) {
    opts = opts || {};
    ensureEquipmentV2();

    if (!globalThis.G) {
      throw new Error('simulateDuel requires global G (load full game bundle)');
    }

    var attackerKey = opts.attackerBirdKey || opts.attacker || 'sparrow';
    var atkRarity = normalizeRarity(opts.attackerRarity || opts.rarity || 'grey');
    var defRarity = normalizeRarity(opts.defenderRarity || opts.rarity || 'grey');
    var maxTurns = Math.max(1, Number(opts.maxTurns) || 40);
    var seed = Number(opts.seed) != null ? Number(opts.seed) : 1;

    var attacker = buildBirdCombatant(attackerKey, { rarity: atkRarity });
    var defender;
    if (opts.defenderBirdKey || opts.defender) {
      defender = buildBirdCombatant(opts.defenderBirdKey || opts.defender, { rarity: defRarity, isEnemy: true });
    } else if (opts.enemyClass) {
      defender = buildClassCombatant(opts.enemyClass, { rarity: defRarity, seed: seed + 17 });
    } else {
      defender = buildClassCombatant('knight', { rarity: defRarity, seed: seed + 17 });
    }
    defender.isEnemy = true;

    var counters = {
      actionsUsed: emptyActionCounts(),
      damageDealt: 0,
      damageTaken: 0,
      misses: 0,
      enemyActions: 0,
    };

    var saved = saveBattleContext();
    var turns = 0;
    var winner = 'draw';

    withSimUiStubs(function () {
      try {
        var g = globalThis.G;
        g.player = attacker;
        g.enemy = defender;
        g.playerStatus = {};
        g.enemyStatus = {};
        g.battleOver = false;
        g.turn = 'player';
        g.turnPhase = typeof TURN !== 'undefined' ? TURN.PLAYER : 'player';
        g.phase = 'PLAYER';
        g.playerActionsThisTurn = 0;
        g.enemyActionsThisTurn = 0;
        g.utilityUsedThisTurn = {};
        g.playerUltimateMeter = 0;
        g.enemyUltimateMeter = 0;
        g._playerEnergyTurnIndex = 0;
        g._enemyEnergyTurnIndex = 0;

        while (turns < maxTurns && attacker.stats.hp > 0 && defender.stats.hp > 0) {
          turns++;
          runPlayerTurnSync(counters);
          if (defender.stats.hp <= 0) {
            winner = 'attacker';
            break;
          }
          if (attacker.stats.hp <= 0) {
            winner = 'defender';
            break;
          }
          runEnemyTurnSync(counters);
          if (attacker.stats.hp <= 0) {
            winner = 'defender';
            break;
          }
          if (defender.stats.hp <= 0) {
            winner = 'attacker';
            break;
          }
        }

        if (winner === 'draw') {
          if (defender.stats.hp <= 0 && attacker.stats.hp > 0) winner = 'attacker';
          else if (attacker.stats.hp <= 0 && defender.stats.hp > 0) winner = 'defender';
          else if (defender.stats.hp < attacker.stats.hp) winner = 'attacker';
          else if (attacker.stats.hp < defender.stats.hp) winner = 'defender';
        }
      } finally {
        restoreBattleContext(saved);
      }
    });

    var pacing = pacingWarning(turns);
    if (pacing) {
      try { console.warn(pacing); } catch (_e) { /* noop */ }
    }

    return {
      turns: turns,
      winner: winner,
      damageDealt: counters.damageDealt,
      damageTaken: counters.damageTaken,
      misses: counters.misses,
      actionsUsed: cloneActionCounts(counters.actionsUsed),
      enemyActions: counters.enemyActions,
      seed: seed,
      pacingWarning: pacing,
      attackerHp: attacker.stats.hp,
      defenderHp: defender.stats.hp,
    };
  }

  Avian.debug.simulateDuel = function simulateDuel(opts) {
    opts = opts || {};
    var seed = Number(opts.seed) != null ? Number(opts.seed) : 1;
    return withSeededRandom(seed, function () {
      return simulateDuelCore(opts);
    });
  };

  Avian.debug.simulateRun = function simulateRun(opts) {
    opts = opts || {};
    var bird = opts.bird || opts.birdKey || 'sparrow';
    var duels = Math.max(1, Number(opts.duels || opts.runs || 1));
    var baseSeed = Number(opts.seed) != null ? Number(opts.seed) : 0;
    var wins = 0;
    var turnTotal = 0;
    var last = null;

    for (var i = 0; i < duels; i++) {
      last = Avian.debug.simulateDuel({
        attackerBirdKey: bird,
        defenderBirdKey: opts.defender || opts.defenderBirdKey || 'crow',
        attackerRarity: opts.attackerRarity || opts.rarity || 'grey',
        defenderRarity: opts.defenderRarity || 'purple',
        enemyClass: opts.enemyClass,
        seed: baseSeed + i,
        maxTurns: opts.maxTurns || 40,
      });
      if (last && last.winner === 'attacker') wins++;
      turnTotal += last ? last.turns : 0;
    }

    return {
      bird: bird,
      win: wins > duels / 2,
      wins: wins,
      duels: duels,
      winRate: duels ? wins / duels : 0,
      avgTurns: duels ? turnTotal / duels : 0,
      stages: 1,
      last: last,
    };
  };

  Avian.systems.equipmentSims = {
    simulateDuel: Avian.debug.simulateDuel,
    simulateRun: Avian.debug.simulateRun,
    telemetry: telemetry,
  };
})();
