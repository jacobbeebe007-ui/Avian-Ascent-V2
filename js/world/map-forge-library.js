/**
 * World Creator library + new-world wizard.
 * Rendered into #map-forge-library; map-forge.js owns draft persistence.
 */
(function (global) {
  'use strict';

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

  global.renderMapForgeLibrary = function (opts) {
    const root = document.getElementById('map-forge-library');
    if (!root) return;
    const drafts = Array.isArray(opts?.drafts) ? opts.drafts : [];
    const templates = global.WORLD_PACK_TEMPLATES || [];
    const currentId = String(opts?.currentId || '');

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
    html += '<div class="map-forge-library-grid">';
    templates.forEach((t) => {
      html += '<button type="button" class="map-forge-library-card map-forge-library-card--new" data-forge-template="' + esc(t.id) + '">';
      html += '<strong>' + esc(t.name) + '</strong>';
      html += '<span>' + esc(t.blurb || '') + '</span>';
      html += '</button>';
    });
    html += '</div></section>';

    html += '<section class="map-forge-library-section">';
    html += '<h3 class="map-forge-library-h">Drafts</h3>';
    if (!drafts.length) {
      html += '<p class="map-forge-hint">No saved worlds yet. Pick a template above.</p>';
    } else {
      html += '<div class="map-forge-library-grid">';
      drafts.forEach((d) => {
        const active = d.id === currentId ? ' is-current' : '';
        const thumb = thumbUrl(d);
        html += '<article class="map-forge-library-card map-forge-library-card--draft' + active + '" data-forge-draft="' + esc(d.id) + '">';
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
    html += '</section></div>';
    root.innerHTML = html;

    root.querySelectorAll('[data-forge-template]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (typeof opts.onNewTemplate === 'function') opts.onNewTemplate(btn.getAttribute('data-forge-template'));
      });
    });
    root.querySelectorAll('[data-forge-open-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (typeof opts.onOpenDraft === 'function') opts.onOpenDraft(btn.getAttribute('data-forge-open-draft'));
      });
    });
    root.querySelectorAll('[data-forge-delete-draft]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (typeof opts.onDeleteDraft === 'function') opts.onDeleteDraft(btn.getAttribute('data-forge-delete-draft'));
      });
    });
    root.querySelectorAll('[data-forge-draft]').forEach((card) => {
      card.addEventListener('dblclick', () => {
        if (typeof opts.onOpenDraft === 'function') opts.onOpenDraft(card.getAttribute('data-forge-draft'));
      });
    });
    const importEl = document.getElementById('map-forge-library-import');
    if (importEl && typeof opts.onImportFile === 'function') {
      importEl.addEventListener('change', function () {
        opts.onImportFile(this.files && this.files[0]);
        this.value = '';
      });
    }
  };

  global.showMapForgeLibraryView = function () {
    document.getElementById('map-forge-library')?.classList.add('is-open');
    document.getElementById('map-forge-workspace')?.classList.add('is-hidden');
    document.getElementById('screen-map-forge')?.classList.add('is-library');
  };

  global.hideMapForgeLibraryView = function () {
    document.getElementById('map-forge-library')?.classList.remove('is-open');
    document.getElementById('map-forge-workspace')?.classList.remove('is-hidden');
    document.getElementById('screen-map-forge')?.classList.remove('is-library');
  };
})(typeof window !== 'undefined' ? window : globalThis);
