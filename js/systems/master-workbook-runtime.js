/* Master Workbook runtime — Ultimate Meter, Marked/Bloodied tags, Cleanse/Purge, UI hooks. */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  function meterRules() {
    return (Avian.data && Avian.data.ultimateMeterRules) || {
      maxMeter: 100,
      damageAwards: { 1: 8, 2: 12, 3: 16, 4: 22 },
      utilityAwards: { 1: 6, 2: 10, 3: 14, 4: 20 },
    };
  }

  function maxUltimateMeter() {
    return Number(meterRules().maxMeter) || 100;
  }

  function initUltimateMeterState() {
    var g = globalThis.G;
    if (!g) return;
    g.playerUltimateMeter = 0;
    g.enemyUltimateMeter = 0;
    g.maxUltimateMeter = maxUltimateMeter();
  }

  function getUltimateMeter(side) {
    var g = globalThis.G;
    if (!g) return 0;
    return side === 'enemy' ? (Number(g.enemyUltimateMeter) || 0) : (Number(g.playerUltimateMeter) || 0);
  }

  function setUltimateMeter(side, value) {
    var g = globalThis.G;
    if (!g) return;
    var cap = maxUltimateMeter();
    var v = Math.max(0, Math.min(cap, Math.round(Number(value) || 0)));
    if (side === 'enemy') g.enemyUltimateMeter = v;
    else g.playerUltimateMeter = v;
  }

  function awardUltimateMeter(side, amount) {
    if (!amount || amount <= 0) return;
    setUltimateMeter(side, getUltimateMeter(side) + amount);
  }

  function packRowForAbility(ab) {
    if (!ab || !ab.id) return null;
    var id = String(ab.id);
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') {
      id = globalThis.resolveAbilityAliasSourceId(id);
    }
    var row = Avian.data && Avian.data.combatPack && Avian.data.combatPack.skillTrees
      ? Avian.data.combatPack.skillTrees[id] : null;
    if (row && typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);
    return row;
  }

  function isUltimateAbility(ab, row) {
    row = row || packRowForAbility(ab);
    if (row && row.isUltimate) return true;
    if (row && (row.role || '').toLowerCase().indexOf('ultimate') >= 0) return true;
    var tags = (row && row.tags) || [];
    return tags.indexOf('Ultimate') >= 0 || /ultimate/i.test(String(ab && ab.name));
  }

  function isSpecialAbility(row) {
    if (!row) return false;
    if (row.isSpecial) return true;
    var tags = row.tags || [];
    return tags.indexOf('Special') >= 0 || Number(row.enCost || row.apCost) === 4;
  }

  function computeUltimateMeterAward(ab, ctx) {
    ctx = ctx || {};
    var row = packRowForAbility(ab);
    if (!row) return 0;
    if (isUltimateAbility(ab, row)) return 0;
    var rules = meterRules();
    var en = Math.max(1, Math.min(4, Number(row.enCost || row.apCost || ab.energy || ab.energyCost || 1)));
    var landed = (ctx.hitsLanded || 0) > 0;
    var utilityOk = !!ctx.utilitySucceeded;
    if (row.noDamage || row.target === 'self') {
      if (!utilityOk) return 0;
      var utilMap = rules.utilityAwards || {};
      return Number(utilMap[String(en)] || utilMap[en] || 0);
    }
    if (!landed) return 0;
    var dmgMap = rules.damageAwards || {};
    if (isSpecialAbility(row) && en < 4) en = 4;
    return Number(dmgMap[String(en)] || dmgMap[en] || 0);
  }

  function canUseMasterWorkbookAbility(player, ab) {
    var row = packRowForAbility(ab);
    if (!row || !isUltimateAbility(ab, row)) return true;
    var meter = getUltimateMeter('player');
    if (meter < maxUltimateMeter()) {
      if (typeof logMsg === 'function') logMsg('Requires ' + maxUltimateMeter() + ' Ultimate Meter (' + meter + '/' + maxUltimateMeter() + ').', 'miss');
      return false;
    }
    return true;
  }

  function spendUltimateForAbility(player, ab) {
    var row = packRowForAbility(ab);
    if (!row || !isUltimateAbility(ab, row)) return;
    setUltimateMeter('player', 0);
  }

  function getEffectiveEnergyCostForAbility(ab, row) {
    row = row || packRowForAbility(ab);
    if (row && isUltimateAbility(ab, row)) return 0;
    return null;
  }

  var NEGATIVE_STATUS_KEYS = [
    'poison', 'toxic', 'bleed', 'burning', 'scorched', 'chilled', 'weaken', 'paralyzed',
    'delayed', 'blinded', 'frozen', 'feared', 'confused', 'slow', 'stunned', 'accDebuff',
  ];
  var POSITIVE_STATUS_KEYS = [
    'frostGuard', 'emberGuard', 'toxicResistance', 'guarded', 'ironResolve', 'counterInstinct',
    'dispatcherTaunt', 'battleHymnActive',
  ];

  function cleanseNegativeStatuses(status) {
    if (!status) return 0;
    var n = 0;
    NEGATIVE_STATUS_KEYS.forEach(function (k) {
      if (status[k] != null) { delete status[k]; n++; }
    });
    return n;
  }

  function purgePositiveStatuses(status) {
    if (!status) return 0;
    var n = 0;
    POSITIVE_STATUS_KEYS.forEach(function (k) {
      if (status[k] != null) { delete status[k]; n++; }
    });
    if (status.guarded) { delete status.guarded; n++; }
    return n;
  }

  function applyMarked(status) {
    if (!status) return false;
    status.marked = { turns: 2, consumed: false };
    return true;
  }

  function consumeMarkedIfPayoff(row, targetStatus) {
    if (!row || !targetStatus || !targetStatus.marked) return false;
    var text = String(row.riderText || row.shortDesc || '') + ' ' + ((row.tags || []).join(' '));
    var wantsMarked = (row.tags || []).indexOf('Marked') >= 0 || /marked/i.test(text);
    var wantsFinisher = (row.tags || []).indexOf('Finisher') >= 0 || /finisher|bloodied/i.test(text);
    if (!wantsMarked && !wantsFinisher) return false;
    if (wantsFinisher && typeof globalThis.isBloodiedTarget === 'function') {
      var g = globalThis.G;
      var tgt = g && g.enemy ? g.enemy : null;
      if (!globalThis.isBloodiedTarget(tgt)) return false;
    }
    delete targetStatus.marked;
    return true;
  }

  function applyTagRidersFromRow(row, ctx) {
    if (!row) return false;
    var g = globalThis.G;
    if (!g) return false;
    var tags = row.tags || [];
    var text = String(row.riderText || row.shortDesc || row.displayText || '').toLowerCase();
    var utilitySucceeded = false;
    if (tags.indexOf('Cleanse') >= 0 || /cleanse/.test(text)) {
      var n = cleanseNegativeStatuses(g.playerStatus);
      if (n > 0) utilitySucceeded = true;
    }
    if (tags.indexOf('Purge') >= 0 || /purge/.test(text)) {
      var p = purgePositiveStatuses(g.enemyStatus);
      if (p > 0) {
        utilitySucceeded = true;
        if (typeof Avian !== 'undefined' && Avian.mutationEffects && typeof Avian.mutationEffects.onPurge === 'function') {
          Avian.mutationEffects.onPurge();
        }
      }
    }
    if (tags.indexOf('Marked') >= 0 || /\bapply marked\b/.test(text)) {
      if (applyMarked(g.enemyStatus)) utilitySucceeded = true;
    }
    if (row.noDamage && !utilitySucceeded && text && text !== 'none') {
      utilitySucceeded = true;
    }
    return utilitySucceeded || !!ctx.utilitySucceeded;
  }

  function getAspectMatchupLabel(attacker, target, abilityRow) {
    if (typeof globalThis.getAspectRelationship !== 'function') return '';
    var atkAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(attacker) : '';
    var tgtAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(target) : '';
    if (!atkAsp || !tgtAsp) return '';
    var rel = globalThis.getAspectRelationship(atkAsp, tgtAsp, abilityRow || null);
    if (rel === 'Strong') return 'Strong';
    if (rel === 'Weak') return 'Weak';
    if (rel === 'Same') return 'Same';
    return 'Neutral';
  }

  function renderUltimateMeterUI() {
    var g = globalThis.G;
    if (!g || !g.player) return;
    var el = document.getElementById('ultimate-meter-wrap');
    if (!el) {
      var host = document.getElementById('player-panel') || document.getElementById('player-energy-wrap');
      if (!host) return;
      el = document.createElement('div');
      el.id = 'ultimate-meter-wrap';
      el.className = 'ultimate-meter-wrap';
      el.innerHTML = '<div class="ultimate-meter-label">Ultimate</div><div class="ultimate-meter-bar"><div id="ultimate-meter-fill"></div></div><div id="ultimate-meter-text"></div>';
      host.appendChild(el);
    }
    var fill = document.getElementById('ultimate-meter-fill');
    var txt = document.getElementById('ultimate-meter-text');
    var cur = getUltimateMeter('player');
    var max = maxUltimateMeter();
    if (fill) fill.style.width = Math.min(100, (cur / max) * 100) + '%';
    if (txt) txt.textContent = cur + ' / ' + max;
  }

  function renderAspectLabels() {
    var g = globalThis.G;
    if (!g) return;
    var pAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(g.player) : (g.player && g.player.aspect);
    var eAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(g.enemy) : (g.enemy && g.enemy.aspect);
    var pel = document.getElementById('player-aspect-label');
    if (!pel) {
      pel = document.createElement('div');
      pel.id = 'player-aspect-label';
      pel.className = 'aspect-label';
      var pn = document.getElementById('player-class-label');
      if (pn && pn.parentNode) pn.parentNode.insertBefore(pel, pn.nextSibling);
    }
    if (pel) {
      var pName = typeof globalThis.formatAspectDisplayName === 'function'
        ? globalThis.formatAspectDisplayName(pAsp) : (pAsp ? String(pAsp).charAt(0).toUpperCase() + String(pAsp).slice(1) : '');
      pel.textContent = pAsp ? ('Aspect: ' + pName) : '';
      pel.dataset.aspectId = pAsp || '';
    }
    var eel = document.getElementById('enemy-aspect-label');
    if (!eel) {
      eel = document.createElement('div');
      eel.id = 'enemy-aspect-label';
      eel.className = 'aspect-label';
      var en = document.getElementById('enemy-class-label');
      if (en && en.parentNode) en.parentNode.insertBefore(eel, en.nextSibling);
    }
    if (eel) {
      var eName = typeof globalThis.formatAspectDisplayName === 'function'
        ? globalThis.formatAspectDisplayName(eAsp) : (eAsp ? String(eAsp).charAt(0).toUpperCase() + String(eAsp).slice(1) : '');
      var matchup = getAspectMatchupLabel(g.player, g.enemy);
      eel.textContent = eAsp
        ? ('Aspect: ' + eName + (matchup && matchup !== 'Neutral' ? ' · ' + matchup : ''))
        : '';
      eel.dataset.aspectId = eAsp || '';
    }
    bindAspectLabelTooltips();
  }

  function bindAspectLabelTooltips() {
    if (typeof globalThis.bindRichTooltip !== 'function' || typeof globalThis.buildAspectTooltipHTML !== 'function') return;
    ['player-aspect-label', 'enemy-aspect-label'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._aspectTooltipBound) return;
      el._aspectTooltipBound = true;
      globalThis.bindRichTooltip(el, function () {
        var aspId = el.dataset.aspectId || '';
        return aspId ? globalThis.buildAspectTooltipHTML(aspId) : '';
      }, { category: 'abilities' });
    });
  }

  Avian.systems.masterWorkbook = {
    initUltimateMeterState: initUltimateMeterState,
    getUltimateMeter: getUltimateMeter,
    awardUltimateMeter: awardUltimateMeter,
    computeUltimateMeterAward: computeUltimateMeterAward,
    canUseMasterWorkbookAbility: canUseMasterWorkbookAbility,
    spendUltimateForAbility: spendUltimateForAbility,
    applyTagRidersFromRow: applyTagRidersFromRow,
    consumeMarkedIfPayoff: consumeMarkedIfPayoff,
    renderUltimateMeterUI: renderUltimateMeterUI,
    renderAspectLabels: renderAspectLabels,
    getAspectMatchupLabel: getAspectMatchupLabel,
    packRowForAbility: packRowForAbility,
    isUltimateAbility: isUltimateAbility,
  };

  globalThis.initUltimateMeterState = initUltimateMeterState;
  globalThis.getUltimateMeter = getUltimateMeter;
  globalThis.awardUltimateMeter = awardUltimateMeter;
  globalThis.computeUltimateMeterAward = computeUltimateMeterAward;
  globalThis.canUseMasterWorkbookAbility = canUseMasterWorkbookAbility;
  globalThis.spendUltimateForAbility = spendUltimateForAbility;
  globalThis.applyTagRidersFromRow = applyTagRidersFromRow;
  globalThis.consumeMarkedIfPayoff = consumeMarkedIfPayoff;
  globalThis.renderUltimateMeterUI = renderUltimateMeterUI;
  globalThis.renderAspectLabels = renderAspectLabels;
  globalThis.packRowForAbility = packRowForAbility;
  globalThis.isUltimateAbility = isUltimateAbility;
  globalThis.maxUltimateMeter = maxUltimateMeter;
  globalThis.getAspectMatchupLabel = getAspectMatchupLabel;

  if (typeof globalThis.refreshBattleUI === 'function') {
    var _oldRefresh = globalThis.refreshBattleUI;
    globalThis.refreshBattleUI = function () {
      _oldRefresh.apply(this, arguments);
      renderUltimateMeterUI();
      renderAspectLabels();
    };
  }

  if (typeof globalThis.loadStage === 'function') {
    var _oldLoadStage = globalThis.loadStage;
    globalThis.loadStage = function () {
      var ret = _oldLoadStage.apply(this, arguments);
      initUltimateMeterState();
      return ret;
    };
  }
})();
