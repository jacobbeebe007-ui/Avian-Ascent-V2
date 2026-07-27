/* Bird progression pipeline — v0.9 weapon-first
 * Order: Base attrs + Level flat + Star flat → ROUND(× Tier) → Equipment flat → temp flat.
 * Leveled Base Health = Base Health + (level - 1) × (Base Health × 0.5).
 * Max HP = Leveled Base Health × (1 + Final Vitality × 0.05).
 * Dodge = min(50%, Final Agility × 0.5%).
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

  /**
   * Species Base Health scaled by bird level.
   * Each level after 1 adds half the original Base Health (e.g. BH 8 → L2 = 12).
   */
  function baseHealthAtLevel(baseHealth, level) {
    var cfg = combatConfig();
    var per = (cfg.weaponFirst && cfg.weaponFirst.baseHealthPerLevelPct != null)
      ? Number(cfg.weaponFirst.baseHealthPerLevelPct) : 0.5;
    var bh = Math.max(0, Number(baseHealth) || 0);
    var lvl = Math.max(1, Math.floor(Number(level) || 1));
    if (!(per > 0) || lvl <= 1) return bh;
    return bh + (lvl - 1) * (bh * per);
  }

  function vitalityToMaxHp(baseHealth, vitality) {
    var cfg = combatConfig();
    var pct = (cfg.weaponFirst && cfg.weaponFirst.vitalityBaseHealthPct != null)
      ? Number(cfg.weaponFirst.vitalityBaseHealthPct) : 0.05;
    var bh = Math.max(0, Number(baseHealth) || 0);
    var vit = Number(vitality) || 0;
    return Math.max(1, Math.round(bh * (1 + vit * pct)));
  }

  function agilityToDodge(agility) {
    var cfg = combatConfig();
    var per = (cfg.weaponFirst && cfg.weaponFirst.agilityDodgePctPerPoint != null)
      ? Number(cfg.weaponFirst.agilityDodgePctPerPoint) : 0.5;
    var cap = (cfg.weaponFirst && cfg.weaponFirst.dodgeCapPct != null)
      ? Number(cfg.weaponFirst.dodgeCapPct)
      : ((cfg.evasion && cfg.evasion.totalCapPct != null) ? Number(cfg.evasion.totalCapPct) : 50);
    return Math.min(cap, Math.max(0, (Number(agility) || 0) * per));
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
    var maxHp = vitalityToMaxHp(leveledBaseHealth, finalStats.vitality);
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
    if (out.hp != null) out.hp = Math.round(out.hp * vit);
    if (out.maxHp != null) out.maxHp = Math.round(out.maxHp * vit);
    if (out.vitality != null) out.vitality = Math.round(out.vitality * vit);
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
    ledgerMap: LEDGER,
    statKeys: STAT_KEYS,
  };
  Avian.systems.birdProgression = Avian.birdProgression;
})();
