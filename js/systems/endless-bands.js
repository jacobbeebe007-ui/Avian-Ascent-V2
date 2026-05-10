/* Avian Ascent — Phase 11 endless counter-tag bands (B.5).
 *
 * Tracks the player's dominant *acquired* tag (across upgrades from
 * Phase 8 tagging) over a sliding window. Every 3-5 endless stages,
 * picks the counter-tag and biases the next enemy roll towards a band
 * matching that counter. Anti-snowball, not anti-fun: only fires in
 * endless mode, only every few stages, default off.
 *
 * Detection-only this commit:
 *   - Tag tracking is wired (cheap, additive).
 *   - The encounter-injection hook is exposed via
 *     Avian.systems.endlessBands.suggest(stage). Wiring it into the
 *     story-mode `chooseNextEnemy` lives behind the
 *     `Avian.flags.endlessBandsEnabled` flag (default false) so today's
 *     endless balance is unchanged.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, flags: {} });
  Avian.systems = Avian.systems || Object.create(null);
  Avian.flags = Avian.flags || Object.create(null);
  if (typeof Avian.flags.endlessBandsEnabled !== 'boolean') {
    Avian.flags.endlessBandsEnabled = false;
  }

  var api = Avian.systems.endlessBands = Object.create(null);
  api.windowSize = 6;             // count tags from the last N picks
  api.injectEvery = [3, 4, 5];    // randomized cadence to avoid metagame muscle memory
  /**
   * Counter-tag map. The KEY is the dominant tag; the VALUE is the tag
   * that the next enemy band should boast. Pulled from
   * docs/endless-tag-set-and-kits.md (kept in sync manually for now).
   */
  api.counterMap = {
    bleed:    'armored',
    poison:   'cleanser',
    chill:    'fireborn',
    crit:     'evader',
    accuracy: 'phaser',
    defense:  'piercer',
    hp:       'executioner',
    spd:      'lockdown',
    dodge:    'tracker',
    magic:    'spellbreaker',
    physical: 'reflective',
  };

  /** Records that a tagged upgrade was acquired. Called from shop apply. */
  api.recordTagPick = function recordTagPick(tags) {
    var G = globalThis.G;
    if (!G) return;
    G._endlessTagWindow = G._endlessTagWindow || [];
    if (Array.isArray(tags)) {
      tags.forEach(function (t) { if (t) G._endlessTagWindow.push(String(t)); });
    } else if (typeof tags === 'string' && tags) {
      G._endlessTagWindow.push(tags);
    }
    /* Trim to the last `windowSize * 4` entries — each pick can have
     * multiple tags so we keep a generous tail. */
    var max = api.windowSize * 6;
    if (G._endlessTagWindow.length > max) {
      G._endlessTagWindow = G._endlessTagWindow.slice(-max);
    }
  };

  /** Returns the player's dominant tag over the window, or null. */
  api.dominantTag = function dominantTag() {
    var G = globalThis.G;
    var arr = (G && G._endlessTagWindow) || [];
    if (!arr.length) return null;
    var counts = Object.create(null);
    var best = null;
    var bestCount = 0;
    for (var i = arr.length - 1, n = 0; i >= 0 && n < api.windowSize * 6; i--, n++) {
      var t = arr[i];
      counts[t] = (counts[t] || 0) + 1;
      if (counts[t] > bestCount) { bestCount = counts[t]; best = t; }
    }
    return best;
  };

  /**
   * Returns the suggested counter-tag for the next enemy band, or null
   * if no bias is appropriate. Stable for the same stage within a run.
   */
  api.suggest = function suggest(stage) {
    var G = globalThis.G;
    if (!Avian.flags.endlessBandsEnabled) return null;
    if (!G || !G.endlessMode) return null;
    if (typeof stage !== 'number' || stage < 1) return null;
    /* Cadence: only fire on stages where (stage - lastFire) hits one of
     * the injectEvery values. Stored on G to survive saves. */
    G._endlessBandLastStage = G._endlessBandLastStage || 0;
    var since = stage - G._endlessBandLastStage;
    if (api.injectEvery.indexOf(since) < 0) return null;
    var dom = api.dominantTag();
    if (!dom) return null;
    var counter = api.counterMap[dom];
    if (!counter) return null;
    G._endlessBandLastStage = stage;
    G._endlessBandHistory = G._endlessBandHistory || [];
    G._endlessBandHistory.push({ stage: stage, dominant: dom, counter: counter });
    return counter;
  };

  api.inspect = function inspect() {
    var G = globalThis.G;
    return {
      enabled: Avian.flags.endlessBandsEnabled,
      windowSize: api.windowSize,
      injectEvery: api.injectEvery.slice(),
      dominant: api.dominantTag(),
      lastInjectStage: (G && G._endlessBandLastStage) || 0,
      history: ((G && G._endlessBandHistory) || []).slice(-10),
    };
  };
})();
