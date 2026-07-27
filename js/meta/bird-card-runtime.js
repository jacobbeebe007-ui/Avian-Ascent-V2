/* Bird card tier progression — stats at run/preview time (feather growth + v0.9 star/tier). */
(function () {
  'use strict';

  function tiers() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
  }

  function growth() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.featherGrowthProfiles;
  }

  function normalizeTier(t) {
    var pack = tiers();
    return pack && typeof pack.normalizeTier === 'function' ? pack.normalizeTier(t) : String(t || 'grey').toLowerCase();
  }

  function clampStars(stars) {
    var pack = tiers();
    return pack && typeof pack.clampStars === 'function' ? pack.clampStars(stars) : Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
  }

  function getFixedPassiveEffectText(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bd = birds[birdKey];
    if (bd && bd.passive && (bd.passive.desc || bd.passive.effect)) {
      return bd.passive.desc || bd.passive.effect;
    }
    var p = globalThis.Avian && Avian.data && Avian.data.combatPack && Avian.data.combatPack.birdPassives;
    if (p) {
      for (var id in p) {
        if (p[id].birdKey === birdKey) return p[id].effect || '';
      }
    }
    return '';
  }

  function excludedStarScalingKeys() {
    var t = tiers();
    if (t && Array.isArray(t.STAR_SCALING_EXCLUDED_STAT_KEYS)) return t.STAR_SCALING_EXCLUDED_STAT_KEYS;
    return ['acc', 'critChance', 'critMult', 'cc', 'cd'];
  }

  function scaleBirdCardStatValue(baseVal, key, birdKey, tier, stars) {
    if (excludedStarScalingKeys().indexOf(key) >= 0) {
      return Number(baseVal) || 0;
    }
    var gp = growth();
    if (!gp || typeof gp.applyFeatherGrowthToStat !== 'function') {
      return Number(baseVal) || 0;
    }
    var profile = typeof gp.getGrowthProfileForBird === 'function' ? gp.getGrowthProfileForBird(birdKey) : null;
    var totalStars = typeof gp.getTotalFeatherStars === 'function' ? gp.getTotalFeatherStars(tier, stars) : 0;
    return gp.applyFeatherGrowthToStat(baseVal, key, profile, totalStars);
  }

  function resolveBaseHealth(player, bd) {
    if (player && Number(player.baseHealth) > 0) return Number(player.baseHealth);
    if (player && Number(player._speciesBaseHealth) > 0) return Number(player._speciesBaseHealth);
    if (bd && Number(bd.baseHealth) > 0) return Number(bd.baseHealth);
    if (bd && bd.stats && Number(bd.stats.baseHealth) > 0) return Number(bd.stats.baseHealth);
    var v2 = globalThis.Avian && Avian.getBirdV2 && player && player.birdKey
      ? Avian.getBirdV2(player.birdKey)
      : (globalThis.Avian && Avian.data && Avian.data.birdsV2 && player && player.birdKey
        ? Avian.data.birdsV2[player.birdKey] : null);
    if (v2 && Number(v2.baseHealth) > 0) return Number(v2.baseHealth);
    return 0;
  }

  function applyBirdCardStats(player, tier, stars) {
    var t = tiers();
    var birds = globalThis.BIRDS || {};
    if (!player || !t || !player.birdKey) return;
    var bd = birds[player.birdKey];
    if (!bd || !bd.stats) return;

    var base = bd.stats;
    var fromCard = {};
    var scaled = {};
    var s = clampStars(stars);
    var tierNorm = normalizeTier(tier);
    var gp = growth();
    var totalStars = gp && typeof gp.getTotalFeatherStars === 'function'
      ? gp.getTotalFeatherStars(tierNorm, s) : 0;

    /* Prefer v0.9 progression star flats + tier mult when available (Vitality scales here). */
    var useProg = !!(globalThis.Avian && Avian.birdProgression
      && typeof Avian.birdProgression.computeFinalStats === 'function'
      && Avian.data && Avian.data.combatConfig
      && (Avian.data.combatConfig.weaponFirstV09 || (Avian.data.combatConfig.weaponFirst && Avian.data.combatConfig.weaponFirst.enabled)));

    if (useProg) {
      var baseHealth = resolveBaseHealth(player, bd);
      var className = bd.class || player.class || 'rogue';
      var result = Avian.birdProgression.computeFinalStats({
        base: {
          vitality: Number(base.vitality) || Number(bd.vitality) || 0,
          atk: Number(base.atk) || 0,
          dex: Number(base.dex) || 0,
          def: Number(base.def) || 0,
          matk: Number(base.matk) || 0,
          mdef: Number(base.mdef) || 0,
          spd: Number(base.spd) || 0,
          baseHealth: baseHealth,
        },
        baseHealth: baseHealth,
        className: className,
        level: 1,
        totalStars: totalStars,
        tier: tierNorm,
        equipmentFlat: {},
      });
      var ledger = result.ledger || {};
      var progKeys = ['vitality', 'atk', 'dex', 'def', 'matk', 'mdef', 'spd', 'maxHp', 'dodge'];
      progKeys.forEach(function (key) {
        if (ledger[key] == null) return;
        scaled[key] = ledger[key];
        /* Star/tier flats are applied again in reapply via totalStars — keep fromCardTier 0. */
        fromCard[key] = 0;
      });
      if (scaled.maxHp != null) scaled.hp = scaled.maxHp;
      fromCard.hp = 0;
      player.baseHealth = baseHealth;
    } else {
      t.SCALED_STAT_KEYS.forEach(function (key) {
        if (base[key] == null && key !== 'vitality') return;
        var baseVal = key === 'vitality'
          ? (Number(base.vitality) || Number(bd.vitality) || 0)
          : Number(base[key]);
        if (base[key] == null && key !== 'vitality') return;
        var val = scaleBirdCardStatValue(baseVal, key, player.birdKey, tierNorm, s);
        scaled[key] = val;
        fromCard[key] = val - (Number(baseVal) || 0);
      });

      excludedStarScalingKeys().forEach(function (key) {
        if (base[key] == null) return;
        scaled[key] = Number(base[key]) || 0;
        fromCard[key] = 0;
      });

      /* Derive Max HP from scaled Vitality when possible. */
      var bh = resolveBaseHealth(player, bd);
      if (bh > 0 && scaled.vitality != null && typeof Avian !== 'undefined'
        && Avian.birdProgression && typeof Avian.birdProgression.vitalityToMaxHp === 'function') {
        var derivedHp = Avian.birdProgression.vitalityToMaxHp(bh, scaled.vitality);
        var baseHp = Number(base.maxHp) || Number(base.hp) || 0;
        scaled.maxHp = derivedHp;
        scaled.hp = derivedHp;
        fromCard.maxHp = derivedHp - baseHp;
        fromCard.hp = fromCard.maxHp;
        player.baseHealth = bh;
      }
    }

    Object.keys(scaled).forEach(function (key) {
      player.stats[key] = scaled[key];
    });
    if (player.stats.maxHp != null) {
      player.stats.hp = Math.max(1, Number(player.stats.maxHp) || 1);
    }

    if (typeof globalThis.ensureStatLedger === 'function') {
      var L = globalThis.ensureStatLedger(player);
      if (L) {
        L.birdBaseline = L.birdBaseline || {};
        if (!Object.keys(L.birdBaseline).length && typeof globalThis.cloneStatLedgerSlice === 'function') {
          L.birdBaseline = globalThis.cloneStatLedgerSlice(base);
          if (L.birdBaseline.vitality == null && base.vitality != null) {
            L.birdBaseline.vitality = Number(base.vitality) || 0;
          }
        }
        L.fromCardTier = fromCard;
      }
    }
  }

  function applyBirdCardAbilities(_player, _tier) {
    /* Tier-based ability unlocks removed — redesigned separately. */
  }

  function applyBirdCardProgression(player) {
    if (!player || !player.birdKey) return player;
    var tier =
      typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(player.birdKey) : 'grey';
    var stars =
      typeof globalThis.getBirdCardStars === 'function' ? globalThis.getBirdCardStars(player.birdKey) : 0;
    tier = normalizeTier(tier);
    stars = clampStars(stars);
    player._birdCardTier = tier;
    player._birdCardStars = stars;
    var gp = growth();
    var totalStars = gp && typeof gp.getTotalFeatherStars === 'function'
      ? gp.getTotalFeatherStars(tier, stars) : 0;
    /* Feed v0.9 progression pipeline (star flats + tier mult). */
    player.totalStars = totalStars;
    player.cardStars = stars;
    player.progressionTier = tier;
    player.cardTier = tier;
    if (!player.stats) return player;
    applyBirdCardStats(player, tier, stars);
    return player;
  }

  function getTierAbilityUnlockSummary(_birdKey, _tier) {
    return [];
  }

  var pack = {
    applyBirdCardProgression: applyBirdCardProgression,
    applyBirdCardStats: applyBirdCardStats,
    getFixedPassiveEffectText: getFixedPassiveEffectText,
    getTierAbilityUnlockSummary: getTierAbilityUnlockSummary,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.meta = Avian.meta || Object.create(null);
  Avian.meta.birdCardRuntime = pack;

  globalThis.applyBirdCardProgression = applyBirdCardProgression;
  globalThis.applyBirdCardStats = applyBirdCardStats;
  globalThis.getFixedPassiveEffectText = getFixedPassiveEffectText;
  globalThis.getTierAbilityUnlockSummary = getTierAbilityUnlockSummary;
})();
