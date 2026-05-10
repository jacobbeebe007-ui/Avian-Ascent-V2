/* Avian Ascent — Phase 10 class-perk deck (B.4).
 *
 * At run start, surface 4 class perks for the active bird's class and
 * let the player pick 2. Picks land in the existing `G.runClassPerks`
 * array so the existing class-perk effect code (untouched) applies them
 * automatically — no behavior fork.
 *
 * Detection-only this commit: `onPickRequested` defaults to a no-op
 * skip so existing balance is unchanged. UI override pattern mirrors
 * Avian.systems.tierPick (see docs/class-perks-deck.md).
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, flags: {} });
  Avian.systems = Avian.systems || Object.create(null);

  var api = Avian.systems.classPerks = Object.create(null);
  api.handsize = 4;
  api.picksAllowed = 2;

  /** Returns 4 perk ids drawn from the active class's perk pool. */
  api.draw = function draw() {
    var G = globalThis.G;
    if (!G || !G.player) return [];
    var birdKey = String(G.player.birdKey || '');
    var BIRDS = globalThis.BIRDS || {};
    var bird = BIRDS[birdKey];
    var birdClass = (bird && bird.class) || '';
    /* Existing class perk pool (kept simple — pluck any registered ids
     * for this class from `Avian.data.classPerkPool` if present, else
     * fall back to the bird's `defaultClassPerks` list). */
    var pool = (Avian.data && Avian.data.classPerkPool && Avian.data.classPerkPool[birdClass]) || [];
    if (!pool.length && bird && Array.isArray(bird.defaultClassPerks)) pool = bird.defaultClassPerks.slice();
    if (!pool.length) return [];
    /* Deterministic-ish selection: shuffle by a seed derived from
     * birdKey + Date.now so reroll behaves like other run randomness. */
    var seed = (Date.now() % 100000) ^ birdKey.length;
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      var j = Math.floor((seed / 233280) * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.slice(0, api.handsize);
  };

  /** Returns true when the active run still owes the player a deck pick. */
  api.isPending = function isPending() {
    var G = globalThis.G;
    if (!G || !G.player) return false;
    if (G.player._classPerkDeckResolved) return false;
    /* Skip endless mode — class perk decks are story-mode only. */
    return !G.endlessMode;
  };

  /**
   * Lock in the player's choice. `pickedIds` should be an array of perk
   * ids (length up to api.picksAllowed). Pushes them onto G.runClassPerks
   * so existing perk effect code applies them. Idempotent within a run.
   */
  api.commit = function commit(pickedIds) {
    var G = globalThis.G;
    if (!G || !G.player) return false;
    if (G.player._classPerkDeckResolved) return true;
    var picks = Array.isArray(pickedIds) ? pickedIds.slice(0, api.picksAllowed) : [];
    G.runClassPerks = G.runClassPerks || [];
    var birdKey = String(G.player.birdKey || '');
    picks.forEach(function (perkId) {
      if (!perkId) return;
      G.runClassPerks.push({
        birdKey: birdKey,
        classPerkId: perkId,
        source: 'class-perk-deck',
      });
    });
    G.player._classPerkDeckResolved = true;
    G.player._classPerkDeckPicks = picks.slice();
    try { console.info('[classPerksDeck] commit', picks); } catch (_e) {}
    return true;
  };

  /** Default no-op renderer (keeps current balance untouched). */
  api.onPickRequested = function defaultOnPickRequested() {
    api.commit([]);
  };

  /** Public hook from systems.js stage / run-start wrapper. */
  api.maybeOpen = function maybeOpen() {
    if (!api.isPending()) return false;
    var hand = api.draw();
    if (!hand.length) {
      api.commit([]);
      return false;
    }
    if (typeof api.onPickRequested === 'function') {
      try { api.onPickRequested(hand); }
      catch (err) { try { console.warn('[classPerksDeck] onPickRequested', err); } catch (_e) {} }
    }
    return true;
  };

  api.inspect = function inspect() {
    var G = globalThis.G;
    return {
      handsize: api.handsize,
      picksAllowed: api.picksAllowed,
      pending: api.isPending(),
      picks: (G && G.player && G.player._classPerkDeckPicks) || [],
    };
  };
})();
