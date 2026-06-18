/* Cuckoo's Feathers & Fortune Emporium — war room store UI and purchases. */
(function () {
  'use strict';

  var FORTUNE_TAB = 'trade';
  var HATCH_BATCH_SIZE = 10;
  var ROYAL_EGG_CLASS = 'knight';

  var ROYAL_CLASSES = ['knight', 'brute', 'rogue', 'mage', 'siren', 'inquisitor', 'bard'];

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

  function tierCss(tier) {
    var pack = tierPack();
    return (pack && pack.TIER_CSS && pack.TIER_CSS[tier]) || 'tier-grey';
  }

  function speciesRarityLabel(tier) {
    var pack = tierPack();
    return (pack && pack.SPECIES_RARITY_LABELS && pack.SPECIES_RARITY_LABELS[tier]) || tierLabel(tier);
  }

  function eggTypeDef(eggId) {
    var cat = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
    if (cat && typeof cat.getEggTypeDef === 'function') return cat.getEggTypeDef(eggId);
    var types = globalThis.MOTHER_GOOSE_EGG_TYPES || {};
    return types[eggId] || null;
  }
  function speciesTierForBird(birdKey) {
    var cat = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.motherGooseCatalog;
    if (cat && typeof cat.getBirdSpeciesRow === 'function') {
      var row = cat.getBirdSpeciesRow(birdKey);
      if (row && row.speciesTier) return row.speciesTier;
    }
    return 'grey';
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

  var _hatchRevealTimers = [];

  function clearHatchRevealTimers() {
    _hatchRevealTimers.forEach(function (t) {
      clearTimeout(t);
    });
    _hatchRevealTimers = [];
  }

  function buildHatchSlotsHtml(results, eggType) {
    var def = eggTypeDef(eggType) || { icon: '🥚', id: eggType || 'cracked' };
    var list = Array.isArray(results) ? results : [];
    var html = '';
    list.forEach(function (result) {
      html +=
        '<div class="mother-goose-hatch-slot">' +
        '<div class="mother-goose-hatch-flip is-shaking">' +
        '<div class="mother-goose-hatch-flip-front">' +
        '<span class="mother-goose-hatch-egg mother-goose-egg-icon mother-goose-egg-icon--' +
        esc(def.id) +
        '" aria-hidden="true">' +
        esc(def.icon) +
        '</span></div>' +
        '<div class="mother-goose-hatch-flip-back" aria-hidden="true">' +
        buildHatchRevealHtml(result, true) +
        '</div></div></div>';
    });
    return html;
  }

  function closeMotherGooseHatchModal() {
    clearHatchRevealTimers();
    var modal = document.getElementById('mother-goose-hatch-modal');
    var panel = modal && modal.querySelector('.mother-goose-hatch-panel');
    var eggWrap = document.getElementById('mother-goose-hatch-egg-wrap');
    var eggGrid = document.getElementById('mother-goose-hatch-egg-grid');
    var reveal = document.getElementById('mother-goose-hatch-reveal');
    var closeBtn = document.getElementById('mother-goose-hatch-close');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (panel) {
      panel.classList.remove('mother-goose-hatch-panel--batch', 'mother-goose-hatch-panel--single');
    }
    if (eggWrap) {
      eggWrap.hidden = false;
      eggWrap.classList.remove('mother-goose-hatch-egg-wrap--single');
    }
    if (eggGrid) {
      eggGrid.innerHTML = '';
      eggGrid.classList.remove('mother-goose-hatch-egg-grid--batch', 'mother-goose-hatch-egg-grid--single');
    }
    if (reveal) {
      reveal.hidden = true;
      reveal.innerHTML = '';
      reveal.classList.remove('mother-goose-hatch-reveal--batch');
    }
    if (closeBtn) closeBtn.hidden = true;
  }

  function buildHatchRevealHtml(result, compact) {
    var birdKey = result.birdKey;
    var birdName = result.birdName || birdKey;
    var birds = globalThis.BIRDS || {};
    var bird = birds[birdKey];
    var cls =
      bird && typeof globalThis.classToRoleId === 'function'
        ? globalThis.classToRoleId(bird.class)
        : 'knight';
    var classLabel =
      typeof globalThis.idToClassLabel === 'function' ? globalThis.idToClassLabel(cls) : cls;
    var speciesTier = speciesTierForBird(birdKey);
    var speciesCss = tierCss(speciesTier);

    if (result.isNew) {
      var cardTier = result.tierAfter || 'grey';
      var cardCss = tierCss(cardTier);
      var cardHtml =
        '<div class="mother-goose-hatch-card mother-goose-hatch-card--bird ' +
        cardCss +
        '">' +
        '<span class="class-badge class-' +
        esc(cls) +
        '">' +
        esc(String(classLabel).toUpperCase()) +
        '</span>' +
        '<div class="mother-goose-hatch-portrait">' +
        birdPortraitHtml(birdKey) +
        '</div>' +
        '<div class="mother-goose-hatch-card-name">' +
        esc(birdName) +
        '</div>' +
        '<span class="bird-card-tier-badge ' +
        speciesCss +
        '">' +
        esc(speciesRarityLabel(speciesTier)) +
        '</span></div>';
      if (compact) return cardHtml;
      return (
        cardHtml +
        '<p class="mother-goose-hatch-msg">Congratulations you have unlocked <strong>' +
        esc(birdName) +
        '</strong>! This bird is now unlocked and playable from Character Select.</p>'
      );
    }

    var gain = Math.max(0, Math.floor(Number(result.feathersGained) || 0));
    var total = Math.max(0, Math.floor(Number(result.speciesFeatherTotal) || 0));
    var featherHtml =
      '<div class="mother-goose-hatch-card mother-goose-hatch-card--feather ' +
      speciesCss +
      '">' +
      '<div class="mother-goose-hatch-feather-glyph" aria-hidden="true">🪶</div>' +
      '<div class="mother-goose-hatch-card-name">' +
      esc(birdName) +
      '</div>' +
      '<span class="bird-card-tier-badge ' +
      speciesCss +
      '">Species Feather</span>' +
      '<div class="mother-goose-hatch-feather-gain">+' +
      fmt(gain || total) +
      '</div>' +
      '<div class="mother-goose-hatch-feather-total mother-goose-hatch-feather-total--secondary">Total: ' +
      fmt(total) +
      '</div></div>';
    if (compact) return featherHtml;
    return featherHtml + '<p class="mother-goose-hatch-msg">Species Feather — Collect more to mutate your bird.</p>';
  }

  function showMotherGooseHatchModal(result, eggType) {
    showMotherGooseHatchModalBatch([result], eggType, 1);
  }

  function showMotherGooseHatchModalBatch(results, eggType, count) {
    var modal = document.getElementById('mother-goose-hatch-modal');
    var panel = modal && modal.querySelector('.mother-goose-hatch-panel');
    var eggWrap = document.getElementById('mother-goose-hatch-egg-wrap');
    var eggGrid = document.getElementById('mother-goose-hatch-egg-grid');
    var reveal = document.getElementById('mother-goose-hatch-reveal');
    var closeBtn = document.getElementById('mother-goose-hatch-close');
    if (!modal || !eggGrid || !results || !results.length) {
      if (results && results[0]) showMotherGooseResult(results[0]);
      return;
    }

    var batch = results.length > 1;
    var eggId = eggType || results[0].eggType;
    closeMotherGooseHatchModal();

    if (panel) panel.classList.add(batch ? 'mother-goose-hatch-panel--batch' : 'mother-goose-hatch-panel--single');
    if (eggWrap) {
      eggWrap.hidden = false;
      if (!batch) eggWrap.classList.add('mother-goose-hatch-egg-wrap--single');
    }
    if (eggGrid) {
      eggGrid.classList.add(batch ? 'mother-goose-hatch-egg-grid--batch' : 'mother-goose-hatch-egg-grid--single');
      eggGrid.innerHTML = buildHatchSlotsHtml(results, eggId);
    }
    if (reveal) {
      reveal.innerHTML = '';
      reveal.hidden = true;
      reveal.classList.remove('mother-goose-hatch-reveal--batch');
    }
    if (closeBtn) closeBtn.hidden = true;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    var flips = eggGrid ? eggGrid.querySelectorAll('.mother-goose-hatch-flip') : [];
    var flipMs = 520;
    var staggerMs = 100;
    var shakeMs = 1400;

    _hatchRevealTimers.push(
      setTimeout(function () {
        flips.forEach(function (flip, idx) {
          _hatchRevealTimers.push(
            setTimeout(function () {
              flip.classList.remove('is-shaking');
              flip.classList.add('is-flipped');
              var back = flip.querySelector('.mother-goose-hatch-flip-back');
              if (back) back.setAttribute('aria-hidden', 'false');
              var front = flip.querySelector('.mother-goose-hatch-flip-front');
              if (front) front.setAttribute('aria-hidden', 'true');
              if (idx === flips.length - 1) {
                _hatchRevealTimers.push(
                  setTimeout(function () {
                    if (closeBtn) closeBtn.hidden = false;
                  }, flipMs),
                );
              }
            }, idx * staggerMs),
          );
        });
      }, shakeMs),
    );
  }

  function setFortuneSubView(view) {
    FORTUNE_TAB = view === 'artifacts' ? 'artifacts' : 'trade';
    var artBtn = document.getElementById('fortune-nav-artifacts');
    var tradeBtn = document.getElementById('fortune-nav-trade');
    var artView = document.getElementById('fortune-view-artifacts');
    var tradeView = document.getElementById('fortune-view-trade');
    var isArtifacts = FORTUNE_TAB === 'artifacts';
    var isTrade = FORTUNE_TAB === 'trade';
    if (artBtn) {
      artBtn.classList.toggle('is-active', isArtifacts);
      artBtn.setAttribute('aria-selected', isArtifacts ? 'true' : 'false');
    }
    if (tradeBtn) {
      tradeBtn.classList.toggle('is-active', isTrade);
      tradeBtn.setAttribute('aria-selected', isTrade ? 'true' : 'false');
    }
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
    var hatchSavedEl = document.getElementById('hatchery-balance-saved');
    var hatchGooseEl = document.getElementById('hatchery-balance-goose');
    if (hatchSavedEl) hatchSavedEl.textContent = fmt(saved);
    if (hatchGooseEl) hatchGooseEl.textContent = fmt(goose);
    var badge = document.getElementById('fortune-egg-badge');
    if (badge) {
      badge.textContent = saved > 0 ? fmt(saved) : '';
      badge.hidden = !(saved > 0);
    }
    if (typeof globalThis.syncInventoryHotspotBadge === 'function') globalThis.syncInventoryHotspotBadge();
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
      var btnLabel = owned ? 'Owned' : 'Buy · ' + fmt(cost) + ' Golden Goose Eggs';
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
      var bulkBtns = '';
      if (offer.id === 'trade_goldenGoose' && !maxed) {
        [1, 10, 100].forEach(function (qty) {
          var bulkCost = cost * qty;
          var canBulk = saved >= bulkCost;
          bulkBtns +=
            '<button type="button" class="fortune-buy-btn fortune-buy-btn--bulk" data-action="purchaseFortuneTrade:' +
            esc(offer.id) +
            ':' +
            qty +
            '" ' +
            (canBulk ? '' : 'disabled') +
            '>Buy ×' +
            qty +
            ' · ' +
            fmt(bulkCost) +
            ' 🥚</button>';
        });
      }
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
        (offer.id === 'trade_goldenGoose' && bulkBtns
          ? '<div class="fortune-trade-bulk-btns">' + bulkBtns + '</div>'
          : '<button type="button" class="fortune-buy-btn" data-action="purchaseFortuneTrade:' +
            esc(offer.id) +
            '" ' +
            (btnDisabled ? 'disabled' : '') +
            '>' +
            esc(btnLabel) +
            '</button>') +
        '</div>';
    });
    grid.innerHTML = html;
  }

  function renderMotherGoosePity() {
    var el = document.getElementById('mother-goose-pity');
    if (!el || typeof globalThis.getPityState !== 'function') return;
    var pity = globalThis.getPityState();
    var parts = ['Eggs until next safety: ' + fmt(pity.eggsUntilNext || 0)];
    if (pity.pityChoicePending && pity.pityChoiceOptions && pity.pityChoiceOptions.length) {
      parts.push('Pity choice ready (modal TODO). Options: ' + pity.pityChoiceOptions.join(', '));
    }
    el.textContent = parts.join(' · ');
  }

  function renderMotherGooseGrid() {
    var grid = document.getElementById('mother-goose-grid');
    if (!grid) return;
    var types = globalThis.MOTHER_GOOSE_EGG_TYPES || {};
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
    var html = '';
    Object.keys(types).forEach(function (id) {
      var egg = eggTypeDef(id) || types[id];
      if (!egg) return;
      var cost = Math.max(0, Math.floor(Number(egg.cost) || 0));
      var batchCost = cost * HATCH_BATCH_SIZE;
      var enabled = !!egg.enabled;
      var canAfford = goose >= cost;
      var canAffordBatch = goose >= batchCost;
      var stateClass = !enabled ? ' is-disabled' : canAfford ? ' is-affordable' : ' is-locked';
      var hatchOneAction = id === 'royal' ? 'hatchRoyalEgg:' + ROYAL_EGG_CLASS : 'purchaseMotherGooseEgg:' + id;
      var hatchBatchAction =
        id === 'royal' ? 'hatchRoyalEggBatch:' + ROYAL_EGG_CLASS : 'purchaseMotherGooseEggBatch:' + id;
      var btnOneLabel = !enabled ? 'Coming soon' : 'Hatch ×1 · ' + fmt(cost) + ' 🪿';
      var btnBatchLabel = !enabled ? 'Coming soon' : 'Hatch ×10 · ' + fmt(batchCost) + ' 🪿';
      var btnOneDisabled = !enabled || !canAfford;
      var btnBatchDisabled = !enabled || !canAffordBatch;
      var royalPick =
        id === 'royal' && enabled
          ? '<div class="mother-goose-class-pick" role="group" aria-label="Royal Egg class">' +
            ROYAL_CLASSES.map(function (cls) {
              var active = cls === ROYAL_EGG_CLASS ? ' is-active' : '';
              return (
                '<button type="button" class="mother-goose-class-btn' +
                active +
                '" data-action="setRoyalEggClass:' +
                esc(cls) +
                '">' +
                esc(cls) +
                '</button>'
              );
            }).join('') +
            '</div>'
          : '';
      html +=
        '<div class="fortune-artifact-card mother-goose-egg-card' +
        stateClass +
        '">' +
        '<div class="fortune-artifact-icon mother-goose-egg-icon mother-goose-egg-icon--' +
        esc(id) +
        '">' +
        esc(egg.icon) +
        '</div>' +
        '<div class="fortune-artifact-name">' +
        esc(egg.name) +
        '</div>' +
        '<p class="fortune-artifact-desc">' +
        esc(egg.desc || '') +
        '</p>' +
        royalPick +
        '<div class="mother-goose-hatch-btns">' +
        '<button type="button" class="fortune-buy-btn" data-action="' +
        esc(hatchOneAction) +
        '" ' +
        (btnOneDisabled ? 'disabled' : '') +
        '>' +
        esc(btnOneLabel) +
        '</button>' +
        '<button type="button" class="fortune-buy-btn fortune-buy-btn--batch" data-action="' +
        esc(hatchBatchAction) +
        '" ' +
        (btnBatchDisabled ? 'disabled' : '') +
        '>' +
        esc(btnBatchLabel) +
        '</button></div></div>';
    });
    grid.innerHTML = html || '<p class="fortune-empty">No eggs configured.</p>';
    renderMotherGoosePity();
  }

  function showMotherGooseResult(result) {
    var el = document.getElementById('mother-goose-result');
    if (!el) return;
    if (!result || !result.ok) {
      el.textContent = result && result.reason === 'funds' ? 'Not enough Golden Goose Eggs.' : 'Hatch failed.';
      el.className = 'mother-goose-result mother-goose-result--error';
      return;
    }
    el.className = 'mother-goose-result mother-goose-result--success';
    el.innerHTML =
      '<strong>' +
      esc(result.message || 'Hatched!') +
      '</strong>' +
      (result.isNew
        ? '<p>New card at tier ' + esc(result.tierAfter || 'grey') + '.</p>'
        : '<p>+' + fmt(result.feathersGained || 0) + ' Species Feathers</p><p class="mother-goose-hatch-feather-total--secondary">Total: ' + fmt(result.speciesFeatherTotal || 0) + '</p>');
  }

  function afterHatchRefresh(msgText) {
    renderHatchery();
    if (typeof globalThis.initSelectionSafe === 'function') globalThis.initSelectionSafe();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
  }

  function purchaseMotherGooseEgg(eggType) {
    if (typeof globalThis.hatchEgg !== 'function') return;
    var result = globalThis.hatchEgg(eggType, {});
    if (result && result.ok) showMotherGooseHatchModal(result, eggType);
    else showMotherGooseResult(result);
    afterHatchRefresh(result && result.ok ? result.message || 'Egg hatched!' : '');
  }

  function purchaseMotherGooseEggBatch(eggType) {
    if (typeof globalThis.hatchEggsBatch !== 'function') return;
    var batch = globalThis.hatchEggsBatch(eggType, HATCH_BATCH_SIZE, {});
    if (batch && batch.ok) showMotherGooseHatchModalBatch(batch.results, eggType, HATCH_BATCH_SIZE);
    else showMotherGooseResult(batch && batch.results && batch.results[0] ? batch.results[0] : batch);
    afterHatchRefresh(
      batch && batch.ok
        ? 'Hatched ' + fmt(batch.results.length) + ' eggs!'
        : batch && batch.reason === 'funds'
          ? 'Not enough Golden Goose Eggs for ×10 hatch.'
          : '',
    );
  }

  function hatchRoyalEgg(classId) {
    if (typeof globalThis.hatchEgg !== 'function') return;
    var cls = classId || ROYAL_EGG_CLASS;
    var result = globalThis.hatchEgg('royal', { classFilter: cls });
    if (result && result.ok) showMotherGooseHatchModal(result, 'royal');
    else showMotherGooseResult(result);
    afterHatchRefresh(result && result.ok ? result.message || 'Royal egg hatched!' : '');
  }

  function hatchRoyalEggBatch(classId) {
    if (typeof globalThis.hatchEggsBatch !== 'function') return;
    var cls = classId || ROYAL_EGG_CLASS;
    var batch = globalThis.hatchEggsBatch('royal', HATCH_BATCH_SIZE, { classFilter: cls });
    if (batch && batch.ok) showMotherGooseHatchModalBatch(batch.results, 'royal', HATCH_BATCH_SIZE);
    else showMotherGooseResult(batch && batch.results && batch.results[0] ? batch.results[0] : batch);
    afterHatchRefresh(
      batch && batch.ok
        ? 'Hatched ' + fmt(batch.results.length) + ' Royal eggs!'
        : batch && batch.reason === 'funds'
          ? 'Not enough Golden Goose Eggs for ×10 hatch.'
          : '',
    );
  }

  function setRoyalEggClass(classId) {
    if (!classId) return;
    ROYAL_EGG_CLASS = String(classId).toLowerCase();
    renderMotherGooseGrid();
  }

  function resolvePityChoiceAction(birdKey) {
    if (typeof globalThis.resolvePityChoice !== 'function') return;
    var result = globalThis.resolvePityChoice(birdKey);
    var msg = document.getElementById('fortune-shop-msg');
    if (msg) {
      msg.textContent = result && result.ok ? 'Pity choice: ' + birdKey + ' granted!' : 'Could not resolve pity choice.';
      msg.style.color = result && result.ok ? 'var(--gold-light)' : 'var(--text-dim)';
    }
    renderHatchery();
  }

  function renderMotherGooseShop() {
    renderMotherGoosePity();
    renderMotherGooseGrid();
  }

  function renderHatchery() {
    syncFortuneBalances();
    renderMotherGooseShop();
  }

  function renderFortuneShop() {
    syncFortuneBalances();
    renderFortuneArtifactsGrid();
    renderFortuneTradeGrid();
    setFortuneSubView(FORTUNE_TAB);
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

  function purchaseFortuneTrade(spec) {
    if (typeof globalThis.commitFortuneTradePurchase !== 'function') return;
    var tradeId = spec;
    var count = 1;
    if (typeof spec === 'string' && spec.indexOf(':') >= 0) {
      var parts = spec.split(':');
      tradeId = parts[0];
      count = Math.max(1, Math.floor(Number(parts[1]) || 1));
    }
    var result = globalThis.commitFortuneTradePurchase(tradeId, count);
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
  globalThis.renderHatchery = renderHatchery;
  globalThis.syncFortuneBalances = syncFortuneBalances;
  globalThis.purchaseFortuneArtifact = purchaseFortuneArtifact;
  globalThis.purchaseFortuneTrade = purchaseFortuneTrade;
  globalThis.purchaseMotherGooseEgg = purchaseMotherGooseEgg;
  globalThis.purchaseMotherGooseEggBatch = purchaseMotherGooseEggBatch;
  globalThis.hatchRoyalEgg = hatchRoyalEgg;
  globalThis.hatchRoyalEggBatch = hatchRoyalEggBatch;
  globalThis.setRoyalEggClass = setRoyalEggClass;
  globalThis.resolvePityChoiceAction = resolvePityChoiceAction;
  globalThis.closeMotherGooseHatchModal = closeMotherGooseHatchModal;
  globalThis.getCompletedStagesForFlight = getCompletedStagesForFlight;
  globalThis.awardFlightSavedEggs = awardFlightSavedEggs;
})();
