/* Avian Ascent — battle strike / projectile / reaction FX.
 *
 * Physical attacks lunge the measured distance to the opposing bird and
 * connect. Magic and ranged stay in place (cast / hop) and fire emoji
 * projectiles. Utility skills play a self-flourish, not a strike.
 * Hit recoil is a knockback+flash; dodge is an upward hop away.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.ui = Avian.ui || Object.create(null);
  Avian.ui.combatFxActive = true;

  var ASPECT_EMOJI = {
    solis: ['✨', '☀️', '🌟'], day: ['✨', '☀️', '🌟'],
    lunae: ['🌙', '✦', '💜'], night: ['🌙', '✦', '💜'],
    tempest: ['⚡', '💫', '🌩️'], storm: ['⚡', '💫', '🌩️'],
    maris: ['💧', '🌊', '✦'], water: ['💧', '🌊', '✦'],
    terra: ['🍃', '🌿', '✨'], earth: ['🍃', '🌿', '✨'],
    aeris: ['💨', '🌀', '✨'], sky: ['💨', '🌀', '✨']
  };
  var DEFAULT_MAGIC = ['✨', '✦', '✧'];
  var FRAME_IDLE = 0;
  var FRAME_CALL = 1;
  var FRAME_DASH = 2;
  var FRAME_POWER = 3;

  function wrapEl(who) {
    if (typeof globalThis.getAvatarWrap === 'function') return globalThis.getAvatarWrap(who);
    return document.getElementById(who + '-avatar-wrap');
  }
  function panelEl(who) {
    if (typeof globalThis.getPanel === 'function') return globalThis.getPanel(who);
    return document.getElementById(who + '-panel');
  }
  function spriteEl(who) {
    var host = wrapEl(who);
    return host ? host.querySelector('.sprite4') : null;
  }

  function getFxLayer() {
    var el = document.getElementById('battle-fx-layer');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'battle-fx-layer';
    el.className = 'battle-fx-layer';
    el.setAttribute('aria-hidden', 'true');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function centerOf(who) {
    var n = wrapEl(who);
    if (!n) return null;
    var r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  function applyLungeMetrics(attacker, target, factor) {
    var a = wrapEl(attacker);
    var t = wrapEl(target);
    if (!a || !t) return;
    var ar = a.getBoundingClientRect();
    var tr = t.getBoundingClientRect();
    var dx = (tr.left + tr.width / 2) - (ar.left + ar.width / 2);
    var dy = (tr.top + tr.height / 2) - (ar.top + ar.height / 2);
    var sign = dx === 0 ? (attacker === 'player' ? 1 : -1) : Math.sign(dx);
    var overlap = Math.min(Math.abs(dx) * 0.2, Math.max(tr.width, 72) * 0.4);
    var x = (dx - sign * overlap) * factor;
    var y = dy * 0.38 * factor;
    a.style.setProperty('--lunge-x', Math.round(x) + 'px');
    a.style.setProperty('--lunge-y', Math.round(y) + 'px');
    a.style.setProperty('--lunge-rot', (sign * 12) + 'deg');
    t.style.setProperty('--hit-x', Math.round(sign * 24) + 'px');
    t.style.setProperty('--hit-tilt', (sign * 9) + 'deg');
    t.style.setProperty('--dodge-x', Math.round(sign * 38) + 'px');
  }

  function clearFrames(spr) {
    if (!spr || !spr.classList) return;
    spr.classList.remove('frame-0', 'frame-1', 'frame-2', 'frame-3', 'menu-idle-anim', 'menu-hover-anim', 'menu-dash-anim');
  }

  function setBattleFrame(who, frame) {
    var spr = spriteEl(who);
    if (!spr) return;
    clearFrames(spr);
    spr.classList.add('frame-' + frame);
    spr._busyUntil = Date.now() + 480;
  }

  function playSpriteCycle(who, frames, stepMs) {
    var spr = spriteEl(who);
    if (!spr || !frames || !frames.length) return;
    clearTimeout(spr._cycleTimer);
    var i = 0;
    var step = Math.max(40, stepMs || 90);
    spr._busyUntil = Date.now() + frames.length * step + 80;
    function tick() {
      setBattleFrame(who, frames[i]);
      i += 1;
      if (i < frames.length) spr._cycleTimer = setTimeout(tick, step);
    }
    tick();
  }

  function spawnProjectile(fromWho, toWho, opts) {
    opts = opts || {};
    var from = centerOf(fromWho);
    var to = centerOf(toWho);
    if (!from || !to) return;
    var layer = getFxLayer();
    var el = document.createElement('div');
    var reach = opts.reach == null ? 1 : opts.reach;
    el.className = 'combat-fx-proj' + (opts.cls ? ' ' + opts.cls : '') + (reach < 1 ? ' combat-fx-proj--fizzle' : '');
    el.textContent = opts.emoji || '✨';
    el.style.left = from.x + 'px';
    el.style.top = from.y + 'px';
    layer.appendChild(el);
    var dx = (to.x - from.x) * reach;
    var dy = (to.y - from.y) * reach;
    var ms = opts.ms || (reach < 1 ? 280 : 380);
    requestAnimationFrame(function () {
      el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(' + (reach < 1 ? '0.7' : '1.25') + ')';
      el.style.opacity = reach < 1 ? '0' : '0.2';
    });
    setTimeout(function () { try { el.remove(); } catch (_) {} }, ms + 40);
  }

  function spawnSparkles(who, emojis, count) {
    var c = centerOf(who);
    if (!c) return;
    var layer = getFxLayer();
    var list = emojis && emojis.length ? emojis : DEFAULT_MAGIC;
    var n = Math.max(2, Math.min(7, count || 5));
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'combat-fx-spark';
      el.textContent = list[i % list.length];
      var ang = (-Math.PI / 2) + (i - (n - 1) / 2) * 0.55;
      var dist = 22 + (i % 3) * 10;
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
      el.style.setProperty('--sx', Math.round(Math.cos(ang) * dist) + 'px');
      el.style.setProperty('--sy', Math.round(Math.sin(ang) * dist - 8) + 'px');
      el.style.animationDelay = (i * 45) + 'ms';
      layer.appendChild(el);
      (function (node) { setTimeout(function () { try { node.remove(); } catch (_) {} }, 820); })(el);
    }
  }

  function spawnImpact(who) {
    var c = centerOf(who);
    if (!c) return;
    var layer = getFxLayer();
    var el = document.createElement('div');
    el.className = 'combat-fx-impact';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    layer.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (_) {} }, 400);
  }

  function spawnAura(who) {
    var wrap = wrapEl(who);
    if (!wrap) return;
    var aura = document.createElement('div');
    aura.className = 'combat-fx-aura';
    wrap.appendChild(aura);
    setTimeout(function () { try { aura.remove(); } catch (_) {} }, 580);
  }

  function aspectEmojis(attacker) {
    var G = globalThis.G;
    var ab = attacker === 'player' ? G && G._activePlayerAbility : (G && (G.enemyNextAction || G._activeEnemyAbility));
    var asp = '';
    try {
      if (typeof globalThis.resolveAbilityAspectForDisplay === 'function' && ab) {
        asp = globalThis.resolveAbilityAspectForDisplay(ab, attacker === 'player' ? G.player : G.enemy);
      }
    } catch (_) {}
    if (!asp) {
      asp = attacker === 'player'
        ? (G && G.player && (G.player.aspect || G.player.affinity))
        : (G && G.enemy && (G.enemy.aspect || G.enemy.affinity));
    }
    asp = String(asp || '').toLowerCase().replace(/[^a-z]/g, '');
    return ASPECT_EMOJI[asp] || DEFAULT_MAGIC;
  }

  function utilityEmoji(ab) {
    var s = String((ab && (ab.name || ab.id)) || '').toLowerCase();
    if (/heal|roost|recover|mend|pouch/.test(s)) return '💚';
    if (/guard|shield|bulwark|defend|fortify|brace/.test(s)) return '🛡️';
    if (/song|call|sing|chorus|lull|dirge/.test(s)) return '🎵';
    if (/buff|focus|charge|stance|inspire/.test(s)) return '🔆';
    return '✨';
  }

  function isProjectileKind(kind) {
    var k = String(kind || '').toLowerCase();
    return k === 'spell' || k === 'song' || k === 'magic' || k === 'ranged';
  }

  function prepareCombatStrike(attacker, target, result, kind) {
    var k = String(kind || 'physical').toLowerCase();
    var projectile = isProjectileKind(k);
    var connect = !(result && result.wasDodged);
    applyLungeMetrics(attacker, target, projectile ? 0.12 : (connect ? 1 : 0.4));

    if (projectile) {
      playSpriteCycle(attacker, k === 'ranged' ? [FRAME_DASH, FRAME_CALL, FRAME_IDLE] : [FRAME_POWER, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 110);
      var emojis = k === 'ranged' ? ['🪶', '✦'] : aspectEmojis(attacker);
      spawnProjectile(attacker, target, {
        emoji: emojis[0],
        cls: k === 'ranged' ? 'combat-fx-proj--ranged' : 'combat-fx-proj--magic',
        reach: connect ? 1 : 0.55,
        ms: connect ? 380 : 280
      });
      if (k !== 'ranged') spawnSparkles(attacker, emojis, 4);
    } else {
      playSpriteCycle(attacker, [FRAME_DASH, FRAME_DASH, FRAME_CALL, FRAME_DASH, FRAME_IDLE], 110);
      if (k === 'hybrid' && connect) {
        spawnProjectile(attacker, target, { emoji: aspectEmojis(attacker)[0], cls: 'combat-fx-proj--magic', reach: 1, ms: 360 });
      }
    }

    var hitDelay = projectile ? 280 : 240;
    setTimeout(function () {
      if (!result || result.wasDodged) {
        playSpriteCycle(target, [FRAME_DASH, FRAME_DASH, FRAME_IDLE], 120);
        return;
      }
      playSpriteCycle(target, [FRAME_POWER, FRAME_POWER, FRAME_IDLE], 140);
      spawnImpact(target);
      if (projectile) spawnSparkles(target, aspectEmojis(attacker), 5);
    }, hitDelay);
  }

  function prepareCombatMiss(attacker, missKind, animKind) {
    var k = String(animKind || 'physical').toLowerCase();
    var other = attacker === 'player' ? 'enemy' : 'player';
    applyLungeMetrics(attacker, other, isProjectileKind(k) ? 0.12 : 0.4);
    if (isProjectileKind(k)) {
      playSpriteCycle(attacker, k === 'ranged' ? [FRAME_DASH, FRAME_IDLE] : [FRAME_POWER, FRAME_CALL, FRAME_IDLE], 120);
      var emojis = k === 'ranged' ? ['🪶'] : aspectEmojis(attacker);
      spawnProjectile(attacker, other, {
        emoji: emojis[0],
        cls: (k === 'ranged' ? 'combat-fx-proj--ranged' : 'combat-fx-proj--magic') + ' combat-fx-proj--fizzle',
        reach: 0.45,
        ms: 280
      });
      spawnSparkles(attacker, emojis, 3);
    } else {
      playSpriteCycle(attacker, [FRAME_DASH, FRAME_CALL, FRAME_IDLE], 130);
    }
  }

  function prepareCombatCast(caster, target, text) {
    var who = caster || 'player';
    var dest = target || who;
    playSpriteCycle(who, [FRAME_POWER, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 120);
    spawnAura(who);
    var emojis = aspectEmojis(who);
    if (text && /[^\w\s]/.test(String(text))) emojis = [String(text).trim().charAt(0)].concat(emojis);
    spawnSparkles(who, emojis, 5);
    if (dest && dest !== who) {
      spawnProjectile(who, dest, { emoji: emojis[0], cls: 'combat-fx-proj--magic', reach: 1, ms: 380 });
    }
  }

  function prepareCombatUtility(who, ab) {
    playSpriteCycle(who, [FRAME_CALL, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 130);
    spawnAura(who);
    spawnSparkles(who, [utilityEmoji(ab), '✨', '✦'], 5);
    if (typeof globalThis.playAvatarAnim === 'function') {
      globalThis.playAvatarAnim(who, 'do-utility', 560);
    } else {
      var wrap = wrapEl(who);
      if (wrap) {
        wrap.classList.add('do-utility');
        setTimeout(function () { try { wrap.classList.remove('do-utility'); } catch (_) {} }, 560);
      }
    }
  }

  Avian.ui.combatFxActive = true;
  Avian.ui.combatFx = {
    active: true,
    prepareCombatStrike: prepareCombatStrike,
    prepareCombatMiss: prepareCombatMiss,
    prepareCombatCast: prepareCombatCast,
    prepareCombatUtility: prepareCombatUtility,
    applyLungeMetrics: applyLungeMetrics,
    spawnProjectile: spawnProjectile,
    aspectEmojis: aspectEmojis,
    onHeal: function (who) {
      spawnAura(who);
      spawnSparkles(who, ['💚', '✨'], 4);
      playSpriteCycle(who, [FRAME_CALL, FRAME_POWER, FRAME_IDLE], 130);
    }
  };
})();
