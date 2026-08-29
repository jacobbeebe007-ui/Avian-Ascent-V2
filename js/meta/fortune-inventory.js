/* War room Inventory — global holdings vault and artifact equip. */
(function () {
  'use strict';

  var INVENTORY_TAB = 'eggs';
  var INVENTORY_TABS = ['eggs', 'artifacts', 'vault'];
  var FEATHER_SACK_TAB = 'upgradable';
  var FEATHER_FILTER = 'all';
  var FEATHER_AMOUNT_FILTER = 'all';
  var FEATHER_SACK_TABS = [
    { id: 'upgradable', label: 'Upgradable' },
    { id: 'birds', label: 'Birds' },
  ];
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

  function normalizeInventoryTab(view) {
    if (view === 'feathers' || view === 'vault') return 'vault';
    if (view === 'misc' || view === 'eggs') return 'eggs';
    if (view === 'artifacts') return 'artifacts';
    return 'eggs';
  }

  function setInventorySubView(view) {
    INVENTORY_TAB = normalizeInventoryTab(view);
    INVENTORY_TABS.forEach(function (id) {
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
    if (INVENTORY_TAB === 'vault') renderInventoryFeathers();
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

  function setInventoryFeatherSackTab(tab) {
    FEATHER_SACK_TAB = tab === 'birds' ? 'birds' : 'upgradable';
    var wrap = document.getElementById('inventory-feather-tabs');
    if (wrap) {
      wrap.querySelectorAll('.inventory-feather-tab-btn').forEach(function (btn) {
        var t = btn.getAttribute('data-feather-sack-tab') || 'upgradable';
        var active = t === FEATHER_SACK_TAB;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    renderInventoryFeathers();
  }

  function renderInventoryFeatherTabs() {
    var wrap = document.getElementById('inventory-feather-tabs');
    if (!wrap) return;
    wrap.innerHTML = FEATHER_SACK_TABS.map(function (row) {
      var active = row.id === FEATHER_SACK_TAB;
      return (
        '<button type="button" class="inventory-feather-tab-btn' +
        (active ? ' is-active' : '') +
        '" role="tab" aria-selected="' +
        (active ? 'true' : 'false') +
        '" data-feather-sack-tab="' +
        esc(row.id) +
        '" data-action="setInventoryFeatherSackTab:' +
        esc(row.id) +
        '">' +
        esc(row.label) +
        '</button>'
      );
    }).join('');
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

  function buildFeatherMutateBtn(row) {
    if (!row || !row.ownsCard) return '<p class="bird-card-upgrade-hint">Hatch this bird card to upgrade.</p>';
    if (!row.progress || row.progress.isMax) return '<p class="bird-card-upgrade-hint">Card at maximum tier and stars.</p>';
    if (!row.progress.canUpgrade) return '';
    if (!row.canUpgrade) {
      return (
        '<p class="bird-card-upgrade-hint">Species Feathers: ' +
        fmt(row.count) +
        ' / ' +
        fmt(row.cost) +
        ' for next upgrade.</p>'
      );
    }
    var preview = row.progress.preview || {};
    var pack = tierPack();
    var nextTierLabel = pack && pack.TIER_LABELS ? pack.TIER_LABELS[preview.tierAfter] || preview.tierAfter : preview.tierAfter;
    var label = preview.isTierUp ? 'Preview ascend to ' + nextTierLabel : 'Preview upgrade';
    return (
      '<div class="bird-card-upgrade-wrap bird-card-upgrade-wrap--inventory">' +
      '<button type="button" class="bird-card-upgrade-btn bird-card-upgrade-btn--inventory" data-action="openBirdUpgradePreview:' +
      esc(row.birdKey) +
      '">' +
      esc(label) +
      ' (' +
      fmt(row.count) +
      '/' +
      fmt(row.cost) +
      ' 🪶)</button></div>'
    );
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
    var gooseEl = document.getElementById('inventory-balance-goose');
    var goose = 0;
    (rows.currency || []).forEach(function (row) {
      if (row.id === 'goldenGooseEggs') goose = row.count;
    });
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
    renderInventoryFeatherTabs();
    renderInventoryFeatherAmountFilters();
    renderInventoryFeatherFilters();
    var grid = document.getElementById('inventory-feathers-grid');
    var empty = document.getElementById('inventory-feathers-empty');
    var amountWrap = document.getElementById('inventory-feather-amount-filters');
    if (amountWrap) amountWrap.hidden = FEATHER_SACK_TAB !== 'birds';
    if (!grid || !empty) return;

    var meta = typeof globalThis.getFortuneMeta === 'function' ? globalThis.getFortuneMeta() : null;
    var store = (meta && meta.speciesFeathers) || {};
    var birds = globalThis.BIRDS || {};
    var entries = Object.keys(birds)
      .filter(function (key) {
        return birds[key] && birds[key].stats;
      })
      .map(function (key) {
        var count = Math.floor(Number(store[key]) || 0);
        var cardTier =
          typeof globalThis.getBirdCardTier === 'function' ? globalThis.getBirdCardTier(key) : 'grey';
        var bird = birds[key];
        var ownsCard = typeof globalThis.ownsBirdCard === 'function' ? globalThis.ownsBirdCard(key) : true;
        var progress = typeof globalThis.getBirdCardProgress === 'function' ? globalThis.getBirdCardProgress(key) : null;
        var cost = progress && progress.cost ? progress.cost : 0;
        var canUpgrade = !!(ownsCard && progress && progress.canUpgrade && count >= cost);
        return {
          birdKey: key,
          birdName: bird && bird.name ? bird.name : key,
          count: count,
          cardTier: cardTier,
          ownsCard: ownsCard,
          progress: progress,
          cost: cost,
          canUpgrade: canUpgrade,
        };
      })
      .filter(function (row) {
        return FEATHER_SACK_TAB === 'birds' || row.canUpgrade;
      })
      .filter(function (row) {
        return FEATHER_FILTER === 'all' || row.cardTier === FEATHER_FILTER;
      })
      .filter(function (row) {
        return FEATHER_SACK_TAB !== 'birds' || featherPassesAmountFilter(row.birdKey, row.count);
      })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.birdName.localeCompare(b.birdName);
      });

    if (!entries.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.textContent =
        FEATHER_SACK_TAB === 'upgradable'
          ? 'No birds are ready to upgrade. Hatch duplicates to collect enough Species Feathers.'
          : FEATHER_AMOUNT_FILTER !== 'all'
          ? 'No feathers match this amount filter.'
          : FEATHER_FILTER === 'all'
          ? 'No birds match this view.'
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
        var stateClass = row.canUpgrade ? ' is-upgradable' : row.count > 0 ? ' has-feathers' : ' has-no-feathers';
        return (
          '<div class="inventory-feather-card ' +
          css +
          stateClass +
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
          buildFeatherMutateBtn(row) +
          '</div>'
        );
      })
      .join('');
  }

  function renderInventoryMisc(misc) {
    var grid = document.getElementById('inventory-eggs-grid') || document.getElementById('inventory-misc-grid');
    var empty = document.getElementById('inventory-eggs-empty') || document.getElementById('inventory-misc-empty');
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
        var def =
          typeof globalThis.getFortuneItemDef === 'function' ? globalThis.getFortuneItemDef(item.id) : null;
        var eggId =
          def && def.eggId
            ? def.eggId
            : typeof globalThis.eggIdFromRescuedNestMisc === 'function'
            ? globalThis.eggIdFromRescuedNestMisc(item.id)
            : null;
        var openControls = '';
        if (eggId && item.count > 0) {
          var qty =
            typeof globalThis.getRescuedNestOpenQty === 'function'
              ? globalThis.getRescuedNestOpenQty(eggId)
              : 1;
          qty = Math.max(1, Math.min(item.count, Math.floor(Number(qty) || 1)));
          var canDec = qty > 1;
          var canInc = qty < item.count;
          openControls =
            '<div class="inventory-nest-open">' +
            '<div class="inventory-nest-stepper" role="group" aria-label="Open quantity">' +
            '<button type="button" class="inventory-nest-qty-btn" data-action="adjustRescuedNestOpenQty:' +
            esc(eggId) +
            ':-1"' +
            (canDec ? '' : ' disabled') +
            ' aria-label="Fewer">−</button>' +
            '<span class="inventory-nest-qty" aria-live="polite">' +
            fmt(qty) +
            '</span>' +
            '<button type="button" class="inventory-nest-qty-btn" data-action="adjustRescuedNestOpenQty:' +
            esc(eggId) +
            ':1"' +
            (canInc ? '' : ' disabled') +
            ' aria-label="More">+</button>' +
            '<button type="button" class="inventory-nest-all-btn" data-action="adjustRescuedNestOpenQty:' +
            esc(eggId) +
            ':all"' +
            (item.count > 1 ? '' : ' disabled') +
            '>All</button>' +
            '</div>' +
            '<button type="button" class="fortune-buy-btn inventory-open-btn" data-action="openRescuedNest:' +
            esc(eggId) +
            ':' +
            qty +
            '">Open ×' +
            fmt(qty) +
            '</button>' +
            '</div>';
        }
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
          '</p>' +
          openControls +
          '</div>'
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
  globalThis.setInventoryFeatherSackTab = setInventoryFeatherSackTab;
  globalThis.setInventoryFeatherFilter = setInventoryFeatherFilter;
  globalThis.setInventoryFeatherAmountFilter = setInventoryFeatherAmountFilter;
})();
