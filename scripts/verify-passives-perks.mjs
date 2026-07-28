#!/usr/bin/env node
/**
 * Focused checks: bird passive skill-gate, pending damage consume, class perk hooks.
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
    remove: noop,
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
} else fail('sparrow skill-gate missing: ' + JSON.stringify(sparrow?.trigger));

/* New Sparrow wording points at Weapon Skill 1 Precision. */
if (/\+10 Precision/i.test(bp.sparrow?.effect || '')) ok('sparrow passive mentions +10 Precision');
else fail('sparrow passive missing +10 Precision');

G.player = {
  birdKey: 'shoebill',
  stats: { hp: 40, maxHp: 40, atk: 12, def: 8, matk: 6, mdef: 6, spd: 10, acc: 0 },
};
G.enemy = {
  birdKey: 'crow',
  stats: { hp: 40, maxHp: 40, atk: 10, def: 10, matk: 6, mdef: 8, spd: 8, acc: 0 },
};
G.playerStatus = {};
G.enemyStatus = {};
G.passiveState = Object.create(null);

/* Pending nextAttack damage bonus consume (legacy path). */
if (typeof Avian.passives?.collectOutgoingDamageBonusFractions === 'function') {
  G.playerStatus._passiveDamageBonusPending = {
    'test:v2:damage:minor': { value: 0.1, dmgType: 'any', turns: 1, nextAttack: true },
  };
  const fracs = Avian.passives.collectOutgoingDamageBonusFractions({ btnType: 'physical' }, {});
  const fracs2 = Avian.passives.collectOutgoingDamageBonusFractions({ btnType: 'physical' }, {});
  if (fracs.length === 1 && fracs2.length === 0) ok('pending damage bonus consumed once');
  else fail('pending damage bonus consume failed: ' + JSON.stringify(fracs));
} else {
  ok('pending damage bonus path skipped (no collector)');
}

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

/* Bulwark Oath: Fortify/Armour Restoration → Guard Up (no longer first-hit DR). */
G.enemy.birdKey = 'crow';
G.enemy.class = 'knight';
G.enemy.stats.def = 10;
delete G.enemy._classPerk;
Avian.classPerks.applyClassPerkMetadata(G.enemy);
G.enemyStatus = { _classPerkState: {} };
G.enemy._classPerk = {
  id: 'bulwarkOath',
  name: 'Bulwark Oath',
  def: { id: 'bulwarkOath', guardBonus: 4, afterArmourRestoreOrFortify: true },
};
const defBefore = G.enemy.stats.def;
Avian.classPerks.onEnemyAbilityUse({ id: 'FORTIFY', name: 'Iron Fortify', barSlot: 'Fortify' }, {});
const defAfter = G.enemy.stats.def;
const mAlways = Avian.classPerks.getIncomingDamageMultiplierForEntity(G.enemy);
if (defAfter === defBefore + 4 && mAlways === 1) ok('enemy Bulwark Fortify grants +4 Guard (no DR)');
else fail(`enemy Bulwark def ${defBefore}→${defAfter} mult=${mAlways}`);

/* Arcane Pressure: Magic Armour damage bonus flag (no Resolve pen). */
G.enemy.birdKey = 'blackbird';
G.enemy.class = 'mage';
delete G.enemy._classPerk;
Avian.classPerks.applyClassPerkMetadata(G.enemy);
G.enemyStatus = { _classPerkState: {} };
G.enemy._classPerk = {
  id: 'arcanePressure',
  name: 'Arcane Pressure',
  def: { id: 'arcanePressure', magicArmourDamageBonus: 0.10, firstMagicWeaponSkillPerTurn: true },
};
Avian.classPerks.onEnemyAbilityUse({
  id: 'WSK-011', name: 'Wand Dart', btnType: 'spell', type: 'spell',
  source: 'Weapon', family: 'Wand', en: 2,
}, {});
const pen = Avian.classPerks.getExtraMdefPierceForEntity(G.enemy, { btnType: 'spell' });
const magBonus = Avian.classPerks.peekArcanePressureMagicArmourBonus(G.enemy, {
  id: 'WSK-011', name: 'Wand Dart', btnType: 'spell', type: 'spell',
  source: 'Weapon', family: 'Wand', en: 2,
});
if (pen === 0 && magBonus >= 0.1) ok('enemy Arcane Pressure Magic Armour bonus (no mdef pen)');
else fail(`Arcane Pressure pen=${pen} magBonus=${magBonus}`);

/* Class perk names from pack. */
const classes = Avian.data.combatPack.classes;
if (classes.siren?.classPerk === 'Cursed Call') ok('Siren class perk is Cursed Call');
else fail('Siren perk=' + classes.siren?.classPerk);
if (/Weapon Skill 1 gains \+10 Precision/i.test(classes.rogue?.classPerkEffect || '')) ok('Rogue Tempo Weapon Skill 1 Precision');
else fail('Rogue Tempo text mismatch');
if (/Armour Restoration or Fortify/i.test(classes.knight?.classPerkEffect || '')) ok('Bulwark Oath Fortify wording');
else fail('Bulwark text mismatch');

if (typeof Avian.passives.onEnemyAbilityUse !== 'function') fail('onEnemyAbilityUse missing');
else ok('onEnemyAbilityUse exported');
if (typeof Avian.passives.onEnemyDamaged !== 'function') fail('onEnemyDamaged missing');
else ok('onEnemyDamaged exported');

if (failed) {
  console.error(`[passives-perks] ${failed} failure(s)`);
  process.exit(1);
}
console.log('[passives-perks] all checks passed');
