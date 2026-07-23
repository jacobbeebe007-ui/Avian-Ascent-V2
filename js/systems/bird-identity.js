/* v0.3 bird identity helpers — stats, passives, utilities, class refs (equipment). */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});

  var LEGACY_CLASS_MAP = Object.freeze({
    striker: 'rogue', singer: 'mage', predator: 'inquisitor', trickster: 'bard',
    tank: 'knight', bruiser: 'brute',
  });

  function normalizeClassId(classId) {
    var id = String(classId || '').toLowerCase().split(/\s+/)[0];
    return LEGACY_CLASS_MAP[id] || id;
  }

  Avian.getBirdV2 = function getBirdV2(key) {
    return (Avian.data && Avian.data.birdsV2 && Avian.data.birdsV2[key]) || null;
  };

  Avian.getClassV2 = function getClassV2(classId) {
    var id = normalizeClassId(classId);
    var pack = Avian.data && Avian.data.combatPack;
    return (pack && pack.classes && pack.classes[id]) || null;
  };

  Avian.getBirdPassiveV2 = function getBirdPassiveV2(key) {
    var pack = Avian.data && Avian.data.combatPack;
    return (pack && pack.birdPassives && pack.birdPassives[key]) || null;
  };

  Avian.getInnateUtility = function getInnateUtility(key) {
    var pack = Avian.data && Avian.data.combatPack;
    return (pack && pack.innateUtilities && pack.innateUtilities[key]) || null;
  };

  Avian.getBirdDef = function getBirdDef(key) {
    var v2 = Avian.getBirdV2(key);
    if (v2) return v2;
    return (globalThis.BIRDS && globalThis.BIRDS[key]) || null;
  };

  Avian.enforceClassMinAcc = function enforceClassMinAcc(stats, classId) {
    if (!stats) return stats;
    var cls = Avian.getClassV2(classId);
    if (!cls) return stats;
    var minAcc = Number(cls.minAcc) || 0;
    if (minAcc > 0 && (Number(stats.acc) || 0) < minAcc) stats.acc = minAcc;
    return stats;
  };

  Avian.hasBossOverride = function hasBossOverride(birdKey) {
    var v2 = Avian.getBirdV2(birdKey);
    return !!(v2 && v2.bossOverride);
  };

  Avian.buildCombatStatsFromBirdDef = function buildCombatStatsFromBirdDef(birdDef, classId) {
    if (!birdDef || !birdDef.stats) return null;
    var stats = Object.assign({}, birdDef.stats);
    if (birdDef.stats.critChance != null && stats.critChance == null) {
      stats.critChance = birdDef.stats.critChance;
    }
    Avian.enforceClassMinAcc(stats, classId || birdDef.class);
    return stats;
  };

  Avian.applyBirdV2IdentityToEntry = function applyBirdV2IdentityToEntry(birdKey, bird) {
    if (!bird) return bird;
    var v2 = Avian.getBirdV2(birdKey);
    if (!v2) return bird;

    if (v2.stats) bird.stats = Object.assign({}, v2.stats);
    if (v2.aspect) bird.aspect = v2.aspect;
    if (v2.class) bird.class = v2.class;
    if (v2.critDamage != null) bird.critDamage = v2.critDamage;
    if (v2.bossOverride) bird.bossOverride = true;

    Avian.enforceClassMinAcc(bird.stats, v2.class);

    var passiveV2 = Avian.getBirdPassiveV2(birdKey);
    if (passiveV2) {
      bird.passive = {
        id: birdKey + '_passive',
        name: passiveV2.name,
        desc: passiveV2.effect || '',
        trigger: passiveV2.triggerLimit || '',
      };
    }

    var clsV2 = Avian.getClassV2(v2.class);
    if (clsV2) {
      bird.classPerk = clsV2.classPerk;
      bird.classPerkEffect = clsV2.classPerkEffect;
    }

    var util = Avian.getInnateUtility(birdKey);
    if (util) {
      bird.innateUtilityId = birdKey;
      bird.innateUtilityName = util.name;
    }

    return bird;
  };

  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.birdIdentity = {
    normalizeClassId: normalizeClassId,
  };
})();
