/* Avian Ascent — Phase 12 quality-of-life (rest of B.6).
 *
 * Three small, mostly orthogonal additions:
 *   1. Replay seeds. `Avian.systems.replaySeed.start()` stamps a seed
 *      on every new run so dev / community can compare runs precisely.
 *      Surfaced as a string the player can copy.
 *   2. Personal-best tracking. After each finished run, write best
 *      stage / time per bird to localStorage; expose diff vs current
 *      attempt for run-summary UI to render.
 *   3. Action queue preview API. Returns the upcoming player + enemy
 *      action pair so the battle UI can render the next-row preview
 *      whenever it wants to (UI work deferred — data is live).
 *
 * All three default to passive (no behavior change). Each can be wired
 * into UI in a follow-up without touching this file.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, flags: {} });
  Avian.systems = Avian.systems || Object.create(null);
  Avian.flags = Avian.flags || Object.create(null);

  /* ---------- 1. Replay seeds -------------------------------------- */

  var seedApi = Avian.systems.replaySeed = Object.create(null);
  var PB_KEY = 'avianAscent_personal_bests';
  var SEED_KEY = 'avianAscent_last_seed';

  function generateSeed() {
    /* 32-bit hex, prefixed with the bundle hash so seeds embed the
     * code version for cross-version replay safety. */
    var bundleHash = (typeof globalThis.__AVIAN_BUNDLE_HASH__ === 'string')
      ? globalThis.__AVIAN_BUNDLE_HASH__
      : 'unknown';
    var rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
    return bundleHash + '-' + rand;
  }

  /** Stamp a seed on the active run. Idempotent. */
  seedApi.start = function start(initialSeed) {
    var G = globalThis.G;
    if (!G) return null;
    if (G.runSeed) return G.runSeed;
    var seed = (typeof initialSeed === 'string' && initialSeed.length) ? initialSeed : generateSeed();
    G.runSeed = seed;
    try { localStorage.setItem(SEED_KEY, seed); } catch (_e) {}
    return seed;
  };

  seedApi.current = function current() {
    var G = globalThis.G;
    return (G && G.runSeed) || null;
  };

  /** "Share run code" — returns a copy-able string for clipboard. */
  seedApi.shareString = function shareString() {
    var G = globalThis.G;
    if (!G || !G.runSeed) return '';
    var birdKey = (G.player && G.player.birdKey) || 'unknown-bird';
    var stage = typeof G.stage === 'number' ? G.stage : 0;
    var mode = G.endlessMode ? 'endless' : 'story';
    return 'avian:' + mode + ':' + birdKey + ':stage' + stage + ':' + G.runSeed;
  };

  seedApi.parseShareString = function parseShareString(s) {
    if (typeof s !== 'string' || s.indexOf('avian:') !== 0) return null;
    var parts = s.split(':');
    if (parts.length < 5) return null;
    return {
      mode: parts[1],
      bird: parts[2],
      stage: parseInt(String(parts[3]).replace(/^stage/i, ''), 10) || 0,
      seed: parts.slice(4).join(':'),
    };
  };

  /* ---------- 2. Personal-best tracking ---------------------------- */

  var pbApi = Avian.systems.personalBest = Object.create(null);

  function readPbBlob() {
    try {
      var raw = localStorage.getItem(PB_KEY);
      if (!raw) return Object.create(null);
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : Object.create(null);
    } catch (_e) { return Object.create(null); }
  }

  function writePbBlob(blob) {
    try { localStorage.setItem(PB_KEY, JSON.stringify(blob)); } catch (_e) {}
  }

  /** Read PB record for a bird. Returns null if none. */
  pbApi.get = function get(birdKey) {
    var blob = readPbBlob();
    return blob[String(birdKey)] || null;
  };

  /**
   * Record a finished run. Returns a diff object { isPersonalBest, deltaStages, deltaSeconds }
   * relative to the previous PB (zeroed when there isn't one).
   */
  pbApi.record = function record(birdKey, stagesCleared, durationSec) {
    var key = String(birdKey || '');
    if (!key) return null;
    var blob = readPbBlob();
    var prev = blob[key] || null;
    var stages = Math.max(0, Math.floor(Number(stagesCleared) || 0));
    var dur = Math.max(0, Math.floor(Number(durationSec) || 0));
    var isBest = !prev || stages > prev.stages || (stages === prev.stages && dur < prev.durationSec);
    var diff = {
      isPersonalBest: isBest,
      deltaStages: prev ? (stages - prev.stages) : stages,
      deltaSeconds: prev ? (dur - prev.durationSec) : 0,
      previous: prev,
    };
    if (isBest) {
      blob[key] = { stages: stages, durationSec: dur, recordedAt: Date.now() };
      writePbBlob(blob);
    }
    return diff;
  };

  /* ---------- 3. Action queue preview ------------------------------ */

  var queueApi = Avian.systems.actionQueue = Object.create(null);

  /** Returns { player: {…}, enemy: {…} } — the next intended actions. */
  queueApi.preview = function preview() {
    var G = globalThis.G;
    if (!G) return { player: null, enemy: null };
    /* Player: read the currently selected ability from the action grid
     * (battle UI flags it on G.player._queuedAbilityId when implemented).
     * Enemy: G.enemyNextAction is already populated by combat code. */
    var playerAbId = G.player && G.player._queuedAbilityId;
    var ability = null;
    if (playerAbId && Array.isArray(G.player.abilities)) {
      ability = G.player.abilities.find(function (a) { return a && a.id === playerAbId; }) || null;
    }
    return {
      player: ability ? { id: ability.id, name: ability.name || ability.id } : null,
      enemy: G.enemyNextAction
        ? { id: G.enemyNextAction.id || null, name: G.enemyNextAction.name || G.enemyNextAction.id || null }
        : null,
      stage: G.stage,
      turn: G.turn,
    };
  };

  /* Auto-stamp a seed when startGame fires. Hook from systems.js so
   * the wrapper sequence stays consistent with other Phase X triggers.
   * Also records a run-start timestamp on G so the personalBest UI can
   * compute duration without altering runHistory. */
  Avian.systems._qolStartGameHook = function _qolStartGameHook() {
    seedApi.start();
    var G = globalThis.G;
    if (G && typeof G._qolRunStartedAt !== 'number') {
      G._qolRunStartedAt = Date.now();
    }
  };

  /** Returns elapsed seconds since the current run started, or null. */
  pbApi.runDurationSec = function runDurationSec() {
    var G = globalThis.G;
    if (!G || typeof G._qolRunStartedAt !== 'number') return null;
    return Math.max(0, Math.floor((Date.now() - G._qolRunStartedAt) / 1000));
  };

  /** Format a seconds count as `Hh Mm Ss` for compact UI. */
  pbApi.formatDuration = function formatDuration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  };
})();
