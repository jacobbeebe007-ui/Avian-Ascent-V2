/* Avian Ascent — save schema migrations.
 *
 * Adds an explicit `schemaVersion` field to the persisted save blob so
 * we can ship balance / shape changes without having to bump the
 * AVIAN_OW_KEYS.SAVE localStorage key (which silently nukes player runs).
 *
 * Add a new migration when you need to:
 *   - Rename or move a field on the save blob.
 *   - Default-fill a new field that downstream code now requires.
 *   - Drop a removed field cleanly.
 *
 * To add a migration:
 *   1. Bump SAVE_SCHEMA_VERSION to N+1.
 *   2. Push `{ from: N, to: N+1, fn: (save) => mutateAndReturn(save) }`.
 *   3. Update docs/save-versioning.md with the human-readable note.
 *
 * Migrations run in order from `save.schemaVersion ?? 0` up to the current
 * SAVE_SCHEMA_VERSION on every load. They MUST be idempotent: a save can
 * be opened, migrated, and re-saved repeatedly.
 *
 * Loaded BEFORE js/core/game.js by js/bootstrap/load-order.json so
 * `loadSaveData()` can call `globalThis.runSaveMigrations` synchronously.
 */
(function () {
  'use strict';

  /** Bump when adding a migration. */
  var TARGET = 2;

  /** @type {Array<{from:number,to:number,fn:(save:any)=>any,note?:string}>} */
  var migrations = [
    {
      from: 0,
      to: 1,
      note: 'baseline chain for saves missing schemaVersion',
      fn: function (save) {
        return save;
      },
    },
    {
      from: 1,
      to: 2,
      note: 'clear mirrored skillSlots so family-evolution catalogs rebuild on load',
      fn: function (save) {
        if (save.player && save.player.familyEvolutionState && Array.isArray(save.player.familyEvolutionState.skillSlots)) {
          delete save.player.familyEvolutionState.skillSlots;
        }
        return save;
      },
    },
  ];

  var Avian = globalThis.Avian || (globalThis.Avian = { systems: {}, debug: {} });
  if (!Avian.systems) Avian.systems = Object.create(null);

  Avian.systems.SAVE_SCHEMA_VERSION = TARGET;

  /**
   * Apply ordered migrations until the save is at the current schema version.
   * Returns the migrated save (mutated in place); returns null on failure
   * so callers can treat the save as corrupt.
   */
  Avian.systems.runSaveMigrations = function runSaveMigrations(save) {
    if (!save || typeof save !== 'object') return save;
    var v = Number(save.schemaVersion);
    if (!Number.isFinite(v) || v < 0) v = 0;
    while (v < TARGET) {
      var step = null;
      for (var i = 0; i < migrations.length; i++) {
        if (migrations[i].from === v) { step = migrations[i]; break; }
      }
      if (!step) {
        try { console.warn('[save] no migration from v' + v + ' to v' + TARGET + '; assuming forward-compatible.'); } catch (_e) {}
        v = TARGET;
        break;
      }
      try {
        var next = step.fn(save);
        save = (next && typeof next === 'object') ? next : save;
        v = step.to;
      } catch (err) {
        try { console.error('[save] migration v' + step.from + '→v' + step.to + ' failed:', err); } catch (_e) {}
        return null;
      }
    }
    save.schemaVersion = TARGET;
    return save;
  };

  /** Convenience for tests / debug: list migration steps in order. */
  Avian.systems.listSaveMigrations = function listSaveMigrations() {
    return migrations.map(function (m) { return { from: m.from, to: m.to, note: m.note || '' }; });
  };
})();
