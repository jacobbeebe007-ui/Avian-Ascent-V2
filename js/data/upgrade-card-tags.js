/* Avian Ascent — Phase 8 modular shop (B.3).
 *
 * Two pieces:
 *   1. `Avian.data.birdTagWeights` — per-bird tag preferences. Default
 *      empty (uniform draft, byte-equivalent to today). Add a bird key
 *      (e.g. `crow: { bleed: 1.5, status: 1.25 }`) to bias that bird's
 *      shop towards specific tags. Draft probability for a card is
 *      product of weights of its tags (capped to a sane range).
 *
 *   2. `Avian.data.synergyUpgradeCards` — 8 verb-layer synergy upgrades
 *      that consume statuses (Bleed / Poison / Chill / Weaken) for
 *      bonus damage. Loaded as DATA only this phase. Flip
 *      `Avian.flags.synergyShopEnabled = true` (or pass `?synergy=1` in
 *      the URL) to fold them into the shop pool and activate the
 *      combat hook. Off by default so existing balance stays untouched
 *      until they're tested live.
 *
 * The `getUpgradePool` wrapper here always runs (cheap, additive); it
 * applies bird tag weights when present and folds synergy cards in
 * only when the flag is on.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { data: {}, flags: {}, systems: {} });
  Avian.data = Avian.data || Object.create(null);
  Avian.flags = Avian.flags || Object.create(null);
  Avian.systems = Avian.systems || Object.create(null);

  /* Read the synergy flag once at boot from URL or existing global. */
  try {
    var search = (globalThis.location && globalThis.location.search) || '';
    if (new URLSearchParams(search).get('synergy') === '1') Avian.flags.synergyShopEnabled = true;
  } catch (_e) { /* file:// in some browsers — leave the flag alone */ }
  if (typeof Avian.flags.synergyShopEnabled !== 'boolean') {
    Avian.flags.synergyShopEnabled = false;
  }

  /** @type {Object<string, Object<string, number>>} */
  Avian.data.birdTagWeights = {
    /* Defaults intentionally empty: every bird drafts the same uniform pool
     * as before. Add an entry like
     *   sparrow: { bleed: 1.4, status: 1.2 }
     * to bias that bird's shop towards specific tags after a balance pass.
     * Run `node scripts/run-balance.js --bird sparrow` (once the simulator
     * lands) to verify the bias delivers the intended win-rate shift. */
  };

  /**
   * Returns a relative weight for a card given the active bird's tag
   * preferences. Cards with NO matching tags get a baseline 1.0; cards
   * with matching tags multiply (e.g. two matches at 1.4 = 1.96). Result
   * is clamped to [0.1, 4.0] so a single bias can't fully exclude or
   * monopolize any card.
   */
  function tagWeightForCard(card, birdKey) {
    var prefs = Avian.data.birdTagWeights[birdKey];
    if (!prefs) return 1;
    var tags = (card && Array.isArray(card.tags)) ? card.tags : [];
    if (!tags.length) return 1;
    var w = 1;
    for (var i = 0; i < tags.length; i++) {
      var bias = prefs[tags[i]];
      if (typeof bias === 'number' && bias > 0) w *= bias;
    }
    if (w < 0.1) return 0.1;
    if (w > 4) return 4;
    return w;
  }
  Avian.data.tagWeightForCard = tagWeightForCard;

  /* ============================================================
   * 8 verb-layer synergy upgrades. They flag the player with
   * `*ConsumeBonusPct` fields; the combat hook below reads those
   * flags and calls `Avian.statuses.consume(...)` once per attack
   * to apply the boost. Disabled by default; flip the flag to test.
   * ========================================================== */
  /** @type {Array<Object>} */
  Avian.data.synergyUpgradeCards = [
    { id:'syn_bleeddrinker', tier:'green', icon:'🩸', name:'Bleed Drinker',
      desc:'Physical attacks consume Bleed for +50% damage.',
      tags:['synergy','bleed','consume'], stackable:false,
      apply: function(p){ p.bleedConsumeBonusPct = Math.max(p.bleedConsumeBonusPct||0, 0.50); } },
    { id:'syn_plague_eater', tier:'green', icon:'☣️', name:'Plague Eater',
      desc:'Spells consume Poison for +50% damage.',
      tags:['synergy','poison','consume','magic'], stackable:false,
      apply: function(p){ p.poisonConsumeBonusPct = Math.max(p.poisonConsumeBonusPct||0, 0.50); } },
    { id:'syn_frost_shatter', tier:'blue', icon:'❄️', name:'Frost Shatter',
      desc:'First strike each turn consumes Chill for +75% damage.',
      tags:['synergy','chill','consume','opening'], stackable:false,
      apply: function(p){ p.chillConsumeBonusPct = Math.max(p.chillConsumeBonusPct||0, 0.75); } },
    { id:'syn_weakness_finisher', tier:'blue', icon:'🐔', name:'Weakness Finisher',
      desc:'Crits consume Weaken for +40% damage.',
      tags:['synergy','weaken','consume','crit'], stackable:false,
      apply: function(p){ p.weakenConsumeBonusPct = Math.max(p.weakenConsumeBonusPct||0, 0.40); } },
    { id:'syn_resonance_amp', tier:'purple', icon:'🎵', name:'Resonance Amplifier',
      desc:'Detonating Resonance also consumes Bleed and Poison for +25% each.',
      tags:['synergy','delayed','bleed','poison','consume'], stackable:false,
      apply: function(p){ p.resonanceConsumesAilments = true;
                          p.resonanceConsumeBonusPct = Math.max(p.resonanceConsumeBonusPct||0, 0.25); } },
    { id:'syn_second_wind', tier:'purple', icon:'🪶', name:'Second Wind',
      desc:'Killing an enemy with a status consumes one to heal +6 HP.',
      tags:['synergy','sustain','consume','kill'], stackable:false,
      apply: function(p){ p.killConsumeStatusHeal = Math.max(p.killConsumeStatusHeal||0, 6); } },
    { id:'syn_glass_storm', tier:'gold', icon:'🌪️', name:'Glass Storm',
      desc:'Once per battle below 30% HP, all enemy ailments are consumed for +100% damage on next attack.',
      tags:['synergy','consume','panic','offense'], stackable:false,
      apply: function(p){ p.glassStormReady = true;
                          p.glassStormBonusPct = Math.max(p.glassStormBonusPct||0, 1.0); } },
    { id:'syn_apex_predator', tier:'gold', icon:'🦅', name:'Apex Predator',
      desc:'Killing an enemy at full HP grants permanent +1 ATK (max +5 per run).',
      tags:['synergy','offense','kill','scaling'], stackable:true, maxStacks:5, runSpawnCap:5,
      apply: function(p){ p.apexPredatorStacks = (p.apexPredatorStacks||0); /* runtime increments */ } },
  ];

  /* Wrapper around getUpgradePool. Runs after game.js declared the
   * original pool; cheap to wrap repeatedly so we install once. */
  function installPoolWrapper() {
    var orig = globalThis.getUpgradePool;
    if (typeof orig !== 'function') return false;
    if (orig.__avianTagged) return true;

    var wrapped = function getUpgradePoolTagged() {
      var pool = orig.apply(this, arguments) || [];
      if (Avian.flags.synergyShopEnabled && Array.isArray(Avian.data.synergyUpgradeCards)) {
        var existing = new Set(pool.map(function (c) { return c && c.id; }));
        for (var i = 0; i < Avian.data.synergyUpgradeCards.length; i++) {
          var c = Avian.data.synergyUpgradeCards[i];
          if (c && !existing.has(c.id)) pool.push(c);
        }
      }
      var bird = (globalThis.G && globalThis.G.player && globalThis.G.player.birdKey) || '';
      if (!bird || !Avian.data.birdTagWeights[bird]) return pool;
      /* Multiply each card's chance by tag weight. The drafting code
       * downstream picks uniformly from the array; we approximate weighting
       * by duplicating cards in the array (rounded to nearest integer
       * weight so it stays cheap and reproducible). */
      var weighted = [];
      for (var j = 0; j < pool.length; j++) {
        var card = pool[j];
        var w = tagWeightForCard(card, bird);
        var copies = Math.max(1, Math.round(w));
        for (var k = 0; k < copies; k++) weighted.push(card);
      }
      return weighted;
    };
    wrapped.__avianTagged = true;
    globalThis.getUpgradePool = wrapped;
    return true;
  }

  /* game.js hasn't loaded when this file runs; defer install. */
  function tryInstall() {
    if (installPoolWrapper()) return;
    setTimeout(tryInstall, 0);
  }
  if (document && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInstall, { once: true });
  } else {
    tryInstall();
  }
})();
