/* Avian Ascent — Phase 9 mid-run tier picks (B.1).
 *
 * Detects when the player crosses a tier-pick stage (default 4 / 8 / 14)
 * and exposes the pick to the UI layer via `Avian.systems.tierPick.*`.
 *
 * Why detection-only this commit:
 *   The actual UI modal needs to mirror the existing skill-slot UI in
 *   js/core/game.js. Keeping detection separate from rendering means
 *   the trigger logic can land + ship green builds today, and the modal
 *   UI is a focused follow-up (touches game.js render code).
 *
 * To actually surface the modal, a future commit registers:
 *   Avian.systems.tierPick.onPickRequested = function(stage) { … render modal … }
 * The modal calls Avian.systems.tierPick.commit(stage, pickId) to lock in
 * the choice. Without a renderer, picks auto-skip after one tick (so
 * existing balance is unchanged).
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, flags: {} });
  Avian.systems = Avian.systems || Object.create(null);
  Avian.flags = Avian.flags || Object.create(null);

  /** Stages that grant a tier pick. Empty — ability evolution is feather-driven only. */
  var DEFAULT_PICK_STAGES = [];

  var api = Avian.systems.tierPick = Object.create(null);
  api.pickStages = DEFAULT_PICK_STAGES.slice();

  /**
   * Returns true if `stage` should grant a tier pick AND it has not been
   * granted to the active player run yet.
   */
  api.isStageDue = function isStageDue(stage) {
    if (api.pickStages.indexOf(stage) < 0) return false;
    var G = globalThis.G;
    if (!G || !G.player) return false;
    var made = (G.player._tierPicksMade && G.player._tierPicksMade[stage]) || null;
    return !made;
  };

  /**
   * Returns the candidate pick options for the active bird's family tree
   * at the given stage. Empty array if no tree data is available.
   * @returns {Array<{ id:string, label:string, ability?:string }>}
   */
  api.optionsForStage = function optionsForStage(stage) {
    var G = globalThis.G;
    if (!G || !G.player) return [];
    var birdKey = String(G.player.birdKey || '');
    var tree = globalThis.AVIAN_FAMILY_TREE || (globalThis.module && globalThis.module.exports);
    if (!tree || !tree.birds) return [];
    var entry = tree.birds[birdKey];
    if (!entry || !entry.families) return [];
    var tierIndex = stage === 4 ? 1 : stage === 8 ? 2 : stage === 14 ? 3 : -1;
    if (tierIndex < 0) return [];
    var out = [];
    var fams = entry.families;
    Object.keys(fams).forEach(function (fk) {
      var fam = fams[fk] || {};
      var paths = fam.paths || {};
      Object.keys(paths).forEach(function (pk) {
        var path = paths[pk] || {};
        var abs = path.abilities || {};
        var abilityId = abs[String(tierIndex)] || abs[tierIndex];
        if (abilityId) {
          out.push({
            id: fam.familyId + ':' + path.pathId + ':' + tierIndex,
            label: (path.name || path.pathId) + ' tier ' + tierIndex,
            ability: abilityId,
          });
        }
      });
    });
    return out;
  };

  /**
   * Records the player's pick for the given stage. Called by the modal
   * UI when the player confirms a choice. Idempotent.
   */
  api.commit = function commit(stage, pickId) {
    var G = globalThis.G;
    if (!G || !G.player) return false;
    G.player._tierPicksMade = G.player._tierPicksMade || Object.create(null);
    G.player._tierPicksMade[stage] = pickId || 'skipped';
    try { console.info('[tierPick] commit stage=' + stage + ' pick=' + pickId); } catch (_e) {}
    return true;
  };

  /* ---------- Modal renderer --------------------------------- */

  var MODAL_ID = 'tier-pick-modal';

  function ensureHost() {
    var existing = document.getElementById(MODAL_ID);
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Tier Pick');
    modal.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9100',
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

  function abilityName(id) {
    if (!id) return '';
    var tpls = globalThis.ABILITY_TEMPLATES || {};
    var entry = tpls[id];
    return (entry && entry.name) || id;
  }

  function abilityDesc(id) {
    if (!id) return '';
    var tpls = globalThis.ABILITY_TEMPLATES || {};
    var entry = tpls[id];
    if (!entry) return '';
    if (typeof entry.description === 'string' && entry.description) return entry.description;
    if (Array.isArray(entry.levels) && entry.levels[0] && entry.levels[0].desc) {
      return entry.levels[0].desc;
    }
    return '';
  }

  /**
   * Default modal renderer. Renders the available paths for the
   * incoming tier-pick stage and lets the player commit one (or skip).
   * Override from UI code if you need a different look:
   *   Avian.systems.tierPick.onPickRequested = function(stage, options) { … }
   * The override should call `Avian.systems.tierPick.commit(stage, pickId)`
   * exactly once when the modal closes.
   */
  api.onPickRequested = function defaultOnPickRequested(stage, options) {
    if (!Array.isArray(options) || !options.length) {
      api.commit(stage, 'no-options');
      return;
    }
    if (typeof document === 'undefined' || !document.body) {
      api.commit(stage, 'skipped');
      return;
    }
    var modal = ensureHost();
    modal.innerHTML = '';
    var inner = document.createElement('div');
    inner.style.cssText = [
      'background:rgba(20,15,8,.96)',
      'border:1px solid var(--gold)',
      'border-radius:14px',
      'max-width:760px', 'width:100%',
      'padding:18px 22px',
      'box-shadow:0 8px 30px rgba(0,0,0,.5)',
      'color:var(--text)',
      'font-family:Cinzel,serif',
    ].join(';');
    var title = document.createElement('div');
    title.style.cssText = 'font-size:1.05rem;color:var(--gold);letter-spacing:.08em;text-align:center;margin-bottom:6px;';
    title.textContent = 'TIER PICK — Stage ' + stage;
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:.78rem;color:var(--text-dim);text-align:center;margin-bottom:14px;font-family:Inter,system-ui,sans-serif;';
    sub.textContent = 'Choose a family path to evolve. Skip to keep your current loadout.';
    inner.appendChild(title);
    inner.appendChild(sub);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px;';
    inner.appendChild(grid);

    options.forEach(function (opt) {
      if (!opt || !opt.id) return;
      var btn = document.createElement('button');
      btn.type = 'button';
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
      name.style.cssText = 'font-size:.9rem;color:var(--gold-light);margin-bottom:3px;';
      name.textContent = opt.label || opt.id;
      var ab = document.createElement('div');
      ab.style.cssText = 'font-size:.78rem;color:var(--text);margin-bottom:4px;';
      ab.textContent = abilityName(opt.ability);
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:.72rem;color:var(--text-dim);line-height:1.35;font-family:Inter,system-ui,sans-serif;';
      desc.textContent = abilityDesc(opt.ability);
      btn.appendChild(name);
      btn.appendChild(ab);
      btn.appendChild(desc);
      btn.addEventListener('click', function () {
        try { api.commit(stage, opt.id); }
        finally { closeModal(); }
      });
      grid.appendChild(btn);
    });

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:center;gap:10px;';
    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'nest-btn';
    skipBtn.style.cssText = 'padding:8px 18px;font-size:.85rem;cursor:pointer;background:rgba(40,35,25,.6);border:1px solid rgba(201,168,76,.4);color:var(--text-dim);border-radius:8px;';
    skipBtn.textContent = 'Skip Tier Pick';
    skipBtn.addEventListener('click', function () {
      try { api.commit(stage, 'skipped'); }
      finally { closeModal(); }
    });
    actions.appendChild(skipBtn);
    inner.appendChild(actions);
    modal.appendChild(inner);
  };

  /** Inspect the trigger state (for debug tooltips / tests). */
  api.inspect = function inspect() {
    var G = globalThis.G;
    return {
      pickStages: api.pickStages.slice(),
      currentStage: G && G.stage ? G.stage : null,
      picksMade: (G && G.player && G.player._tierPicksMade) ? Object.assign({}, G.player._tierPicksMade) : {},
    };
  };

  /**
   * Public hook for the stage-change wrapper installed in
   * js/systems/systems.js. Calling this with the new stage runs the
   * pick flow (no-op when not due / no options available).
   */
  api.maybeOpen = function maybeOpen(stage) {
    if (!api.isStageDue(stage)) return false;
    var options = api.optionsForStage(stage);
    if (!options.length) {
      api.commit(stage, 'no-options');
      return false;
    }
    if (typeof api.onPickRequested === 'function') {
      try { api.onPickRequested(stage, options); }
      catch (err) { try { console.warn('[tierPick] onPickRequested', err); } catch (_e) {} }
    }
    return true;
  };
})();
