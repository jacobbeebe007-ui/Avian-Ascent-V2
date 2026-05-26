/* Feathers & Fortune — war room store UI and purchases. */
(function () {
  'use strict';

  var FORTUNE_TAB = 'hiring';
  var ARTIFACT_EGG_COST = 1;

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
    FORTUNE_TAB = view === 'artifacts' ? 'artifacts' : 'hiring';
    var hiringBtn = document.getElementById('fortune-nav-hiring');
    var artBtn = document.getElementById('fortune-nav-artifacts');
    var hiringView = document.getElementById('fortune-view-hiring');
    var artView = document.getElementById('fortune-view-artifacts');
    var isHiring = FORTUNE_TAB === 'hiring';
    if (hiringBtn) {
      hiringBtn.classList.toggle('is-active', isHiring);
      hiringBtn.setAttribute('aria-selected', isHiring ? 'true' : 'false');
    }
    if (artBtn) {
      artBtn.classList.toggle('is-active', !isHiring);
      artBtn.setAttribute('aria-selected', !isHiring ? 'true' : 'false');
    }
    if (hiringView) hiringView.classList.toggle('is-active', isHiring);
    if (artView) artView.classList.toggle('is-active', !isHiring);
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
      var owned = typeof globalThis.ownsArtifact === 'function' && globalThis.ownsArtifact(art.id);
      var canAfford = goose >= ARTIFACT_EGG_COST;
      var stateClass = owned ? ' is-owned' : canAfford ? ' is-affordable' : ' is-locked';
      var btnLabel = owned ? 'Owned' : 'Buy · ' + fmt(ARTIFACT_EGG_COST) + ' 🪿';
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
        '<p class="fortune-artifact-note">Gameplay effect coming soon.</p>' +
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

  function renderFortuneShop() {
    syncFortuneBalances();
    renderFortuneHiringGrid();
    renderFortuneArtifactsGrid();
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
    if (typeof globalThis.spendGoldenGooseEggs !== 'function' || !globalThis.spendGoldenGooseEggs(ARTIFACT_EGG_COST)) return;
    if (typeof globalThis.grantArtifact === 'function') globalThis.grantArtifact(artifactId);
    var msg = document.getElementById('fortune-shop-msg');
    if (msg) {
      msg.textContent = art.name + ' acquired! (Effect activates in a future update.)';
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
  globalThis.getCompletedStagesForFlight = getCompletedStagesForFlight;
  globalThis.awardFlightSavedEggs = awardFlightSavedEggs;
  globalThis.FORTUNE_ARTIFACT_EGG_COST = ARTIFACT_EGG_COST;
})();
