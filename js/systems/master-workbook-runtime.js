/* Master Workbook runtime — Ultimate Meter, Marked/Bloodied tags, Cleanse/Purge, UI hooks. */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);

  function isEquipmentV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function meterRules() {
    if (isEquipmentV2()) {
      var cfg = Avian.data && Avian.data.combatConfig;
      if (cfg && cfg.ultimateMeter) {
        return {
          maxMeter: Number(cfg.ultimateMeter.max) || 100,
          damageAwards: cfg.ultimateMeter.damageAwards || {},
          utilityAwards: cfg.ultimateMeter.utilityAwards || {},
        };
      }
    }
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
    if (ab._dispatcherRow) {
      var embedded = ab._dispatcherRow;
      if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(embedded);
      return embedded;
    }
    var id = String(ab.id);
    if (typeof globalThis.resolveAbilityAliasSourceId === 'function') {
      id = globalThis.resolveAbilityAliasSourceId(id);
    }
    var row = null;
    if (Avian.equipmentActions && typeof Avian.equipmentActions.skillToAbilityRow === 'function') {
      row = Avian.equipmentActions.skillToAbilityRow(id, null, 'grey');
    } else {
      var skills = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
      row = skills && skills[id] ? skills[id] : null;
    }
    if (row && typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);
    return row;
  }

  function isUltimateAbility(ab, row) {
    if (ab && ab.isUltimate) return true;
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
    var enMax = isEquipmentV2() ? 6 : 4;
    var en = Math.max(1, Math.min(enMax, Number(row.enCost || row.apCost || ab.energy || ab.energyCost || 1)));
    var landed = (ctx.hitsLanded || 0) > 0;
    var utilityOk = !!ctx.utilitySucceeded;
    if (row.noDamage || row.target === 'self') {
      if (!utilityOk) return 0;
      var utilMap = rules.utilityAwards || {};
      return Number(utilMap[String(en)] || utilMap[en] || 0);
    }
    if (!landed) return 0;
    var cfg = Avian.data && Avian.data.combatConfig && Avian.data.combatConfig.ultimateMeter;
    var perAp = cfg && cfg.meterPerAp != null ? Number(cfg.meterPerAp) : 0;
    var raw;
    if (perAp > 0) {
      raw = Math.round(perAp * en);
    } else {
      var dmgMap = rules.damageAwards || {};
      if (isSpecialAbility(row) && en < 4) en = 4;
      raw = Number(dmgMap[String(en)] || dmgMap[en] || 0);
    }
    var cap = cfg && cfg.perTurnCap != null ? Number(cfg.perTurnCap) : 0;
    if (cap > 0) {
      var g = globalThis.G;
      var side = (ctx.side || 'player');
      var key = side === 'enemy' ? '_enemyUltMeterThisTurn' : '_playerUltMeterThisTurn';
      var used = g && Number(g[key]) || 0;
      var allowed = Math.max(0, cap - used);
      raw = Math.min(raw, allowed);
      if (g) g[key] = used + raw;
    }
    return raw;
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
    'poison', 'toxic', 'bleed', 'burning', 'incinerating', 'scorched', 'chilled', 'weaken', 'weakened',
    'paralyzed', 'shock', 'delayed', 'blinded', 'frozen', 'feared', 'confused', 'slow', 'stunned', 'accDebuff',
  ];
  var DAMAGING_AILMENT_KEYS = ['poison', 'toxic', 'bleed', 'burning', 'incinerating', 'shock'];
  var STAT_DOWN_KEYS = ['atk', 'matk', 'def', 'mdef', 'spd', 'acc', 'dodge'];
  var POSITIVE_STATUS_KEYS = [
    'frostGuard', 'emberGuard', 'toxicResistance', 'guarded', 'ironResolve', 'counterInstinct',
    'dispatcherTaunt', 'battleHymnActive',
  ];

  function restoreOneDebuffBag(status, entity, bagName, wantStat) {
    var bag = status && status[bagName];
    if (!bag || !entity || !entity.stats) return 0;
    var keys = Object.keys(bag);
    for (var i = 0; i < keys.length; i++) {
      var e = bag[keys[i]];
      if (!e) continue;
      var sk = String(e.statKey || keys[i].split(':')[0]).toLowerCase();
      if (wantStat && sk !== wantStat) continue;
      var amt = Number(e.amt) || 0;
      if (bagName === '_dispatcherDebuffBySource') {
        entity.stats[sk] = Math.round(((Number(entity.stats[sk]) || 0) + amt) * 100) / 100;
        delete bag[keys[i]];
        return 1;
      }
      if (amt < 0) {
        entity.stats[sk] = Math.round(((Number(entity.stats[sk]) || 0) - amt) * 100) / 100;
        delete bag[keys[i]];
        return 1;
      }
    }
    return 0;
  }

  function cleanseStatDown(status, wantStat) {
    var g = globalThis.G;
    var entity = (g && status === g.playerStatus) ? g.player : ((g && status === g.enemyStatus) ? g.enemy : null);
    var n = 0;
    n += restoreOneDebuffBag(status, entity, '_dispatcherDebuffBySource', wantStat);
    if (n) return n;
    n += restoreOneDebuffBag(status, entity, '_dispatcherStatLoans', wantStat);
    if (n) return n;
    n += restoreOneDebuffBag(status, entity, '_passiveStatLoans', wantStat);
    return n;
  }

  function cleanseNegativeStatuses(status, opts) {
    if (!status) return 0;
    opts = opts || {};
    var text = String(opts.text || '');
    var n = 0;
    var first = null;
    var max = /all/i.test(text) ? 99 : 1;

    function take(k) {
      if (n >= max) return;
      if (status[k] == null) return;
      if (!first) first = k;
      delete status[k];
      n++;
    }

    if (/agility down/i.test(text)) {
      n += cleanseStatDown(status, 'spd');
      if (n && !first) first = 'spdDown';
    } else if (/stat debuff/i.test(text)) {
      for (var si = 0; si < STAT_DOWN_KEYS.length && n < max; si++) {
        n += cleanseStatDown(status, STAT_DOWN_KEYS[si]);
      }
      if (status.accDebuff != null) take('accDebuff');
    } else if (/damaging ailment/i.test(text)) {
      DAMAGING_AILMENT_KEYS.forEach(take);
    } else {
      NEGATIVE_STATUS_KEYS.forEach(take);
    }
    if (first) status._lastCleansedAilment = first;
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
      var n = cleanseNegativeStatuses(g.playerStatus, { text: text, count: 1 });
      if (ctx) ctx.cleansedCount = n;
      if (n > 0) {
        utilitySucceeded = true;
        if (g.playerStatus) g.playerStatus._lastCleansedAilment = g.playerStatus._lastCleansedAilment || 'poison';
      }
    }
    if (tags.indexOf('Purge') >= 0 || /purge/.test(text)) {
      var p = purgePositiveStatuses(g.enemyStatus);
      if (p > 0) {
        utilitySucceeded = true;
        if (typeof Avian !== 'undefined' && Avian.equipmentEffects && typeof Avian.equipmentEffects.onPurge === 'function') {
          Avian.equipmentEffects.onPurge();
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

  function playerHasUltimateUnlocked() {
    var g = globalThis.G;
    if (!g || !g.player || !Array.isArray(g.player.abilities)) return false;
    for (var i = 0; i < g.player.abilities.length; i++) {
      var ab = g.player.abilities[i];
      if (ab && isUltimateAbility(ab)) return true;
    }
    return false;
  }

  function renderUltimateMeterUI() {
    var g = globalThis.G;
    var wrap = document.getElementById('player-ult-wrap');
    if (!wrap) return;
    if (!g || !g.player || !playerHasUltimateUnlocked()) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    var fill = document.getElementById('ultimate-meter-fill');
    var txt = document.getElementById('ultimate-meter-text');
    var cur = getUltimateMeter('player');
    var max = maxUltimateMeter();
    if (fill) {
      var pct = max > 0 ? Math.min(100, (cur / max) * 100) : 0;
      fill.style.width = pct + '%';
      fill.classList.toggle('ult-ready', cur >= max);
    }
    if (txt) txt.textContent = cur + ' / ' + max;
  }

  function updateAspectChip(chipId, aspectId) {
    var chip = document.getElementById(chipId);
    if (!chip) return null;
    var prevId = chip.dataset.aspectId || '';
    var nextId = aspectId || '';
    if (aspectId) {
      var name = typeof globalThis.formatAspectDisplayName === 'function'
        ? globalThis.formatAspectDisplayName(aspectId)
        : String(aspectId).charAt(0).toUpperCase() + String(aspectId).slice(1);
      chip.textContent = name;
      chip.dataset.aspectId = aspectId;
      chip.hidden = false;
      chip.style.display = '';
    } else {
      chip.textContent = '';
      chip.dataset.aspectId = '';
      chip.hidden = true;
      chip.style.display = 'none';
    }
    if (prevId !== nextId) {
      chip._aspectTooltipBound = false;
      chip._richTooltipBound = false;
    }
    return chip;
  }

  function renderAspectLabels() {
    var g = globalThis.G;
    if (!g) return;

    var pAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(g.player) : (g.player && g.player.aspect);
    var eAsp = typeof globalThis.getEntityAspect === 'function' ? globalThis.getEntityAspect(g.enemy) : (g.enemy && g.enemy.aspect);
    updateAspectChip('player-aspect-label', pAsp || '');
    updateAspectChip('enemy-aspect-label', eAsp || '');

    var oldPel = document.querySelector('.combatant-meta > .aspect-label');
    if (oldPel) oldPel.remove();
    document.querySelectorAll('.combatant-meta > .aspect-label').forEach(function (el) { el.remove(); });
    ['player-class-label', 'enemy-class-label'].forEach(function (hostId) {
      var host = document.getElementById(hostId);
      if (!host) return;
      host.querySelectorAll('.aspect-chip').forEach(function (chip) { chip.remove(); });
    });

    bindAspectLabelTooltips();
  }

  function bindAspectLabelTooltips() {
    if (typeof globalThis.bindRichTooltip !== 'function') return;
    ['player-aspect-label', 'enemy-aspect-label'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.dataset.aspectId) return;
      if (el._aspectTooltipBound) return;
      el._aspectTooltipBound = true;
      globalThis.bindRichTooltip(el, function () {
        var aspId = el.dataset.aspectId || '';
        if (!aspId) return '';
        if (typeof globalThis.buildEntityAspectTooltipHtml === 'function') {
          var vsAsp = '';
          if (id === 'enemy-aspect-label' && globalThis.G && globalThis.G.player && typeof globalThis.getEntityAspect === 'function') {
            vsAsp = globalThis.getEntityAspect(globalThis.G.player) || '';
          } else if (id === 'player-aspect-label' && globalThis.G && globalThis.G.enemy && typeof globalThis.getEntityAspect === 'function') {
            vsAsp = globalThis.getEntityAspect(globalThis.G.enemy) || '';
          }
          return globalThis.buildEntityAspectTooltipHtml(aspId, { vsAspect: vsAsp });
        }
        return typeof globalThis.buildAspectTooltipHTML === 'function' ? globalThis.buildAspectTooltipHTML(aspId) : '';
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
      var sequential = typeof globalThis.isSequentialEncounterContinue === 'function'
        && globalThis.isSequentialEncounterContinue();
      var kept = sequential ? (Number(globalThis.G && globalThis.G.playerUltimateMeter) || 0) : 0;
      var ret = _oldLoadStage.apply(this, arguments);
      if (sequential) {
        if (globalThis.G) {
          globalThis.G.maxUltimateMeter = maxUltimateMeter();
          globalThis.G.enemyUltimateMeter = 0;
          globalThis.G.playerUltimateMeter = kept;
        }
      } else {
        initUltimateMeterState();
      }
      return ret;
    };
  }
})();
