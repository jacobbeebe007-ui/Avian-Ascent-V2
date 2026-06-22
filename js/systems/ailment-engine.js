/* Master Ailment Engine — unified ticks, apply helpers, status verb registrations.
 * Loaded after game.js and systems.js so combat globals exist. */
(function () {
  'use strict';

  var R = globalThis.AILMENT_RULES;
  if (!R) return;

  var GUARD_DURATION = R.guardDuration || 1;

  function sideStatus(side) {
    var g = globalThis.G;
    if (!g) return null;
    return side === 'player' ? g.playerStatus : g.enemyStatus;
  }

  function sideStats(side) {
    var g = globalThis.G;
    if (!g) return null;
    return side === 'player' ? g.player.stats : g.enemy.stats;
  }

  function sideName(side) {
    var g = globalThis.G;
    if (!g) return side;
    return side === 'player' ? (g.player?.name || 'you') : (g.enemy?.name || 'enemy');
  }

  /** Apply DoT / stored damage with master-list rules (no crit, no lifesteal, etc.). */
  globalThis.applyAilmentDamage = function applyAilmentDamage(side, dmg, opts) {
    opts = opts || {};
    var stats = sideStats(side);
    if (!stats || !dmg || dmg <= 0) return 0;
    var bonusFrac = Math.min(R.AILMENT_DAMAGE_BONUS_CAP, Math.max(0, Number(opts.bonusFraction) || 0));
    if (side === 'enemy' && globalThis.G?.player) {
      if (opts.ailmentId === 'poison') bonusFrac += Math.min(R.AILMENT_DAMAGE_BONUS_CAP, (globalThis.G.player.poisonTickBonusPct || 0) / 100);
      if (opts.ailmentId === 'bleed') bonusFrac += Math.min(R.AILMENT_DAMAGE_BONUS_CAP, (globalThis.G.player.bleedTickBonusPct || 0) / 100);
    }
    bonusFrac = Math.min(R.AILMENT_DAMAGE_BONUS_CAP, bonusFrac);
    var roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : function(n) { return Math.max(0.01, Math.round(Number(n) * 100) / 100); };
    var finalDmg = typeof globalThis.applyAilmentDamageBonus === 'function'
      ? globalThis.applyAilmentDamageBonus(dmg, bonusFrac)
      : roundDmg(Math.max(0.01, dmg * (1 + bonusFrac)));
    finalDmg = roundDmg(Math.max(0.01, finalDmg));
    if (typeof globalThis.applyFractionalHp === 'function') {
      globalThis.applyFractionalHp(stats, -finalDmg);
    } else {
      stats.hp = Math.max(0, Math.round((Number(stats.hp) - finalDmg) * 100) / 100);
    }
    var dmgDisp = (typeof globalThis.formatCombatNumber === 'function')
      ? globalThis.formatCombatNumber(finalDmg)
      : finalDmg;
    if (typeof globalThis.spawnFloat === 'function') {
      globalThis.spawnFloat(side, (opts.icon || '💥') + ' -' + dmgDisp, opts.floatClass || 'fn-dmg');
    }
    if (typeof globalThis.setHpBar === 'function') {
      globalThis.setHpBar(side, stats.hp, stats.maxHp);
    }
    if (typeof globalThis.logMsg === 'function' && opts.logText) {
      globalThis.logMsg(opts.logText.replace('{dmg}', finalDmg).replace('{name}', sideName(side)), opts.logKind || 'system');
    }
    if (side === 'enemy' && globalThis.BS) globalThis.BS.dmgDealt = (globalThis.BS.dmgDealt || 0) + finalDmg;
    return finalDmg;
  };

  function tickGuardDurations(status) {
    if (!status) return;
    ['frostGuard', 'emberGuard', 'toxicResistance'].forEach(function (key) {
      var g = status[key];
      if (typeof g === 'number' && g > 0) {
        status[key] = g - 1;
        if (status[key] <= 0) delete status[key];
      } else if (g && typeof g === 'object' && g.turns != null) {
        g.turns--;
        if (g.turns <= 0) delete status[key];
      }
    });
  }

  function decrementAilmentDuration(status, key) {
    var v = status[key];
    if (!v) return false;
    if (key === 'poison' && v.stacks > 0) {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.poison; return true; }
      return false;
    }
    if (key === 'bleed' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.bleed; return true; }
      return false;
    }
    if (key === 'burning' && typeof v === 'object' && v.stacks != null) {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.burning; return true; }
      return false;
    }
    if (key === 'weaken' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.weaken; return true; }
      return false;
    }
    if (key === 'chilled' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) {
        if (v.baseSpd != null && globalThis.G?.enemy?.stats && status === globalThis.G.enemyStatus) {
          globalThis.G.enemy.stats.spd = Math.max(1, v.baseSpd);
        }
        delete status.chilled;
        return true;
      }
      return false;
    }
    if (key === 'toxic' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) {
        delete status.toxic;
        status.toxicResistance = { turns: GUARD_DURATION };
        return true;
      }
      return false;
    }
    if (key === 'scorched' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) {
        delete status.scorched;
        status.emberGuard = { turns: GUARD_DURATION };
        return true;
      }
      return false;
    }
    if (key === 'blinded' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.blinded; return true; }
      return false;
    }
    if (key === 'decreed' && typeof v === 'object') {
      v.turns = (v.turns || 0) - 1;
      if (v.turns <= 0) { delete status.decreed; return true; }
      return false;
    }
    if (typeof v === 'number' && v > 0) {
      status[key] = v - 1;
      if (status[key] <= 0) delete status[key];
    }
    return false;
  }

  globalThis.tickEndOfTurnAilments = function tickEndOfTurnAilments(side) {
    var g = globalThis.G;
    var status = sideStatus(side);
    var stats = sideStats(side);
    if (!g || !status || !stats) return;

    var ownerBonus = side === 'enemy' ? (g.player?.poisonTickMult || 1) : 1;
    var flatPoisonBonus = side === 'enemy'
      ? ((g.player?.poisonFlatBonus || 0) + (g.player?.perkPoisonTickBonus || 0) + (g.player?.relVenomLedger ? 1 : 0))
      : 0;

    if (status.poison && status.poison.stacks > 0 && (status.poison.turns || 0) > 0) {
      var pDmg = globalThis.calcPoisonTickDmg(status.poison.stacks, ownerBonus) + flatPoisonBonus;
      globalThis.applyAilmentDamage(side, pDmg, {
        ailmentId: 'poison', icon: '☣', floatClass: 'fn-poison',
        logText: '☣ Poison deals {dmg} to {name}!', logKind: 'poison-tick',
      });
      if (typeof globalThis.SFX !== 'undefined' && globalThis.SFX.poison) globalThis.SFX.poison();
    }

    if (status.toxic && (status.toxic.turns || 0) > 0) {
      var tDmg = globalThis.calcToxicTickDmg(stats.maxHp, g, side);
      globalThis.applyAilmentDamage(side, tDmg, {
        ailmentId: 'toxic', icon: '☠', floatClass: 'fn-poison',
        logText: '☠ Toxic deals {dmg} to {name}!', logKind: 'poison-tick',
      });
    }

    if (status.bleed && (status.bleed.stacks || 0) > 0 && (status.bleed.turns || 0) > 0) {
      var bDmg = globalThis.calcBleedTickDmg(stats.maxHp, status.bleed.stacks, g, side);
      globalThis.applyAilmentDamage(side, bDmg, {
        ailmentId: 'bleed', icon: '🩸', floatClass: 'fn-dmg',
        logText: '🩸 Bleed deals {dmg} to {name}!', logKind: 'poison-tick',
      });
    }

    if (status.burning && status.burning.stacks > 0 && (status.burning.turns || 0) > 0) {
      var burnMult = side === 'enemy' ? (g.player?.burnBonus || 1) : 1;
      var brDmg = globalThis.calcBurningTickDmg(status.burning.stacks, burnMult);
      globalThis.applyAilmentDamage(side, brDmg, {
        ailmentId: 'burning', icon: '🔥', floatClass: 'fn-burn',
        logText: '🔥 Burn deals {dmg} to {name}!', logKind: 'burn-tick',
      });
    }

    if (status.scorched && (status.scorched.turns || 0) > 0) {
      var scMult = side === 'enemy' ? (g.player?.burnBonus || 1) : 1;
      var scDmg = globalThis.calcScorchedTickDmg(scMult);
      globalThis.applyAilmentDamage(side, scDmg, {
        ailmentId: 'scorched', icon: '🔥', floatClass: 'fn-burn',
        logText: '🔥 Scorched deals {dmg} to {name}!', logKind: 'burn-tick',
      });
    }

    R.tickOrder.forEach(function () { /* damage phase done above */ });
    ['poison', 'toxic', 'bleed', 'burning', 'scorched'].forEach(function (key) {
      if (status[key]) decrementAilmentDuration(status, key);
    });
    if (status.chilled) decrementAilmentDuration(status, 'chilled');
    tickGuardDurations(status);
  };

  /** Start-of-turn control: Paralysed roll. Returns 'paralyzed' if turn should be skipped (enemy) or first action blocked. */
  globalThis.tickStartOfTurnControl = function tickStartOfTurnControl(side) {
    var g = globalThis.G;
    var status = sideStatus(side);
    if (!g || !status) return false;

    var skipChance = (globalThis.AILMENTS?.paralyzed?.skipChance) || R.paralyzed.skipChance;
    if (status.paralyzed) {
      var paraTurns = typeof status.paralyzed === 'number' ? status.paralyzed : (status.paralyzed.turns || 0);
      if (paraTurns > 0) {
        var immune = side === 'player' && (g.player?.immuneParalyze || globalThis.BIRDS?.[g.player?.birdKey]?.passive?.immuneStun);
        if (!immune && typeof globalThis.chance === 'function' && globalThis.chance(skipChance)) {
          delete status.paralyzed;
          return 'paralyzed';
        }
        if (typeof status.paralyzed === 'number') status.paralyzed = paraTurns - 1;
        else status.paralyzed.turns = paraTurns - 1;
        if ((typeof status.paralyzed === 'number' && status.paralyzed <= 0) ||
            (typeof status.paralyzed === 'object' && status.paralyzed.turns <= 0)) {
          delete status.paralyzed;
        }
      }
    }
    return false;
  };

  /** Consume Frozen skip on action attempt. Returns true if action should be skipped. */
  globalThis.consumeFrozenSkip = function consumeFrozenSkip(side) {
    var g = globalThis.G;
    var status = sideStatus(side);
    if (!g || !status?.frozen?.pendingSkip) return false;
    var fbs = status.frozen.baseSpd;
    delete status.frozen;
    status.frostGuard = { turns: GUARD_DURATION };
    if (status.chilled) {
      if (fbs != null && side === 'enemy' && g.enemy?.stats) g.enemy.stats.spd = Math.max(1, fbs);
      if (fbs != null && side === 'player' && g.player?.stats) g.player.stats.spd = Math.max(1, fbs);
      delete status.chilled;
    }
    return true;
  };

  globalThis.applyFrozenToTarget = function applyFrozenToTarget(target, baseSpd) {
    var status = sideStatus(target);
    if (!status) return false;
    delete status.chilled;
    status.frozen = { pendingSkip: true, baseSpd: baseSpd != null ? baseSpd : null };
    if (typeof globalThis.logMsg === 'function') {
      var name = target === 'player' ? (globalThis.G?.player?.name || 'You') : (globalThis.G?.enemy?.name || 'Enemy');
      globalThis.logMsg('❄ ' + name + ' is Frozen!', 'system');
    }
    return true;
  };

  globalThis.getEffectiveBlindAccPenalty = function getEffectiveBlindAccPenalty(status) {
    if (!status) return 0;
    var pen = 0;
    if (status.blinded && (status.blinded.turns || 0) > 0) {
      pen += R.blinded.accPenalty;
    }
    if ((status.accDebuff || 0) > 0) pen += status.accDebuff;
    if ((status.enemyBlind || 0) > 0) pen += 15;
    if (status.dustDevil && (status.dustDevil.turns || 0) > 0) pen += (status.dustDevil.accDrop || 15);
    if ((status.blind || 0) > 0) pen += 12;
    return pen;
  };

  globalThis.enemyHasBurningStacks = function enemyHasBurningStacks() {
    var s = globalThis.G?.enemyStatus;
    if (!s) return { burning: false, scorched: false, stacks: 0 };
    var scorched = !!(s.scorched && (s.scorched.turns || 0) > 0);
    var burning = !!(s.burning && s.burning.stacks > 0 && (s.burning.turns || 0) > 0);
    return { burning: burning, scorched: scorched, stacks: burning ? (s.burning.stacks || 0) : 0 };
  };

  globalThis.playerHasBurningStacks = function playerHasBurningStacks() {
    var s = globalThis.G?.playerStatus;
    if (!s) return { burning: false, scorched: false, stacks: 0 };
    var scorched = !!(s.scorched && (s.scorched.turns || 0) > 0);
    var burning = !!(s.burning && s.burning.stacks > 0 && (s.burning.turns || 0) > 0);
    return { burning: burning, scorched: scorched, stacks: burning ? (s.burning.stacks || 0) : 0 };
  };

  var Avian = globalThis.Avian;
  if (!Avian || typeof Avian.statuses.register !== 'function') return;

  function refreshStatusPanel(target) {
    if (typeof globalThis.renderStatuses !== 'function' || !globalThis.G) return;
    var side = target === 'player' ? 'player-status' : 'enemy-status';
    var bag = target === 'player' ? globalThis.G.playerStatus : globalThis.G.enemyStatus;
    if (bag) globalThis.renderStatuses(side, bag);
  }

  Avian.statuses.register('delayed', {
    onConsume: function (_target, value) {
      if (!value || typeof value !== 'object') return null;
      return { dmg: Math.max(0, Number(value.dmg) || 0) };
    },
  });

  Avian.statuses.register('bleed', {
    onConsume: function (_target, value, _src) {
      var stacks = (value && value.stacks) || 0;
      return { bonusMult: 0.5 + Math.min(0.5, stacks * 0.05) };
    },
  });

  Avian.statuses.register('poison', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('toxic', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('burning', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('scorched', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('weaken', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('paralyzed', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('chilled', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('frozen', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('blinded', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('decreed', {
    onApply: function (target) { refreshStatusPanel(target); },
  });
  Avian.statuses.register('marked', {
    onConsume: function () { return { consumed: true }; },
  });
})();
