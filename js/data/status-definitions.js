/* Combat status badge registry — tooltip text + display chips above HP bar. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.statusDefs = Avian.statusDefs || Object.create(null);

  var SKIP_KEYS = {
    _passiveStatLoans: 1, _dispatcherStatLoans: 1, _passiveDisplaySlots: 1,
    _dispatcherDisplaySlots: 1, _classPerkState: 1, _ironMomentumLoans: 1,
    _shieldWingLoans: 1, dispatcherDebuffs: 1, _dispatcherDebuffBySource: 1,
    passiveDodge: 1, dispatcherDodge: 1, dispatcherCrit: 1, dispatcherAcc: 1,
    dispatcherCritDmg: 1, huntersMarkBonusPct: 1, pendingStrikeBuff: 1,
  };

  var DISPLAY_KIND_LABELS = {
    gainDodge: { icon: '💨', label: 'Dodge Up', cls: 'evading', cat: 'buff' },
    gainCritChance: { icon: '🎯', label: 'Crit Up', cls: 'crit', cat: 'buff' },
    gainCritDamage: { icon: '💥', label: 'Crit Dmg Up', cls: 'crit', cat: 'buff' },
    gainAcc: { icon: '👁', label: 'ACC Up', cls: 'evading', cat: 'buff' },
    gainAtk: { icon: '⚔', label: 'ATK Up', cls: 'buffed', cat: 'buff' },
    gainMatk: { icon: '🎶', label: 'MATK Up', cls: 'buffed', cat: 'buff' },
    gainDef: { icon: '🛡', label: 'DEF Up', cls: 'defending', cat: 'buff' },
    gainMdef: { icon: '🔮', label: 'MDEF Up', cls: 'defending', cat: 'buff' },
    gainSpd: { icon: '⚡', label: 'SPD Up', cls: 'buffed', cat: 'buff' },
    gainMagicAilmentChance: { icon: '✨', label: 'Mag Ailment Up', cls: 'buffed', cat: 'buff' },
    gainPhysicalAilmentChance: { icon: '✨', label: 'Phys Ailment Up', cls: 'buffed', cat: 'buff' },
  };

  function resolveSourceLabel(sourceId, sourceKind) {
    if (!sourceId) return '';
    var id = String(sourceId).split(':')[0];
    var kind = sourceKind || 'ability';
    var pack = Avian.data && Avian.data.combatPack;
    if (kind === 'ability' && pack && pack.skillTrees && pack.skillTrees[id]) {
      return pack.skillTrees[id].name || id;
    }
    if (kind === 'passive' && pack && pack.birdPassives && pack.birdPassives[id]) {
      return pack.birdPassives[id].name || id;
    }
    if (kind === 'perk') return id.replace(/^perk_/i, '').replace(/_/g, ' ');
    if (kind === 'mutation') return 'Mutation';
    return id.replace(/_/g, ' ');
  }

  function isActiveStatusValue(v) {
    if (!v && v !== 0) return false;
    if (v === 0) return false;
    if (typeof v === 'object' && v.turns == null && v.stacks == null && (v.dmg == null || v.dmg === '')) return false;
    return true;
  }

  function collectCombatStatusEntries(statuses, ownerStats) {
    var entries = [];
    var s = statuses || {};
    Object.keys(s).forEach(function (k) {
      if (SKIP_KEYS[k] || k.charAt(0) === '_') return;
      var v = s[k];
      if (!isActiveStatusValue(v)) return;
      entries.push({ id: k, value: v, synthetic: false });
    });
    if ((s.accDebuff || 0) > 0 && !entries.some(function (e) { return e.id === 'accDebuff'; })) {
      entries.push({ id: 'accDebuff', value: s.accDebuff, synthetic: true });
    }
    if ((s.rageBuff || 0) > 0) {
      entries.push({ id: 'rageBuff', value: s.rageBuff, synthetic: true });
    }
    var shieldHp = Number(ownerStats && ownerStats.shieldHp) || 0;
    if (shieldHp > 0) {
      entries.push({
        id: 'shieldHp',
        value: { amount: shieldHp, max: Number(ownerStats.maxShieldHp) || shieldHp, turns: s.shieldHpTurns || 1,
          sourceId: s.shieldHpSourceId, sourceKind: s.shieldHpSourceKind },
        synthetic: true,
      });
    }
    if ((s.magicAilmentChanceBuff || 0) > 0) {
      entries.push({
        id: 'magicAilmentChanceBuff',
        value: { value: s.magicAilmentChanceBuff, turns: 1 },
        synthetic: true,
        displayKind: 'gainMagicAilmentChance',
      });
    }
    if ((s.physicalAilmentChanceBuff || 0) > 0) {
      entries.push({
        id: 'physicalAilmentChanceBuff',
        value: { value: s.physicalAilmentChanceBuff, turns: 1 },
        synthetic: true,
        displayKind: 'gainPhysicalAilmentChance',
      });
    }
    if ((s._dispatcherAccNextHit || 0) > 0) {
      entries.push({
        id: '_dispatcherAccNextHit',
        value: { value: s._dispatcherAccNextHit, turns: 1 },
        synthetic: true,
        displayKind: 'gainAcc',
      });
    }
    ['_passiveDisplaySlots', '_dispatcherDisplaySlots'].forEach(function (bagKey) {
      var bag = s[bagKey];
      if (!bag) return;
      Object.keys(bag).forEach(function (slotKey) {
        var slot = bag[slotKey];
        if (!slot || (slot.turns || 0) <= 0) return;
        entries.push({
          id: bagKey + ':' + slotKey,
          value: slot,
          synthetic: true,
          displayBag: bagKey,
          displayKind: slot.kind,
        });
      });
    });
    return entries;
  }

  function resolveStatusBadge(entry, ctx) {
    var k = entry.id;
    var v = entry.value;
    var statuses = ctx.statuses || {};
    var owner = ctx.owner || 'player';
    var poisonCap = ctx.poisonCap || 5;
    var poisonBoundaryDamage = ctx.poisonBoundaryDamage || function () { return 1; };
    var getWeakenStacks = ctx.getWeakenStacks || function () { return 0; };
    var getWeakenDamageMult = ctx.getWeakenDamageMult || function () { return 1; };
    var getWeakenDodgePenalty = ctx.getWeakenDodgePenalty || function () { return 0; };
    var AILMENTS = globalThis.AILMENTS || {};
    var STATUS_CONFUSED_SELF_PCT = ctx.confusedSelfPct || 30;
    var out = { id: k, className: 'status-badge ' + k, text: '', summary: '', source: '', category: 'system' };

    if (entry.synthetic && entry.displayKind) {
      var meta = DISPLAY_KIND_LABELS[entry.displayKind] || { icon: '✦', label: entry.displayKind, cls: 'buffed', cat: 'buff' };
      var srcKind = entry.displayBag === '_passiveDisplaySlots' ? 'passive' : 'ability';
      var srcId = String(k).split(':')[1] || '';
      out.className = 'status-badge ' + meta.cls;
      out.text = meta.icon + ' ' + meta.label + ' +' + (v.value || 0) + '(' + (v.turns || 1) + 't)';
      out.summary = meta.label + ' from ' + (srcKind === 'passive' ? 'passive' : 'ability') + '.';
      out.source = resolveSourceLabel(srcId.split(':')[0], srcKind);
      out.category = meta.cat;
      return out;
    }

    if (k === 'accDebuff') {
      out.className = 'status-badge weaken';
      out.text = '👁 ACC −' + v + '%';
      out.summary = 'Accuracy reduced.';
      out.category = 'debuff';
      return out;
    }
    if (k === 'rageBuff') {
      out.className = 'status-badge buffed';
      out.text = '😤 Rage(' + v + 't)';
      out.summary = 'Increased outgoing damage.';
      out.category = 'buff';
      return out;
    }
    if (k === 'shieldHp') {
      out.className = 'status-badge shield';
      out.text = '🛡 Shield ' + v.amount + ' HP(' + (v.turns || 1) + 't)';
      out.summary = 'Temporary HP absorbs damage before real HP.';
      out.source = resolveSourceLabel(v.sourceId, v.sourceKind);
      out.category = 'buff';
      return out;
    }

    if (k === 'poison') { var per = poisonBoundaryDamage(v.stacks); out.text = '☣ Poison×' + v.stacks + '/' + poisonCap + '(' + v.turns + 't, ' + per + '/tick)'; out.summary = (AILMENTS.poison && AILMENTS.poison.desc) || ''; out.category = 'ailment'; }
    else if (k === 'toxic') { out.className = 'status-badge poison'; out.text = '☠ Toxic(' + (v.turns || 0) + 't, 8% Max HP)'; out.summary = (AILMENTS.toxic && AILMENTS.toxic.desc) || ''; out.category = 'ailment'; }
    else if (k === 'bleed') { out.className = 'status-badge bleed'; out.text = '🩸 Bleed×' + (v.stacks || 0) + '(' + (v.turns || 0) + 't)'; out.summary = (AILMENTS.bleed && AILMENTS.bleed.desc) || ''; out.category = 'ailment'; }
    else if (k === 'weaken') {
      var st = getWeakenStacks(statuses);
      var turns = typeof v === 'number' ? v : (v.turns || 0);
      out.text = '🐔 Weaken×' + st + '(' + turns + 't, −' + Math.round((1 - getWeakenDamageMult(st)) * 100) + '% dmg)';
      out.summary = (AILMENTS.weaken && AILMENTS.weaken.desc) || '';
      out.category = 'debuff';
    }
    else if (k === 'paralyzed') { out.text = '⚡ Para(' + v + 't)'; out.summary = (AILMENTS.paralyzed && AILMENTS.paralyzed.desc) || ''; out.category = 'ailment'; }
    else if (k === 'burning') { out.text = '🔥 Burn×' + (v.stacks || 0) + '(' + (v.turns || 0) + 't)'; out.summary = (AILMENTS.burning && AILMENTS.burning.desc) || ''; out.category = 'ailment'; }
    else if (k === 'scorched') { out.className = 'status-badge burning'; out.text = '🔥 Scorched(' + (v.turns || 0) + 't)'; out.category = 'ailment'; }
    else if (k === 'delayed') { out.text = '🎵 Delayed(' + v.dmg + 'dmg)'; out.summary = 'Stored damage detonates end of next turn.'; out.category = 'debuff'; }
    else if (k === 'confused') { out.className = 'status-badge confused'; var sc = v.selfChance != null ? v.selfChance : (v.skipChance != null ? v.skipChance : STATUS_CONFUSED_SELF_PCT); out.text = '🌀 Confused(' + v.turns + 't,' + sc + '% self-hit)'; out.category = 'ailment'; }
    else if (k === 'tookie') { out.className = 'status-badge stunned'; out.text = '🦜 Tookie(+' + v.atkBonus + '%atk,' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'humDodge') { out.className = 'status-badge evading'; out.text = '🎵 Hum+' + v.bonus + '%(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'warcry') { out.className = 'status-badge stunned'; out.text = '🎺 Warcry+' + v.atkBonus + '%(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'battleHymn') { out.className = 'status-badge evading'; out.text = '🎼 Hymn(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'stunned') { out.className = 'status-badge stunned'; out.text = '😵 Stunned(' + v + 't)'; out.category = 'ailment'; }
    else if (k === 'mud') { out.className = 'status-badge delayed'; out.text = '🟤 Slowed(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'slow') { out.className = 'status-badge slow'; out.text = '🐌 Slow(' + (typeof v === 'number' ? v : v.turns) + 't)'; out.category = 'debuff'; }
    else if (k === 'chilled') { out.className = 'status-badge slow'; out.text = '❄ Chill×' + (v.stacks || 0) + '(' + (v.turns || 0) + 't)'; out.category = 'ailment'; }
    else if (k === 'frozen') { out.className = 'status-badge slow'; out.text = '🧊 Frozen'; out.category = 'ailment'; }
    else if (k === 'blinded') { out.className = 'status-badge feared'; out.text = '👁 Blinded(' + (v.turns || 0) + 't)'; out.category = 'debuff'; }
    else if (k === 'decreed') { out.className = 'status-badge feared'; out.text = '📜 Decreed(' + (v.turns || 0) + 't)'; out.category = 'debuff'; }
    else if (k === 'frostGuard' || k === 'emberGuard' || k === 'toxicResistance') { out.className = 'status-badge guarded'; out.text = '🛡 ' + k + '(' + (typeof v === 'number' ? v : v.turns || 0) + 't)'; out.category = 'buff'; }
    else if (k === 'feared') { out.className = 'status-badge feared'; out.text = '😨 Feared(' + v + 't)'; out.category = 'debuff'; }
    else if (k === 'lullabied') { out.className = 'status-badge lullabied'; out.text = '💤 Lulled(' + v + 't)'; out.category = 'debuff'; }
    else if (k === 'evading') { out.className = 'status-badge evading'; out.text = '💨 Evade(' + v + 't)'; out.category = 'buff'; }
    else if (k === 'guarded') {
      out.className = 'status-badge guarded';
      out.text = '🛡 Guarded(' + Math.floor(Number(v.physReducPct) || 0) + '%·' + Math.floor(Number(v.turns) || 0) + 't)';
      out.summary = 'Physical attack damage reduction only.';
      out.source = resolveSourceLabel(v.sourceAbilityId, v.sourceKind || 'ability');
      out.category = 'buff';
    }
    else if (k === 'defending') { out.className = 'status-badge defending'; out.text = '🛡 Guard(' + v + 't)'; out.summary = 'Damage reduction while guarding.'; out.category = 'buff'; }
    else if (k === 'dustDevil') { out.className = 'status-badge feared'; out.text = '🌪 Blinded(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'featherRuffle') { out.className = 'status-badge weaken'; out.text = '🪶 Ruffled(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'exposedGuard') { out.className = 'status-badge weaken'; out.text = '🎯 Exposed(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'hum') { out.className = 'status-badge evading'; out.text = '🎵 Hum(' + v + 't)'; out.category = 'buff'; }
    else if (k === 'rockDrop') { out.className = 'status-badge delayed'; out.text = '🪨 Rock Ready'; out.category = 'buff'; }
    else if (k === 'flyby') { out.className = 'status-badge evading'; out.text = '💨 Momentum!'; out.category = 'buff'; }
    else if (k === 'countering') { out.className = 'status-badge defending'; out.text = '⚔ Counter(' + (v.turns || 0) + 't)'; out.category = 'buff'; }
    else if (k === 'defBoost') { out.className = 'status-badge defending'; out.text = '🧱 DEF+' + v.amt + '(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'parry') { out.className = 'status-badge evading'; out.text = '🗡 Parry(' + v + 't)'; out.category = 'buff'; }
    else if (k === 'enemyBlind') { out.className = 'status-badge feared'; out.text = '👁 Blind(' + v + 't)'; out.category = 'debuff'; }
    else if (k === 'sittingDuck') { out.className = 'status-badge feared'; out.text = '🦆 Duck!(Dodge=0%)'; out.category = 'debuff'; }
    else if (k === 'wingClip') { out.className = 'status-badge feared'; out.text = '✂ Clipped(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'sonicSkip') { out.className = 'status-badge paralyzed'; out.text = '🔊 Dirge(' + v.turns + 't)'; out.category = 'debuff'; }
    else if (k === 'peregrineCritLens' || k === 'kookaCritLens' || k === 'owlCritFocus') { out.className = 'status-badge crit'; out.text = '🎯 Crit+' + (v.bonus || 0) + '%(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'peregrineDiveAmp') { out.className = 'status-badge buffed'; out.text = '🦅 Stoop+' + Math.round((v.mult || 0) * 100) + '%(' + v.turns + 't)'; out.category = 'buff'; }
    else if (k === 'peregrineDefBreak' || k === 'owlArmorStress') { out.className = 'status-badge weaken'; out.text = '🛡 Broken(' + v.turns + 't)'; out.category = 'debuff'; }
    else return null;

    if (typeof v === 'object' && v.sourceAbilityId && !out.source) {
      out.source = resolveSourceLabel(v.sourceAbilityId, v.sourceKind || 'ability');
    }
    return out;
  }

  function buildStatusDetail(key, value, summary, ctx) {
    var turns = typeof value === 'number' ? value : (value && value.turns != null ? value.turns : null);
    var stacks = typeof value === 'object' && value && typeof value.stacks === 'number' ? value.stacks : null;
    var bits = [];
    if (turns !== null) bits.push('Duration: ' + turns + ' turn' + (turns === 1 ? '' : 's') + '.');
    if (stacks !== null) bits.push('Stacks: ' + stacks + '.');
    if (summary) bits.push(summary);
    return bits.join(' ');
  }

  Avian.statusDefs.collectCombatStatusEntries = collectCombatStatusEntries;
  Avian.statusDefs.resolveStatusBadge = resolveStatusBadge;
  Avian.statusDefs.buildStatusDetail = buildStatusDetail;
  Avian.statusDefs.resolveSourceLabel = resolveSourceLabel;
  globalThis.collectCombatStatusEntries = collectCombatStatusEntries;
  globalThis.resolveCombatStatusBadge = resolveStatusBadge;
})();
