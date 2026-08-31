#!/usr/bin/env node
/**
 * Enemy AI v2 — profile resolution, override persistence, behaviour independence, stat separation.
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('[enemy-ai-v2] missing js/avian-game.bundle.js — run npm run bundle');
  process.exit(1);
}

let failed = 0;

function fail(msg) {
  console.error('[enemy-ai-v2] FAIL', msg);
  failed++;
}

function ok(msg) {
  console.log('[enemy-ai-v2] ok  ', msg);
}

function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus: noop, blur: noop, click: noop, contains: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: { setProperty: noop, getPropertyValue: () => '', removeProperty: noop },
    dataset: {}, children: [], childNodes: [], parentNode: null, innerHTML: '', textContent: '', value: '',
  };
  function makeEl(tagName = 'div') {
    return Object.assign({}, elementProto, { tagName: String(tagName).toUpperCase(), nodeName: String(tagName).toUpperCase() });
  }
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

const localStorageStub = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: () => null, get length() { return Object.keys(store).length; },
  };
})();

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Promise, JSON, Math, Date, Map, Set, Object, Array, Number, String, Boolean, Error,
  URLSearchParams,
  document: makeDomStub(),
  location: { hash: '', pathname: '/', href: 'http://localhost/?equipmentV2=1', search: '?equipmentV2=1' },
  navigator: { userAgent: 'node-verify', platform: 'node' },
  localStorage: localStorageStub, sessionStorage: localStorageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  fetch: () => Promise.reject(new Error('fetch unavailable')),
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'avian-game.bundle.js', timeout: 30000 });

const {
  resolveEnemyAIProfile,
  resolveEnemyAIConfig,
  normalizeDifficultyAIProfile,
  defaultEnemyAI,
  ensureEnemyAI,
  normalizeSavedEnemyAI,
  resolveEnemyAIBehaviour,
  compareAIProfiles,
} = sandbox;

if (typeof resolveEnemyAIProfile !== 'function') fail('missing resolveEnemyAIProfile');
else ok('resolveEnemyAIProfile exported');

if (typeof resolveEnemyAIConfig !== 'function') fail('missing resolveEnemyAIConfig');
else ok('resolveEnemyAIConfig exported');

function enemyWithProfile(profile, extra = {}) {
  return {
    id: 'test-enemy',
    name: 'Test Enemy',
    class: 'mage',
    enemyClass: 'mage',
    stats: { hp: 80, maxHp: 80, atk: 10, def: 8, matk: 12, mdef: 8, spd: 10, acc: 80, dodge: 5 },
    ai: { profile, behaviour: extra.behaviour || 'automatic', overrides: extra.overrides },
    ...extra,
  };
}

function assertProfile(savedProfile, difficulty, expected, label) {
  const enemy = enemyWithProfile(savedProfile);
  const got = resolveEnemyAIProfile(enemy, difficulty);
  if (got !== expected) fail(`${label}: expected ${expected}, got ${got}`);
  else ok(`${label}: ${savedProfile || 'default'} + ${difficulty} → ${got}`);
}

assertProfile('default', 'easy', 'easy', 'Default → Easy');
assertProfile('default', 'normal', 'normal', 'Default → Normal');
assertProfile('default', 'elite', 'elite', 'Default → Elite');
assertProfile('default', 'boss', 'boss', 'Default → Boss');
assertProfile('easy', 'boss', 'easy', 'Explicit Easy override');
assertProfile('normal', 'boss', 'normal', 'Explicit Normal override');
assertProfile('elite', 'easy', 'elite', 'Explicit Elite override');
assertProfile('boss', 'easy', 'boss', 'Explicit Boss override');
assertProfile('custom', 'boss', 'custom', 'Custom override');

{
  const enemy = enemyWithProfile('custom', {
    overrides: { randomness: 0.03, koAwareness: 1.15, lookahead: true },
  });
  const cfg = resolveEnemyAIConfig(enemy, { difficulty: 'boss', isBoss: true });
  if (cfg.profile !== 'custom') fail('custom config profile');
  else if (cfg.randomness !== 0.03) fail('custom randomness not preserved');
  else if (cfg.koAwareness !== 1.15) fail('custom koAwareness not preserved');
  else ok('Custom values preserved under boss encounter difficulty');
}

{
  const enemy = enemyWithProfile('default');
  resolveEnemyAIProfile(enemy, 'normal');
  if (enemy.ai.profile !== 'default') fail('Default profile mutated on resolve');
  else ok('Stored profile remains default after Normal resolve');
  const elite = resolveEnemyAIProfile(enemy, 'elite');
  if (elite !== 'elite') fail('Dynamic difficulty change failed');
  else if (enemy.ai.profile !== 'default') fail('Default profile mutated after elite resolve');
  else ok('Dynamic difficulty Normal → Elite without mutating saved profile');
}

{
  const enemy = enemyWithProfile('elite');
  for (const diff of ['normal', 'easy', 'boss']) {
    const got = resolveEnemyAIProfile(enemy, diff);
    if (got !== 'elite') fail(`Override persistence failed at difficulty ${diff}: ${got}`);
  }
  ok('Explicit Elite override persists across difficulty changes');
}

{
  const enemy = enemyWithProfile('boss');
  resolveEnemyAIProfile(enemy, 'easy');
  enemy.ai.profile = 'default';
  const got = resolveEnemyAIProfile(enemy, 'easy');
  const cfg = resolveEnemyAIConfig(enemy, { difficulty: 'easy' });
  const easyCfg = resolveEnemyAIConfig(enemyWithProfile('default'), { difficulty: 'easy' });
  if (got !== 'easy') fail(`Return to Default expected easy, got ${got}`);
  else if (cfg.randomness !== easyCfg.randomness) fail('Boss randomness still active after return to Default');
  else ok('Return Boss → Default restores easy inheritance');
}

{
  const base = enemyWithProfile('default', { behaviour: 'siren' });
  const statKeys = ['hp', 'maxHp', 'atk', 'def', 'matk', 'mdef', 'spd', 'acc', 'dodge'];
  const recordStats = (e) => Object.fromEntries(statKeys.map((k) => [k, e.stats[k]]));
  const baseline = recordStats(JSON.parse(JSON.stringify(base)));
  const cases = [
    ['default', 'easy'],
    ['default', 'normal'],
    ['default', 'elite'],
    ['default', 'boss'],
    ['easy', 'boss'],
    ['boss', 'easy'],
  ];
  let statOk = true;
  for (const [prof, diff] of cases) {
    const e = JSON.parse(JSON.stringify(base));
    e.ai.profile = prof;
    resolveEnemyAIConfig(e, { difficulty: diff, isBoss: diff === 'boss' });
    const after = recordStats(e);
    for (const k of statKeys) {
      if (after[k] !== baseline[k]) {
        fail(`Stat separation: ${prof}/${diff} changed ${k}: ${baseline[k]} → ${after[k]}`);
        statOk = false;
      }
    }
  }
  if (statOk) ok('AI profile changes do not alter combat stats');
}

{
  const easySiren = enemyWithProfile('easy', { behaviour: 'siren' });
  const bossSiren = enemyWithProfile('boss', { behaviour: 'siren' });
  const bossBrute = enemyWithProfile('boss', { behaviour: 'brute' });
  const cfgEasy = resolveEnemyAIConfig(easySiren, { difficulty: 'normal' });
  const cfgBossSiren = resolveEnemyAIConfig(bossSiren, { difficulty: 'normal' });
  const cfgBossBrute = resolveEnemyAIConfig(bossBrute, { difficulty: 'normal' });
  if (cfgEasy.behaviour !== 'siren' || cfgBossSiren.behaviour !== 'siren') fail('Siren behaviour not preserved');
  else if (cfgEasy.randomness <= cfgBossSiren.randomness) fail('Boss should have lower randomness than Easy');
  else if (cfgBossBrute.behaviour !== 'brute') fail('Brute behaviour not applied');
  else if (cfgBossBrute.randomness !== cfgBossSiren.randomness) fail('Intelligence should stay Boss when behaviour changes');
  else ok('Behaviour independence: intelligence vs strategic style');
}

{
  const fresh = defaultEnemyAI();
  if (fresh.profile !== 'default' || fresh.behaviour !== 'automatic') {
    fail(`New enemy AI default unexpected: ${JSON.stringify(fresh)}`);
  } else ok('New Build Nest enemy defaults to default/automatic');
}

{
  const legacy = { id: 'legacy', name: 'Legacy', stats: { hp: 50, maxHp: 50, atk: 8, def: 5, spd: 8 } };
  ensureEnemyAI(legacy);
  if (legacy.ai.profile !== 'default' || legacy.ai.behaviour !== 'automatic') {
    fail(`Legacy migration unexpected: ${JSON.stringify(legacy.ai)}`);
  } else ok('Migrated enemy without AI config → default/automatic');
  const resolved = resolveEnemyAIProfile(legacy, 'elite');
  if (resolved !== 'elite') fail('Migrated default should inherit elite difficulty');
  else ok('Migrated default inherits encounter difficulty');
}

{
  const saved = normalizeSavedEnemyAI({ profile: 'default', behaviour: 'automatic' });
  if (saved.profile !== 'default') fail('normalizeSavedEnemyAI must not convert Default to Normal');
  else ok('Default saved profile stays default');
}

{
  if (normalizeDifficultyAIProfile('fletchling') !== 'easy') fail('fletchling alias');
  else if (normalizeDifficultyAIProfile('juvenile') !== 'normal') fail('juvenile alias');
  else if (normalizeDifficultyAIProfile('predator') !== 'elite') fail('predator alias');
  else if (normalizeDifficultyAIProfile('murder') !== 'boss') fail('murder alias');
  else ok('Difficulty aliases map to AI profiles');
}

{
  const enemy = enemyWithProfile('default', { behaviour: 'automatic', class: 'siren', enemyClass: 'siren' });
  const behaviour = resolveEnemyAIBehaviour(enemy);
  if (behaviour !== 'siren') fail(`Automatic siren class expected siren behaviour, got ${behaviour}`);
  else ok('Automatic behaviour derives from class');
}

{
  const enemy = enemyWithProfile('default');
  const cfg = resolveEnemyAIConfig(enemy, { difficulty: 'normal' });
  if (cfg.source !== 'encounterDifficulty') fail('Default source should be encounterDifficulty');
  else ok('Default profile source = encounterDifficulty');
  enemy.ai.profile = 'normal';
  const cfg2 = resolveEnemyAIConfig(enemy, { difficulty: 'boss', isBoss: true });
  if (cfg2.source !== 'buildNestOverride') fail('Override source should be buildNestOverride');
  else ok('Explicit override source = buildNestOverride');
}

if (typeof compareAIProfiles === 'function') {
  sandbox.G = { stage: 10, difficulty: 'juvenile', turn: 'enemy', enemyTurnCount: 1, playerStatus: {}, enemyStatus: {}, abilityCooldowns: {} };
  const enemy = enemyWithProfile('elite');
  enemy.energy = 6;
  enemy.abilities = [{ id: 'BASIC_MAGIC', name: 'Basic', empty: false }];
  const player = { stats: { hp: 40, maxHp: 100, def: 8, mdef: 8, dodge: 5, acc: 80 } };
  const rows = compareAIProfiles(enemy, player, { difficulty: 'normal' });
  if (!Array.isArray(rows) || rows.length !== 4) fail('COMPARE AI should evaluate 4 profiles');
  else if (enemy.ai.profile !== 'elite') fail('COMPARE AI must not modify saved profile');
  else ok('COMPARE AI evaluates Easy/Normal/Elite/Boss without mutating enemy');
} else {
  fail('missing compareAIProfiles');
}

if (failed) {
  console.error(`\n[enemy-ai-v2] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[enemy-ai-v2] all checks passed');
