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
  function emptyAilmentCounts() {
    return {
      attempts: 0, successes: 0, stacks: 0, turnsActive: 0,
      evolutions: 0, damage: 0, controlTurns: 0,
    };
  }

  function emptyDuelCounters() {
    return {
      actionsUsed: emptyActionCounts(),
      damageDealt: 0,
      healthDamageDealt: 0,
      armourDamageDealt: 0,
      magicArmourDamageDealt: 0,
      damageTaken: 0,
      healthLost: 0,
      armourAbsorbed: 0,
      magicArmourAbsorbed: 0,
      attacksAttempted: 0,
      hits: 0,
      precisionMisses: 0,
      dodges: 0,
      misses: 0,
      crits: 0,
      critRolls: 0,
      healing: 0,
      armourRestored: 0,
      magicArmourRestored: 0,
      fortifyGenerated: 0,
      wardGenerated: 0,
      protectionWasted: 0,
      enemyActions: 0,
      ailments: emptyAilmentCounts(),
      passiveTriggers: 0,
    };
  }

  /* Active duel counters (set while simulateDuel runs) for native pool/crit/ailment hooks. */
  var activeDuelCounters = null;

  var telemetry = {
    hits: 0,
    misses: 0,
    precisionMisses: 0,
    dodges: 0,
    attacksAttempted: 0,
    crits: 0,
    damageDealt: 0,
    healthDamageDealt: 0,
    armourDamageDealt: 0,
    magicArmourDamageDealt: 0,
    damageTaken: 0,
    healthLost: 0,
    armourAbsorbed: 0,
    magicArmourAbsorbed: 0,
    healing: 0,
    armourRestored: 0,
    magicArmourRestored: 0,
    fortifyGenerated: 0,
    wardGenerated: 0,
    protectionWasted: 0,
    meterAwarded: 0,
    ailments: emptyAilmentCounts(),
    passiveTriggers: 0,
    actions: { player: 0, enemy: 0 },
    bySource: emptyActionCounts(),
    startedAt: null,
    reset: function reset() {
      this.hits = 0;
      this.misses = 0;
      this.precisionMisses = 0;
      this.dodges = 0;
      this.attacksAttempted = 0;
      this.crits = 0;
      this.damageDealt = 0;
      this.healthDamageDealt = 0;
      this.armourDamageDealt = 0;
      this.magicArmourDamageDealt = 0;
      this.damageTaken = 0;
      this.healthLost = 0;
      this.armourAbsorbed = 0;
      this.magicArmourAbsorbed = 0;
      this.healing = 0;
      this.armourRestored = 0;
      this.magicArmourRestored = 0;
      this.fortifyGenerated = 0;
      this.wardGenerated = 0;
      this.protectionWasted = 0;
      this.meterAwarded = 0;
      this.ailments = emptyAilmentCounts();
      this.passiveTriggers = 0;
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
    recordMiss: function recordMiss(kind) {
      this.misses++;
      if (kind === 'dodge') this.dodges++;
      else this.precisionMisses++;
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
        precisionMisses: this.precisionMisses,
        dodges: this.dodges,
        attacksAttempted: this.attacksAttempted,
        crits: this.crits,
        meter: this.meterAwarded,
        meterAwarded: this.meterAwarded,
        damageDealt: this.damageDealt,
        healthDamageDealt: this.healthDamageDealt,
        armourDamageDealt: this.armourDamageDealt,
        magicArmourDamageDealt: this.magicArmourDamageDealt,
        damageTaken: this.damageTaken,
        healthLost: this.healthLost,
        armourAbsorbed: this.armourAbsorbed,
        magicArmourAbsorbed: this.magicArmourAbsorbed,
        healing: this.healing,
        armourRestored: this.armourRestored,
        magicArmourRestored: this.magicArmourRestored,
        fortifyGenerated: this.fortifyGenerated,
        wardGenerated: this.wardGenerated,
        protectionWasted: this.protectionWasted,
        ailments: Object.assign({}, this.ailments),
        passiveTriggers: this.passiveTriggers,
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

  function applyProtectionHitToBuckets(buckets, prot, outgoing) {
    if (!buckets || !prot) return;
    var absorbed = Math.max(0, Number(prot.absorbed) || 0);
    var remaining = Math.max(0, Number(prot.remaining) || 0);
    if (outgoing) {
      if (prot.isMagic) buckets.magicArmourDamageDealt = (buckets.magicArmourDamageDealt || 0) + absorbed;
      else buckets.armourDamageDealt = (buckets.armourDamageDealt || 0) + absorbed;
      buckets.healthDamageDealt = (buckets.healthDamageDealt || 0) + remaining;
      buckets.damageDealt = (buckets.damageDealt || 0) + absorbed + remaining;
    } else {
      if (prot.isMagic) buckets.magicArmourAbsorbed = (buckets.magicArmourAbsorbed || 0) + absorbed;
      else buckets.armourAbsorbed = (buckets.armourAbsorbed || 0) + absorbed;
      buckets.healthLost = (buckets.healthLost || 0) + remaining;
      buckets.damageTaken = (buckets.damageTaken || 0) + remaining;
    }
  }

  function recordOutgoingAttackResult(counters, res, isMagic) {
    var g = globalThis.G;
    var prot = g && g._lastProtectionHit;
    if (res && res.isCrit) {
      counters.crits = (counters.crits || 0) + 1;
      telemetry.crits++;
    }
    counters.critRolls = (counters.critRolls || 0) + 1;
    if (res && res.wasDodged) {
      counters.dodges = (counters.dodges || 0) + 1;
      counters.misses = (counters.misses || 0) + 1;
      telemetry.recordMiss('dodge');
      return 0;
    }
    counters.hits = (counters.hits || 0) + 1;
    if (prot && (prot.absorbed > 0 || prot.remaining > 0 || prot.poolBefore != null)) {
      applyProtectionHitToBuckets(counters, prot, true);
      applyProtectionHitToBuckets(telemetry, prot, true);
      telemetry.hits++;
      return (Number(prot.absorbed) || 0) + (Number(prot.remaining) || 0);
    }
    var dealt = res && res.dmgDealt != null ? Number(res.dmgDealt) || 0 : 0;
    counters.healthDamageDealt = (counters.healthDamageDealt || 0) + dealt;
    counters.damageDealt = (counters.damageDealt || 0) + dealt;
    telemetry.recordHit('player', dealt);
    telemetry.healthDamageDealt += dealt;
    return dealt;
  }

  function recordIncomingAttackResult(counters, res) {
    var g = globalThis.G;
    var prot = g && g._lastProtectionHit;
    if (res && res.wasDodged) {
      /* Enemy miss/dodge against the player — do not pollute player miss totals. */
      return 0;
    }
    if (prot && (prot.absorbed > 0 || prot.remaining > 0 || prot.poolBefore != null)) {
      applyProtectionHitToBuckets(counters, prot, false);
      applyProtectionHitToBuckets(telemetry, prot, false);
      return Number(prot.remaining) || 0;
    }
    var taken = res && res.dmgDealt != null ? Number(res.dmgDealt) || 0 : 0;
    counters.healthLost = (counters.healthLost || 0) + taken;
    counters.damageTaken = (counters.damageTaken || 0) + taken;
    telemetry.recordHit('enemy', taken);
    telemetry.healthLost += taken;
    return taken;
  }

  var coreTelemetryHooksAttached = false;

  function wrapProtectionFn(name, onResult) {
    var prot = Avian.protection;
    if (!prot || typeof prot[name] !== 'function' || prot[name]._avianTelemetryWrapped) return;
    var inner = prot[name];
    var wrapped = function () {
      var out = inner.apply(this, arguments);
      try { onResult(out, arguments); } catch (_e) { /* noop */ }
      return out;
    };
    wrapped._avianTelemetryWrapped = true;
    prot[name] = wrapped;
  }

  function attachProtectionTelemetryHooks() {
    wrapProtectionFn('restoreArmour', function (restored) {
      var n = Math.max(0, Number(restored) || 0);
      telemetry.armourRestored += n;
      if (activeDuelCounters) activeDuelCounters.armourRestored += n;
    });
    wrapProtectionFn('restoreMagicArmour', function (restored) {
      var n = Math.max(0, Number(restored) || 0);
      telemetry.magicArmourRestored += n;
      if (activeDuelCounters) activeDuelCounters.magicArmourRestored += n;
    });
    wrapProtectionFn('applyFortify', function (gained, args) {
      var n = Math.max(0, Number(gained) || 0);
      var requested = Math.max(0, Math.floor(Number(args && args[2]) || 0));
      telemetry.fortifyGenerated += n;
      if (requested > n) telemetry.protectionWasted += (requested - n);
      if (activeDuelCounters) {
        activeDuelCounters.fortifyGenerated += n;
        if (requested > n) activeDuelCounters.protectionWasted += (requested - n);
      }
    });
    wrapProtectionFn('applyWard', function (gained, args) {
      var n = Math.max(0, Number(gained) || 0);
      var requested = Math.max(0, Math.floor(Number(args && args[2]) || 0));
      telemetry.wardGenerated += n;
      if (requested > n) telemetry.protectionWasted += (requested - n);
      if (activeDuelCounters) {
        activeDuelCounters.wardGenerated += n;
        if (requested > n) activeDuelCounters.protectionWasted += (requested - n);
      }
    });
  }

  function attachCombatTelemetryHooks() {
    attachProtectionTelemetryHooks();
    if (coreTelemetryHooksAttached) return;
    coreTelemetryHooksAttached = true;

    var innerDeal = globalThis.dealDamage;
    if (typeof innerDeal === 'function') {
      globalThis.dealDamage = function dealDamageWithTelemetry(target, amount, isCrit, isMagic, srcAbility, opts) {
        var res = innerDeal.apply(this, arguments);
        try {
          /* Live-play telemetry only; duel sims record via recordOutgoing/Incoming. */
          if (!activeDuelCounters) {
            if (res && res.wasDodged) telemetry.recordMiss('dodge');
            else if (res && (res.dmgDealt || 0) > 0) {
              var prot = globalThis.G && globalThis.G._lastProtectionHit;
              if (prot) {
                applyProtectionHitToBuckets(telemetry, prot, target === 'enemy');
                telemetry.hits++;
                if (res.isCrit) telemetry.crits++;
              } else {
                telemetry.recordHit(target === 'enemy' ? 'player' : 'enemy', res.dmgDealt);
                if (res.isCrit) telemetry.crits++;
              }
            }
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

    if (typeof globalThis.applyAilment === 'function') {
      var innerAil = globalThis.applyAilment;
      globalThis.applyAilment = function applyAilmentWithTelemetry(target, ailId, stacks) {
        var ok = innerAil.apply(this, arguments);
        try {
          var n = Math.max(1, Number(stacks) || 1);
          telemetry.ailments.attempts++;
          if (activeDuelCounters) activeDuelCounters.ailments.attempts++;
          if (ok !== false) {
            telemetry.ailments.successes++;
            telemetry.ailments.stacks += n;
            if (activeDuelCounters) {
              activeDuelCounters.ailments.successes++;
              activeDuelCounters.ailments.stacks += n;
            }
          }
        } catch (_e) { /* noop */ }
        return ok;
      };
    }
  }

  attachCombatTelemetryHooks();
  if (typeof document !== 'undefined') {
    setTimeout(attachCombatTelemetryHooks, 0);
  }

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
        var playerAcc;
        var prec = row && (row.hitChanceOverride != null
          ? row.hitChanceOverride
          : (row.precision != null ? row.precision : row.basePrecision));
        if (prec == null && typeof resolveActionPrecisionPct === 'function') {
          prec = resolveActionPrecisionPct(ab);
          if (prec != null) {
            /* resolveActionPrecisionPct already returns percent */
            playerAcc = prec;
            prec = null;
          }
        }
        if (playerAcc == null) {
          if (prec != null && Number.isFinite(Number(prec))) {
            var n = Number(prec);
            playerAcc = n <= 1.5 ? n * 100 : n;
          } else if (typeof getPlayerEffectiveAcc === 'function') {
            playerAcc = getPlayerEffectiveAcc();
          } else {
            playerAcc = 85;
          }
        }
        if (typeof getPlayerAccMod === 'function' && prec != null) {
          playerAcc += getPlayerAccMod();
        }
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
      /* Healing utilities — approximate from HP delta when present. */
      var hpBefore = g.player.stats.hp;
      if (typeof Avian.equipmentActions === 'object' && ab.id) {
        /* no-op: utility effects may still mutate via other hooks if wired later */
      }
      var healed = Math.max(0, (g.player.stats.hp || 0) - hpBefore);
      if (healed > 0) {
        counters.healing = (counters.healing || 0) + healed;
        telemetry.healing += healed;
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
        counters.attacksAttempted = (counters.attacksAttempted || 0) + 1;
        telemetry.attacksAttempted++;
        if (Math.random() * 100 >= hitPct) {
          counters.precisionMisses = (counters.precisionMisses || 0) + 1;
          counters.misses = (counters.misses || 0) + 1;
          telemetry.recordMiss('precision');
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
          dmgOut += recordOutgoingAttackResult(counters, res, isMagic);
        } else {
          recordOutgoingAttackResult(counters, res || { wasDodged: true }, isMagic);
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

    return recordIncomingAttackResult(counters, res);
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

    /* Balance-lab fixtures may supply an exact catalogue loadout and/or a
     * synthetic target stat line.  Normal game callers omit both options. */
    if (opts.attackerEquipment && Avian.equipment) {
      attacker.equipment = Avian.equipment.createEmptyLoadout();
      Object.assign(attacker.equipment, opts.attackerEquipment);
      if (typeof Avian.equipment.applyEquipmentStatsToEntity === 'function') Avian.equipment.applyEquipmentStatsToEntity(attacker);
      if (Avian.equipmentActions && typeof Avian.equipmentActions.syncEntityAbilities === 'function') Avian.equipmentActions.syncEntityAbilities(attacker);
    }
    if (opts.defenderStats) {
      var fixed = opts.defenderStats;
      if (fixed.hp != null) defender.stats.hp = defender.stats.maxHp = Number(fixed.hp);
      if (fixed.armour != null) defender.stats.armour = defender.stats.maxArmour = defender.stats.normalMaxArmour = Number(fixed.armour);
      if (fixed.magicArmour != null) defender.stats.magicArmour = defender.stats.maxMagicArmour = defender.stats.normalMaxMagicArmour = Number(fixed.magicArmour);
      if (fixed.precision != null) defender.stats.acc = Number(fixed.precision);
      if (fixed.dodge != null) defender.stats.dodge = Number(fixed.dodge);
    }

    var counters = emptyDuelCounters();
    activeDuelCounters = counters;
    attachCombatTelemetryHooks();

    var saved = saveBattleContext();
    var turns = 0;
    var winner = 'draw';

    try {
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
    } finally {
      activeDuelCounters = null;
    }

    var pacing = pacingWarning(turns);
    if (pacing) {
      try { console.warn(pacing); } catch (_e) { /* noop */ }
    }

    return {
      turns: turns,
      winner: winner,
      damageDealt: counters.damageDealt,
      healthDamageDealt: counters.healthDamageDealt,
      armourDamageDealt: counters.armourDamageDealt,
      magicArmourDamageDealt: counters.magicArmourDamageDealt,
      damageTaken: counters.damageTaken,
      healthLost: counters.healthLost,
      armourAbsorbed: counters.armourAbsorbed,
      magicArmourAbsorbed: counters.magicArmourAbsorbed,
      attacksAttempted: counters.attacksAttempted,
      hits: counters.hits,
      precisionMisses: counters.precisionMisses,
      dodges: counters.dodges,
      misses: counters.misses,
      crits: counters.crits,
      critRolls: counters.critRolls,
      healing: counters.healing,
      armourRestored: counters.armourRestored,
      magicArmourRestored: counters.magicArmourRestored,
      fortifyGenerated: counters.fortifyGenerated,
      wardGenerated: counters.wardGenerated,
      protectionWasted: counters.protectionWasted,
      ailments: Object.assign({}, counters.ailments),
      passiveTriggers: counters.passiveTriggers,
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

  /**
   * In-browser / shared balance lab batch.
   * mode: 'story' → roster × tiers × synthetic targets
   * mode: 'endless' → endlessBands only
   */
  Avian.debug.runBalanceLabBatch = function runBalanceLabBatch(opts) {
    opts = opts || {};
    var cfg = Avian.data && Avian.data.balanceBenchmarks;
    if (!cfg || typeof Avian.debug.simulateDuel !== 'function') {
      throw new Error('balanceBenchmarks or simulateDuel missing');
    }
    attachCombatTelemetryHooks();
    var mode = String(opts.mode || 'story').toLowerCase() === 'endless' ? 'endless' : 'story';
    var runs = Math.max(1, Math.min(10000, Number(opts.runs) || 20));
    var seed = Number(opts.seed != null ? opts.seed : cfg.baseSeed) || 12345;
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    var targetBird = {
      balanced: 'crow', highArmour: 'crow', highMagicArmour: 'blackbird',
      highDodge: 'sparrow', highHp: 'goose', lowDefence: 'chickadee',
    };
    var rows = [];
    var warnings = [];
    var matchups = [];
    var matchupIndex = 0;

    function round(n, places) {
      places = places == null ? 3 : places;
      var p = Math.pow(10, places);
      return Math.round((Number(n) || 0) * p) / p;
    }

    function aggregateOne(label, cls, bird, tier, opponent, rarity, defender, count, kind, fixture) {
      var total = {
        wins: 0, turns: 0, damage: 0, health: 0, armourDmg: 0, magicDmg: 0,
        taken: 0, healthLost: 0, armourAbs: 0, magicAbs: 0,
        attacks: 0, hits: 0, precisionMisses: 0, dodges: 0, misses: 0, crits: 0, critRolls: 0,
        healing: 0, armourRestored: 0, magicArmourRestored: 0,
        fortify: 0, ward: 0, wasted: 0, enemyActions: 0, en: 0, source: {},
        ailments: emptyAilmentCounts(), passiveTriggers: 0,
      };
      var nominalCosts = { basic: 1, utility: 2, weaponA: 2, weaponB: 3, armour: 2, ultimate: 0 };
      for (var i = 0; i < count; i++) {
        var r = Avian.debug.simulateDuel({
          attackerBirdKey: bird,
          defenderBirdKey: defender,
          attackerRarity: rarity,
          defenderRarity: rarity,
          attackerEquipment: fixture && fixture.equipment,
          defenderStats: fixture && fixture.target,
          seed: seed + matchupIndex * 100003 + i,
          maxTurns: cfg.maxTurns,
        });
        if (r && r.winner === 'attacker') total.wins++;
        total.turns += r && r.turns || 0;
        total.damage += r && r.damageDealt || 0;
        total.health += r && r.healthDamageDealt || 0;
        total.armourDmg += r && r.armourDamageDealt || 0;
        total.magicDmg += r && r.magicArmourDamageDealt || 0;
        total.taken += r && r.damageTaken || 0;
        total.healthLost += r && r.healthLost || 0;
        total.armourAbs += r && r.armourAbsorbed || 0;
        total.magicAbs += r && r.magicArmourAbsorbed || 0;
        total.attacks += r && r.attacksAttempted || 0;
        total.hits += r && r.hits || 0;
        total.precisionMisses += r && r.precisionMisses || 0;
        total.dodges += r && r.dodges || 0;
        total.misses += r && r.misses || 0;
        total.crits += r && r.crits || 0;
        total.critRolls += r && r.critRolls || 0;
        total.healing += r && r.healing || 0;
        total.armourRestored += r && r.armourRestored || 0;
        total.magicArmourRestored += r && r.magicArmourRestored || 0;
        total.fortify += r && r.fortifyGenerated || 0;
        total.ward += r && r.wardGenerated || 0;
        total.wasted += r && r.protectionWasted || 0;
        total.enemyActions += r && r.enemyActions || 0;
        total.passiveTriggers += r && r.passiveTriggers || 0;
        if (r && r.ailments) {
          total.ailments.attempts += r.ailments.attempts || 0;
          total.ailments.successes += r.ailments.successes || 0;
          total.ailments.stacks += r.ailments.stacks || 0;
        }
        var src = r && r.actionsUsed || {};
        Object.keys(src).forEach(function (source) {
          var n = src[source] || 0;
          total.source[source] = (total.source[source] || 0) + n;
          total.en += n * (nominalCosts[source] != null ? nominalCosts[source] : 2);
        });
      }
      matchupIndex++;
      var attempts = total.attacks;
      var hitRate = attempts ? total.hits / attempts : 0;
      var row = {
        kind: kind, class: cls, bird: bird, tier: tier, opponent: opponent, runs: count,
        winRate: round(total.wins / count),
        averageTurns: round(total.turns / count),
        actionsToVictory: round(Object.keys(total.source).reduce(function (a, k) { return a + (total.source[k] || 0); }, 0) / count),
        totalDamageDealt: round(total.damage / count),
        healthDamageDealt: round(total.health / count),
        armourDamageDealt: round(total.armourDmg / count),
        magicArmourDamageDealt: round(total.magicDmg / count),
        damagePerTurn: round(total.damage / Math.max(1, total.turns)),
        damagePerEN: round(total.damage / Math.max(1, total.en)),
        rawDamagePerEN: round(total.damage / Math.max(1, total.en)),
        healthDamagePerEN: round(total.health / Math.max(1, total.en)),
        protectionDamagePerEN: round((total.armourDmg + total.magicDmg) / Math.max(1, total.en)),
        damageTaken: round(total.taken / count),
        healthLost: round(total.healthLost / count),
        armourAbsorbed: round(total.armourAbs / count),
        magicArmourAbsorbed: round(total.magicAbs / count),
        effectiveSurvivability: round((total.damage + total.taken) / count),
        enSpent: round(total.en / count),
        enWasted: 0,
        averageENPerTurn: round(total.en / Math.max(1, total.turns)),
        actionsPerTurn: round(Object.keys(total.source).reduce(function (a, k) { return a + (total.source[k] || 0); }, 0) / Math.max(1, total.turns)),
        unaffordableTurns: 0,
        attacksAttempted: attempts,
        hits: total.hits,
        precisionMisses: total.precisionMisses,
        dodges: total.dodges,
        misses: total.misses,
        hitRate: round(hitRate),
        dodgeRate: round(attempts ? total.dodges / attempts : 0),
        criticalRate: round(total.critRolls ? total.crits / total.critRolls : 0),
        healing: round(total.healing / count),
        armourRestored: round(total.armourRestored / count),
        magicArmourRestored: round(total.magicArmourRestored / count),
        fortifyGenerated: round(total.fortify / count),
        wardGenerated: round(total.ward / count),
        protectionWasted: round(total.wasted / count),
        ailments: Object.assign({}, total.ailments),
        skillUsage: total.source,
        passive: {
          triggers: total.passiveTriggers,
          value: 0,
          triggerFightRate: 0,
          disabledWinRateDelta: null,
        },
        classPerk: { disabledWinRateDelta: null },
        firstActorWinRate: round(total.wins / count),
        telemetryCoverage: 'Native duel telemetry: pool damage, crits, restores, Fortify/Ward, ailments when emitted; passive/perk A-B deltas remain null.',
      };
      rows.push(row);
      if (kind === 'target' && (row.averageTurns < cfg.thresholds.turnsMin || row.averageTurns > cfg.thresholds.turnsMax)) {
        warnings.push(label + ' average turns ' + row.averageTurns);
      }
      if (attempts && (row.hitRate < cfg.thresholds.hitRateMin || row.hitRate > cfg.thresholds.hitRateMax)) {
        warnings.push(label + ' hit rate ' + (row.hitRate * 100).toFixed(1) + '%');
      }
      return row;
    }

    if (mode === 'endless') {
      (cfg.endlessBands || []).forEach(function (band) {
        matchups.push(function () {
          aggregateOne(
            'endless/' + band, 'endless', cfg.roster.rogue.birdId, 'band-' + band, 'scaled knight',
            'grey', 'crow', Math.max(1, Math.ceil(runs / 10)), 'endless', null
          );
        });
      });
    } else {
      Object.keys(cfg.roster).forEach(function (cls) {
        var entry = cfg.roster[cls];
        Object.keys(entry.tiers).forEach(function (tier) {
          var build = entry.tiers[tier];
          ['balanced', 'highArmour', 'highMagicArmour', 'highDodge', 'highHp'].forEach(function (target) {
            matchups.push(function () {
              aggregateOne(
                cls + '/' + tier + '/' + target, cls, entry.birdId, tier, target, build.rarity,
                targetBird[target], runs, 'target',
                { equipment: build.equipment, target: cfg.targets[tier][target] }
              );
            });
          });
        });
      });
    }

    var total = matchups.length;
    function runAt(index) {
      if (index >= matchups.length) {
        return {
          mode: mode,
          runs: runs,
          seed: seed,
          rows: rows,
          warnings: warnings,
          telemetry: telemetry.snapshot(),
        };
      }
      matchups[index]();
      if (onProgress) onProgress({ done: index + 1, total: total, mode: mode, runs: runs });
      return null;
    }

    if (opts.async) {
      return new Promise(function (resolve, reject) {
        var idx = 0;
        function step() {
          try {
            var done = runAt(idx);
            idx++;
            if (done) {
              resolve(done);
              return;
            }
            var delay = typeof opts.asyncDelayMs === 'number' ? opts.asyncDelayMs : 0;
            if (delay > 0) setTimeout(step, delay);
            else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
            else setTimeout(step, 0);
          } catch (err) {
            reject(err);
          }
        }
        step();
      });
    }

    for (var m = 0; m < matchups.length; m++) {
      var finished = runAt(m);
      if (finished) return finished;
    }
    return {
      mode: mode,
      runs: runs,
      seed: seed,
      rows: rows,
      warnings: warnings,
      telemetry: telemetry.snapshot(),
    };
  };

  Avian.systems.equipmentSims = {
    simulateDuel: Avian.debug.simulateDuel,
    simulateRun: Avian.debug.simulateRun,
    runBalanceLabBatch: Avian.debug.runBalanceLabBatch,
    telemetry: telemetry,
  };
})();
