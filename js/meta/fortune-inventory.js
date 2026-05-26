/* War room Inventory — global holdings vault (read-only). */
(function () {
  'use strict';

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    if (typeof globalThis.formatCombatNumber === 'function') return globalThis.formatCombatNumber(n);
    return String(Math.floor(Number(n) || 0));
  }

  function syncInventoryHotspotBadge() {
    var meta = typeof globalThis.getFortuneMeta === 'function' ? globalThis.getFortuneMeta() : null;
    var ownedArt = meta && meta.ownedArtifacts ? meta.ownedArtifacts : {};
    var count = Object.keys(ownedArt).filter(function (id) {
      return ownedArt[id];
    }).length;
    var badge = document.getElementById('inventory-artifact-badge');
    if (badge) {
      badge.textContent = count > 0 ? fmt(count) : '';
      badge.hidden = !(count > 0);
    }
  }

  function renderInventoryCurrency(rows) {
    var savedEl = document.getElementById('inventory-balance-saved');
    var gooseEl = document.getElementById('inventory-balance-goose');
    var saved = 0;
    var goose = 0;
    (rows.currency || []).forEach(function (row) {
      if (row.id === 'savedEggs') saved = row.count;
      if (row.id === 'goldenGooseEggs') goose = row.count;
    });
    if (savedEl) savedEl.textContent = fmt(saved);
    if (gooseEl) gooseEl.textContent = fmt(goose);
  }

  function renderInventoryArtifacts(artifacts) {
    var grid = document.getElementById('inventory-artifacts-grid');
    var empty = document.getElementById('inventory-artifacts-empty');
    if (!grid) return;
    if (!artifacts.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = artifacts
      .map(function (art) {
        return (
          '<div class="inventory-item-card inventory-item-card--artifact">' +
          '<div class="inventory-item-icon">' +
          esc(art.icon) +
          '</div>' +
          '<div class="inventory-item-name">' +
          esc(art.name) +
          '</div>' +
          '<p class="inventory-item-desc">' +
          esc(art.desc) +
          '</p>' +
          '<p class="inventory-item-note">Effect coming soon.</p></div>'
        );
      })
      .join('');
  }

  function renderInventoryMisc(misc) {
    var grid = document.getElementById('inventory-misc-grid');
    var empty = document.getElementById('inventory-misc-empty');
    if (!grid || !empty) return;
    if (!misc.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    grid.innerHTML = misc
      .map(function (item) {
        var countBadge = item.count > 1 ? '<span class="inventory-item-qty">×' + fmt(item.count) + '</span>' : '';
        return (
          '<div class="inventory-item-card inventory-item-card--misc">' +
          '<div class="inventory-item-icon">' +
          esc(item.icon) +
          countBadge +
          '</div>' +
          '<div class="inventory-item-name">' +
          esc(item.name) +
          '</div>' +
          '<p class="inventory-item-desc">' +
          esc(item.desc) +
          '</p></div>'
        );
      })
      .join('');
  }

  function renderFortuneInventory() {
    var rows =
      typeof globalThis.getOwnedInventoryRows === 'function'
        ? globalThis.getOwnedInventoryRows()
        : { currency: [], artifacts: [], misc: [] };
    renderInventoryCurrency(rows);
    renderInventoryArtifacts(rows.artifacts || []);
    renderInventoryMisc(rows.misc || []);
    syncInventoryHotspotBadge();
    if (typeof globalThis.syncFortuneBalances === 'function') globalThis.syncFortuneBalances();
  }

  globalThis.renderFortuneInventory = renderFortuneInventory;
  globalThis.syncInventoryHotspotBadge = syncInventoryHotspotBadge;
})();
