/* Bird progression pipeline — Combat Workbook v2.1
 * Order: Base attrs + Level flat + Star flat → ROUND(× Tier) → Equipment flat → temp flat.
 * Max HP = Size Base Health + Final Vitality × 5 + 5 × (Level − 1).
 * Dodge = min(50%, Final Agility × 0.5%).            (+1 Agility = +0.5% Evasion)
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  var STAT_KEYS = ['vitality', 'might', 'dexterity', 'guard', 'focus', 'resolve', 'agility'];
  var LEDGER = {
    vitality: 'vitality',
    might: 'atk',
    dexterity: 'dex',
    guard: 'def',
    focus: 'matk',
    resolve: 'mdef',
    agility: 'spd',
  };

  function progData() {
    return (Avian.data && Avian.data.progression) || {};
  }

  function combatConfig() {
    return (Avian.data && Avian.data.combatConfig) || {};
  }

  function normalizeClass(cls) {
    var c = String(cls || 'rogue').toLowerCase().replace(/[^a-z]/g, '');
    if (c === 'dukeblakiston') return 'duke';
    return c || 'rogue';
  }

  function normalizeTier(tier) {
    var t = String(tier || 'grey').toLowerCase();
    if (t === 'grand' || t === 'epic') return 'gold';
    if (t === 'legendary') return 'orange';
    return t;
  }

  function lookupLevelFlat(className, level) {
    var table = progData().levelGrowth || {};
    var lvl = Math.max(1, Math.min(30, Math.floor(Number(level) || 1)));
    var titled = {
      knight: 'Knight', rogue: 'Rogue', mage: 'Mage', siren: 'Siren',
      inquisitor: 'Inquisitor', bard: 'Bard', brute: 'Brute', duke: 'Duke',
    };
    var cls = normalizeClass(className);
    var key = (titled[cls] || 'Rogue') + '|' + lvl;
    return table[key] || null;
  }

  function lookupStarFlat(className, totalStars) {
    var table = progData().starGrowth || {};
    var stars = Math.max(0, Math.min(30, Math.floor(Number(totalStars) || 0)));
    var titled = {
      knight: 'Knight', rogue: 'Rogue', mage: 'Mage', siren: 'Siren',
      inquisitor: 'Inquisitor', bard: 'Bard', brute: 'Brute', duke: 'Duke',
    };
    var cls = normalizeClass(className);
    var key = (titled[cls] || 'Rogue') + '|' + stars;
    return table[key] || null;
  }

  function tierMultiplier(tier) {
    var t = normalizeTier(tier);
    var rules = progData().rules || {};
    var map = rules.tierMultipliers || combatConfig().progressionTier || {};
    return Number(map[t]) || 1;
  }

  function levelHealthFlatPerLevel() {
    var cfg = combatConfig();
    if (cfg.weaponFirst && cfg.weaponFirst.levelHealthFlat != null) {
      return Number(cfg.weaponFirst.levelHealthFlat);
    }
    return 0;
  }

  /**
   * Species Base Health scaled by bird level.
   * v2.1: Size base is unchanged by level; +levelHealthFlat × (level−1) is applied in vitalityToMaxHp.
   * Legacy: Each level after 1 adds baseHealthPerLevelPct × original Base Health.
   */
  function baseHealthAtLevel(baseHealth, level) {
    var cfg = combatConfig();
    var flat = levelHealthFlatPerLevel();
    var bh = Math.max(0, Number(baseHealth) || 0);
    var lvl = Math.max(1, Math.floor(Number(level) || 1));
    /* v2.1 flat level health is applied later — return raw size base. */
    if (flat > 0) return bh;
    var per = (cfg.weaponFirst && cfg.weaponFirst.baseHealthPerLevelPct != null)
      ? Number(cfg.weaponFirst.baseHealthPerLevelPct) : 0.5;
    if (!(per > 0) || lvl <= 1) return bh;
    return bh + (lvl - 1) * (bh * per);
  }

  function vitalityMaxHpPerPoint() {
    var cfg = combatConfig();
    if (cfg.weaponFirst && cfg.weaponFirst.vitalityMaxHpPerPoint != null) {
      return Number(cfg.weaponFirst.vitalityMaxHpPerPoint);
    }
    return 5;
  }

  function dodgeCapPct() {
    var cfg = combatConfig();
    if (cfg.weaponFirst && cfg.weaponFirst.dodgeCapPct != null) {
      return Number(cfg.weaponFirst.dodgeCapPct);
    }
    if (cfg.evasion && cfg.evasion.totalCapPct != null) {
      return Number(cfg.evasion.totalCapPct);
    }
    return 50;
  }

  /**
   * @param {number} baseHealth — size base (or leveled size base for legacy)
   * @param {number} vitality
   * @param {number} [level] — when provided with v2.1 levelHealthFlat, adds 5×(level−1)
   */
  function vitalityToMaxHp(baseHealth, vitality, level) {
    var per = vitalityMaxHpPerPoint();
    var bh = Math.max(0, Number(baseHealth) || 0);
    var vit = Number(vitality) || 0;
    var flat = levelHealthFlatPerLevel();
    var lvl = Math.max(1, Math.floor(Number(level) || 1));
    var levelBonus = flat > 0 ? flat * (lvl - 1) : 0;
    return Math.max(1, Math.round(bh + vit * per + levelBonus));
  }

  function agilityToDodge(agility) {
    var cfg = combatConfig();
    var per = (cfg.weaponFirst && cfg.weaponFirst.agilityDodgePctPerPoint != null)
      ? Number(cfg.weaponFirst.agilityDodgePctPerPoint) : 0.5;
    var cap = dodgeCapPct();
    return Math.min(cap, Math.max(0, (Number(agility) || 0) * per));
  }

  function collectBonusDodge(entity) {
    var extra = 0;
    var L = entity && entity._statLedger;
    if (L) {
      extra += Number(L.fromLevel && L.fromLevel.dodge) || 0;
      extra += Number(L.fromUpgrades && L.fromUpgrades.dodge) || 0;
      extra += Number(L.fromCardTier && L.fromCardTier.dodge) || 0;
      extra += Number(L.fromEquipment && L.fromEquipment.dodge) || 0;
    }
    extra += Number(entity && entity._bonusDodge) || 0;
    if (entity && entity.stats && entity.stats._bonusDodge != null) {
      extra += Number(entity.stats._bonusDodge) || 0;
    }
    return extra;
  }

  function resolveEntityBaseHealth(entity) {
    if (!entity) return 0;
    var bh = Number(entity.baseHealth) || Number(entity._speciesBaseHealth) || 0;
    if (!(bh > 0) && entity.stats) bh = Number(entity.stats.baseHealth) || 0;
    if (!(bh > 0) && entity.birdKey && Avian.data && Avian.data.birdsV2) {
      var row = Avian.data.birdsV2[entity.birdKey];
      if (row) bh = Number(row.baseHealth) || 0;
    }
    return bh;
  }

  function resolveEntityLevel(entity) {
    if (!entity) return 1;
    var stats = entity.stats || entity;
    return Math.max(1, Math.floor(
      Number(entity.birdLevel) || Number(entity.workbookLevel)
      || Number(entity.effectiveLevel) || Number(entity.storyLevel)
      || Number(entity.level) || Number(stats && stats.birdLevel)
      || Number(stats && stats.level) || 1
    ));
  }

  /**
   * Wrap a combat entity or a bare stats bag so refreshDerivedStats can read fields.
   */
  function asEntity(entityOrStats) {
    if (!entityOrStats) return null;
    if (entityOrStats.stats) return entityOrStats;
    return {
      stats: entityOrStats,
      baseHealth: entityOrStats.baseHealth,
      _speciesBaseHealth: entityOrStats._speciesBaseHealth,
      birdLevel: entityOrStats.birdLevel || entityOrStats.level,
      birdKey: entityOrStats.birdKey,
      _statLedger: entityOrStats._statLedger,
      _bonusDodge: entityOrStats._bonusDodge,
    };
  }

  /**
   * Recompute Max Health from Vitality and Evasion from Agility.
   * Extra Dodge (feathers / gear) is preserved and added on top of derived Evasion.
   */
  function refreshDerivedStats(entityOrStats, opts) {
    opts = opts || {};
    var entity = asEntity(entityOrStats);
    if (!entity || !entity.stats) return entityOrStats;
    var stats = entity.stats;
    var refreshHp = opts.hp !== false;
    var refreshDodge = opts.dodge !== false;

    if (refreshHp) {
      var baseHealth = resolveEntityBaseHealth(entity);
      var vit = Number(stats.vitality) || 0;
      var prevMax = Math.max(1, Number(stats.maxHp) || Number(stats.hp) || 1);
      var prevHp = Math.max(0, Number(stats.hp) || prevMax);
      var nextMax = prevMax;
      if (baseHealth > 0) {
        var entLevel = resolveEntityLevel(entity);
        var leveledBh = baseHealthAtLevel(baseHealth, entLevel);
        nextMax = vitalityToMaxHp(leveledBh, vit, entLevel);
        entity.leveledBaseHealth = leveledBh;
        if (entityOrStats && entityOrStats.stats) entityOrStats.leveledBaseHealth = leveledBh;
        else if (entityOrStats) entityOrStats.leveledBaseHealth = leveledBh;
      } else if (opts.vitalityDelta) {
        nextMax = Math.max(1, prevMax + Math.round(Number(opts.vitalityDelta) * vitalityMaxHpPerPoint()));
      }
      if (nextMax !== prevMax) {
        stats.maxHp = nextMax;
        if (opts.keepCurrentHp) {
          stats.hp = Math.min(prevHp, nextMax);
        } else {
          var wasFull = prevHp >= prevMax;
          stats.hp = wasFull ? nextMax : Math.max(1, Math.min(nextMax, prevHp + (nextMax - prevMax)));
        }
      }
    }

    if (refreshDodge) {
      var cap = dodgeCapPct();
      var derived = agilityToDodge(Number(stats.spd) || 0);
      var extra = collectBonusDodge(entity);
      var current = Number(stats.dodge) || 0;
      var remainder = current - derived - extra;
      if (remainder > 0.0001) extra += remainder;
      stats.dodge = Math.min(cap, Math.max(0, derived + extra));
    }
    return entityOrStats;
  }

  /**
   * @param {object} opts
   * @param {object} opts.base — progression or ledger keys
   * @param {number} [opts.baseHealth]
   * @param {string} opts.className
   * @param {number} opts.level 1–30
   * @param {number} opts.totalStars 0–30 completed stars
   * @param {string} opts.tier grey…orange
   * @param {object} [opts.equipmentFlat]
   * @param {object} [opts.tempFlat] temporary flat ups/downs already netted, or use tempUp/tempDown flats
   * @param {object} [opts.tempUp] temporary flat ups (v0.9) — strongest-tier values as flat points
   * @param {object} [opts.tempDown]
   */
  function computeFinalStats(opts) {
    opts = opts || {};
    var baseIn = opts.base || {};
    function readBase(progKey, ledgerKey) {
      if (baseIn[progKey] != null) return Number(baseIn[progKey]) || 0;
      if (baseIn[ledgerKey] != null) return Number(baseIn[ledgerKey]) || 0;
      return 0;
    }

    var birdLevel = Math.max(1, Math.floor(Number(opts.level) || 1));
    /* Feather spends replace workbook level flats but must not zero Base Health level growth. */
    var levelForFlats = opts.skipLevelFlat ? 1 : birdLevel;
    var levelFlat = lookupLevelFlat(opts.className, levelForFlats) || {};
    var starFlat = lookupStarFlat(opts.className, opts.totalStars) || {};
    var mult = tierMultiplier(opts.tier);
    var equipFlat = opts.equipmentFlat || {};
    var tempUp = opts.tempUp || {};
    var tempDown = opts.tempDown || {};
    var cfg = combatConfig();
    var pointTiers = (cfg.effectTiers && cfg.effectTiers.points) || { minor: 4, moderate: 10, major: 20 };

    var developed = {};
    var tiered = {};
    var afterFlat = {};
    var finalStats = {};
    var ledgerOut = {};

    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      var ledger = LEDGER[k];
      var b = readBase(k, ledger);
      var lf = Number(levelFlat[k]) || Number(levelFlat[ledger]) || 0;
      var sf = Number(starFlat[k]) || Number(starFlat[ledger]) || 0;
      /* Level/star tables may still use legacy vitality→hp naming. */
      if (k === 'vitality' && !lf) lf = Number(levelFlat.hp) || 0;
      if (k === 'vitality' && !sf) sf = Number(starFlat.hp) || 0;
      if (k === 'dexterity' && !lf) lf = Number(levelFlat.dex) || 0;
      if (k === 'dexterity' && !sf) sf = Number(starFlat.dex) || 0;
      developed[k] = b + lf + sf;
      tiered[k] = Math.round(developed[k] * mult);
      var flat = 0;
      if (equipFlat[k] != null) flat += Number(equipFlat[k]) || 0;
      if (equipFlat[ledger] != null) flat += Number(equipFlat[ledger]) || 0;
      /* hpFlat on gear is Vitality in v0.9. */
      if (k === 'vitality' && equipFlat.hp != null) flat += Number(equipFlat.hp) || 0;
      afterFlat[k] = tiered[k] + flat;

      var up = 0;
      var down = 0;
      if (tempUp[k] != null) up = Math.max(up, Number(tempUp[k]) || 0);
      if (tempUp[ledger] != null) up = Math.max(up, Number(tempUp[ledger]) || 0);
      if (tempDown[k] != null) down = Math.max(down, Number(tempDown[k]) || 0);
      if (tempDown[ledger] != null) down = Math.max(down, Number(tempDown[ledger]) || 0);
      /* If callers still pass fractional % temps, treat values < 1 as unused legacy. */
      if (up > 0 && up < 1) up = 0;
      if (down > 0 && down < 1) down = 0;
      var finalVal = Math.round(afterFlat[k] + up - down);
      finalStats[k] = finalVal;
      ledgerOut[ledger] = finalVal;
    }

    var baseHealth = opts.baseHealth != null
      ? Number(opts.baseHealth)
      : (baseIn.baseHealth != null ? Number(baseIn.baseHealth) : (Number(baseIn.hp) || Number(baseIn.maxHp) || 0));
    /* If baseHealth missing, fall back to treating developed vitality path as legacy HP (should not happen in v0.9). */
    if (!(baseHealth > 0) && baseIn.maxHp != null && finalStats.vitality === readBase('vitality', 'vitality')) {
      baseHealth = Number(baseIn.maxHp) || 0;
    }
    var leveledBaseHealth = baseHealthAtLevel(baseHealth || 1, birdLevel);
    var maxHp = vitalityToMaxHp(leveledBaseHealth, finalStats.vitality, birdLevel);
    ledgerOut.maxHp = maxHp;
    ledgerOut.hp = maxHp;
    ledgerOut.dodge = agilityToDodge(finalStats.agility);
    ledgerOut.baseHealth = baseHealth;
    ledgerOut.leveledBaseHealth = leveledBaseHealth;

    return {
      developed: developed,
      tiered: tiered,
      afterEquipmentFlat: afterFlat,
      equipped: afterFlat,
      final: finalStats,
      ledger: ledgerOut,
      tierMultiplier: mult,
      pointTiers: pointTiers,
    };
  }

  function applyEnemyProfile(statsLedger, profileId) {
    var profiles = Avian.data && Avian.data.enemyScalingProfiles && Avian.data.enemyScalingProfiles.profiles;
    var p = profiles && profiles[String(profileId || 'standard').toLowerCase()];
    if (!p || !statsLedger) return statsLedger;
    var out = Object.assign({}, statsLedger);
    /* Standard has no hidden multipliers (all 1.0). Elite/Boss/story may still scale explicitly. */
    var vit = Number(p.vitalityMult) || 1;
    var off = Number(p.offenceMult) || 1;
    var def = Number(p.defenceMult) || 1;
    var agi = Number(p.agilityMult) || 1;
    if (out.vitality != null) out.vitality = Math.round(out.vitality * vit);
    /* Single HP source: recompute from leveled Base Health + scaled Vitality (do not also × maxHp). */
    var leveledBh = out.leveledBaseHealth != null
      ? Number(out.leveledBaseHealth)
      : (out.baseHealth != null ? Number(out.baseHealth) : null);
    if (leveledBh != null && leveledBh > 0 && out.vitality != null) {
      var levelHint = Number(statsLedger && statsLedger.birdLevel) || Number(statsLedger && statsLedger.level) || 1;
      var recomputed = vitalityToMaxHp(leveledBh, out.vitality, levelHint);
      out.maxHp = recomputed;
      out.hp = recomputed;
    } else {
      if (out.hp != null) out.hp = Math.round(out.hp * vit);
      if (out.maxHp != null) out.maxHp = Math.round(out.maxHp * vit);
    }
    if (out.atk != null) out.atk = Math.round(out.atk * off);
    if (out.matk != null) out.matk = Math.round(out.matk * off);
    if (out.dex != null) out.dex = Math.round(out.dex * off);
    if (out.def != null) out.def = Math.round(out.def * def);
    if (out.mdef != null) out.mdef = Math.round(out.mdef * def);
    if (out.spd != null) out.spd = Math.round(out.spd * agi);
    if (out.dodge != null) out.dodge = agilityToDodge(out.spd);
    return out;
  }

  Avian.birdProgression = {
    computeFinalStats: computeFinalStats,
    applyEnemyProfile: applyEnemyProfile,
    lookupLevelFlat: lookupLevelFlat,
    lookupStarFlat: lookupStarFlat,
    tierMultiplier: tierMultiplier,
    baseHealthAtLevel: baseHealthAtLevel,
    vitalityToMaxHp: vitalityToMaxHp,
    agilityToDodge: agilityToDodge,
    refreshDerivedStats: refreshDerivedStats,
    vitalityMaxHpPerPoint: vitalityMaxHpPerPoint,
    ledgerMap: LEDGER,
    statKeys: STAT_KEYS,
  };
  Avian.systems.birdProgression = Avian.birdProgression;
})();
