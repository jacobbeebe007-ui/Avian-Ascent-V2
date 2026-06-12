/* War room Inventory — global holdings vault and artifact equip. */
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

  function renderInventoryEquippedNote(artifacts, equippedId) {
    var note = document.getElementById('inventory-equipped-note');
    if (!note) return;
    if (!artifacts.length) {
      note.textContent = '';
      note.hidden = true;
      return;
    }
    note.hidden = false;
    if (!equippedId) {
      note.textContent = 'No artifact equipped for your next Flight.';
      return;
    }
    var equipped = artifacts.find(function (art) {
      return art.id === equippedId;
    });
    note.textContent = equipped
      ? 'Equipped for next Flight: ' + equipped.name
      : 'No artifact equipped for your next Flight.';
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
    var equippedId =
      typeof globalThis.getEquippedArtifactId === 'function' ? globalThis.getEquippedArtifactId() : null;
    renderInventoryEquippedNote(artifacts, equippedId);
    if (!artifacts.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    grid.innerHTML = artifacts
      .map(function (art) {
        var isEquipped = art.id === equippedId;
        var cardClass =
          'inventory-item-card inventory-item-card--artifact' + (isEquipped ? ' inventory-item-card--equipped' : '');
        var equippedBadge = isEquipped
          ? '<span class="inventory-item-equipped-badge">Equipped</span>'
          : '';
        var btnAction = isEquipped
          ? 'data-action="unequipFortuneArtifact"'
          : 'data-action="equipFortuneArtifact:' + esc(art.id) + '"';
        var btnLabel = isEquipped ? 'Unequip' : 'Equip';
        return (
          '<div class="' +
          cardClass +
          '">' +
          '<div class="inventory-item-icon">' +
          esc(art.icon) +
          equippedBadge +
          '</div>' +
          '<div class="inventory-item-name">' +
          esc(art.name) +
          '</div>' +
          '<p class="inventory-item-desc">' +
          esc(art.desc) +
          '</p>' +
          '<button type="button" class="fortune-buy-btn fortune-buy-btn--artifact inventory-equip-btn" ' +
          btnAction +
          '>' +
          esc(btnLabel) +
          '</button></div>'
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

  function equipFortuneArtifact(artifactId) {
    if (typeof globalThis.setEquippedArtifact !== 'function') return;
    if (!globalThis.setEquippedArtifact(artifactId)) return;
    renderFortuneInventory();
  }

  function unequipFortuneArtifact() {
    if (typeof globalThis.setEquippedArtifact !== 'function') return;
    globalThis.setEquippedArtifact(null);
    renderFortuneInventory();
  }

  globalThis.renderFortuneInventory = renderFortuneInventory;
  globalThis.syncInventoryHotspotBadge = syncInventoryHotspotBadge;
  globalThis.equipFortuneArtifact = equipFortuneArtifact;
  globalThis.unequipFortuneArtifact = unequipFortuneArtifact;
})();
