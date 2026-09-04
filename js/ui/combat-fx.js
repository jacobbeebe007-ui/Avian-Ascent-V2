/* Avian Ascent — battle strike / projectile / reaction FX.
 *
 * Physical attacks lunge the measured distance to the opposing bird and
 * connect. Magic and ranged stay in place (cast / hop) and fire emoji
 * projectiles. Utility skills play a self-flourish, not a strike.
 * Hit recoil is a knockback+flash; dodge is an upward hop away.
 * Misses send the attacker across the screen and back from above.
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
  var SONG_NOTES = ['🎶', '🎵', '♪', '♫'];
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

  function activeAbility(attacker) {
    var G = globalThis.G;
    if (!G) return null;
    return attacker === 'player' ? G._activePlayerAbility : (G.enemyNextAction || G._activeEnemyAbility);
  }

  function resolveWeaponFamily(attacker, ab) {
    ab = ab || activeAbility(attacker);
    if (ab) {
      if (ab.family) return String(ab.family);
      if (ab.weaponFamily) return String(ab.weaponFamily);
      if (Array.isArray(ab.tags)) {
        for (var ti = 0; ti < ab.tags.length; ti++) {
          var tag = String(ab.tags[ti] || '');
          if (/pinion|blade|sabre|bow|crossbow|hammer|scythe|lance|staff|wand|grimoire|song/i.test(tag)) return tag;
        }
      }
    }
    if (attacker !== 'player') return '';
    var G = globalThis.G;
    var eq = G && G.player && (G.player.equipment || G.player._equipment);
    if (!eq) return '';
    var mainId = eq.mainHand || eq.weapon || eq.main;
    var item = typeof Avian.equipment?.getItem === 'function'
      ? Avian.equipment.getItem(mainId)
      : (Avian.data?.equipment?.items?.[mainId] || null);
    return item?.family ? String(item.family) : '';
  }

  function weaponAnimProfile(family) {
    var f = String(family || '').toLowerCase();
    if (/bow|crossbow/.test(f)) return { ranged: true, slash: null, thrust: false };
    if (/dagger|pinion|sabre|talon|scratch|stab/.test(f)) return { ranged: false, slash: 'light', thrust: false };
    if (/hammer/.test(f)) return { ranged: false, slash: 'blunt', thrust: false };
    if (/greatblade|greatbow/.test(f)) return { ranged: /greatbow/.test(f), slash: /greatbow/.test(f) ? null : 'heavy', thrust: false };
    if (/scythe|sickle/.test(f)) return { ranged: false, slash: 'sweep', thrust: false };
    if (/lance/.test(f)) return { ranged: false, slash: null, thrust: true };
    if (/staff|wand|grimoire|orb|sceptre/.test(f)) return { ranged: false, slash: null, thrust: false, arc: true };
    return { ranged: false, slash: 'light', thrust: false };
  }

  function abilityIsSong(ab) {
    if (!ab) return false;
    var kind = String(ab.btnType || ab.type || ab.category || '').toLowerCase();
    var name = String(ab.name || ab.id || '').toLowerCase();
    return kind === 'song' || /song|call|verse|chorus|lament|hymn|lullaby|dirge/i.test(name);
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
    var overlap = Math.min(Math.abs(dx) * 0.1, Math.max(tr.width, 72) * 0.22);
    var x = (dx - sign * overlap) * factor;
    if (Math.abs(x) < 48 && factor >= 0.9) {
      x = sign * Math.max(Math.abs(dx) - overlap, 120);
    }
    var y = dy * 0.38 * factor;
    a.style.setProperty('--lunge-x', Math.round(x) + 'px');
    a.style.setProperty('--lunge-y', Math.round(y) + 'px');
    a.style.setProperty('--lunge-rot', (sign * 12) + 'deg');
    t.style.setProperty('--hit-x', Math.round(sign * 24) + 'px');
    t.style.setProperty('--hit-tilt', (sign * 9) + 'deg');
    t.style.setProperty('--dodge-x', Math.round(sign * 38) + 'px');
  }

  function applyOverflyMetrics(attacker, target) {
    var a = wrapEl(attacker);
    var t = wrapEl(target);
    if (!a || !t) return;
    var ar = a.getBoundingClientRect();
    var tr = t.getBoundingClientRect();
    var dx = (tr.left + tr.width / 2) - (ar.left + ar.width / 2);
    var sign = dx === 0 ? (attacker === 'player' ? 1 : -1) : Math.sign(dx);
    var exit = sign * (Math.abs(dx) + Math.max(ar.width, tr.width, 96) * 1.35 + (typeof window !== 'undefined' ? window.innerWidth * 0.18 : 180));
    a.style.setProperty('--overfly-x', Math.round(exit) + 'px');
    a.style.setProperty('--overfly-y', Math.round((tr.top - ar.top) * 0.22 - 18) + 'px');
    a.style.setProperty('--overfly-drop', '-150px');
  }

  function clearFrames(spr) {
    if (!spr || !spr.classList) return;
    spr.classList.remove(
      'frame-0', 'frame-1', 'frame-2', 'frame-3',
      'menu-idle-anim', 'menu-hover-anim', 'menu-dash-anim',
      'anim-attack-player', 'anim-attack-enemy', 'anim-hit-player', 'anim-hit-enemy'
    );
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
    var rot = opts.rotate == null ? 0 : opts.rotate;
    requestAnimationFrame(function () {
      var scale = reach < 1 ? '0.7' : '1.25';
      el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + rot + 'deg) scale(' + scale + ')';
      el.style.opacity = reach < 1 ? '0' : '0.2';
    });
    setTimeout(function () { try { el.remove(); } catch (_) {} }, ms + 40);
  }

  function spawnHorizontalFeather(fromWho, toWho, opts) {
    opts = opts || {};
    var from = centerOf(fromWho);
    var to = centerOf(toWho);
    if (!from || !to) return;
    var layer = getFxLayer();
    var el = document.createElement('div');
    var reach = opts.reach == null ? 1 : opts.reach;
    el.className = 'combat-fx-proj combat-fx-proj--feather' + (reach < 1 ? ' combat-fx-proj--fizzle' : '');
    el.textContent = '🪶';
    el.style.left = from.x + 'px';
    el.style.top = from.y + 'px';
    layer.appendChild(el);
    var dx = (to.x - from.x) * reach;
    var dy = (to.y - from.y) * reach;
    var rot = dx >= 0 ? 8 : 188;
    var ms = opts.ms || (reach < 1 ? 280 : 400);
    requestAnimationFrame(function () {
      el.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + rot + 'deg) scale(' + (reach < 1 ? '0.65' : '1.2') + ')';
      el.style.opacity = reach < 1 ? '0' : '1';
    });
    setTimeout(function () { try { el.remove(); } catch (_) {} }, ms + 40);
  }

  function animateAlongWave(el, from, to, delayMs, durationMs, waveAmp, onDone) {
    var startAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (delayMs || 0);
    function tick(now) {
      var t = (now - startAt) / (durationMs || 520);
      if (t < 0) {
        requestAnimationFrame(tick);
        return;
      }
      if (t >= 1) {
        try { el.remove(); } catch (_) {}
        if (onDone) onDone();
        return;
      }
      var x = from.x + (to.x - from.x) * t;
      var wave = Math.sin(t * Math.PI * 2.8) * (waveAmp || 26);
      var y = from.y + (to.y - from.y) * t + wave;
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
      el.style.opacity = t > 0.88 ? String(1 - (t - 0.88) / 0.12) : '1';
      el.style.transform = 'translate(-50%, -50%) scale(' + (0.75 + t * 0.35) + ') rotate(' + Math.round(Math.sin(t * 10) * 8) + 'deg)';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function spawnSongNotes(fromWho, toWho, opts) {
    opts = opts || {};
    var from = centerOf(fromWho);
    var to = centerOf(toWho || fromWho);
    if (!from || !to) return;
    var layer = getFxLayer();
    var count = opts.count || 5;
    var reach = opts.reach == null ? 1 : opts.reach;
    var dest = { x: from.x + (to.x - from.x) * reach, y: from.y + (to.y - from.y) * reach };
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      el.className = 'combat-fx-note';
      el.textContent = SONG_NOTES[i % SONG_NOTES.length];
      el.style.left = from.x + 'px';
      el.style.top = from.y + 'px';
      layer.appendChild(el);
      animateAlongWave(el, from, dest, i * 70, opts.ms || 560, 22 + (i % 3) * 6);
    }
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

  function spawnSlashImpact(who, style, attacker) {
    var c = centerOf(who);
    if (!c) return;
    var layer = getFxLayer();
    var el = document.createElement('div');
    var slash = style || 'light';
    var facing = attacker === 'player' ? 'r' : 'l';
    el.className = 'combat-fx-slash combat-fx-slash--' + slash + ' combat-fx-slash--' + facing;
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    layer.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (_) {} }, slash === 'blunt' ? 420 : 340);
  }

  function spawnThrustLine(fromWho, toWho, connect) {
    var from = centerOf(fromWho);
    var to = centerOf(toWho);
    if (!from || !to) return;
    var layer = getFxLayer();
    var el = document.createElement('div');
    el.className = 'combat-fx-thrust' + (connect ? '' : ' combat-fx-thrust--fizzle');
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var len = Math.sqrt(dx * dx + dy * dy) * (connect ? 0.92 : 0.45);
    var ang = Math.atan2(dy, dx) * 180 / Math.PI;
    el.style.left = from.x + 'px';
    el.style.top = from.y + 'px';
    el.style.setProperty('--thrust-len', Math.round(len) + 'px');
    el.style.setProperty('--thrust-rot', ang + 'deg');
    layer.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (_) {} }, connect ? 360 : 280);
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
    var ab = activeAbility(attacker);
    var asp = '';
    var G = globalThis.G;
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

  function fireProjectile(attacker, target, kind, profile, connect) {
    var reach = connect ? 1 : 0.55;
    var ms = connect ? 380 : 280;
    if (kind === 'song' || abilityIsSong(activeAbility(attacker))) {
      spawnSongNotes(attacker, target, { reach: reach, ms: ms + 80, count: connect ? 5 : 3 });
      return;
    }
    if (kind === 'ranged' || profile.ranged) {
      spawnHorizontalFeather(attacker, target, { reach: reach, ms: ms + 20 });
      return;
    }
    if (profile.thrust) {
      spawnThrustLine(attacker, target, connect);
      return;
    }
    var emojis = aspectEmojis(attacker);
    spawnProjectile(attacker, target, {
      emoji: emojis[0],
      cls: profile.arc ? 'combat-fx-proj--magic combat-fx-proj--arc' : 'combat-fx-proj--magic',
      reach: reach,
      ms: ms
    });
    spawnSparkles(attacker, emojis, 4);
  }

  function prepareCombatStrike(attacker, target, result, kind) {
    var k = String(kind || 'physical').toLowerCase();
    var ab = activeAbility(attacker);
    var profile = weaponAnimProfile(resolveWeaponFamily(attacker, ab));
    if (profile.ranged && k === 'physical') k = 'ranged';
    var projectile = isProjectileKind(k) || profile.ranged || profile.thrust;
    var connect = !(result && result.wasDodged);
    applyLungeMetrics(attacker, target, projectile ? 0.12 : (connect ? 1 : 0.4));

    if (projectile) {
      playSpriteCycle(attacker, k === 'ranged' || profile.ranged
        ? [FRAME_DASH, FRAME_CALL, FRAME_IDLE]
        : (k === 'song' || abilityIsSong(ab))
          ? [FRAME_CALL, FRAME_POWER, FRAME_CALL, FRAME_IDLE]
          : [FRAME_POWER, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 110);
      fireProjectile(attacker, target, k, profile, connect);
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
      if (profile.slash) {
        spawnSlashImpact(target, profile.slash, attacker);
      } else {
        spawnImpact(target);
      }
      if (projectile && k !== 'song' && !abilityIsSong(ab)) {
        spawnSparkles(target, aspectEmojis(attacker), 5);
      } else if (k === 'song' || abilityIsSong(ab)) {
        spawnSparkles(target, SONG_NOTES, 4);
      }
    }, hitDelay);
  }

  function prepareCombatMiss(attacker, missKind, animKind) {
    var k = String(animKind || 'physical').toLowerCase();
    var other = attacker === 'player' ? 'enemy' : 'player';
    var ab = activeAbility(attacker);
    var profile = weaponAnimProfile(resolveWeaponFamily(attacker, ab));
    if (profile.ranged && k === 'physical') k = 'ranged';
    var projectile = isProjectileKind(k) || profile.ranged;
    var isDodge = missKind === 'dodge';

    if (projectile) {
      applyLungeMetrics(attacker, other, 0.12);
      playSpriteCycle(attacker, k === 'ranged' || profile.ranged ? [FRAME_DASH, FRAME_IDLE] : [FRAME_POWER, FRAME_CALL, FRAME_IDLE], 120);
      fireProjectile(attacker, other, k, profile, false);
    } else if (!isDodge) {
      applyOverflyMetrics(attacker, other);
      playSpriteCycle(attacker, [FRAME_DASH, FRAME_DASH, FRAME_CALL, FRAME_DASH, FRAME_CALL, FRAME_IDLE], 95);
      var overflyCls = attacker === 'player' ? 'do-miss-overfly-r' : 'do-miss-overfly-l';
      if (typeof globalThis.playAvatarAnim === 'function') {
        globalThis.playAvatarAnim(attacker, overflyCls, 1120);
      } else {
        var wrap = wrapEl(attacker);
        if (wrap) {
          wrap.classList.add(overflyCls);
          setTimeout(function () { try { wrap.classList.remove(overflyCls); } catch (_) {} }, 1120);
        }
      }
    } else {
      applyLungeMetrics(attacker, other, 0.4);
      playSpriteCycle(attacker, [FRAME_DASH, FRAME_CALL, FRAME_IDLE], 130);
    }
  }

  function prepareCombatCast(caster, target, text) {
    var who = caster || 'player';
    var dest = target || who;
    var ab = activeAbility(who);
    playSpriteCycle(who, [FRAME_POWER, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 120);
    spawnAura(who);
    if (abilityIsSong(ab)) {
      spawnSongNotes(who, dest !== who ? dest : who, { reach: dest !== who ? 1 : 0.35, count: 6, ms: 620 });
      spawnSparkles(who, SONG_NOTES, 4);
    } else {
      var emojis = aspectEmojis(who);
      if (text && /[^\w\s]/.test(String(text))) emojis = [String(text).trim().charAt(0)].concat(emojis);
      spawnSparkles(who, emojis, 5);
      if (dest && dest !== who) {
        spawnProjectile(who, dest, { emoji: emojis[0], cls: 'combat-fx-proj--magic', reach: 1, ms: 380 });
      }
    }
  }

  function prepareCombatUtility(who, ab) {
    ab = ab || activeAbility(who);
    playSpriteCycle(who, [FRAME_CALL, FRAME_CALL, FRAME_POWER, FRAME_IDLE], 130);
    spawnAura(who);
    if (abilityIsSong(ab)) {
      spawnSongNotes(who, who, { reach: 0.42, count: 6, ms: 700 });
      spawnSparkles(who, SONG_NOTES.concat(['✨']), 5);
    } else if (/heal|roost|recover|mend/i.test(String(ab?.name || ab?.id || ''))) {
      spawnSparkles(who, ['💚', '✨', '💚'], 6);
    } else if (/guard|shield|bulwark|defend|fortify/i.test(String(ab?.name || ab?.id || ''))) {
      spawnSparkles(who, ['🛡️', '✨', '🛡️'], 5);
    } else {
      spawnSparkles(who, [utilityEmoji(ab), '✨', '✦'], 5);
    }
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
    applyOverflyMetrics: applyOverflyMetrics,
    spawnProjectile: spawnProjectile,
    spawnSongNotes: spawnSongNotes,
    spawnHorizontalFeather: spawnHorizontalFeather,
    spawnSlashImpact: spawnSlashImpact,
    aspectEmojis: aspectEmojis,
    weaponAnimProfile: weaponAnimProfile,
    onHeal: function (who) {
      spawnAura(who);
      spawnSparkles(who, ['💚', '✨'], 4);
      playSpriteCycle(who, [FRAME_CALL, FRAME_POWER, FRAME_IDLE], 130);
    }
  };
})();
