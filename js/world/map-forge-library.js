/**
 * World Creator library + new-world wizard.
 * Rendered into #map-forge-library; map-forge.js owns draft persistence.
 */
(function (global) {
  'use strict';

  let _opts = null;
  let _selection = { kind: '', id: '' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return '';
      return d.toLocaleString();
    } catch (_) {
      return String(iso);
    }
  }

  function mapCount(pack) {
    return 1 + Object.keys(pack?.worlds || {}).length;
  }

  function thumbUrl(pack) {
    const u = pack?.backgroundDataUrl || '';
    if (!u) return '';
    if (u.slice(0, 6) === 'asset:') return '';
    return u;
  }

  function templateName(id) {
    const t = (global.WORLD_PACK_TEMPLATES || []).find((x) => x.id === id);
    return t?.name || id;
  }

  function draftName(id) {
    const drafts = Array.isArray(_opts?.drafts) ? _opts.drafts : [];
    const d = drafts.find((x) => x.id === id);
    return d?.name || 'Untitled World';
  }

  function setSelection(kind, id) {
    _selection = { kind: kind || '', id: String(id || '') };
    syncLibraryConfirm();
  }

  function syncLibraryConfirm() {
    const root = document.getElementById('map-forge-library');
    if (!root) return;
    root.querySelectorAll('[data-forge-template]').forEach((el) => {
      const on = _selection.kind === 'template' && el.getAttribute('data-forge-template') === _selection.id;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    root.querySelectorAll('[data-forge-draft]').forEach((el) => {
      const on = _selection.kind === 'draft' && el.getAttribute('data-forge-draft') === _selection.id;
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const hint = root.querySelector('#map-forge-library-confirm-hint');
    const btn = root.querySelector('[data-action="confirmMapForgeLibrary"]');
    if (!_selection.kind || !_selection.id) {
      if (hint) hint.textContent = 'Pick a template or draft, then confirm to proceed.';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Confirm →';
      }
      return;
    }
    if (_selection.kind === 'template') {
      if (hint) hint.textContent = 'Selected template: ' + templateName(_selection.id);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Create world →';
      }
      return;
    }
    if (hint) hint.textContent = 'Selected draft: ' + draftName(_selection.id);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Open world →';
    }
  }

  function proceedSelection() {
    if (!_opts) return false;
    if (_selection.kind === 'template' && _selection.id && typeof _opts.onNewTemplate === 'function') {
      _opts.onNewTemplate(_selection.id);
      return true;
    }
    if (_selection.kind === 'draft' && _selection.id && typeof _opts.onOpenDraft === 'function') {
      _opts.onOpenDraft(_selection.id);
      return true;
    }
    return false;
  }

  global.getMapForgeLibrarySelection = function () {
    return { kind: _selection.kind, id: _selection.id };
  };

  global.confirmMapForgeLibrary = function () {
    return proceedSelection();
  };

  global.renderMapForgeLibrary = function (opts) {
    const root = document.getElementById('map-forge-library');
    if (!root) return;
    _opts = opts || {};
    const drafts = Array.isArray(_opts.drafts) ? _opts.drafts : [];
    const templates = global.WORLD_PACK_TEMPLATES || [];
    const currentId = String(_opts.currentId || '');
    if (_selection.kind === 'draft' && !drafts.some((d) => d.id === _selection.id)) {
      _selection = { kind: '', id: '' };
    }
    if (_selection.kind === 'template' && !templates.some((t) => t.id === _selection.id)) {
      _selection = { kind: '', id: '' };
    }

    let html = '';
    html += '<div class="map-forge-library-inner">';
    html += '<header class="map-forge-library-head">';
    html += '<div><h2 class="map-forge-title">World Creator</h2>';
    html += '<p class="map-forge-library-sub">Build Nest — author worlds, maps, and stages</p></div>';
    html += '<div class="map-forge-library-head-actions">';
    html += '<label class="map-forge-upload-label map-forge-library-import"><span class="menu-btn">Import pack</span>';
    html += '<input type="file" id="map-forge-library-import" accept="application/json,.json" hidden/></label>';
    html += '<button type="button" class="menu-btn" data-action="closeMapForge">← War room</button>';
    html += '</div></header>';

    html += '<section class="map-forge-library-section">';
    html += '<h3 class="map-forge-library-h">New world</h3>';
    html += '<p class="map-forge-hint">Select a template, then confirm to open the workspace.</p>';
    html += '<div class="map-forge-library-grid">';
    templates.forEach((t) => {
      html += '<article class="map-forge-library-card map-forge-library-card--new" role="button" tabindex="0" data-forge-template="' + esc(t.id) + '" aria-pressed="false">';
      html += '<strong>' + esc(t.name) + '</strong>';
      html += '<span>' + esc(t.blurb || '') + '</span>';
      html += '<div class="map-forge-library-card-actions">';
      html += '<button type="button" class="menu-btn map-forge-btn-accent" data-forge-create-template="' + esc(t.id) + '">Create</button>';
      html += '</div></article>';
    });
    html += '</div></section>';

    html += '<section class="map-forge-library-section">';
    html += '<h3 class="map-forge-library-h">Drafts</h3>';
    if (!drafts.length) {
      html += '<p class="map-forge-hint">No saved worlds yet. Pick a template above, then confirm.</p>';
    } else {
      html += '<div class="map-forge-library-grid">';
      drafts.forEach((d) => {
        const active = d.id === currentId ? ' is-current' : '';
        const thumb = thumbUrl(d);
        html += '<article class="map-forge-library-card map-forge-library-card--draft' + active + '" role="button" tabindex="0" data-forge-draft="' + esc(d.id) + '" aria-pressed="false">';
        if (thumb) html += '<div class="map-forge-library-thumb" style="background-image:url(\'' + esc(thumb).replace(/'/g, '%27') + '\')"></div>';
        else html += '<div class="map-forge-library-thumb map-forge-library-thumb--empty">No art</div>';
        html += '<strong>' + esc(d.name || 'Untitled World') + '</strong>';
        html += '<span>' + mapCount(d) + ' map' + (mapCount(d) === 1 ? '' : 's');
        const when = fmtWhen(d.updatedAt || d.createdAt);
        if (when) html += ' · ' + esc(when);
        html += '</span>';
        html += '<div class="map-forge-library-card-actions">';
        html += '<button type="button" class="menu-btn map-forge-btn-accent" data-forge-open-draft="' + esc(d.id) + '">Open</button>';
        html += '<button type="button" class="menu-btn" data-forge-delete-draft="' + esc(d.id) + '">Delete</button>';
        html += '</div></article>';
      });
      html += '</div>';
    }
    html += '</section>';

    html += '<footer class="map-forge-library-confirm">';
    html += '<p class="map-forge-library-confirm-hint" id="map-forge-library-confirm-hint">Pick a template or draft, then confirm to proceed.</p>';
    html += '<button type="button" class="select-hub-confirm-btn map-forge-library-confirm-btn" data-action="confirmMapForgeLibrary" disabled>Confirm →</button>';
    html += '</footer></div>';
    root.innerHTML = html;

    function bindActivate(el, onActivate) {
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) return;
        onActivate();
      });
      el.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        ev.preventDefault();
        onActivate();
      });
    }

    root.querySelectorAll('[data-forge-template]').forEach((card) => {
      bindActivate(card, () => setSelection('template', card.getAttribute('data-forge-template')));
    });
    root.querySelectorAll('[data-forge-create-template]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute('data-forge-create-template');
        setSelection('template', id);
        if (typeof _opts.onNewTemplate === 'function') _opts.onNewTemplate(id);
      });
    });
    root.querySelectorAll('[data-forge-open-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute('data-forge-open-draft');
        setSelection('draft', id);
        if (typeof _opts.onOpenDraft === 'function') _opts.onOpenDraft(id);
      });
    });
    root.querySelectorAll('[data-forge-delete-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (typeof _opts.onDeleteDraft === 'function') _opts.onDeleteDraft(btn.getAttribute('data-forge-delete-draft'));
      });
    });
    root.querySelectorAll('[data-forge-draft]').forEach((card) => {
      bindActivate(card, () => setSelection('draft', card.getAttribute('data-forge-draft')));
      card.addEventListener('dblclick', (ev) => {
        if (ev.target.closest('button')) return;
        const id = card.getAttribute('data-forge-draft');
        setSelection('draft', id);
        if (typeof _opts.onOpenDraft === 'function') _opts.onOpenDraft(id);
      });
    });
    const importEl = document.getElementById('map-forge-library-import');
    if (importEl && typeof _opts.onImportFile === 'function') {
      importEl.addEventListener('change', function () {
        _opts.onImportFile(this.files && this.files[0]);
        this.value = '';
      });
    }
    syncLibraryConfirm();
  };

  global.showMapForgeLibraryView = function () {
    document.getElementById('map-forge-library')?.classList.add('is-open');
    document.getElementById('map-forge-workspace')?.classList.add('is-hidden');
    document.getElementById('screen-map-forge')?.classList.add('is-library');
    const lib = document.getElementById('map-forge-library');
    if (lib?.querySelector('.map-forge-library-fallback') && typeof global.refreshMapForgeLibrary === 'function') {
      global.refreshMapForgeLibrary();
    }
  };

  global.hideMapForgeLibraryView = function () {
    document.getElementById('map-forge-library')?.classList.remove('is-open');
    document.getElementById('map-forge-workspace')?.classList.remove('is-hidden');
    document.getElementById('screen-map-forge')?.classList.remove('is-library');
  };
})(typeof window !== 'undefined' ? window : globalThis);
