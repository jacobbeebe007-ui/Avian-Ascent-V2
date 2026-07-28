/* Avian Ascent — Physical Armour / Magic Armour / Fortify / Ward (equipment v1.2)
 *
 * Separate protection pools absorb post-mitigation damage of matching type.
 * Fortify/Ward heal current pools and raise temporary maximums; restoration
 * only repairs up to normal maximum. Barrier (shieldHp) is no longer used.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.protection || Object.create(null);

  function coreRules() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.coreRules) || null;
  }

  function entityStats(entity) {
    return entity && entity.stats ? entity.stats : null;
  }

  function entityStatus(entity) {
    return entity && entity.status
      ? entity.status
      : (entity && entity._status) || null;
  }

  function ensureProtectionFields(stats) {
    if (!stats) return stats;
    if (stats.maxArmour == null) stats.maxArmour = 0;
    if (stats.armour == null) stats.armour = Number(stats.maxArmour) || 0;
    if (stats.normalMaxArmour == null) stats.normalMaxArmour = Number(stats.maxArmour) || 0;
    if (stats.maxMagicArmour == null) stats.maxMagicArmour = 0;
    if (stats.magicArmour == null) stats.magicArmour = Number(stats.maxMagicArmour) || 0;
    if (stats.normalMaxMagicArmour == null) {
      stats.normalMaxMagicArmour = Number(stats.maxMagicArmour) || 0;
    }
    /* Legacy barrier cleared when protection pools are authoritative. */
    if (stats.shieldHp) stats.shieldHp = 0;
    if (stats.maxShieldHp) stats.maxShieldHp = 0;
    return stats;
  }

  function initFromEquipmentRoll(entity, rollStats) {
    if (!entity || !entity.stats) return entity;
    var stats = entity.stats;
    var armour = Math.max(0, Math.floor(Number(rollStats && rollStats.armour) || Number(stats.armourFlat) || 0));
    var magic = Math.max(0, Math.floor(Number(rollStats && rollStats.magicArmour) || Number(stats.magicArmourFlat) || 0));
    /* Preserve current fill ratio when re-applying mid-run if pools already exist. */
    var prevArmour = Number(stats.armour);
    var prevMax = Number(stats.normalMaxArmour != null ? stats.normalMaxArmour : stats.maxArmour);
    var prevMagic = Number(stats.magicArmour);
    var prevMagicMax = Number(stats.normalMaxMagicArmour != null ? stats.normalMaxMagicArmour : stats.maxMagicArmour);

    stats.normalMaxArmour = armour;
    stats.normalMaxMagicArmour = magic;
    stats.maxArmour = armour + Math.max(0, Number(stats._fortifyBonus) || 0);
    stats.maxMagicArmour = magic + Math.max(0, Number(stats._wardBonus) || 0);

    if (Number.isFinite(prevArmour) && Number.isFinite(prevMax) && prevMax > 0) {
      var ratioA = Math.max(0, Math.min(1, prevArmour / prevMax));
      stats.armour = Math.min(stats.maxArmour, Math.round(armour * ratioA + (Number(stats._fortifyBonus) || 0) * ratioA));
    } else {
      stats.armour = stats.maxArmour;
    }
    if (Number.isFinite(prevMagic) && Number.isFinite(prevMagicMax) && prevMagicMax > 0) {
      var ratioM = Math.max(0, Math.min(1, prevMagic / prevMagicMax));
      stats.magicArmour = Math.min(stats.maxMagicArmour, Math.round(magic * ratioM + (Number(stats._wardBonus) || 0) * ratioM));
    } else {
      stats.magicArmour = stats.maxMagicArmour;
    }
    ensureProtectionFields(stats);
    return entity;
  }

  function resetCombatPools(entity) {
    if (!entity || !entity.stats) return;
    var stats = entity.stats;
    stats._fortifyBonus = 0;
    stats._wardBonus = 0;
    stats.maxArmour = Number(stats.normalMaxArmour) || Number(stats.maxArmour) || 0;
    stats.maxMagicArmour = Number(stats.normalMaxMagicArmour) || Number(stats.maxMagicArmour) || 0;
    stats.armour = stats.maxArmour;
    stats.magicArmour = stats.maxMagicArmour;
    stats.shieldHp = 0;
    stats.maxShieldHp = 0;
    if (entity.status) {
      delete entity.status.fortify;
      delete entity.status.ward;
      delete entity.status.shieldHpTurns;
      delete entity.status.shieldHpSourceId;
      delete entity.status.shieldHpSourceKind;
    }
  }

  function restoreArmour(stats, amount) {
    if (!stats) return 0;
    ensureProtectionFields(stats);
    var add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return 0;
    var normalMax = Number(stats.normalMaxArmour) || 0;
    var before = Number(stats.armour) || 0;
    /* Restoration cannot exceed normal maximum; leave Fortify overflow untouched. */
    if (before >= normalMax) return 0;
    var next = Math.min(normalMax, before + add);
    stats.armour = next;
    return Math.max(0, next - before);
  }

  function restoreMagicArmour(stats, amount) {
    if (!stats) return 0;
    ensureProtectionFields(stats);
    var add = Math.max(0, Math.floor(Number(amount) || 0));
    if (add <= 0) return 0;
    var normalMax = Number(stats.normalMaxMagicArmour) || 0;
    var before = Number(stats.magicArmour) || 0;
    if (before > normalMax) return 0;
    var next = Math.min(normalMax, before + add);
    stats.magicArmour = next;
    return Math.max(0, next - before);
  }

  function applyFortify(stats, status, amount, turns) {
    if (!stats) return 0;
    ensureProtectionFields(stats);
    var add = Math.max(0, Math.floor(Number(amount) || 0));
    var dur = Math.max(1, Math.floor(Number(turns) || 2));
    if (add <= 0) return 0;
    var existing = status && status.fortify ? status.fortify : null;
    var activeBonus = existing ? Math.max(0, Number(existing.amount) || 0) : 0;
    /* Reapplication: greater bonus wins; always refresh duration. */
    var bonus = Math.max(activeBonus, add);
    var normalMax = Number(stats.normalMaxArmour) || 0;
    stats._fortifyBonus = bonus;
    stats.maxArmour = normalMax + bonus;
    stats.armour = Math.min(stats.maxArmour, (Number(stats.armour) || 0) + add);
    if (status) {
      status.fortify = { amount: bonus, turns: dur };
    }
    return add;
  }

  function applyWard(stats, status, amount, turns) {
    if (!stats) return 0;
    ensureProtectionFields(stats);
    var add = Math.max(0, Math.floor(Number(amount) || 0));
    var dur = Math.max(1, Math.floor(Number(turns) || 2));
    if (add <= 0) return 0;
    var existing = status && status.ward ? status.ward : null;
    var activeBonus = existing ? Math.max(0, Number(existing.amount) || 0) : 0;
    var bonus = Math.max(activeBonus, add);
    var normalMax = Number(stats.normalMaxMagicArmour) || 0;
    stats._wardBonus = bonus;
    stats.maxMagicArmour = normalMax + bonus;
    stats.magicArmour = Math.min(stats.maxMagicArmour, (Number(stats.magicArmour) || 0) + add);
    if (status) {
      status.ward = { amount: bonus, turns: dur };
    }
    return add;
  }

  function applyBastion(stats, status, armourAmt, magicAmt, turns) {
    var a = applyFortify(stats, status, armourAmt, turns);
    var m = applyWard(stats, status, magicAmt, turns);
    return { armour: a, magicArmour: m };
  }

  function expireFortify(stats, status) {
    if (!stats) return;
    var normalMax = Number(stats.normalMaxArmour) || 0;
    stats._fortifyBonus = 0;
    stats.maxArmour = normalMax;
    stats.armour = Math.min(Number(stats.armour) || 0, normalMax);
    if (status) delete status.fortify;
  }

  function expireWard(stats, status) {
    if (!stats) return;
    var normalMax = Number(stats.normalMaxMagicArmour) || 0;
    stats._wardBonus = 0;
    stats.maxMagicArmour = normalMax;
    stats.magicArmour = Math.min(Number(stats.magicArmour) || 0, normalMax);
    if (status) delete status.ward;
  }

  function tickProtectionStatuses(stats, status) {
    if (!status || !stats) return;
    if (status.fortify && status.fortify.turns != null) {
      status.fortify.turns = Math.max(0, Math.floor(Number(status.fortify.turns) || 0) - 1);
      if (status.fortify.turns <= 0) expireFortify(stats, status);
    }
    if (status.ward && status.ward.turns != null) {
      status.ward.turns = Math.max(0, Math.floor(Number(status.ward.turns) || 0) - 1);
      if (status.ward.turns <= 0) expireWard(stats, status);
    }
  }

  /**
   * Absorb post-mitigation damage into the matching protection pool.
   * Returns { remaining, absorbed, poolBefore, poolAfter, brokePool, damagedHealth }.
   * damagedHealth is true when remaining > 0 after absorption (caller applies to HP).
   */
  function applyDamageThroughProtection(stats, status, dmg, isMagic) {
    ensureProtectionFields(stats);
    var remaining = Math.max(0, Number(dmg) || 0);
    var poolKey = isMagic ? 'magicArmour' : 'armour';
    var poolBefore = Math.max(0, Number(stats[poolKey]) || 0);
    var absorbed = 0;
    if (poolBefore > 0 && remaining > 0) {
      absorbed = Math.min(poolBefore, remaining);
      stats[poolKey] = Math.round((poolBefore - absorbed) * 100) / 100;
      if (stats[poolKey] < 0) stats[poolKey] = 0;
      remaining = Math.round((remaining - absorbed) * 100) / 100;
    }
    var poolAfter = Math.max(0, Number(stats[poolKey]) || 0);
    var brokePool = poolBefore > 0 && poolAfter <= 0;
    var damagedHealth = remaining > 0;
    return {
      remaining: remaining,
      absorbed: absorbed,
      poolBefore: poolBefore,
      poolAfter: poolAfter,
      brokePool: brokePool,
      damagedHealth: damagedHealth,
      poolKey: poolKey,
      isMagic: !!isMagic,
    };
  }

  /**
   * Same-hit ailment gate: permitted when pool was already 0, or hit breaks pool
   * and deals at least 1 Health damage.
   */
  function ailmentApplicationAllowed(protectResult) {
    if (!protectResult) return false;
    if (protectResult.poolBefore <= 0 && protectResult.damagedHealth) return true;
    if (protectResult.brokePool && protectResult.damagedHealth) return true;
    return false;
  }

  function protectionPoolForAilment(ailmentName) {
    var name = String(ailmentName || '').toLowerCase();
    var gates = Avian.data && Avian.data.equipment && Avian.data.equipment.ailmentGates;
    if (Array.isArray(gates)) {
      for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var ail = String(g.ailment || '').toLowerCase();
        if (!ail) continue;
        if (ail.indexOf(name) >= 0 || name.indexOf(ail.split('/')[0].trim()) >= 0) {
          var pool = String(g.protectionPool || '').toLowerCase();
          if (pool.indexOf('magic') >= 0) return 'magicArmour';
          if (pool.indexOf('armour') >= 0 || pool.indexOf('armor') >= 0) return 'armour';
        }
      }
    }
    if (/bleed|physical/.test(name)) return 'armour';
    if (/burn|scorch|poison|toxic|chill|frozen|shock|paralys|magic/.test(name)) return 'magicArmour';
    return 'magicArmour';
  }

  function currentPool(stats, poolKey) {
    if (!stats) return 0;
    if (poolKey === 'magicArmour') return Math.max(0, Number(stats.magicArmour) || 0);
    return Math.max(0, Number(stats.armour) || 0);
  }

  /** Legacy Barrier API → Fortify/Ward mapping helpers. */
  function applyLegacyBarrierAsProtection(stats, status, opts) {
    opts = opts || {};
    var amount = Math.max(0, Math.floor(Number(opts.amount) || 0));
    if (amount <= 0) return 0;
    var isMagic = !!opts.isMagic || String(opts.pool || '').toLowerCase().indexOf('magic') >= 0;
    var turns = Math.max(1, Math.floor(Number(opts.turns) || 2));
    if (opts.restoreOnly) {
      return isMagic ? restoreMagicArmour(stats, amount) : restoreArmour(stats, amount);
    }
    return isMagic ? applyWard(stats, status, amount, turns) : applyFortify(stats, status, amount, turns);
  }

  ns.ensureProtectionFields = ensureProtectionFields;
  ns.initFromEquipmentRoll = initFromEquipmentRoll;
  ns.resetCombatPools = resetCombatPools;
  ns.restoreArmour = restoreArmour;
  ns.restoreMagicArmour = restoreMagicArmour;
  ns.applyFortify = applyFortify;
  ns.applyWard = applyWard;
  ns.applyBastion = applyBastion;
  ns.expireFortify = expireFortify;
  ns.expireWard = expireWard;
  ns.tickProtectionStatuses = tickProtectionStatuses;
  ns.applyDamageThroughProtection = applyDamageThroughProtection;
  ns.ailmentApplicationAllowed = ailmentApplicationAllowed;
  ns.protectionPoolForAilment = protectionPoolForAilment;
  ns.currentPool = currentPool;
  ns.applyLegacyBarrierAsProtection = applyLegacyBarrierAsProtection;
  ns.coreRules = coreRules;

  Avian.protection = ns;
  Avian.systems.protection = ns;
  globalThis.AvianProtection = ns;
})();
