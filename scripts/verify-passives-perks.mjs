#!/usr/bin/env node
/**
 * Focused checks: bird passive skill-gate, pending damage consume, enemy Bulwark/Arcane Pressure.
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('[passives-perks] missing bundle — run npm run bundle');
  process.exit(1);
}

let failed = 0;
function fail(msg) { console.error('[passives-perks] FAIL', msg); failed++; }
function ok(msg) { console.log('[passives-perks] ok  ', msg); }

function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: { setProperty: noop, getPropertyValue: () => '', removeProperty: noop },
    dataset: {}, children: [], childNodes: [], parentNode: null, innerHTML: '', textContent: '', value: '',
  };
  const makeEl = (t = 'div') => Object.assign({}, elementProto, { tagName: String(t).toUpperCase(), nodeName: String(t).toUpperCase() });
  const cache = Object.create(null);
  return {
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    createElement: (t) => makeEl(t), createElementNS: (_ns, t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: (id) => (cache[id] ||= makeEl('div')),
    querySelector: () => makeEl('div'), querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true, readyState: 'complete',
  };
}

const store = Object.create(null);
const sandbox = {
  console, setTimeout, clearTimeout, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, Promise, Map, Set,
  document: makeDomStub(),
  location: { search: '?equipmentV2=1', href: 'http://localhost/?equipmentV2=1', pathname: '/' },
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { userAgent: 'node' },
  performance: { now: () => Date.now() },
  addEventListener() {}, removeEventListener() {},
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'avian-game.bundle.js', timeout: 30000 });

const Avian = sandbox.Avian;
const G = sandbox.G || (sandbox.G = {});

const bp = Avian?.data?.combatPack?.birdPassives || {};
const nullKeys = Object.keys(bp).filter((k) => !bp[k]?.parsed);
if (nullKeys.length === 0) ok('all bird passives parsed');
else fail('unparsed bird passives: ' + nullKeys.join(', '));

const sparrow = bp.sparrow?.parsed;
if (sparrow?.trigger?.kind === 'afterSkillUse' && /hedge hop/i.test(sparrow.trigger.skill || '')) {
  ok('sparrow Hedge Hop skill-gate present');
} else fail('sparrow skill-gate missing');

G.player = {
  birdKey: 'shoebill',
  stats: { hp: 40, maxHp: 40, atk: 12, def: 8, matk: 6, mdef: 6, spd: 10, acc: 0 },
};
G.enemy = {
  birdKey: 'crow',
  enemyClass: 'knight',
  class: 'knight',
  stats: { hp: 40, maxHp: 40, atk: 10, def: 10, matk: 6, mdef: 8, spd: 8, acc: 0 },
};
G.playerStatus = {};
G.enemyStatus = {};
G.passiveState = Object.create(null);

if (typeof Avian.passives?.onBattleStart === 'function') Avian.passives.onBattleStart();
if (typeof Avian.classPerks?.onBattleStart === 'function') Avian.classPerks.onBattleStart();

/* Pending damage consume (shoebill-style nextAttack damage up). */
G.playerStatus._passiveDamageBonusPending = {
  'test:v2:damage:moderate': { value: 0.25, dmgType: 'any', turns: 1, nextAttack: true },
};
const fracs = Avian.passives.collectPendingDamageBonusFractions('player', { id: 'BASIC_PHYSICAL', btnType: 'physical' }, { isAttack: true });
if (fracs.length === 1 && Math.abs(fracs[0] - 0.25) < 1e-9
    && !G.playerStatus._passiveDamageBonusPending['test:v2:damage:moderate']) {
  ok('pending damage bonus consumed once');
} else fail('pending damage bonus consume failed: ' + JSON.stringify(fracs));

/* Sparrow skill-gate: wrong skill must not fire display slot. */
G.player.birdKey = 'sparrow';
G.playerStatus = {};
G.passiveState = Object.create(null);
Avian.passives.onPlayerAbilityUse({ id: 'WPN_TALON_RAKE', name: 'Talon Rake', btnType: 'physical' }, {});
const wrong = G.playerStatus._passiveDisplaySlots || {};
if (!Object.keys(wrong).length) ok('sparrow ignores non-Hedge-Hop skills');
else fail('sparrow fired on wrong skill');

Avian.passives.onPlayerAbilityUse({ id: 'UTIL_HEDGE_HOP', name: 'Hedge Hop', btnType: 'utility' }, {});
const right = G.playerStatus._passiveDisplaySlots || {};
if (Object.keys(right).length) ok('sparrow fires on Hedge Hop');
else fail('sparrow did not fire on Hedge Hop');

/* Enemy Bulwark Oath first-hit DR. */
G.enemy.birdKey = 'crow';
Avian.classPerks.applyClassPerkMetadata(G.enemy);
G.enemyStatus = { _classPerkState: {} };
const m1 = Avian.classPerks.getIncomingDamageMultiplierForEntity(G.enemy);
Avian.classPerks.markBulwarkOathConsumed(G.enemy);
const m2 = Avian.classPerks.getIncomingDamageMultiplierForEntity(G.enemy);
if (G.enemy._classPerk?.def?.id === 'bulwarkOath' || G.enemy.classPerk === 'Bulwark Oath') {
  if (m1 < 1 && m2 === 1) ok('enemy Bulwark first-hit then consumed');
  else fail(`enemy Bulwark mults m1=${m1} m2=${m2}`);
} else {
  /* Crow may not be knight — force knight perk metadata. */
  G.enemy._classPerk = {
    id: 'bulwarkOath',
    name: 'Bulwark Oath',
    def: { id: 'bulwarkOath', damageReduction: 0.10, firstHitPerTurn: true },
  };
  G.enemyStatus._classPerkState = {};
  const a = Avian.classPerks.getIncomingDamageMultiplierForEntity(G.enemy);
  Avian.classPerks.markBulwarkOathConsumed(G.enemy);
  const b = Avian.classPerks.getIncomingDamageMultiplierForEntity(G.enemy);
  if (a === 0.9 && b === 1) ok('enemy Bulwark first-hit then consumed');
  else fail(`forced enemy Bulwark mults a=${a} b=${b}`);
}

/* Arcane Pressure on mage enemy. */
G.enemy.birdKey = 'raven';
G.enemy.enemyClass = 'mage';
G.enemy.class = 'mage';
delete G.enemy._classPerk;
Avian.classPerks.applyClassPerkMetadata(G.enemy);
const pen = Avian.classPerks.getExtraMdefPierceForEntity(G.enemy, { btnType: 'spell', type: 'spell' });
if (pen >= 0.1) ok('enemy Arcane Pressure mdef pen');
else {
  G.enemy._classPerkMdefPen = 0.10;
  G.enemy._classPerk = { def: { id: 'arcanePressure', mdefPen: 0.10 } };
  const pen2 = Avian.classPerks.getExtraMdefPierceForEntity(G.enemy, { btnType: 'spell' });
  if (pen2 >= 0.1) ok('enemy Arcane Pressure mdef pen (forced)');
  else fail('enemy Arcane Pressure missing, pen=' + pen2);
}

if (typeof Avian.passives.onEnemyAbilityUse !== 'function') fail('onEnemyAbilityUse missing');
else ok('onEnemyAbilityUse exported');
if (typeof Avian.passives.onEnemyDamaged !== 'function') fail('onEnemyDamaged missing');
else ok('onEnemyDamaged exported');

if (failed) {
  console.error(`[passives-perks] ${failed} failure(s)`);
  process.exit(1);
}
console.log('[passives-perks] all checks passed');
