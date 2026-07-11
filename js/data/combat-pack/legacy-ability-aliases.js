/* Build legacy *_F{n}_L1_BASE → combat-pack canonical ability id aliases at load time. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);

  var LEGACY_PREFIX_OVERRIDES = Object.freeze({
    peregrine: 'PEREGRINE_FALCON',
    shoebill: 'SHOEBILL_STORK',
    penguin: 'EMPEROR_PENGUIN',
    fairywren: 'SUPERB_FAIRYWREN',
    wagtail: 'WILLIE_WAGTAIL',
    pelican: 'AUSTRALIAN_PELICAN',
    goldeneagle: 'GOLDEN_EAGLE',
    baldeagle: 'BALD_EAGLE',
    blackcockatoo: 'BLACK_COCKATOO',
    bushturkey: 'BUSH_TURKEY',
    secretary: 'SECRETARY_BIRD',
    rockpigeon: 'ROCK_PIGEON',
    rockdove: 'ROCK_DOVE',
    barnowl: 'BARN_OWL',
    dukeblakiston: 'DUKE_BLAKISTON',
    harpy: 'HARPY_EAGLE',
    marabou: 'MARABOU_STORK',
  });

  function legacyPrefixForBirdKey(birdKey) {
    var key = String(birdKey || '').toLowerCase();
    if (LEGACY_PREFIX_OVERRIDES[key]) return LEGACY_PREFIX_OVERRIDES[key];
    return String(birdKey || '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  function buildLegacyAbilityAliases(families, existing) {
    var out = Object.assign({}, existing || {});
    if (!families || typeof families !== 'object') return out;
    var byBirdSlot = Object.create(null);
    for (var famId in families) {
      var fam = families[famId];
      if (!fam || !fam.birdKey) continue;
      var slot = fam.abilitySlot != null ? fam.abilitySlot : fam.starterSlot;
      if (slot == null || slot < 0) continue;
      var slotKey = String(fam.birdKey).toLowerCase() + '|' + slot;
      var prev = byBirdSlot[slotKey];
      if (prev && prev.kind === 'starter' && fam.kind !== 'starter') continue;
      byBirdSlot[slotKey] = fam;
    }
    for (var sk in byBirdSlot) {
      var famEntry = byBirdSlot[sk];
      var slotIdx = famEntry.abilitySlot != null ? famEntry.abilitySlot : famEntry.starterSlot;
      var canon = (famEntry.mutations && famEntry.mutations['1']) || (famEntry.id + '_S1');
      var prefix = legacyPrefixForBirdKey(famEntry.birdKey);
      var legacyAbilityId = prefix + '_F' + (Number(slotIdx) + 1) + '_L1_BASE';
      if (!out[legacyAbilityId]) out[legacyAbilityId] = canon;
      var legacyFamilyId = prefix + '_F' + (Number(slotIdx) + 1);
      if (!out[legacyFamilyId]) out[legacyFamilyId] = famEntry.id;
    }
    return out;
  }

  var pack = Avian.data.combatPack;
  var baseAliases = pack.abilityAliases || Object.create(null);
  var legacy = buildLegacyAbilityAliases(pack.families, baseAliases);
  pack.legacyAbilityAliases = Object.freeze(legacy);
  pack.abilityAliases = Object.freeze(Object.assign({}, baseAliases, legacy));
  globalThis.ABILITY_ID_ALIASES = pack.abilityAliases;

  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.buildLegacyAbilityAliases = buildLegacyAbilityAliases;
  Avian.systems.legacyPrefixForBirdKey = legacyPrefixForBirdKey;
})();
