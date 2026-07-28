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

/* ---- Kakapo: Moss-King Dream must not revive on damage / ignore cooldown ---- */
{
  const kak = bp.kakapo?.parsed;
  if (kak?.trigger?.kind === 'whileHpBelow' && kak.trigger.skillClass === 'song') ok('kakapo song-gated whileHpBelow');
  else fail('kakapo trigger missing song gate: ' + JSON.stringify(kak?.trigger));
  if (kak?.limit?.kind === 'cooldownTurns' && kak.limit.turns === 3) ok('kakapo 3-turn cooldown parsed');
  else fail('kakapo cooldown missing: ' + JSON.stringify(kak?.limit));
  if ((kak?.specials || []).some((s) => s.id === 'restoreLowerProtection' && s.amount === 2)) ok('kakapo restores lower protection');
  else fail('kakapo missing restoreLowerProtection');

  G.player = {
    birdKey: 'kakapo',
    aspect: 'terra',
    stats: { hp: 5, maxHp: 40, atk: 8, def: 8, matk: 6, mdef: 6, spd: 6, acc: 0, armour: 0, maxArmour: 4, magicArmour: 0, maxMagicArmour: 4 },
  };
  G.enemy = { birdKey: 'crow', aspect: 'aeris', stats: { hp: 40, maxHp: 40, atk: 10, def: 8, matk: 6, mdef: 6, spd: 8, acc: 0 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);

  const hpBeforeHit = G.player.stats.hp;
  Avian.passives.onPlayerDamaged(20, false, {});
  if (G.player.stats.hp === hpBeforeHit) ok('kakapo does not heal on damaged');
  else fail(`kakapo healed on damaged ${hpBeforeHit}→${G.player.stats.hp}`);

  G.player.stats.hp = 0;
  Avian.passives.onPlayerDamaged(5, false, {});
  if (G.player.stats.hp === 0) ok('kakapo does not revive from 0hp on damaged');
  else fail('kakapo revived from 0hp: ' + G.player.stats.hp);

  G.player.stats.hp = 5;
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'SONG_TEST', name: 'Forest Song', btnType: 'song' }, {});
  if (G.player.stats.hp > 5) ok('kakapo song heals while low HP');
  else fail('kakapo song did not heal');
  const cdKey = Object.keys(G.passiveState || {}).find((k) => k.indexOf('kakapo') >= 0);
  const cdLeft = cdKey ? G.passiveState[cdKey].cooldownRemaining : null;
  if (cdLeft === 3) ok('kakapo cooldown armed at 3');
  else fail('kakapo cooldown not armed: ' + cdLeft);

  const hpAfterFirst = G.player.stats.hp;
  Avian.passives.onPlayerAbilityUse({ id: 'SONG_TEST2', name: 'Forest Song', btnType: 'song' }, {});
  if (G.player.stats.hp === hpAfterFirst) ok('kakapo song blocked during cooldown');
  else fail('kakapo healed again during cooldown');

  Avian.passives.onPlayerAbilityUse({ id: 'MOSS_DREAM', name: 'Moss Dream', btnType: 'utility' }, {});
  if (G.player.stats.hp === hpAfterFirst) ok('kakapo ignores Moss Dream for passive');
  else fail('kakapo passive fired from Moss Dream');
}

/* ---- Cardinal: Crimson Benediction heal must require Day Magic vs Burning Health damage ---- */
{
  const card = bp.cardinal?.parsed;
  if (card?.trigger?.kind === 'skillModifier'
    && card.trigger.aspect === 'solis'
    && card.trigger.foeState === 'burning'
    && card.trigger.weaponSkill) ok('cardinal Day Magic vs Burning trigger');
  else fail('cardinal trigger under-specified: ' + JSON.stringify(card?.trigger));
  const healSp = (card?.specials || []).find((s) => s.id === 'healMaxHp');
  if (healSp && healSp.requiresHealthDamage && healSp.pct === 5) ok('cardinal heal requires Health damage');
  else fail('cardinal heal special wrong: ' + JSON.stringify(healSp));
  if (!(card?.specials || []).some((s) => s.id === 'skillPowerBonus')) ok('cardinal has no duplicate flat Skill Power');
  else fail('cardinal still has duplicate skillPowerBonus');

  G.player = {
    birdKey: 'cardinal',
    aspect: 'solis',
    stats: { hp: 20, maxHp: 40, atk: 4, def: 6, matk: 12, mdef: 8, spd: 8, acc: 0 },
  };
  G.enemy = { birdKey: 'crow', aspect: 'aeris', stats: { hp: 40, maxHp: 40, atk: 10, def: 8, matk: 6, mdef: 6, spd: 8, acc: 0 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);

  const wand = { id: 'WSK-011', name: 'Wand Dart', btnType: 'spell', type: 'spell', source: 'Weapon', family: 'Wand', enCost: 2, aspect: 'solis' };

  Avian.passives.onPlayerAbilityUse(wand, { healthDamage: 5 });
  if (G.player.stats.hp === 20) ok('cardinal ignores non-Burning target');
  else fail('cardinal healed without Burning: ' + G.player.stats.hp);

  G.enemyStatus = { burning: { turns: 2, stacks: 1 } };
  G.passiveState = Object.create(null);
  G.playerStatus = {};
  Avian.passives.onPlayerAbilityUse({ id: 'BASIC_MAGIC', name: 'Tail Wand', btnType: 'spell', actionSource: 'basic' }, { healthDamage: 5 });
  if (G.player.stats.hp === 20) ok('cardinal ignores basic attack');
  else fail('cardinal healed from basic: ' + G.player.stats.hp);

  G.passiveState = Object.create(null);
  G.playerStatus = {};
  Avian.passives.prepareOutgoingAbilityBonuses('player', wand);
  const armedSp = G.playerStatus._passiveSkillPowerBonus || 0;
  if (armedSp === 20) ok('cardinal arms +20 Skill Power vs Magic Armour pre-hit');
  else fail('cardinal prepare skill power=' + armedSp);

  Avian.passives.onPlayerAbilityUse(wand, { healthDamage: 0 });
  if (G.player.stats.hp === 20) ok('cardinal no heal without Health damage');
  else fail('cardinal healed without Health damage: ' + G.player.stats.hp);

  G.passiveState = Object.create(null);
  G.playerStatus = {};
  G.player.stats.hp = 20;
  Avian.passives.prepareOutgoingAbilityBonuses('player', wand);
  Avian.passives.onPlayerAbilityUse(wand, { healthDamage: 4 });
  if (G.player.stats.hp === 22) ok('cardinal heals 5% Max HP once when Health damaged');
  else fail('cardinal heal expected 22 got ' + G.player.stats.hp);

  const hpAfter = G.player.stats.hp;
  Avian.passives.prepareOutgoingAbilityBonuses('player', wand);
  Avian.passives.onPlayerAbilityUse(wand, { healthDamage: 4 });
  if (G.player.stats.hp === hpAfter) ok('cardinal heal once-per-turn gated');
  else fail('cardinal healed twice in one turn');
}

if (failed) {
  console.error(`[passives-perks] ${failed} failure(s)`);
  process.exit(1);
}
console.log('[passives-perks] all checks passed');
