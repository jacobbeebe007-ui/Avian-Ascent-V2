/* Cuckoo's Feathers & Fortune Emporium — war room store UI and purchases. */
(function () {
  'use strict';

  var FORTUNE_TAB = 'trade';
  var HATCHERY_TAB = 'mother';
  var HATCH_BATCH_SIZE = 10;
  var ROYAL_EGG_CLASS = 'knight';

  var ROYAL_CLASSES = ['knight', 'brute', 'rogue', 'mage', 'siren', 'inquisitor', 'bard'];

  var EGG_SPECIES_TIER = {
    cracked: 'grey',
    feathered: 'green',
    gleaming: 'blue',
    royal: 'purple',
    ancestral: 'orange',
  };

  var EGG_RARITY_CHIP = {
    cracked: { label: 'Common pool', css: 'tier-grey' },
    feathered: { label: 'Uncommon pool', css: 'tier-green' },
    gleaming: { label: 'Rare pool', css: 'tier-blue' },
    royal: { label: 'Legendary pool', css: 'tier-purple' },
    ancestral: { label: 'Ancestral pool', css: 'tier-orange' },
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    if (n === Infinity) return '∞';
    if (typeof globalThis.formatCombatNumber === 'function') return globalThis.formatCombatNumber(n);
    return String(Math.floor(Number(n) || 0));
  }

  function fmtInt(n) {
    return String(Math.max(0, Math.floor(Number(n) || 0)));
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

  function eggSpeciesTier(eggId) {
    return EGG_SPECIES_TIER[String(eggId || '').toLowerCase()] || 'grey';
  }

  function setHatchModalCopy(titleText, subtitleText, show) {
    var title = document.getElementById('mother-goose-hatch-title');
    var sub = document.getElementById('mother-goose-hatch-subtitle');
    if (title) {
      title.textContent = titleText || 'Hatching';
      title.hidden = !show;
    }
    if (sub) {
      if (subtitleText) {
        sub.textContent = subtitleText;
        sub.hidden = false;
      } else {
        sub.textContent = '';
        sub.hidden = true;
      }
    }
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
  var _pendingHatchReveal = null;

  function clearHatchRevealTimers() {
    _hatchRevealTimers.forEach(function (t) {
      clearTimeout(t);
    });
    _hatchRevealTimers = [];
  }

  function buildHatchSlotsHtml(results, eggType, opts) {
    opts = opts || {};
    var def = eggTypeDef(eggType) || { icon: '🥚', id: eggType || 'cracked' };
    var eggId = String((def && def.id) || eggType || 'cracked').toLowerCase();
    var eggCss = tierCss(eggSpeciesTier(eggId));
    var isNest = opts.source === 'nest';
    var frontIcon = isNest ? '🪺' : def.icon;
    var list = Array.isArray(results) ? results : [];
    var html = '';
    list.forEach(function (result) {
      html +=
        '<div class="mother-goose-hatch-slot">' +
        '<span class="mother-goose-hatch-burst" aria-hidden="true"></span>' +
        '<div class="mother-goose-hatch-flip is-shaking mother-goose-hatch-flip--' +
        (isNest ? 'nest' : 'egg') +
        ' ' +
        eggCss +
        '">' +
        '<div class="mother-goose-hatch-flip-front mother-goose-hatch-flip-front--' +
        esc(eggId) +
        (isNest ? ' mother-goose-hatch-flip-front--nest' : '') +
        ' ' +
        eggCss +
        '">' +
        '<span class="mother-goose-hatch-egg mother-goose-egg-icon mother-goose-egg-icon--' +
        esc(eggId) +
        '" aria-hidden="true">' +
        esc(frontIcon) +
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
    var hatchBtn = document.getElementById('mother-goose-hatch-now');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (panel) {
      panel.classList.remove(
        'mother-goose-hatch-panel--batch',
        'mother-goose-hatch-panel--single',
        'mother-goose-hatch-panel--nest',
      );
    }
    setHatchModalCopy('Hatching', '', false);
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
    if (hatchBtn) hatchBtn.hidden = false;
    _pendingHatchReveal = null;
  }

  function buildHatchOverviewHtml(results, eggType) {
    var def = eggTypeDef(eggType) || { name: eggType || 'Egg' };
    var totals = {};
    results.forEach(function (r) {
      var label = r.isNew ? (r.birdName || r.birdKey) + ' bird' : (r.birdName || r.birdKey) + ' feathers';
      totals[label] = (totals[label] || 0) + (r.isNew ? 1 : Math.max(0, Number(r.feathersGained) || 0));
    });
    return '<div class="mother-goose-hatch-overview"><h3>' + esc(results.length + ' ' + (def.name || eggType) + (results.length === 1 ? '' : 's') + ' Opened!') + '</h3><ul>' + Object.keys(totals).map(function (label) { return '<li>' + esc(label) + ' ×' + fmt(totals[label]) + '</li>'; }).join('') + '</ul></div>';
  }

  function finishHatchReveal() {
    if (!_pendingHatchReveal) return;
    clearHatchRevealTimers();
    var data = _pendingHatchReveal;
    var flips = document.querySelectorAll('#mother-goose-hatch-egg-grid .mother-goose-hatch-flip');
    flips.forEach(function (flip) {
      flip.classList.remove('is-shaking'); flip.classList.add('is-flipped');
      var back = flip.querySelector('.mother-goose-hatch-flip-back'); if (back) back.setAttribute('aria-hidden', 'false');
      var front = flip.querySelector('.mother-goose-hatch-flip-front'); if (front) front.setAttribute('aria-hidden', 'true');
    });
    var reveal = document.getElementById('mother-goose-hatch-reveal');
    if (reveal) { reveal.innerHTML = buildHatchOverviewHtml(data.results, data.eggType); reveal.hidden = false; }
    var hatchBtn = document.getElementById('mother-goose-hatch-now'); if (hatchBtn) hatchBtn.hidden = true;
    var closeBtn = document.getElementById('mother-goose-hatch-close'); if (closeBtn) closeBtn.hidden = false;
    var newCount = 0;
    var dupeCount = 0;
    data.results.forEach(function (r) {
      if (r && r.isNew) newCount += 1;
      else dupeCount += 1;
    });
    var doneTitle = data.source === 'nest' ? 'Nest opened' : 'Hatched!';
    var doneSub = [];
    if (newCount) doneSub.push(newCount === 1 ? '1 new bird' : newCount + ' new birds');
    if (dupeCount) doneSub.push(dupeCount === 1 ? '1 duplicate feather' : dupeCount + ' duplicate feathers');
    if (data.source === 'nest' && data.goldenEggsGained) {
      doneSub.push('+' + fmtInt(data.goldenEggsGained) + ' Golden Goose Eggs');
    }
    setHatchModalCopy(doneTitle, doneSub.join(' · '), true);
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
      var cardHtml =
        '<div class="mother-goose-hatch-card mother-goose-hatch-card--bird mother-goose-hatch-card--new ' +
        speciesCss +
        '">' +
        '<span class="mother-goose-hatch-shine" aria-hidden="true"></span>' +
        '<span class="mother-goose-hatch-ribbon mother-goose-hatch-ribbon--new">New</span>' +
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
      '<div class="mother-goose-hatch-card mother-goose-hatch-card--feather mother-goose-hatch-card--dupe ' +
      speciesCss +
      '">' +
      '<span class="mother-goose-hatch-shine" aria-hidden="true"></span>' +
      '<span class="mother-goose-hatch-ribbon mother-goose-hatch-ribbon--dupe">Duplicate</span>' +
      '<div class="mother-goose-hatch-feather-glyph" aria-hidden="true">🪶</div>' +
      '<div class="mother-goose-hatch-card-name">' +
      esc(birdName) +
      '</div>' +
      '<span class="bird-card-tier-badge ' +
      speciesCss +
      '">Species Feather</span>' +
      '<div class="mother-goose-hatch-feather-gain">+' +
      fmtInt(gain || total) +
      '</div>' +
      '<div class="mother-goose-hatch-feather-total mother-goose-hatch-feather-total--secondary">Total: ' +
      fmtInt(total) +
      '</div></div>';
    if (compact) return featherHtml;
    return featherHtml + '<p class="mother-goose-hatch-msg">Species Feather — Collect more to mutate your bird.</p>';
  }

  function showMotherGooseHatchModal(result, eggType, opts) {
    showMotherGooseHatchModalBatch([result], eggType, 1, opts);
  }

  function showMotherGooseHatchModalBatch(results, eggType, count, opts) {
    opts = opts || {};
    var modal = document.getElementById('mother-goose-hatch-modal');
    var panel = modal && modal.querySelector('.mother-goose-hatch-panel');
    var eggWrap = document.getElementById('mother-goose-hatch-egg-wrap');
    var eggGrid = document.getElementById('mother-goose-hatch-egg-grid');
    var reveal = document.getElementById('mother-goose-hatch-reveal');
    var closeBtn = document.getElementById('mother-goose-hatch-close');
    var hatchBtn = document.getElementById('mother-goose-hatch-now');
    if (!modal || !eggGrid || !results || !results.length) {
      if (results && results[0]) showMotherGooseResult(results[0]);
      return;
    }

    var batch = results.length > 1;
    var eggId = eggType || results[0].eggType;
    var isNest = opts.source === 'nest';
    closeMotherGooseHatchModal();

    if (panel) {
      panel.classList.add(batch ? 'mother-goose-hatch-panel--batch' : 'mother-goose-hatch-panel--single');
      if (isNest) panel.classList.add('mother-goose-hatch-panel--nest');
    }
    if (eggWrap) {
      eggWrap.hidden = false;
      if (!batch) eggWrap.classList.add('mother-goose-hatch-egg-wrap--single');
    }
    if (eggGrid) {
      eggGrid.classList.add(batch ? 'mother-goose-hatch-egg-grid--batch' : 'mother-goose-hatch-egg-grid--single');
      eggGrid.innerHTML = buildHatchSlotsHtml(results, eggId, opts);
    }
    if (reveal) {
      reveal.innerHTML = '';
      reveal.hidden = true;
      reveal.classList.remove('mother-goose-hatch-reveal--batch');
    }
    if (closeBtn) closeBtn.hidden = true;
    if (hatchBtn) hatchBtn.hidden = false;
    var def = eggTypeDef(eggId) || { name: eggId + ' Egg' };
    var openingTitle = isNest
      ? 'Opening ' + (opts.nestName || 'Rescued Nest')
      : 'Hatching ' + (def.name || 'Egg');
    var openingSub = isNest && opts.goldenEggsGained
      ? '+' + fmtInt(opts.goldenEggsGained) + ' Golden Goose Eggs'
      : batch
        ? results.length + ' eggs ready'
        : 'Tap Hatch to crack the shell';
    setHatchModalCopy(openingTitle, openingSub, true);
    _pendingHatchReveal = {
      results: results.slice(),
      eggType: eggId,
      source: isNest ? 'nest' : 'hatch',
      nestName: opts.nestName || '',
      goldenEggsGained: Math.max(0, Math.floor(Number(opts.goldenEggsGained) || 0)),
    };
    if (typeof globalThis.recordSuppliesActivity === 'function') {
      var details = results.map(function (r) { return r.isNew ? (r.birdName || r.birdKey) + ' bird ×1' : (r.birdName || r.birdKey) + ' feathers ×' + Math.max(0, Number(r.feathersGained) || 0); });
      var activityTitle = isNest
        ? (opts.nestName || 'Rescued Nest') + (results.length === 1 ? '' : ' ×' + results.length) + ' opened!'
        : results.length + ' ' + def.name + (results.length === 1 ? '' : 's') + ' Opened!';
      globalThis.recordSuppliesActivity(activityTitle, details);
      if (typeof globalThis.renderSuppliesActivityLog === 'function') globalThis.renderSuppliesActivityLog();
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    var flips = eggGrid ? eggGrid.querySelectorAll('.mother-goose-hatch-flip') : [];
    var flipMs = 520;
    var staggerMs = 100;
    var shakeMs = 1400;

    _hatchRevealTimers.push(
      setTimeout(function () {
        if (hatchBtn) hatchBtn.hidden = true;
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
                    finishHatchReveal();
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
    FORTUNE_TAB = view === 'artifacts' || view === 'relics' ? 'relics' : 'trade';
    var relicBtn = document.getElementById('fortune-nav-relics') || document.getElementById('fortune-nav-artifacts');
    var tradeBtn = document.getElementById('fortune-nav-trade');
    var relicView = document.getElementById('fortune-view-relics') || document.getElementById('fortune-view-artifacts');
    var tradeView = document.getElementById('fortune-view-trade');
    var isRelics = FORTUNE_TAB === 'relics';
    var isTrade = FORTUNE_TAB === 'trade';
    if (relicBtn) {
      relicBtn.classList.toggle('is-active', isRelics);
      relicBtn.setAttribute('aria-selected', isRelics ? 'true' : 'false');
    }
    if (tradeBtn) {
      tradeBtn.classList.toggle('is-active', isTrade);
      tradeBtn.setAttribute('aria-selected', isTrade ? 'true' : 'false');
    }
    if (relicView) relicView.classList.toggle('is-active', isRelics);
    if (tradeView) tradeView.classList.toggle('is-active', isTrade);
  }

  function setHatcherySubView(view) {
    HATCHERY_TAB = view === 'eggs' ? 'eggs' : 'mother';
    var tabs = ['mother', 'eggs'];
    tabs.forEach(function (id) {
      var btn = document.getElementById('hatchery-nav-' + id);
      var panel = document.getElementById('hatchery-view-' + id);
      var active = id === HATCHERY_TAB;
      if (btn) {
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      }
    });
    if (HATCHERY_TAB === 'eggs') renderMotherGooseGrid();
    else renderMotherGoosePity();
  }

  function countOwnedRescuedNests() {
    var ids = ['cracked', 'feathered', 'gleaming', 'royal', 'ancestral'];
    var cat = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.rescuedNestCatalog;
    if (cat && Array.isArray(cat.EGG_IDS) && cat.EGG_IDS.length) ids = cat.EGG_IDS;
    var total = 0;
    ids.forEach(function (eggId) {
      var id =
        typeof globalThis.miscIdForRescuedNest === 'function'
          ? globalThis.miscIdForRescuedNest(eggId)
          : 'rescuedNest_' + eggId;
      if (typeof globalThis.getOwnedMiscCount === 'function') {
        total += Math.max(0, Math.floor(Number(globalThis.getOwnedMiscCount(id)) || 0));
      }
    });
    return total;
  }

  function syncWarRoomBank() {
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
    var eggsChip = document.getElementById('splash-bank-eggs');
    var eggsCount = document.getElementById('splash-bank-eggs-count');
    if (eggsCount) eggsCount.textContent = fmtInt(goose);
    if (eggsChip) {
      eggsChip.hidden = !(goose > 0);
      eggsChip.setAttribute('aria-label', 'Banked Golden Goose Eggs: ' + fmtInt(goose));
    }
    var nests = countOwnedRescuedNests();
    var nestBtn = document.getElementById('splash-bank-nests');
    var nestCount = document.getElementById('splash-bank-nests-count');
    if (nestCount) nestCount.textContent = fmtInt(nests);
    if (nestBtn) {
      nestBtn.hidden = !(nests > 0);
      nestBtn.setAttribute('aria-label', 'Open ' + fmtInt(nests) + ' saved nest' + (nests === 1 ? '' : 's') + ' in Inventory');
    }
  }

  function syncFortuneBalances() {
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
    var gooseEl = document.getElementById('fortune-balance-goose');
    if (gooseEl) gooseEl.textContent = fmt(goose);
    var invGooseEl = document.getElementById('inventory-balance-goose');
    if (invGooseEl) invGooseEl.textContent = fmt(goose);
    var hatchGooseEl = document.getElementById('hatchery-balance-goose');
    if (hatchGooseEl) hatchGooseEl.textContent = fmt(goose);
    syncWarRoomBank();
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
    var goose = typeof getGoldenGooseEggBalance === 'function' ? getGoldenGooseEggBalance() : 0;
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
      var canAfford = goose >= cost;
      var stateClass = maxed ? ' is-owned' : canAfford ? ' is-affordable' : ' is-locked';
      var btnLabel = maxed ? 'Maxed' : canAfford ? 'Trade · ' + fmt(cost) + ' 🪿' : 'Need more eggs';
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

  function renderMotherGoosePity() {
    var els = [
      document.getElementById('mother-goose-pity'),
      document.getElementById('mother-goose-pity-eggs'),
    ].filter(Boolean);
    if (!els.length || typeof globalThis.getPityState !== 'function') return;
    var pity = globalThis.getPityState();
    var parts = ['Eggs until next safety: ' + fmt(pity.eggsUntilNext || 0)];
    if (pity.pityChoicePending && pity.pityChoiceOptions && pity.pityChoiceOptions.length) {
      parts.push('Pity choice ready. Options: ' + pity.pityChoiceOptions.join(', '));
    }
    var text = parts.join(' · ');
    els.forEach(function (el) {
      el.textContent = text;
    });
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
      var rarityChip = EGG_RARITY_CHIP[id] || { label: 'Egg', css: 'tier-grey' };
      html +=
        '<div class="fortune-artifact-card mother-goose-egg-card mother-goose-egg-card--' +
        esc(id) +
        ' ' +
        rarityChip.css +
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
        '<span class="bird-card-tier-badge mother-goose-egg-rarity ' +
        rarityChip.css +
        '">' +
        esc(rarityChip.label) +
        '</span>' +
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
    setHatcherySubView(HATCHERY_TAB);
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
    if (typeof globalThis.recordSuppliesActivity === 'function') globalThis.recordSuppliesActivity('Item purchased', [art.name + ' ×1']);
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
        else if (result && result.reason === 'funds') msg.textContent = 'Not enough Golden Goose Eggs.';
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
    if (typeof globalThis.recordSuppliesActivity === 'function') globalThis.recordSuppliesActivity('Item purchased', [((result.offer && result.offer.name) || 'Trade') + ' ×' + result.count]);
    renderFortuneShop();
    if (typeof globalThis.renderFortuneInventory === 'function') globalThis.renderFortuneInventory();
  }

  function getCompletedStagesForFlight() {
    var g = globalThis.G;
    if (!g) return 0;
    var stage = Math.max(1, Math.floor(Number(g.stage) || 1));
    return Math.max(0, stage - 1);
  }

  globalThis.setFortuneSubView = setFortuneSubView;
  globalThis.setHatcherySubView = setHatcherySubView;
  globalThis.renderFortuneShop = renderFortuneShop;
  globalThis.renderHatchery = renderHatchery;
  globalThis.syncFortuneBalances = syncFortuneBalances;
  globalThis.syncWarRoomBank = syncWarRoomBank;
  globalThis.purchaseFortuneArtifact = purchaseFortuneArtifact;
  globalThis.purchaseFortuneTrade = purchaseFortuneTrade;
  globalThis.purchaseMotherGooseEgg = purchaseMotherGooseEgg;
  globalThis.purchaseMotherGooseEggBatch = purchaseMotherGooseEggBatch;
  globalThis.hatchRoyalEgg = hatchRoyalEgg;
  globalThis.hatchRoyalEggBatch = hatchRoyalEggBatch;
  globalThis.setRoyalEggClass = setRoyalEggClass;
  globalThis.resolvePityChoiceAction = resolvePityChoiceAction;
  globalThis.closeMotherGooseHatchModal = closeMotherGooseHatchModal;
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.actions = Avian.actions || {};
  Avian.actions.hatchMotherGooseNow = finishHatchReveal;
  globalThis.getCompletedStagesForFlight = getCompletedStagesForFlight;
  globalThis.showMotherGooseHatchModal = showMotherGooseHatchModal;
  globalThis.showMotherGooseHatchModalBatch = showMotherGooseHatchModalBatch;
})();
