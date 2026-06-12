/* Cuckoo's Feathers & Fortune Emporium — war room store UI and purchases. */
(function () {
  'use strict';

  var FORTUNE_TAB = 'hiring';

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

  function setFortuneSubView(view) {
    FORTUNE_TAB = view === 'artifacts' ? 'artifacts' : view === 'trade' ? 'trade' : 'hiring';
    var hiringBtn = document.getElementById('fortune-nav-hiring');
    var artBtn = document.getElementById('fortune-nav-artifacts');
    var tradeBtn = document.getElementById('fortune-nav-trade');
    var hiringView = document.getElementById('fortune-view-hiring');
    var artView = document.getElementById('fortune-view-artifacts');
    var tradeView = document.getElementById('fortune-view-trade');
    var isHiring = FORTUNE_TAB === 'hiring';
    var isArtifacts = FORTUNE_TAB === 'artifacts';
    var isTrade = FORTUNE_TAB === 'trade';
    if (hiringBtn) {
      hiringBtn.classList.toggle('is-active', isHiring);
      hiringBtn.setAttribute('aria-selected', isHiring ? 'true' : 'false');
    }
    if (artBtn) {
      artBtn.classList.toggle('is-active', isArtifacts);
      artBtn.setAttribute('aria-selected', isArtifacts ? 'true' : 'false');
    }
    if (tradeBtn) {
      tradeBtn.classList.toggle('is-active', isTrade);
      tradeBtn.setAttribute('aria-selected', isTrade ? 'true' : 'false');
    }
    if (hiringView) hiringView.classList.toggle('is-active', isHiring);
    if (artView) artView.classList.toggle('is-active', isArtifacts);
    if (tradeView) tradeView.classList.toggle('is-active', isTrade);
  }

  function syncFortuneBalances() {
    var saved = typeof getSavedEggBalance === 'function' ? getSavedEggBalance() : 0;
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
    var savedEl = document.getElementById('fortune-balance-saved');
    var gooseEl = document.getElementById('fortune-balance-goose');
    if (savedEl) savedEl.textContent = fmt(saved);
    if (gooseEl) gooseEl.textContent = fmt(goose);
    var invSavedEl = document.getElementById('inventory-balance-saved');
    var invGooseEl = document.getElementById('inventory-balance-goose');
    if (invSavedEl) invSavedEl.textContent = fmt(saved);
    if (invGooseEl) invGooseEl.textContent = fmt(goose);
    var badge = document.getElementById('fortune-egg-badge');
    if (badge) {
      badge.textContent = saved > 0 ? fmt(saved) : '';
      badge.hidden = !(saved > 0);
    }
    if (typeof globalThis.syncInventoryHotspotBadge === 'function') globalThis.syncInventoryHotspotBadge();
  }

  function renderFortuneHiringGrid() {
    var grid = document.getElementById('fortune-hiring-grid');
    if (!grid) return;
    if (typeof globalThis.rebuildFortuneHireCatalog === 'function') globalThis.rebuildFortuneHireCatalog();
    var catalog = globalThis.FORTUNE_HIRE_BIRDS || [];
    var birds = globalThis.BIRDS || {};
    var saved = typeof getSavedEggBalance === 'function' ? getSavedEggBalance() : 0;
    if (!catalog.length) {
      grid.innerHTML = '<p class="fortune-empty">No hireable birds in the catalog yet.</p>';
      return;
    }
    var html = '';
    catalog.forEach(function (row) {
      var bird = birds[row.birdKey];
      if (!bird) return;
      var unlocked = typeof globalThis.isUnlocked === 'function' && globalThis.isUnlocked(row.unlockId);
      var canAfford = saved >= row.savedEggCost;
      var cls = typeof globalThis.classToRoleId === 'function' ? globalThis.classToRoleId(bird.class) : 'striker';
      var clsLabel = typeof globalThis.idToClassLabel === 'function' ? globalThis.idToClassLabel(cls) : cls;
      var sizeClass = typeof globalThis.getUISizeClass === 'function' ? globalThis.getUISizeClass(bird, 'select') : 'medium';
      var icon =
        typeof globalThis.renderBirdIconHTML === 'function'
          ? globalThis.renderBirdIconHTML(row.birdKey, sizeClass, !unlocked)
          : '🐦';
      var stateClass = unlocked ? ' is-owned' : canAfford ? ' is-affordable' : ' is-locked';
      var btnLabel = unlocked ? 'Hired' : 'Hire · ' + fmt(row.savedEggCost) + ' 🥚';
      var btnDisabled = unlocked || !canAfford;
      html +=
        '<div class="fortune-hire-card' +
        stateClass +
        '">' +
        '<div class="fortune-hire-top">' +
        '<span class="class-badge class-' +
        esc(cls) +
        '">' +
        esc(clsLabel.toUpperCase()) +
        '</span>' +
        '<span class="fortune-hire-cost">' +
        (unlocked ? '✓ Roster' : fmt(row.savedEggCost) + ' Saved Eggs') +
        '</span></div>' +
        '<div class="fortune-hire-icon">' +
        icon +
        '</div>' +
        '<div class="fortune-hire-name">' +
        esc(bird.name) +
        '</div>' +
        '<p class="fortune-hire-hint">' +
        esc(unlocked ? 'Permanently on your roster.' : row.unlockHint || 'Unlock this champion for all future Flights.') +
        '</p>' +
        '<button type="button" class="fortune-buy-btn" data-action="purchaseFortuneBird:' +
        esc(row.birdKey) +
        '" ' +
        (btnDisabled ? 'disabled' : '') +
        '>' +
        esc(btnLabel) +
        '</button></div>';
    });
    grid.innerHTML = html;
  }

  function renderFortuneArtifactsGrid() {
    var grid = document.getElementById('fortune-artifacts-grid');
    if (!grid) return;
    var stubs = globalThis.FORTUNE_ARTIFACT_STUBS || [];
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
    if (!stubs.length) {
      grid.innerHTML = '<p class="fortune-empty">Artifacts coming soon.</p>';
      return;
    }
    var html = '';
    stubs.forEach(function (art) {
      var cost = Math.max(0, Math.floor(Number(art.gooseEggCost) || 0));
      var owned = typeof globalThis.ownsArtifact === 'function' && globalThis.ownsArtifact(art.id);
      var canAfford = goose >= cost;
      var stateClass = owned ? ' is-owned' : canAfford ? ' is-affordable' : ' is-locked';
      var btnLabel = owned ? 'Owned' : 'Buy · ' + fmt(cost) + ' 🪿';
      var btnDisabled = owned || !canAfford;
      html +=
        '<div class="fortune-artifact-card' +
        stateClass +
        '">' +
        '<div class="fortune-artifact-icon">' +
        esc(art.icon) +
        '</div>' +
        '<div class="fortune-artifact-name">' +
        esc(art.name) +
        '</div>' +
        '<p class="fortune-artifact-desc">' +
        esc(art.desc) +
        '</p>' +
        '<button type="button" class="fortune-buy-btn fortune-buy-btn--artifact" data-action="purchaseFortuneArtifact:' +
        esc(art.id) +
        '" ' +
        (btnDisabled ? 'disabled' : '') +
        '>' +
        esc(btnLabel) +
        '</button></div>';
    });
    grid.innerHTML = html;
  }

  function renderFortuneTradeGrid() {
    var grid = document.getElementById('fortune-trade-grid');
    if (!grid) return;
    var offers = globalThis.FORTUNE_TRADE_OFFERS || [];
    var saved = typeof getSavedEggBalance === 'function' ? getSavedEggBalance() : 0;
    if (!offers.length) {
      grid.innerHTML = '<p class="fortune-empty">No trade offers available yet.</p>';
      return;
    }
    var html = '';
    offers.forEach(function (offer) {
      var purchases =
        typeof globalThis.getTradePurchaseCount === 'function' ? globalThis.getTradePurchaseCount(offer.id) : 0;
      var maxed = offer.maxPurchases != null && purchases >= Math.max(0, Math.floor(Number(offer.maxPurchases) || 0));
      var cost =
        typeof globalThis.getTradeOfferCost === 'function'
          ? globalThis.getTradeOfferCost(offer, purchases)
          : Math.max(0, Math.floor(Number(offer.baseCost) || 0));
      var canAfford = saved >= cost;
      var stateClass = maxed ? ' is-owned' : canAfford ? ' is-affordable' : ' is-locked';
      var btnLabel = maxed ? 'Maxed' : canAfford ? 'Trade · ' + fmt(cost) + ' 🥚' : 'Need more eggs';
      var btnDisabled = maxed || !canAfford;
      var progress =
        offer.maxPurchases != null
          ? '<p class="fortune-trade-progress">' +
            esc(String(purchases) + '/' + String(offer.maxPurchases)) +
            (offer.capLabel ? ' · ' + esc(offer.capLabel) : '') +
            '</p>'
          : '';
      html +=
        '<div class="fortune-artifact-card fortune-trade-card' +
        stateClass +
        '">' +
        '<div class="fortune-artifact-icon">' +
        esc(offer.icon) +
        '</div>' +
        '<div class="fortune-artifact-name">' +
        esc(offer.name) +
        '</div>' +
        '<p class="fortune-artifact-desc">' +
        esc(offer.desc) +
        '</p>' +
        progress +
        '<button type="button" class="fortune-buy-btn" data-action="purchaseFortuneTrade:' +
        esc(offer.id) +
        '" ' +
        (btnDisabled ? 'disabled' : '') +
        '>' +
        esc(btnLabel) +
        '</button></div>';
    });
    grid.innerHTML = html;
  }

  function renderFortuneShop() {
    syncFortuneBalances();
    renderFortuneHiringGrid();
    renderFortuneArtifactsGrid();
    renderFortuneTradeGrid();
    setFortuneSubView(FORTUNE_TAB);
  }

  function purchaseFortuneBird(birdKey) {
    if (typeof globalThis.rebuildFortuneHireCatalog === 'function') globalThis.rebuildFortuneHireCatalog();
    var row = (globalThis.FORTUNE_HIRE_BIRDS || []).find(function (r) {
      return r.birdKey === birdKey;
    });
    if (!row) return;
    if (typeof globalThis.isUnlocked === 'function' && globalThis.isUnlocked(row.unlockId)) {
      renderFortuneShop();
      return;
    }
    if (typeof globalThis.spendSavedEggs !== 'function' || !globalThis.spendSavedEggs(row.savedEggCost)) return;
    if (typeof globalThis.grantUnlock === 'function') globalThis.grantUnlock(row.unlockId);
    var bird = (globalThis.BIRDS || {})[birdKey];
    var msg = document.getElementById('fortune-shop-msg');
    if (msg) {
      msg.textContent = (bird && bird.name ? bird.name : birdKey) + ' hired for all future Flights!';
      msg.style.color = 'var(--gold-light)';
    }
    renderFortuneShop();
    if (typeof globalThis.initSelectionSafe === 'function') globalThis.initSelectionSafe();
  }

  function purchaseFortuneArtifact(artifactId) {
    var art = (globalThis.FORTUNE_ARTIFACT_STUBS || []).find(function (a) {
      return a.id === artifactId;
    });
    if (!art) return;
    if (typeof globalThis.ownsArtifact === 'function' && globalThis.ownsArtifact(artifactId)) {
      renderFortuneShop();
      return;
    }
    var cost = Math.max(0, Math.floor(Number(art.gooseEggCost) || 0));
    if (typeof globalThis.spendGoldenGooseEggs !== 'function' || !globalThis.spendGoldenGooseEggs(cost)) return;
    if (typeof globalThis.grantArtifact === 'function') globalThis.grantArtifact(artifactId);
    var autoEquipped =
      typeof globalThis.getEquippedArtifactId === 'function' &&
      globalThis.getEquippedArtifactId() === artifactId;
    var msg = document.getElementById('fortune-shop-msg');
    if (msg) {
      msg.textContent = autoEquipped
        ? art.name + ' acquired and equipped for your next Flight.'
        : art.name + ' acquired! Equip it from Inventory before your next Flight.';
      msg.style.color = 'var(--gold-light)';
    }
    renderFortuneShop();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
  }

  function purchaseFortuneTrade(tradeId) {
    if (typeof globalThis.commitFortuneTradePurchase !== 'function') return;
    var result = globalThis.commitFortuneTradePurchase(tradeId);
    var msg = document.getElementById('fortune-shop-msg');
    if (!result || !result.ok) {
      if (msg) {
        if (result && result.reason === 'maxed') msg.textContent = 'This trade is maxed out.';
        else if (result && result.reason === 'funds') msg.textContent = 'Not enough Saved Eggs.';
        else msg.textContent = 'Trade unavailable.';
        msg.style.color = 'var(--text-dim)';
      }
      renderFortuneShop();
      return;
    }
    if (msg) {
      var offer = result.offer || {};
      msg.textContent = (offer.name || 'Trade') + ' complete!';
      msg.style.color = 'var(--gold-light)';
    }
    renderFortuneShop();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
  }

  function getCompletedStagesForFlight() {
    var g = globalThis.G;
    if (!g) return 0;
    var stage = Math.max(1, Math.floor(Number(g.stage) || 1));
    return Math.max(0, stage - 1);
  }

  /** Award Saved Eggs at end of Flight: 1 per stage completed (victory or defeat only). */
  function awardFlightSavedEggs() {
    var n = getCompletedStagesForFlight();
    if (!n || typeof globalThis.addSavedEggs !== 'function') return 0;
    globalThis.addSavedEggs(n);
    if (typeof globalThis.syncFortuneBalances === 'function') globalThis.syncFortuneBalances();
    return n;
  }

  globalThis.setFortuneSubView = setFortuneSubView;
  globalThis.renderFortuneShop = renderFortuneShop;
  globalThis.syncFortuneBalances = syncFortuneBalances;
  globalThis.purchaseFortuneBird = purchaseFortuneBird;
  globalThis.purchaseFortuneArtifact = purchaseFortuneArtifact;
  globalThis.purchaseFortuneTrade = purchaseFortuneTrade;
  globalThis.getCompletedStagesForFlight = getCompletedStagesForFlight;
  globalThis.awardFlightSavedEggs = awardFlightSavedEggs;
})();
