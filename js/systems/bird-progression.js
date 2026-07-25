/* Bird progression pipeline — R-PROG-005
 * Order: Base + Level flat + Star flat → ROUND(× Tier) → Equipment % → temp.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  var STAT_KEYS = ['vitality', 'might', 'guard', 'focus', 'resolve', 'agility'];
  var LEDGER = {
    vitality: 'hp',
    might: 'atk',
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
    var cls = normalizeClass(className);
    var lvl = Math.max(1, Math.min(30, Math.floor(Number(level) || 1)));
    var key = cls.charAt(0).toUpperCase() + cls.slice(1) + '|' + lvl;
    /* Tables use Title Case class names. */
    var titled = {
      knight: 'Knight', rogue: 'Rogue', mage: 'Mage', siren: 'Siren',
      inquisitor: 'Inquisitor', bard: 'Bard', brute: 'Brute', duke: 'Duke',
    };
    key = (titled[cls] || 'Rogue') + '|' + lvl;
    return table[key] || null;
  }

  function lookupStarFlat(className, totalStars) {
    var table = progData().starGrowth || {};
    var cls = normalizeClass(className);
    var stars = Math.max(0, Math.min(30, Math.floor(Number(totalStars) || 0)));
    var titled = {
      knight: 'Knight', rogue: 'Rogue', mage: 'Mage', siren: 'Siren',
      inquisitor: 'Inquisitor', bard: 'Bard', brute: 'Brute', duke: 'Duke',
    };
    var key = (titled[cls] || 'Rogue') + '|' + stars;
    return table[key] || null;
  }

  function tierMultiplier(tier) {
    var t = normalizeTier(tier);
    var rules = progData().rules || {};
    var map = rules.tierMultipliers || combatConfig().progressionTier || {};
    return Number(map[t]) || 1;
  }

  function equipmentCapFor(statKey) {
    var caps = (progData().rules && progData().rules.equipmentCaps)
      || combatConfig().equipmentCaps
      || {};
    if (statKey === 'vitality') return Number(caps.vitalityPct) || 0.6;
    if (statKey === 'agility') return Number(caps.agilityPct) || 0.3;
    return Number(caps.corePct) || 0.5;
  }

  /**
   * @param {object} opts
   * @param {object} opts.base — {vitality,might,guard,focus,resolve,agility} or ledger keys
   * @param {string} opts.className
   * @param {number} opts.level 1–30
   * @param {number} opts.totalStars 0–30 completed stars
   * @param {string} opts.tier grey…orange
   * @param {object} [opts.equipmentFlat] flat equipment after tier (ledger or progression keys)
   * @param {object} [opts.equipmentPct] additive % by ledger or progression key
   * @param {object} [opts.tempUp] temporary % ups
   * @param {object} [opts.tempDown] temporary % downs
   */
  function computeFinalStats(opts) {
    opts = opts || {};
    var baseIn = opts.base || {};
    function readBase(progKey, ledgerKey) {
      if (baseIn[progKey] != null) return Number(baseIn[progKey]) || 0;
      if (baseIn[ledgerKey] != null) return Number(baseIn[ledgerKey]) || 0;
      if (ledgerKey === 'hp' && baseIn.maxHp != null) return Number(baseIn.maxHp) || 0;
      return 0;
    }

    var levelFlat = lookupLevelFlat(opts.className, opts.level) || {};
    var starFlat = lookupStarFlat(opts.className, opts.totalStars) || {};
    var mult = tierMultiplier(opts.tier);
    var equipFlat = opts.equipmentFlat || {};
    var equipPct = opts.equipmentPct || {};
    var tempUp = opts.tempUp || {};
    var tempDown = opts.tempDown || {};
    var cfg = combatConfig();
    var coreTempCap = ((cfg.effectTiers && cfg.effectTiers.coreTempCapPct) || 20) / 100;

    var developed = {};
    var tiered = {};
    var afterFlat = {};
    var equipped = {};
    var finalStats = {};
    var ledgerOut = {};

    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      var ledger = LEDGER[k];
      var b = readBase(k, ledger);
      var lf = Number(levelFlat[k]) || 0;
      var sf = Number(starFlat[k]) || 0;
      developed[k] = b + lf + sf;
      /* R-PROG-005 / R-RND-001: round after tier, then add equipment flat, then % , round again. */
      tiered[k] = Math.round(developed[k] * mult);
      var flat = 0;
      if (equipFlat[k] != null) flat += Number(equipFlat[k]) || 0;
      if (equipFlat[ledger] != null) flat += Number(equipFlat[ledger]) || 0;
      afterFlat[k] = tiered[k] + flat;

      var pct = 0;
      if (equipPct[k] != null) pct += Number(equipPct[k]) || 0;
      if (equipPct[ledger] != null) pct += Number(equipPct[ledger]) || 0;
      var cap = equipmentCapFor(k);
      pct = Math.max(-cap, Math.min(cap, pct));
      equipped[k] = afterFlat[k] * (1 + pct);

      var up = 0;
      var down = 0;
      if (tempUp[k] != null) up = Math.max(up, Number(tempUp[k]) || 0);
      if (tempUp[ledger] != null) up = Math.max(up, Number(tempUp[ledger]) || 0);
      if (tempDown[k] != null) down = Math.max(down, Number(tempDown[k]) || 0);
      if (tempDown[ledger] != null) down = Math.max(down, Number(tempDown[ledger]) || 0);
      up = Math.min(coreTempCap, up);
      down = Math.min(coreTempCap, down);
      var finalVal = Math.round(equipped[k] * (1 + up - down));
      finalStats[k] = finalVal;
      ledgerOut[ledger] = finalVal;
    }

    ledgerOut.maxHp = ledgerOut.hp;
    return {
      developed: developed,
      tiered: tiered,
      afterEquipmentFlat: afterFlat,
      equipped: equipped,
      final: finalStats,
      ledger: ledgerOut,
      tierMultiplier: mult,
    };
  }

  function applyEnemyProfile(statsLedger, profileId) {
    var profiles = Avian.data && Avian.data.enemyScalingProfiles && Avian.data.enemyScalingProfiles.profiles;
    var p = profiles && profiles[String(profileId || 'standard').toLowerCase()];
    if (!p || !statsLedger) return statsLedger;
    var out = Object.assign({}, statsLedger);
    var vit = Number(p.vitalityMult) || 1;
    var off = Number(p.offenceMult) || 1;
    var def = Number(p.defenceMult) || 1;
    var agi = Number(p.agilityMult) || 1;
    if (out.hp != null) out.hp = Math.round(out.hp * vit);
    if (out.maxHp != null) out.maxHp = Math.round(out.maxHp * vit);
    if (out.atk != null) out.atk = Math.round(out.atk * off);
    if (out.matk != null) out.matk = Math.round(out.matk * off);
    if (out.def != null) out.def = Math.round(out.def * def);
    if (out.mdef != null) out.mdef = Math.round(out.mdef * def);
    if (out.spd != null) out.spd = Math.round(out.spd * agi);
    return out;
  }

  Avian.birdProgression = {
    computeFinalStats: computeFinalStats,
    applyEnemyProfile: applyEnemyProfile,
    lookupLevelFlat: lookupLevelFlat,
    lookupStarFlat: lookupStarFlat,
    tierMultiplier: tierMultiplier,
    ledgerMap: LEDGER,
  };
  Avian.systems.birdProgression = Avian.birdProgression;
})();
