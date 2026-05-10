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

  /** Stages that grant a tier pick. Mutable for tuning. */
  var DEFAULT_PICK_STAGES = [4, 8, 14];

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

  /**
   * Default no-op renderer. Override from UI code:
   *   Avian.systems.tierPick.onPickRequested = function(stage, options) { … }
   * The override should call `Avian.systems.tierPick.commit(stage, pickId)`
   * exactly once when the modal closes.
   */
  api.onPickRequested = function defaultOnPickRequested(stage) {
    /* No UI registered → auto-skip so combat continues without a stuck
     * modal. This is also how today's balance stays untouched. */
    api.commit(stage, 'skipped');
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
