/**
 * Floating error console modal — shared by index.html (bundle) and overworld map.
 */
(function (global) {
  'use strict';

  var store = { max: 24, items: [], installed: false, pushing: false };
  var overlayEl = null;
  var badgeEl = null;
  var listEl = null;
  var metaEl = null;
  var chkAutoEl = null;

  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
    });
  }

  function formatArgs(args) {
    return Array.prototype.slice.call(args).map(function (a) {
      if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (_) { return String(a); }
      }
      return String(a);
    }).join(' ');
  }

  function kindClass(kind) {
    var k = String(kind || 'Log').toLowerCase();
    if (k.indexOf('warn') >= 0) return 'error-console-entry--warn';
    if (k.indexOf('error') >= 0 || k.indexOf('crash') >= 0 || k.indexOf('reject') >= 0) return 'error-console-entry--error';
    return 'error-console-entry--log';
  }

  function updateBadge() {
    if (!badgeEl) return;
    var n = store.items.length;
    if (n <= 0) {
      badgeEl.classList.remove('is-visible');
      badgeEl.textContent = '';
      return;
    }
    badgeEl.textContent = '\u26A0 ' + n;
    if (!overlayEl || !overlayEl.classList.contains('is-open')) {
      badgeEl.classList.add('is-visible');
    }
  }

  function renderList() {
    if (!listEl || !metaEl) return;
    listEl.innerHTML = '';
    store.items.forEach(function (e) {
      var box = document.createElement('div');
      box.className = 'error-console-entry ' + kindClass(e.kind);
      var loc = e.src
        ? '@ ' + e.src + (e.line !== '' ? ':' + e.line : '') + (e.col !== '' ? ':' + e.col : '')
        : '';
      box.innerHTML =
        '<div class="error-console-entry-head"><span class="error-console-chip">' + escapeHtml(e.kind) + '</span> <span class="error-console-time">' + escapeHtml(e.time) + '</span></div>' +
        '<div class="error-console-msg">' + escapeHtml(e.msg) + '</div>' +
        (loc ? '<div class="error-console-loc">' + escapeHtml(loc) + '</div>' : '') +
        (e.stack ? '<details class="error-console-stack"><summary>stack</summary><pre>' + escapeHtml(e.stack) + '</pre></details>' : '');
      listEl.appendChild(box);
    });
    var latest = store.items[0];
    metaEl.textContent = store.items.length
      ? store.items.length + ' message(s). Latest at ' + (latest ? latest.time : '')
      : '(No messages yet)';
    updateBadge();
  }

  function showHUD() {
    if (!overlayEl) return;
    overlayEl.classList.add('is-open');
    overlayEl.setAttribute('aria-hidden', 'false');
    if (badgeEl) badgeEl.classList.remove('is-visible');
  }

  function hideHUD() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-open');
    overlayEl.setAttribute('aria-hidden', 'true');
    updateBadge();
  }

  function pushErrorHUD(kind, msg, meta) {
    if (store.pushing) return;
    store.pushing = true;
    try {
      var time = new Date().toLocaleTimeString();
      var stack = '';
      var src = '';
      var line = '';
      var col = '';
      if (meta instanceof Error) {
        stack = meta.stack || '';
        msg = msg || meta.message || String(meta);
      } else if (typeof meta === 'string') {
        stack = meta;
      } else if (meta && typeof meta === 'object') {
        stack = meta.stack || meta.detail || '';
        src = meta.src || meta.filename || '';
        line = meta.line != null ? meta.line : '';
        col = meta.col != null ? meta.col : '';
        if (meta.message && !msg) msg = String(meta.message);
      }
      store.items.unshift({
        time: time,
        kind: String(kind || 'Log'),
        msg: String(msg || ''),
        src: String(src || ''),
        line: line,
        col: col,
        stack: String(stack || ''),
      });
      if (store.items.length > store.max) store.items.length = store.max;
      renderList();
      showHUD();
      if (chkAutoEl && chkAutoEl.checked && !globalThis.__AVIAN_OW_HANDOFF__) {
        try {
          var g = global.G;
          if (g && g.player && g.enemy && typeof global.failsafeAdvance === 'function') {
            global.failsafeAdvance('ErrorHUD auto-recover');
          }
        } catch (_) {}
      }
    } finally {
      store.pushing = false;
    }
  }

  function installErrorHUD() {
    if (store.installed || global.document.getElementById('error-console-overlay')) {
      store.installed = true;
      return;
    }
    store.installed = true;

    overlayEl = global.document.createElement('div');
    overlayEl.id = 'error-console-overlay';
    overlayEl.className = 'error-console-overlay';
    overlayEl.setAttribute('aria-hidden', 'true');
    overlayEl.innerHTML =
      '<div class="error-console-panel" role="dialog" aria-labelledby="error-console-title">' +
        '<div class="error-console-header">' +
          '<div id="error-console-title" class="error-console-title">CONSOLE</div>' +
          '<div class="error-console-actions">' +
            '<button type="button" class="error-console-btn" id="eh-copy">Copy</button>' +
            '<button type="button" class="error-console-btn" id="eh-clear">Clear</button>' +
            '<button type="button" class="error-console-btn" id="eh-close">Close</button>' +
          '</div>' +
        '</div>' +
        '<div id="eh-meta" class="error-console-meta">(No messages yet)</div>' +
        '<div id="eh-list" class="error-console-list"></div>' +
        '<label class="error-console-autofix">' +
          '<input id="eh-autofix" type="checkbox" /> Auto-recover during battle (calls failsafeAdvance when player + enemy exist)' +
        '</label>' +
      '</div>';

    badgeEl = global.document.createElement('button');
    badgeEl.type = 'button';
    badgeEl.id = 'error-console-badge';
    badgeEl.className = 'error-console-badge';
    badgeEl.setAttribute('aria-label', 'Open error console');
    badgeEl.addEventListener('click', showHUD);

    global.document.body.appendChild(overlayEl);
    global.document.body.appendChild(badgeEl);

    listEl = overlayEl.querySelector('#eh-list');
    metaEl = overlayEl.querySelector('#eh-meta');
    chkAutoEl = overlayEl.querySelector('#eh-autofix');

    overlayEl.querySelector('#eh-close').addEventListener('click', hideHUD);
    overlayEl.addEventListener('click', function (ev) {
      if (ev.target === overlayEl) hideHUD();
    });
    overlayEl.querySelector('#eh-clear').addEventListener('click', function () {
      store.items = [];
      renderList();
      metaEl.textContent = '(Messages cleared)';
    });
    overlayEl.querySelector('#eh-copy').addEventListener('click', async function () {
      var text = store.items.map(function (e) {
        return '[' + e.time + '] ' + e.kind + ': ' + e.msg + '\n' +
          e.src + (e.line !== '' ? ':' + e.line : '') + (e.col !== '' ? ':' + e.col : '') + '\n' +
          e.stack + '\n';
      }).join('\n');
      try {
        await global.navigator.clipboard.writeText(text);
        metaEl.textContent = 'Copied to clipboard';
      } catch (err) {
        metaEl.textContent = 'Copy failed (clipboard unavailable).';
      }
    });

    global.addEventListener('error', function (ev) {
      var err = ev.error;
      pushErrorHUD('Crash', ev.message, {
        src: ev.filename,
        line: ev.lineno,
        col: ev.colno,
        stack: err && err.stack ? err.stack : '',
      });
    });

    global.addEventListener('unhandledrejection', function (ev) {
      var r = ev.reason;
      pushErrorHUD('PromiseRejection', r && r.message ? r.message : String(r), r instanceof Error ? r : { stack: r && r.stack ? r.stack : '' });
    });

    if (!global.__AVIAN_CONSOLE_HOOKED__) {
      global.__AVIAN_CONSOLE_HOOKED__ = true;
      var origError = global.console.error.bind(global.console);
      var origWarn = global.console.warn.bind(global.console);
      global.console.error = function () {
        origError.apply(global.console, arguments);
        if (global.__AVIAN_OW_LOG_SUPPRESS || store.pushing) return;
        pushErrorHUD('Error', formatArgs(arguments));
      };
      global.console.warn = function () {
        origWarn.apply(global.console, arguments);
        if (global.__AVIAN_OW_LOG_SUPPRESS || store.pushing) return;
        pushErrorHUD('Warn', formatArgs(arguments));
      };
    }

    global.pushErrorHUD = pushErrorHUD;
    global.showErrorHUD = showHUD;
    global.hideErrorHUD = hideHUD;
    global.installErrorHUD = installErrorHUD;
  }

  global.pushErrorHUD = pushErrorHUD;
  global.showErrorHUD = showHUD;
  global.hideErrorHUD = hideHUD;
  global.installErrorHUD = installErrorHUD;
})(typeof window !== 'undefined' ? window : globalThis);
