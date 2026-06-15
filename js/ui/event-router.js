/* Avian Ascent — global event router.
 *
 * Replaces inline `onclick="foo()"` / `onchange="bar(this.value)"` attributes in
 * index.html with `data-action="foo"` / `data-change="bar"`. One delegated
 * listener per event type resolves the action via the Avian namespace, falling
 * back to `globalThis[name]` so legacy classic-shell functions keep working
 * without touching every call site.
 *
 * Dataset conventions
 *   data-action     — click; spec is "name" or "name:literalArg"
 *   data-input      — input event (text inputs); receives event.target.value
 *   data-change     — change event (selects/checkboxes); receives value or checked
 *   data-submit     — submit event; receives the form
 *   data-backdrop   — modifier ("1"): only fires when the click target IS the bound element
 *                     (replaces inline `if(event.target===this) closeX()` patterns)
 *
 * Keyboard
 *   In-battle: `1`-`4` / `Q`/`W`/`E`/`R` invoke `Avian.actions.fireAbilitySlot`
 *   with the slot index (0-3) when present. The action is registered later
 *   from the existing battle UI; absence is a silent no-op.
 */
(function () {
  'use strict';

  const Avian = globalThis.Avian || (globalThis.Avian = { actions: {}, debug: {} });
  if (!Avian.actions) Avian.actions = Object.create(null);
  if (!Avian.debug) Avian.debug = Object.create(null);

  function safe(label, fn, fallback) {
    if (typeof Avian.debug.safe === 'function') return Avian.debug.safe(label, fn, fallback);
    try {
      return fn();
    } catch (err) {
      try {
        console.warn('[router] ' + label, err);
        if (typeof globalThis.pushErrorHUD === 'function') {
          globalThis.pushErrorHUD('Router', label + ': ' + (err && err.message ? err.message : String(err)), err instanceof Error ? err : { stack: err && err.stack ? err.stack : '' });
        }
      } catch (_e) {
        /* noop */
      }
      return fallback;
    }
  }

  function resolveAction(name) {
    if (!name) return null;
    const fromAvian = Avian.actions && Avian.actions[name];
    if (typeof fromAvian === 'function') return fromAvian;
    const fromGlobal = globalThis[name];
    if (typeof fromGlobal === 'function') return fromGlobal;
    return null;
  }

  function parseSpec(spec) {
    if (!spec) return ['', undefined];
    const idx = spec.indexOf(':');
    if (idx < 0) return [spec, undefined];
    return [spec.slice(0, idx), spec.slice(idx + 1)];
  }

  function dispatch(name, args, evt) {
    const fn = resolveAction(name);
    if (!fn) {
      if (Avian.debug.enabled) console.warn('[router] unknown action:', name);
      return;
    }
    safe('action:' + name, function () {
      return fn.apply(null, args);
    });
  }

  function findActionable(target, attr) {
    if (!target || target.nodeType !== 1) return null;
    const closest = target.closest ? target.closest('[' + attr + ']') : null;
    return closest;
  }

  function onClick(e) {
    const el = findActionable(e.target, 'data-action');
    if (!el) return;
    if (el.dataset.backdrop === '1' && e.target !== el) return;
    const [name, arg] = parseSpec(el.dataset.action);
    const args = arg === undefined ? [e] : [arg, e];
    dispatch(name, args, e);
  }

  function onInput(e) {
    const el = findActionable(e.target, 'data-input');
    if (!el) return;
    const [name, literalArg] = parseSpec(el.dataset.input);
    const value = literalArg !== undefined ? literalArg : e.target.value;
    dispatch(name, [value, e], e);
  }

  function onChange(e) {
    const el = findActionable(e.target, 'data-change');
    if (!el) return;
    const [name, literalArg] = parseSpec(el.dataset.change);
    let value;
    if (literalArg !== undefined) value = literalArg;
    else if (e.target.type === 'checkbox') value = e.target.checked;
    else value = e.target.value;
    dispatch(name, [value, e], e);
  }

  function onSubmit(e) {
    const el = findActionable(e.target, 'data-submit');
    if (!el) return;
    const [name] = parseSpec(el.dataset.submit);
    dispatch(name, [el, e], e);
  }

  function isBattleScreenActive() {
    try {
      const battle = document.getElementById('screen-battle');
      return !!(battle && battle.classList.contains('active'));
    } catch (_e) {
      return false;
    }
  }

  function onKeyDown(e) {
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!isBattleScreenActive()) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const slotMap = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, w: 1, e: 2, r: 3 };
    const slot = slotMap[e.key.toLowerCase()];
    if (slot === undefined) return;
    const fn = resolveAction('fireAbilitySlot');
    if (!fn) return;
    e.preventDefault();
    safe('keyboard:fireAbilitySlot', function () {
      return fn(slot, e);
    });
  }

  /* Generic helpers reused by data-action specs in index.html. */
  Avian.actions.reloadPage = function reloadPage() {
    try {
      location.reload();
    } catch (_e) {
      /* sandboxed embed */
    }
  };
  Avian.actions.openConsoleHud = function openConsoleHud() {
    if (typeof globalThis.showErrorHUD === 'function') globalThis.showErrorHUD();
  };

  /* Stub — the legacy `exportCombatTelemetry` was removed during the aggressive
   * legacy pruning. The settings button still exists; click logs a notice
   * so the action resolves (Phase 4 ci-check requires every data-action to
   * resolve to a known function). Replace with a real exporter when telemetry
   * is reintroduced, or remove the corresponding button in index.html. */
  Avian.actions.exportCombatTelemetry = function exportCombatTelemetryStub() {
    try {
      console.info('[Avian] exportCombatTelemetry: feature was removed during pruning; this is a stub.');
      if (typeof globalThis.alert === 'function') {
        globalThis.alert('Combat telemetry export was removed during legacy pruning. Re-add a real exporter to enable this button.');
      }
    } catch (_e) {
      /* noop */
    }
  };

  /* Replay-seed share: copies the QoL share string to clipboard. The
   * button is injected into the gameover screen by systems.js; the
   * action is resolved here so data-action="copyReplaySeed" works. */
  Avian.actions.copyReplaySeed = function copyReplaySeed(_arg, e) {
    var Avian2 = globalThis.Avian || {};
    var systems = Avian2.systems || {};
    var seedApi = systems.replaySeed;
    if (!seedApi || typeof seedApi.shareString !== 'function') return;
    var text = seedApi.shareString();
    if (!text) return;
    var done = function () {
      try {
        var btn = e && e.target && e.target.closest && e.target.closest('[data-action]');
        if (btn) {
          var prev = btn.textContent;
          btn.textContent = '✓ Copied seed';
          setTimeout(function () { try { btn.textContent = prev; } catch (_x) {} }, 1500);
        }
      } catch (_x) { /* noop */ }
    };
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
        return;
      }
    } catch (_x) { /* fall through */ }
    fallbackCopy(text, done);
  };

  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof done === 'function') done();
    } catch (err) {
      try { console.warn('[router] copyReplaySeed fallback', err); } catch (_x) {}
    }
  }

  function attach() {
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('keydown', onKeyDown, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }
})();
