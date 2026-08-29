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
const armed = G.playerStatus._passiveNextSkill;
if (armed && armed.gate && armed.gate.weaponSkill1) ok('sparrow arms next Weapon Skill 1 after Hedge Hop');
else fail('sparrow did not arm next WS1: ' + JSON.stringify(armed));
if (!Object.keys(G.playerStatus._passiveDisplaySlots || {}).length) ok('sparrow does not buff Hedge Hop itself');
else fail('sparrow applied display slots on Hedge Hop');

Avian.passives.prepareOutgoingAbilityBonuses('player', {
  id: 'WSK-001', name: 'Talon Rake', btnType: 'physical', actionSource: 'weaponA', barSlot: 'Weapon Skill 1', enCost: 2,
});
Avian.passives.onPlayerAbilityUse({
  id: 'WSK-001', name: 'Talon Rake', btnType: 'physical', actionSource: 'weaponA', barSlot: 'Weapon Skill 1', enCost: 2,
}, { hitsLanded: 1, damage: 4 });
const right = G.playerStatus._passiveDisplaySlots || {};
const hasAcc = Object.values(right).some((s) => s && s.kind === 'gainAcc' && s.value >= 10);
const hasCrit = Object.values(right).some((s) => s && s.kind === 'gainCritChance' && s.value >= 5);
if (hasAcc && hasCrit) ok('sparrow Precision + Crit apply on next Weapon Skill 1');
else fail('sparrow WS1 missing Precision/Crit slots: ' + JSON.stringify(right));
if (!G.playerStatus._passiveNextSkill) ok('sparrow next-skill pending consumed');
else fail('sparrow pending still armed');

/* Rock Dove: Armour absorb arms next song restore. */
{
  G.player.birdKey = 'rockDove';
  G.player.stats.armour = 0;
  G.player.stats.maxArmour = 8;
  G.player.stats.normalMaxArmour = 8;
  G.playerStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onArmourAbsorbed(G.player, 4);
  const pending = G.playerStatus._passiveNextSkill;
  if (pending && pending.gate && pending.gate.skillClass === 'song'
    && (pending.specials || []).some((s) => s.id === 'restoreArmour' && s.amount === 3)) {
    ok('rock dove arms next song restore 3 Armour');
  } else fail('rock dove pending wrong: ' + JSON.stringify(pending));
  Avian.passives.onPlayerAbilityUse({
    id: 'SONG_TEST', name: 'Court Song', btnType: 'spell', skillType: 'song', barSlot: 'Song',
  }, {});
  if ((G.player.stats.armour || 0) >= 3) ok('rock dove song restores 3 Armour');
  else fail('rock dove song restore failed, armour=' + G.player.stats.armour);
}

/* Shoebill: idle last turn → Strength weapon skill Skill Power + Armour damage. */
{
  G.player.birdKey = 'shoebill';
  G.playerStatus = {};
  G.passiveState = Object.create(null);
  G._passiveNoDamageLastTurn = { player: true };
  Avian.passives.prepareOutgoingAbilityBonuses('player', {
    id: 'WSK-009', name: 'Crushing Peck', btnType: 'physical', actionSource: 'weaponA',
    weaponClass: 'strength', family: 'Hammer', barSlot: 'Weapon Skill 1', enCost: 2, scalingStat: 'ATK',
  });
  if ((G.playerStatus._passiveSkillPowerBonus || 0) >= 20
    && (G.playerStatus._passiveFlatArmourDamage || 0) >= 2) {
    ok('shoebill idle-turn Strength skill arms +20 Skill Power and +2 Armour damage');
  } else fail('shoebill bonuses missing: ' + JSON.stringify({
    sp: G.playerStatus._passiveSkillPowerBonus,
    arm: G.playerStatus._passiveFlatArmourDamage,
    armed: G.playerStatus._v2PassiveArmedAbility,
  }));
}

/* Kiwi: ignore 4 Guard is consumed as flat pen. */
{
  G.player.birdKey = 'kiwi';
  G.playerStatus = {};
  G.enemyStatus = { jewelMark: { turns: 2 } };
  G.passiveState = Object.create(null);
  G._workbookPassiveDefFlat = 0;
  Avian.passives.prepareOutgoingAbilityBonuses('player', {
    id: 'WSK-001', name: 'Talon Rake', btnType: 'physical', actionSource: 'weaponA',
    family: 'Talon', barSlot: 'Weapon Skill 1', enCost: 2,
  });
  if ((G._workbookPassiveDefFlat || 0) >= 4) ok('kiwi ignoreGuardFlat armed vs marked target');
  else fail('kiwi ignoreGuardFlat not armed: ' + G._workbookPassiveDefFlat);
}

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

/* ---- Broader under-gated bird audit ---- */
{
  const duke = bp.dukeBlakiston?.parsed;
  if (duke?.trigger?.kind === 'onHpBelow' && duke.trigger.pct === 50) ok('duke onHpBelow trigger');
  else fail('duke trigger: ' + JSON.stringify(duke?.trigger));

  G.player = {
    birdKey: 'dukeBlakiston', aspect: 'lunae',
    stats: { hp: 30, maxHp: 40, atk: 10, def: 8, matk: 10, mdef: 8, spd: 8, acc: 0, armour: 0, maxArmour: 20, normalMaxArmour: 20, magicArmour: 0, maxMagicArmour: 20, normalMaxMagicArmour: 20 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 40, maxHp: 40 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-011', name: 'Wand Dart', btnType: 'spell', enCost: 2 }, {});
  if ((G.player.stats.armour || 0) === 0) ok('duke does not fire on arbitrary skill use');
  else fail('duke fired on skill use armour=' + G.player.stats.armour);

  G.player.stats.hp = 15; // already reduced by the hit
  Avian.passives.onPlayerDamaged(15, false, {}); // crossed 50% of 40 (=20) from 30→15
  if ((G.player.stats.armour || 0) >= 5) ok('duke restores Armour on crossing 50% HP');
  else fail('duke armour after cross: ' + G.player.stats.armour);
}

{
  const dodo = bp.dodo?.parsed;
  if (dodo?.trigger?.kind === 'onArmourBreakLowHp') ok('dodo armour-break trigger');
  else fail('dodo trigger: ' + JSON.stringify(dodo?.trigger));
  G.player = {
    birdKey: 'dodo', aspect: 'terra',
    stats: { hp: 10, maxHp: 40, atk: 8, def: 10, matk: 4, mdef: 6, spd: 4, acc: 0, armour: 0, maxArmour: 8 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 40, maxHp: 40 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'BASIC_PHYSICAL', name: 'Beak Jab', btnType: 'physical' }, {});
  if ((G.player.stats.armour || 0) === 0) ok('dodo does not fire on skill use');
  else fail('dodo fired on skill');
  Avian.passives.onPlayerDamaged(5, false, { brokePool: true });
  if ((G.player.stats.armour || 0) === 4) ok('dodo restores 4 Armour on armour break while low HP');
  else fail('dodo armour=' + G.player.stats.armour);
}

{
  const vul = bp.vulture?.parsed;
  if (vul?.trigger?.kind === 'skillModifier' && vul.trigger.foeHpBelow === 50) ok('vulture targets foe HP below');
  else fail('vulture trigger: ' + JSON.stringify(vul?.trigger));
  G.player = {
    birdKey: 'vulture', aspect: 'terra',
    stats: { hp: 10, maxHp: 40, atk: 10, def: 6, matk: 4, mdef: 6, spd: 6, acc: 0, armour: 0, maxArmour: 4, magicArmour: 0, maxMagicArmour: 4 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 40, maxHp: 40 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-003', name: 'Talon Rake', btnType: 'physical', enCost: 2 }, { healthDamage: 3 });
  if ((G.player.stats.armour || 0) === 0 && (G.player.stats.magicArmour || 0) === 0) ok('vulture ignores healthy targets');
  else fail('vulture restored vs healthy foe');
  G.enemy.stats.hp = 10;
  G.passiveState = Object.create(null);
  G.playerStatus = {};
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-003', name: 'Talon Rake', btnType: 'physical', enCost: 2 }, { healthDamage: 3 });
  const restored = (G.player.stats.armour || 0) + (G.player.stats.magicArmour || 0);
  if (restored === 1) ok('vulture restores 1 prot when foe low HP + Health damage');
  else fail('vulture restore=' + restored);
}

{
  const galah = bp.galah?.parsed;
  if (galah?.trigger?.skillClass === 'song') ok('galah song-gated afterSkillUse');
  else fail('galah trigger: ' + JSON.stringify(galah?.trigger));
  G.player = {
    birdKey: 'galah', aspect: 'solis',
    stats: { hp: 30, maxHp: 40, atk: 6, def: 6, matk: 8, mdef: 8, spd: 8, acc: 0, armour: 0, maxArmour: 4, magicArmour: 0, maxMagicArmour: 6 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 40, maxHp: 40 } };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-011', name: 'Wand Dart', btnType: 'spell', enCost: 2 }, {});
  if ((G.player.stats.magicArmour || 0) === 0) ok('galah ignores non-song skills');
  else fail('galah restored on non-song');
  Avian.passives.onPlayerAbilityUse({ id: 'SONG_1', name: 'Court Song', btnType: 'song' }, {});
  if ((G.player.stats.magicArmour || 0) === 2) ok('galah restores MARM on song');
  else fail('galah marm=' + G.player.stats.magicArmour);
}

{
  const mara = bp.marabou?.parsed;
  if (mara?.trigger?.foeHpBelow === 50 && (mara.specials || []).some((s) => s.requiresHealthDamage)) ok('marabou foe-HP + Health-damage restore');
  else fail('marabou: ' + JSON.stringify(mara?.trigger) + ' ' + JSON.stringify(mara?.specials));
}

{
  const bare = Object.entries(bp).filter(([, v]) => {
    const t = v?.parsed?.trigger;
    if (!t || t.kind !== 'skillModifier') return false;
    const effect = v.effect || '';
    const rich = /Day |Night |Burning|debuffed|below 50%|weapon skill|damaging|song|Storm |Strength |Finesse |physical weapon/i.test(effect);
    const gated = !!(t.aspect || t.category || t.weaponSkill || t.weaponScale || t.foeState || t.foeHpBelow != null || t.skillClass || t.damaging || t.skill);
    return rich && !gated;
  }).map(([k]) => k);
  if (bare.length === 0) ok('no remaining bare rich skillModifier passives');
  else fail('bare skillModifiers remain: ' + bare.join(', '));
}

/* tickStatuses must tolerate null status-bag entries (typeof null === 'object'). */
{
  G.player = { birdKey: 'sparrow', stats: { hp: 20, maxHp: 20, def: 5 } };
  G.enemy = { birdKey: 'crow', stats: { hp: 20, maxHp: 20, def: 5 } };
  G.playerStatus = {
    _passiveNextMartialPenSpecials: null,
    _v2PassiveArmedAbility: null,
    orphanNull: null,
    defBoost: { turns: 1, amt: 2 },
    burning: { turns: 2, stacks: 1 },
  };
  G.enemyStatus = {};
  let threw = null;
  try {
    sandbox.tickStatuses('player');
  } catch (err) {
    threw = err;
  }
  if (threw) fail('tickStatuses threw on null status keys: ' + threw.message);
  else ok('tickStatuses survived null status keys');
  if (Object.prototype.hasOwnProperty.call(G.playerStatus, 'orphanNull')) fail('null orphan status key should be removed');
  else ok('tickStatuses removes null non-internal status keys');
  if (G.playerStatus.defBoost) fail('defBoost should have expired');
  else ok('tickStatuses still expires defBoost');
}

/* getAbDesc must not throw for missing/0 levels (OW→battle renderActions crash). */
{
  let threw = null;
  try {
    const T = sandbox.ABILITY_TEMPLATES || {};
    const sampleId = Object.keys(T).find((id) => Array.isArray(T[id]?.levels) && T[id].levels.length) || 'BASIC_PHYSICAL';
    sandbox.getAbDesc({ id: sampleId, level: undefined, desc: 'fallback' });
    sandbox.getAbDesc({ id: sampleId, level: 0, desc: 'fallback' });
    sandbox.getAbDesc({ id: sampleId, level: 99, desc: 'fallback' });
    sandbox.getAbDesc({ id: '__missing__', desc: 'only-desc' });
    sandbox.getAbDesc(null);
    sandbox.getAbDesc({
      id: 'EQ_TEST',
      _dispatcherRow: { id: 'EQ_TEST', name: 'Eq', category: 'physical', riderText: 'poke' },
    });
  } catch (err) {
    threw = err;
  }
  if (threw) fail('getAbDesc threw: ' + threw.message);
  else ok('getAbDesc tolerates missing/0/overflow level');
}

/* Trigger wiring: afterCrit / afterEnemyAttack / afterDamageDealt / passiveAlways. */
{
  G.player = {
    birdKey: 'baldEagle',
    stats: { hp: 40, maxHp: 40, armour: 0, maxArmour: 8, normalMaxArmour: 8, magicArmour: 0, maxMagicArmour: 8, normalMaxMagicArmour: 8, acc: 80 },
  };
  G.playerStatus = {};
  G.passiveState = Object.create(null);
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-001', name: 'Strike', btnType: 'physical' }, { crit: true, anyCrit: true, hitsLanded: 1, damage: 10 });
  const armAfter = G.player.stats.armour;
  if (armAfter > 0) ok('bald eagle afterCrit restores lower protection');
  else fail('bald eagle afterCrit did not restore protection, armour=' + armAfter);
}

{
  G.player = {
    birdKey: 'wagtail',
    stats: { hp: 40, maxHp: 40, armour: 0, maxArmour: 8, normalMaxArmour: 8, spd: 10, atk: 8, def: 6, matk: 4, mdef: 6 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 40, maxHp: 40, spd: 8 } };
  G.playerStatus = {};
  G.passiveState = Object.create(null);
  const spdBefore = G.player.stats.spd;
  Avian.passives.onPlayerDamaged(6, false, { afterEnemyAttack: true });
  if (G.player.stats.spd > spdBefore) ok('wagtail afterEnemyAttack grants Agility');
  else fail('wagtail afterEnemyAttack did not grant Agility');
  if ((G.player.stats.armour || 0) === 0) ok('wagtail hit does not restore Armour');
  else fail('wagtail restored Armour on a connecting hit');
  G.passiveState = Object.create(null);
  G.playerStatus = {};
  Avian.passives.onPlayerDodged({});
  if (G.player.stats.armour > 0) ok('wagtail dodge restores Armour');
  else fail('wagtail dodge did not restore Armour, armour=' + G.player.stats.armour);
}

{
  G.player = {
    birdKey: 'seagull',
    stats: { hp: 40, maxHp: 40, armour: 0, maxArmour: 8, normalMaxArmour: 8, magicArmour: 4, maxMagicArmour: 8, normalMaxMagicArmour: 8, spd: 8 },
  };
  G.enemy = { birdKey: 'crow', stats: { hp: 20, maxHp: 40 } };
  G.playerStatus = {};
  G.enemyStatus = { poison: { stacks: 1, turns: 2 } };
  G.passiveState = Object.create(null);
  const spdBefore = G.player.stats.spd;
  Avian.passives.onPlayerAbilityUse({ id: 'WSK-001', name: 'Strike', btnType: 'physical' }, { hitsLanded: 1, damage: 8, firstHitLanded: true });
  if (G.player.stats.spd > spdBefore) ok('seagull afterDamageDealt vs debuffed target grants Agility');
  else fail('seagull afterDamageDealt did not fire');
}

{
  G.player = {
    birdKey: 'bushturkey',
    stats: { hp: 50, maxHp: 50, armour: 4, maxArmour: 10, normalMaxArmour: 10, spd: 6, atk: 10, def: 10, matk: 2, mdef: 6 },
  };
  G.playerStatus = {};
  G.passiveState = Object.create(null);
  const armBefore = G.player.stats.armour;
  Avian.passives.onPlayerAbilityUse({
    id: 'innate_bushturkey',
    name: 'Mound Guard',
    btnType: 'utility',
    riderText: 'Gain 5 Fortified Armour for 2 turns.',
    actionSource: 'utility',
  }, { armourTechnique: true });
  if (G.player.stats.armour > armBefore) ok('bush turkey Fortify grants +1 additional Armour');
  else fail('bush turkey additional Armour missing, armour ' + armBefore + '→' + G.player.stats.armour);
}

{
  const rogue = Avian.classPerks.getClassPerkForBird('sparrow');
  if (rogue && rogue.def && rogue.def.id === 'rogueTempo') ok('sparrow resolves Rogue Tempo');
  else fail('sparrow class perk missing Rogue Tempo');
  G.player = { birdKey: 'sparrow', class: 'rogue', stats: { spd: 20, acc: 86 } };
  G.enemy = { birdKey: 'crow', stats: { spd: 8 } };
  G.playerStatus = { _classPerkState: {} };
  Avian.classPerks.applyClassPerkMetadata(G.player);
  const peek = Avian.classPerks.peekRogueTempoPrecision(G.player, {
    id: 'WSK-001', actionSource: 'weaponA', energy: 2, energyCost: 2, btnType: 'physical',
  });
  if (peek === 10) ok('Rogue Tempo peeks +10 Precision when acting first');
  else fail('Rogue Tempo peek expected 10, got ' + peek);
}

if (failed) {
  console.error(`[passives-perks] ${failed} failure(s)`);
  process.exit(1);
}
console.log('[passives-perks] all checks passed');
