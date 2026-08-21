/* Encounter-specific difficulty curves shared by Story and Endless combat. */
(function initEnemyEncounterBalance(global) {
  'use strict';
  var Avian = global.Avian || (global.Avian = {});
  Avian.balance = Avian.balance || Object.create(null);

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  /** Start below the player's level, then gain one level per cleared map to a modest ceiling. */
  function endlessMapLevelOffset(segmentIndex) {
    if (segmentIndex == null) return 0;
    var segment = Math.max(0, Math.floor(Number(segmentIndex) || 0));
    return clamp(segment - 2, -2, 3);
  }

  /** Role-based tuning lets bosses gain durability without gaining the same amount of burst. */
  function encounterMultipliers(opts) {
    var o = opts || {};
    var stage = Math.max(1, Math.floor(Number(o.stage) || 1));
    if (o.isStory && o.isBoss) {
      /* Stage 10 arrives before a complete build; the Duke retains more finale weight. */
      return stage < 20
        ? { hp: 0.78, offence: 0.90, defence: 0.92 }
        : { hp: 0.88, offence: 0.96, defence: 0.96 };
    }
    if (o.isEndless) {
      /* Legacy stage-based Endless has no segment; retain its neutral multiplier. */
      if (o.segmentIndex == null) return { hp: 1, offence: 1, defence: 1 };
      var segment = Math.max(0, Math.floor(Number(o.segmentIndex) || 0));
      var mapRamp = Math.min(1, 0.92 + segment * 0.02);
      if (o.isBoss) return { hp: 1.16 * mapRamp, offence: 1.06 * mapRamp, defence: 1.04 * mapRamp };
      if (o.isElite) return { hp: 1.02 * mapRamp, offence: mapRamp, defence: mapRamp };
      return { hp: mapRamp, offence: mapRamp, defence: mapRamp };
    }
    return { hp: 1, offence: 1, defence: 1 };
  }

  function applyMultipliers(stats, multipliers) {
    if (!stats) return stats;
    var m = multipliers || { hp: 1, offence: 1, defence: 1 };
    var out = Object.assign({}, stats);
    var hp = Math.max(1, Math.round(Number(out.maxHp != null ? out.maxHp : out.hp) * m.hp));
    out.hp = hp;
    out.maxHp = hp;
    if (out._progressHpMult != null) out._progressHpMult = Number(out._progressHpMult) * m.hp;
    if (out.atk != null) out.atk = Math.max(1, Math.round(Number(out.atk) * m.offence));
    if (out.matk != null) out.matk = Math.max(1, Math.round(Number(out.matk) * m.offence));
    if (out.def != null) out.def = Math.max(0, Math.round(Number(out.def) * m.defence));
    if (out.mdef != null) out.mdef = Math.max(0, Math.round(Number(out.mdef) * m.defence));
    return out;
  }

  Avian.balance.enemyEncounters = Object.freeze({
    endlessMapLevelOffset: endlessMapLevelOffset,
    encounterMultipliers: encounterMultipliers,
    applyMultipliers: applyMultipliers,
  });
})(typeof window !== 'undefined' ? window : globalThis);
