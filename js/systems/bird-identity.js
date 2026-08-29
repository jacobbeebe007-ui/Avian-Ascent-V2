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

  function canonicalBirdKey(key) {
    var raw = String(key || '');
    if (!raw) return raw;
    var packs = [
      Avian.data && Avian.data.birdsV2,
      Avian.data && Avian.data.combatPack && Avian.data.combatPack.birdPassives,
      Avian.data && Avian.data.combatPack && Avian.data.combatPack.innateUtilities,
      globalThis.BIRDS,
    ];
    var lower = raw.toLowerCase();
    for (var p = 0; p < packs.length; p++) {
      var pack = packs[p];
      if (!pack) continue;
      if (pack[raw]) return raw;
      if (pack[lower]) return lower;
      for (var k in pack) {
        if (Object.prototype.hasOwnProperty.call(pack, k) && String(k).toLowerCase() === lower) return k;
      }
    }
    return raw;
  }

  Avian.canonicalBirdKey = canonicalBirdKey;

  Avian.getBirdV2 = function getBirdV2(key) {
    var pack = Avian.data && Avian.data.birdsV2;
    if (!pack) return null;
    var canon = canonicalBirdKey(key);
    return pack[canon] || pack[key] || null;
  };

  Avian.getClassV2 = function getClassV2(classId) {
    var id = normalizeClassId(classId);
    var pack = Avian.data && Avian.data.combatPack;
    return (pack && pack.classes && pack.classes[id]) || null;
  };

  Avian.getBirdPassiveV2 = function getBirdPassiveV2(key) {
    var pack = Avian.data && Avian.data.combatPack;
    var table = pack && pack.birdPassives;
    if (!table) return null;
    var canon = canonicalBirdKey(key);
    return table[canon] || table[key] || null;
  };

  Avian.getInnateUtility = function getInnateUtility(key) {
    var pack = Avian.data && Avian.data.combatPack;
    var table = pack && pack.innateUtilities;
    if (!table) return null;
    var canon = canonicalBirdKey(key);
    return table[canon] || table[key] || null;
  };

  Avian.getBirdDef = function getBirdDef(key) {
    var v2 = Avian.getBirdV2(key);
    if (v2) return v2;
    return (globalThis.BIRDS && globalThis.BIRDS[key]) || null;
  };

  Avian.enforceClassMinAcc = function enforceClassMinAcc(stats) {
    /* Bird Precision System: Base Precision is species-authored; class minAcc floors stay retired. */
    return stats;
  };

  Avian.hasBossOverride = function hasBossOverride(birdKey) {
    var v2 = Avian.getBirdV2(birdKey);
    return !!(v2 && v2.bossOverride);
  };

  Avian.buildCombatStatsFromBirdDef = function buildCombatStatsFromBirdDef(birdDef) {
    if (!birdDef || !birdDef.stats) return null;
    var stats = Object.assign({}, birdDef.stats);
    if (birdDef.stats.critChance != null && stats.critChance == null) {
      stats.critChance = birdDef.stats.critChance;
    }
    if (birdDef.vitality != null && stats.vitality == null) stats.vitality = birdDef.vitality;
    if (birdDef.baseHealth != null) stats.baseHealth = birdDef.baseHealth;
    return stats;
  };

  Avian.applyBirdV2IdentityToEntry = function applyBirdV2IdentityToEntry(birdKey, bird) {
    if (!bird) return bird;
    var v2 = Avian.getBirdV2(birdKey);
    if (!v2) return bird;

    if (v2.stats) bird.stats = Object.assign({}, v2.stats);
    if (v2.baseHealth != null) bird.baseHealth = v2.baseHealth;
    if (v2.vitality != null) {
      bird.vitality = v2.vitality;
      if (bird.stats) bird.stats.vitality = v2.vitality;
    }
    if (v2.aspect) bird.aspect = v2.aspect;
    if (v2.class) bird.class = v2.class;
    if (v2.realSize) bird.realSize = v2.realSize;
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
