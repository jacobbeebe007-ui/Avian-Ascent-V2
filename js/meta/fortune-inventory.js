/* War room Inventory — global holdings vault and artifact equip. */
(function () {
  'use strict';

  var INVENTORY_TAB = 'feathers';
  var FEATHER_FILTER = 'all';
  var FEATHER_AMOUNT_FILTER = 'all';
  var FEATHER_TIERS = ['all', 'grey', 'green', 'blue', 'purple', 'gold', 'orange'];
  var FEATHER_AMOUNT_FILTERS = [
    { id: 'all', label: 'All' },
    { id: '1', label: '1+' },
    { id: '5', label: '5+' },
    { id: '10', label: '10+' },
    { id: '20', label: '20+' },
    { id: 'canUpgrade', label: 'Can upgrade' },
  ];

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

  function tierPack() {
    return globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.birdCardTiers;
  }

  function tierLabel(tier) {
    var pack = tierPack();
    return (pack && pack.TIER_LABELS && pack.TIER_LABELS[tier]) || tier;
  }

  function speciesRarityLabel(tier) {
    var pack = tierPack();
    return (pack && pack.SPECIES_RARITY_LABELS && pack.SPECIES_RARITY_LABELS[tier]) || tierLabel(tier);
  }

  function tierCss(tier) {
    var pack = tierPack();
    return (pack && pack.TIER_CSS && pack.TIER_CSS[tier]) || 'tier-grey';
  }

  function birdPortraitHtml(birdKey) {
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    if (typeof globalThis.renderBirdIconHTML === 'function' && bird) {
      var sizeClass =
        typeof globalThis.getUISizeClass === 'function'
          ? globalThis.getUISizeClass(bird, 'select')
          : 'medium';
      return globalThis.renderBirdIconHTML(birdKey, sizeClass, false);
    }
    return bird && bird.emoji ? esc(bird.emoji) : '🐦';
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

  function setInventorySubView(view) {
    INVENTORY_TAB =
      view === 'feathers' ? 'feathers' : view === 'misc' ? 'misc' : 'artifacts';
    var tabs = ['artifacts', 'feathers', 'misc'];
    tabs.forEach(function (id) {
      var btn = document.getElementById('inventory-nav-' + id);
      var panel = document.getElementById('inventory-view-' + id);
      var active = id === INVENTORY_TAB;
      if (btn) {
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      }
    });
    if (INVENTORY_TAB === 'feathers') renderInventoryFeathers();
  }

  function setInventoryFeatherFilter(tier) {
    FEATHER_FILTER = tier || 'all';
    var wrap = document.getElementById('inventory-feather-filters');
    if (wrap) {
      wrap.querySelectorAll('.inventory-feather-filter-btn').forEach(function (btn) {
        var t = btn.getAttribute('data-feather-tier') || 'all';
        btn.classList.toggle('is-active', t === FEATHER_FILTER);
      });
    }
    renderInventoryFeathers();
  }

  function setInventoryFeatherAmountFilter(filter) {
    FEATHER_AMOUNT_FILTER = filter || 'all';
    var wrap = document.getElementById('inventory-feather-amount-filters');
    if (wrap) {
      wrap.querySelectorAll('.inventory-feather-filter-btn').forEach(function (btn) {
        var t = btn.getAttribute('data-feather-amount') || 'all';
        btn.classList.toggle('is-active', t === FEATHER_AMOUNT_FILTER);
      });
    }
    renderInventoryFeathers();
  }

  function renderInventoryFeatherAmountFilters() {
    var wrap = document.getElementById('inventory-feather-amount-filters');
    if (!wrap || wrap.dataset.wired === '1') return;
    wrap.dataset.wired = '1';
    wrap.innerHTML = FEATHER_AMOUNT_FILTERS.map(function (row) {
      var active = row.id === FEATHER_AMOUNT_FILTER ? ' is-active' : '';
      return (
        '<button type="button" class="inventory-feather-filter-btn' +
        active +
        '" data-feather-amount="' +
        esc(row.id) +
        '" data-action="setInventoryFeatherAmountFilter:' +
        esc(row.id) +
        '">' +
        esc(row.label) +
        '</button>'
      );
    }).join('');
  }

  function featherPassesAmountFilter(birdKey, count) {
    if (FEATHER_AMOUNT_FILTER === 'all') return true;
    if (FEATHER_AMOUNT_FILTER === 'canUpgrade') {
      if (typeof globalThis.getBirdCardProgress !== 'function' || typeof globalThis.ownsBirdCard !== 'function') return false;
      if (!globalThis.ownsBirdCard(birdKey)) return false;
      var progress = globalThis.getBirdCardProgress(birdKey);
      if (!progress || !progress.canUpgrade) return false;
      return count >= (progress.cost || 0);
    }
    var min = Math.max(0, Math.floor(Number(FEATHER_AMOUNT_FILTER) || 0));
    return count >= min;
  }

  function buildFeatherMutateBtn(birdKey) {
    if (typeof globalThis.renderBirdCardUpgradeHtml === 'function') {
      return globalThis.renderBirdCardUpgradeHtml(birdKey, { layout: 'inventory' });
    }
    return '';
  }

  function renderInventoryFeatherFilters() {
    var wrap = document.getElementById('inventory-feather-filters');
    if (!wrap || wrap.dataset.wired === '1') return;
    wrap.dataset.wired = '1';
    wrap.innerHTML = FEATHER_TIERS.map(function (tier) {
      var active = tier === FEATHER_FILTER ? ' is-active' : '';
      var label = tier === 'all' ? 'All tiers' : speciesRarityLabel(tier);
      return (
        '<button type="button" class="inventory-feather-filter-btn' +
        active +
        '" data-feather-tier="' +
        esc(tier) +
        '" data-action="setInventoryFeatherFilter:' +
        esc(tier) +
        '">' +
        esc(label) +
        '</button>'
      );
    }).join('');
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

  function renderInventoryFeathers() {
    renderInventoryFeatherAmountFilters();
    renderInventoryFeatherFilters();
    var grid = document.getElementById('inventory-feathers-grid');
    var empty = document.getElementById('inventory-feathers-empty');
    if (!grid || !empty) return;

    var meta = typeof globalThis.getFortuneMeta === 'function' ? globalThis.getFortuneMeta() : null;
    var store = (meta && meta.speciesFeathers) || {};
    var birds = globalThis.BIRDS || {};
    var entries = Object.keys(store)
      .filter(function (key) {
        return Math.floor(Number(store[key]) || 0) > 0;
      })
      .map(function (key) {
        var count = Math.floor(Number(store[key]) || 0);
        var cardTier =
          typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(key) : 'grey';
        var bird = birds[key];
        return {
          birdKey: key,
          birdName: bird && bird.name ? bird.name : key,
          count: count,
          cardTier: cardTier,
        };
      })
      .filter(function (row) {
        return FEATHER_FILTER === 'all' || row.cardTier === FEATHER_FILTER;
      })
      .filter(function (row) {
        return featherPassesAmountFilter(row.birdKey, row.count);
      })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.birdName.localeCompare(b.birdName);
      });

    if (!entries.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.textContent =
        FEATHER_AMOUNT_FILTER !== 'all'
          ? 'No feathers match this amount filter.'
          : FEATHER_FILTER === 'all'
          ? 'No Species Feathers yet. Hatch duplicates at The Hatchery.'
          : 'No Species Feathers for ' + speciesRarityLabel(FEATHER_FILTER) + ' tier birds.';
      return;
    }
    empty.hidden = true;
    grid.innerHTML = entries
      .map(function (row) {
        var css = tierCss(row.cardTier);
        var cardStars =
          typeof globalThis.getBirdCardStars === 'function' ? globalThis.getBirdCardStars(row.birdKey) : 0;
        var maxStars = (tierPack() && tierPack().STARS_PER_TIER) || 5;
        var starsHtml = '';
        for (var si = 0; si < maxStars; si++) {
          starsHtml +=
            '<span class="bird-card-star' +
            (si < cardStars ? ' is-filled' : '') +
            '">' +
            (si < cardStars ? '★' : '☆') +
            '</span>';
        }
        return (
          '<div class="inventory-feather-card ' +
          css +
          '" title="' +
          esc(row.birdName) +
          ' — ' +
          fmt(row.count) +
          ' Species Feathers">' +
          '<div class="inventory-feather-portrait">' +
          birdPortraitHtml(row.birdKey) +
          '</div>' +
          '<div class="inventory-feather-icon" aria-hidden="true">🪶</div>' +
          '<div class="inventory-feather-name">' +
          esc(row.birdName) +
          '</div>' +
          '<div class="inventory-feather-tier">' +
          esc(tierLabel(row.cardTier)) +
          ' · <span class="inventory-feather-stars">' +
          starsHtml +
          '</span></div>' +
          '<div class="inventory-feather-count">×' +
          fmt(row.count) +
          '</div>' +
          buildFeatherMutateBtn(row.birdKey) +
          '</div>'
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
    renderInventoryFeathers();
    renderInventoryMisc(rows.misc || []);
    setInventorySubView(INVENTORY_TAB);
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
  globalThis.setInventorySubView = setInventorySubView;
  globalThis.setInventoryFeatherFilter = setInventoryFeatherFilter;
  globalThis.setInventoryFeatherAmountFilter = setInventoryFeatherAmountFilter;
})();
