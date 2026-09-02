#!/usr/bin/env node
/**
 * Verify connected combat attack FX:
 * physical lunges use measured --lunge-x, hits differ from dodge,
 * magic/ranged fire projectiles, utility is a non-attack flourish.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function ok(label, cond = true) {
  if (cond) console.log('[combat-fx] ok  ', label);
  else {
    console.error('[combat-fx] FAIL', label);
    failed++;
  }
}

const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const fx = readFileSync(path.join(ROOT, 'js/ui/combat-fx.js'), 'utf8');
const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');
const loadOrder = JSON.parse(readFileSync(path.join(ROOT, 'js/bootstrap/load-order.json'), 'utf8'));
const scripts = loadOrder.gameShellScripts || [];

ok('combat-fx.js exists', existsSync(path.join(ROOT, 'js/ui/combat-fx.js')));
ok('load-order includes combat-fx.js after sprites.js',
  scripts.indexOf('js/ui/combat-fx.js') > scripts.indexOf('js/ui/sprites.js'));
ok('CSS defines --lunge-x', /--lunge-x/.test(css));
ok('CSS smash uses measured lunge var', /translate\(var\(--lunge-x/.test(css));
ok('CSS hit uses --hit-x knockback', /--hit-x/.test(css));
ok('CSS dodge hops upward', /@keyframes dodge-l[\s\S]*?-30px/.test(css));
ok('CSS has do-cast / do-ranged / do-utility',
  /\.do-cast\{/.test(css) && /\.do-ranged\{/.test(css) && /\.do-utility\{/.test(css));
ok('CSS projectile layer exists', /\.battle-fx-layer\{/.test(css) && /\.combat-fx-proj\{/.test(css));
ok('doAttack branches projectile vs lunge', /combatAnimIsProjectile/.test(game) && /do-cast/.test(game));
ok('doMiss uses cast pose for magic', /prepareCombatMiss/.test(game));
ok('playerAction stamps _animAttackKind', /G\._animAttackKind\s*=\s*effActKind/.test(game));
ok('utility flourish hooked from playerAction', /prepareCombatUtility\('player'/.test(game));
ok('conflicting sprite smash skipped when combat FX is active', /__combatFxActive/.test(game));
ok('prepareCombatStrike lives in combat-fx.js', /function prepareCombatStrike/.test(fx));
ok('magic uses aspect emoji projectiles', /ASPECT_EMOJI/.test(fx) && /combat-fx-proj--magic/.test(fx));
ok('physical sprite cycle uses dash/call frames', /FRAME_DASH/.test(fx) && /FRAME_CALL/.test(fx));

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  page.setDefaultTimeout(15000);
  await page.setContent(`<!doctype html>
<html><head>
<style>
body{margin:0;background:#111;}
.combatants{display:grid;grid-template-columns:1fr 1fr;width:1000px;height:320px;gap:40px;padding:20px;}
.combatant-panel{position:relative;overflow:visible;}
.avatar-wrap{position:relative;width:120px;height:120px;margin:40px auto;--lunge-x:280px;--lunge-y:0px;}
#player-avatar-wrap{background:#243;}
#enemy-avatar-wrap{background:#422;}
.sprite4{width:80px;height:80px;background:#8c8;margin:20px auto;}
.sprite4.frame-1{outline:2px solid gold;}
.sprite4.frame-2{outline:2px solid orange;}
.sprite4.frame-3{outline:2px solid violet;}
.do-smash-r{animation:smash-r .2s linear forwards;}
@keyframes smash-r{from{transform:translate(0,0)}to{transform:translate(var(--lunge-x),var(--lunge-y))}}
.do-hit{filter:brightness(2);}
.do-dodge-l{transform:translateY(-30px);}
.do-cast{transform:scale(1.1);}
.do-utility{transform:translateY(-12px);}
.battle-fx-layer{position:fixed;inset:0;pointer-events:none;z-index:9;}
.combat-fx-proj,.combat-fx-spark,.combat-fx-impact{position:fixed;}
</style>
</head><body>
<div class="combatants">
  <div class="combatant-panel player" id="player-panel">
    <div class="avatar-wrap" id="player-avatar-wrap"><div class="avatar-inner" id="player-avatar"><div class="sprite4 frame-0"></div></div></div>
  </div>
  <div class="combatant-panel enemy" id="enemy-panel">
    <div class="avatar-wrap" id="enemy-avatar-wrap"><div class="avatar-inner" id="enemy-avatar"><div class="sprite4 frame-0"></div></div></div>
  </div>
</div>
<script>
function getAvatarWrap(who){ return document.getElementById(who + '-avatar-wrap'); }
function getPanel(who){ return document.getElementById(who + '-panel'); }
function getAvatar(who){ return document.getElementById(who + '-avatar'); }
</script>
</body></html>`);
  await page.addScriptTag({ path: path.join(ROOT, 'js/ui/combat-fx.js') });
  await page.waitForFunction(() => typeof window.prepareCombatStrike === 'function');

  const metrics = await page.evaluate(() => {
    const fx = window.Avian.ui.combatFx;
    fx.applyLungeMetrics('player', 'enemy', 1);
    const p = document.getElementById('player-avatar-wrap');
    const e = document.getElementById('enemy-avatar-wrap');
    const lungeX = parseFloat(p.style.getPropertyValue('--lunge-x'));
    const hitX = parseFloat(e.style.getPropertyValue('--hit-x'));
    const dodgeX = parseFloat(e.style.getPropertyValue('--dodge-x'));
    const pr = p.getBoundingClientRect();
    const er = e.getBoundingClientRect();
    const gap = (er.left + er.width / 2) - (pr.left + pr.width / 2);
    return { lungeX, hitX, dodgeX, gap };
  });
  ok(`physical lunge covers most of the ${Math.round(metrics.gap)}px gap (got ${Math.round(metrics.lungeX)}px)`,
    metrics.lungeX > metrics.gap * 0.55 && metrics.lungeX < metrics.gap);
  ok('hit knockback is away from the attacker (positive for enemy)', metrics.hitX > 0);
  ok('dodge hop is away from the attacker and distinct from hit distance',
    metrics.dodgeX > 0 && Math.abs(metrics.dodgeX) !== Math.abs(metrics.hitX));

  const magic = await page.evaluate(() => {
    window.prepareCombatStrike('player', 'enemy', { wasDodged: false, isMagic: true }, 'spell');
    return {
      projs: document.querySelectorAll('.combat-fx-proj').length,
      sparks: document.querySelectorAll('.combat-fx-spark').length,
      playerFrame: document.querySelector('#player-avatar .sprite4').className
    };
  });
  ok('magic strike spawns a projectile', magic.projs >= 1);
  ok('magic strike spawns sparkles', magic.sparks >= 1);
  ok('magic uses power/call frames rather than dash-only', /frame-[13]/.test(magic.playerFrame));

  const phys = await page.evaluate(() => {
    document.querySelectorAll('.combat-fx-proj,.combat-fx-spark').forEach((n) => n.remove());
    window.prepareCombatStrike('player', 'enemy', { wasDodged: false }, 'physical');
    return document.querySelector('#player-avatar .sprite4').className;
  });
  ok('physical strike uses dash frame cycle', /frame-2/.test(phys));

  const util = await page.evaluate(() => {
    document.querySelectorAll('.combat-fx-proj,.combat-fx-spark,.combat-fx-aura').forEach((n) => n.remove());
    window.prepareCombatUtility('player', { name: 'Roost' });
    return {
      wrapClass: document.getElementById('player-avatar-wrap').className,
      sparks: document.querySelectorAll('.combat-fx-spark').length,
      aura: document.querySelectorAll('.combat-fx-aura').length,
      frame: document.querySelector('#player-avatar .sprite4').className
    };
  });
  ok('utility plays do-utility rather than smash', /\bdo-utility\b/.test(util.wrapClass));
  ok('utility sparkles around the caster', util.sparks >= 1 && util.aura >= 1);
  ok('utility uses call/power frames, not a dash lunge', /frame-[13]/.test(util.frame) && !/do-smash/.test(util.wrapClass));

  const dodgeHit = await page.evaluate(() => {
    const hit = getComputedStyle(document.documentElement).cssText;
    return {
      hitKey: /hit-shake|hit-connect|--hit-x/.test(document.querySelector('style')?.textContent || ''),
      dodgeKey: /dodge/.test(document.querySelector('style')?.textContent || '')
    };
  });
  ok('fixture CSS keeps hit and dodge as separate animations', dodgeHit.hitKey && dodgeHit.dodgeKey);
} catch (err) {
  ok(`playwright combat-fx fixture (${err && err.message})`, false);
} finally {
  await browser.close();
}

if (failed) {
  console.error(`[combat-fx] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[combat-fx] OK');
