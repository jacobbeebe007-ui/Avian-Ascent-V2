/* Avian Ascent — Phase 10 class-perk deck (B.4).
 *
 * At run start, surface up to `handsize` class perks for the active
 * bird's class and let the player pick `picksAllowed`. Picks are
 * applied via the existing `grantClassPerk` path so all downstream
 * effect code (passives, combat ctx, save migration) keeps working
 * without changes elsewhere.
 *
 * Default shipping behavior:
 *   - `draw()` pulls eligible perks from CLASS_PERK_BY_CLASS via
 *     `getAvailableClassPerksForBird` (full perk objects).
 *   - `onPickRequested(hand)` renders a modal directly into the DOM
 *     so the player can pick `picksAllowed`. The modal uses
 *     data-action handlers wired from inside this file.
 *   - `commit(picks)` calls `grantClassPerk(...,'class-perk-deck')` so
 *     the existing perk effect code applies the picks.
 *
 * Skipping is allowed; commit([]) just resolves the deck pending flag.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, flags: {}, actions: {} });
  Avian.systems = Avian.systems || Object.create(null);
  Avian.actions = Avian.actions || Object.create(null);

  var api = Avian.systems.classPerks = Object.create(null);
  api.handsize = 4;
  api.picksAllowed = 2;

  /**
   * Returns up to `handsize` perk objects (`{id,name,desc}`) drawn
   * from the active class's perk pool. Skips perks the bird already
   * owns. Returns [] when no draw is appropriate.
   */
  api.draw = function draw() {
    var G = globalThis.G;
    if (!G || !G.player) return [];
    var birdKey = String(G.player.birdKey || '');
    if (!birdKey) return [];
    var pool = [];
    if (typeof globalThis.getAvailableClassPerksForBird === 'function') {
      try { pool = globalThis.getAvailableClassPerksForBird(birdKey) || []; }
      catch (_e) { pool = []; }
    }
    if (!pool.length) return [];
    /* Lightweight shuffle. Uses Math.random; replays may diverge from
     * a stamped seed, which is OK — deck draws are run-prefix only. */
    var arr = pool.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr.slice(0, api.handsize);
  };

  /** Returns true when the active run still owes the player a deck pick. */
  api.isPending = function isPending() {
    var G = globalThis.G;
    if (!G || !G.player) return false;
    if (G.player._classPerkDeckResolved) return false;
    /* Skip endless mode — class perk decks are story-mode only.
     * Endless still uses the legacy stage-30 perk grant path. */
    if (G.endlessMode) return false;
    /* Skip if the player already has any class perks for this bird
     * (legacy save data, or a manual perk grant fired earlier in the
     * boot sequence). */
    if (typeof globalThis.getBirdClassPerks === 'function') {
      try {
        var owned = globalThis.getBirdClassPerks(G.player.birdKey) || [];
        if (owned.length > 0) return false;
      } catch (_e) { /* defensive */ }
    }
    return true;
  };

  /**
   * Lock in the player's choice. `pickedIds` is an array of perk ids
   * (length up to api.picksAllowed). Calls grantClassPerk for each
   * via the existing perk pipeline. Idempotent within a run.
   */
  api.commit = function commit(pickedIds) {
    var G = globalThis.G;
    if (!G || !G.player) return false;
    if (G.player._classPerkDeckResolved) return true;
    var picks = Array.isArray(pickedIds) ? pickedIds.slice(0, api.picksAllowed) : [];
    var birdKey = String(G.player.birdKey || '');
    var grantFn = globalThis.grantClassPerk;
    var pool = [];
    try {
      pool = (typeof globalThis.getAvailableClassPerksForBird === 'function')
        ? (globalThis.getAvailableClassPerksForBird(birdKey) || [])
        : [];
    } catch (_e) { pool = []; }
    if (typeof grantFn === 'function') {
      picks.forEach(function (perkId) {
        if (!perkId) return;
        var def = pool.find(function (p) { return p && p.id === perkId; });
        if (def) {
          try { grantFn(birdKey, def, 'class-perk-deck'); }
          catch (err) { try { console.warn('[classPerksDeck] grantClassPerk', err); } catch (_e) {} }
        }
      });
    } else {
      /* Fall back to the previous shape if the grant path isn't ready. */
      G.runClassPerks = G.runClassPerks || [];
      picks.forEach(function (perkId) {
        if (!perkId) return;
        G.runClassPerks.push({ birdKey: birdKey, classPerkId: perkId, source: 'class-perk-deck' });
      });
    }
    G.player._classPerkDeckResolved = true;
    G.player._classPerkDeckPicks = picks.slice();
    try { closeModal(); } catch (_e) {}
    try {
      if (typeof globalThis.refreshBattleUI === 'function') globalThis.refreshBattleUI();
    } catch (_e) {}
    try { console.info('[classPerksDeck] commit', picks); } catch (_e) {}
    return true;
  };

  /* ---------- Modal renderer ----------------------------------- */

  var MODAL_ID = 'class-perks-deck-modal';

  function ensureModalHost() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Class Perks Deck');
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9000',
      'background:rgba(8,6,4,.78)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:20px',
    ].join(';');
    document.body.appendChild(modal);
    return modal;
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
  }

  api.onPickRequested = function defaultOnPickRequested(hand) {
    if (!Array.isArray(hand) || !hand.length) {
      api.commit([]);
      return;
    }
    if (typeof document === 'undefined' || !document.body) {
      api.commit([]);
      return;
    }
    var modal = ensureModalHost();
    modal.innerHTML = '';
    var inner = document.createElement('div');
    inner.style.cssText = [
      'background:rgba(20,15,8,.96)',
      'border:1px solid var(--gold)',
      'border-radius:14px',
      'max-width:720px', 'width:100%',
      'padding:18px 22px',
      'box-shadow:0 8px 30px rgba(0,0,0,.5)',
      'color:var(--text)',
      'font-family:Cinzel,serif',
    ].join(';');
    var title = document.createElement('div');
    title.style.cssText = 'font-size:1.05rem;color:var(--gold);letter-spacing:.08em;text-align:center;margin-bottom:6px;';
    title.textContent = 'CLASS PERKS — choose ' + api.picksAllowed;
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:.78rem;color:var(--text-dim);text-align:center;margin-bottom:14px;font-family:inherit;';
    sub.textContent = 'Select up to ' + api.picksAllowed + ' perks for this run. Skip to start with no class perks.';
    inner.appendChild(title);
    inner.appendChild(sub);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px;';
    inner.appendChild(grid);

    var picked = Object.create(null);
    var confirmBtn;

    function refreshButtons() {
      var count = Object.keys(picked).length;
      Array.prototype.forEach.call(grid.querySelectorAll('button[data-perk-id]'), function (b) {
        var pid = b.getAttribute('data-perk-id');
        var on = !!picked[pid];
        b.style.background = on ? 'rgba(201,168,76,.22)' : 'rgba(40,35,25,.6)';
        b.style.borderColor = on ? 'var(--gold)' : 'rgba(201,168,76,.35)';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        var disabled = !on && count >= api.picksAllowed;
        b.disabled = disabled;
        b.style.opacity = disabled ? '.5' : '1';
        b.style.cursor = disabled ? 'not-allowed' : 'pointer';
      });
      if (confirmBtn) {
        confirmBtn.disabled = count <= 0;
        confirmBtn.style.opacity = count > 0 ? '1' : '.6';
        confirmBtn.textContent = count > 0
          ? '✓ Lock In (' + count + '/' + api.picksAllowed + ')'
          : 'Skip';
      }
    }

    hand.forEach(function (perk) {
      if (!perk || !perk.id) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-perk-id', perk.id);
      btn.style.cssText = [
        'border:1px solid rgba(201,168,76,.35)',
        'border-radius:10px',
        'padding:10px 12px',
        'background:rgba(40,35,25,.6)',
        'text-align:left',
        'font-family:inherit',
        'color:var(--text)',
        'cursor:pointer',
      ].join(';');
      var name = document.createElement('div');
      name.style.cssText = 'font-size:.92rem;color:var(--gold-light);margin-bottom:4px;';
      name.textContent = perk.name || perk.id;
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:.75rem;color:var(--text-dim);line-height:1.35;font-family:Inter,system-ui,sans-serif;';
      desc.textContent = perk.desc || '';
      btn.appendChild(name);
      btn.appendChild(desc);
      btn.addEventListener('click', function () {
        if (picked[perk.id]) delete picked[perk.id];
        else if (Object.keys(picked).length < api.picksAllowed) picked[perk.id] = true;
        refreshButtons();
      });
      grid.appendChild(btn);
    });

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:center;gap:10px;';
    confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'start-btn';
    confirmBtn.style.cssText = 'padding:8px 18px;font-size:.85rem;cursor:pointer;';
    confirmBtn.textContent = 'Skip';
    confirmBtn.addEventListener('click', function () {
      api.commit(Object.keys(picked));
    });
    actions.appendChild(confirmBtn);
    inner.appendChild(actions);
    modal.appendChild(inner);
    refreshButtons();
  };

  /** Public hook — invoked from systems.js startGame wrapper. */
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
