/* Avian Ascent — runtime namespace bootstrap.
 *
 * Loaded as the FIRST entry in js/bootstrap/load-order.json so every later
 * file can opt into a single curated surface (`globalThis.Avian`) instead of
 * adding more ad-hoc `globalThis.foo = foo` lines.
 *
 * Three contracts:
 *   1. `Avian.actions.register(name, fn)` — routable from
 *      `data-action="name"` (Phase 2) and reachable via `Avian.run('name')`.
 *   2. `Avian.statuses.register(id, hooks)` — verb-style status hooks
 *      (Phase 7).
 *   3. `Avian.debug.safe(label, fn, fallback)` — replacement for silent
 *      `try{}catch(_){}`. In `?debug=1` mode it rethrows; otherwise it
 *      logs a warning and returns `fallback`.
 *
 * The classic shell continues to declare top-level `function foo()` so
 * existing inline `onclick="foo()"` keeps resolving on `window`. The
 * namespace is additive — never wrap the bundle in an IIFE.
 */
(function () {
  'use strict';

  if (globalThis.Avian && typeof globalThis.Avian === 'object') return;

  const Avian = {
    version: 1,
    actions: Object.create(null),
    ui: Object.create(null),
    data: Object.create(null),
    systems: Object.create(null),
    statuses: Object.create(null),
    debug: Object.create(null),
  };

  let debugFlag = false;
  try {
    const search = (globalThis.location && globalThis.location.search) || '';
    debugFlag = new URLSearchParams(search).get('debug') === '1';
  } catch (_e) {
    /* file:// in some browsers throws on URLSearchParams of an empty query */
  }
  Avian.debug.enabled = debugFlag;

  Avian.debug.safe = function safe(label, fn, fallback) {
    if (typeof fn !== 'function') return fallback;
    try {
      return fn();
    } catch (err) {
      if (Avian.debug.enabled) throw err;
      try {
        console.warn('[Avian] safe(' + label + ')', err);
      } catch (_e) {
        /* console missing in some embed contexts */
      }
      return fallback;
    }
  };

  Avian.actions.register = function register(name, fn) {
    if (typeof name !== 'string' || !name) return;
    if (typeof fn !== 'function') return;
    Avian.actions[name] = fn;
  };

  Avian.run = function run(name) {
    const fn = Avian.actions[name];
    const args = Array.prototype.slice.call(arguments, 1);
    if (typeof fn === 'function') {
      return Avian.debug.safe('action:' + name, function () {
        return fn.apply(null, args);
      });
    }
    if (Avian.debug.enabled) {
      console.warn('[Avian] action not registered:', name);
    }
    return undefined;
  };

  Avian.statuses.register = function registerStatus(id, hooks) {
    if (typeof id !== 'string' || !id) return;
    if (!hooks || typeof hooks !== 'object') return;
    Avian.statuses[id] = Object.assign({ id: id }, hooks);
  };

  globalThis.Avian = Avian;
})();
