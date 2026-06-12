/* Runtime verification: boot the bundle in a Node vm sandbox and assert that
 * player ability resolution works end-to-end after the legacy combat excision.
 *
 *   - Sparrow's slot 0 starter resolves to SPARROW_F1_L1_BASE
 *   - ABILITY_TEMPLATES[SPARROW_F1_L1_BASE] is a populated row from the
 *     combat data pack
 *   - ACTIONS[SPARROW_F1_L1_BASE] is a function (dispatcher proxy)
 *   - Avian.dispatcher.execute resolves the ability without throwing
 *   - FAMILY_EVOLUTION_BIRD_DATA.sparrow exists with proper slotLayout
 *   - getBaseSkillSlotsForBird('sparrow') returns 4 slots, slot 0 marked isStarterMain
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const bundlePath = path.resolve('js/avian-game.bundle.js');
const bundle = readFileSync(bundlePath, 'utf8');

// Build a minimal DOM stub so the bundle's UI code doesn't throw during boot.
function makeDomStub() {
  const noop = () => {};
  const styleStub = {
    setProperty: noop,
    getPropertyValue: () => '',
    removeProperty: noop,
  };
  const elementProto = {
    appendChild: noop,
    removeChild: noop,
    insertBefore: noop,
    setAttribute: noop,
    getAttribute: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus: noop,
    blur: noop,
    click: noop,
    contains: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: styleStub,
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
  };
  function makeEl(tagName = 'div') {
    return Object.assign({}, elementProto, {
      tagName: String(tagName).toUpperCase(),
      nodeName: String(tagName).toUpperCase(),
      onclick: null, oninput: null, onchange: null, onkeydown: null, onkeyup: null, onmouseenter: null, onmouseleave: null,
    });
  }
  const elementCache = Object.create(null);
  function getEl(id) {
    if (!elementCache[id]) elementCache[id] = makeEl('div');
    return elementCache[id];
  }
  const body = makeEl('body');
  const documentStub = {
    body,
    head: makeEl('head'),
    documentElement: makeEl('html'),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    getElementById: (id) => getEl(String(id || '')),
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    readyState: 'complete',
  };
  return documentStub;
}

const documentStub = makeDomStub();
const localStorageStub = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: () => null,
    get length() { return Object.keys(store).length; },
  };
})();

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Promise, JSON, Math, Date, Map, Set, WeakMap, WeakSet, Object, Array, Number, String, Boolean, Symbol, RegExp, Error, TypeError, RangeError,
  document: documentStub,
  window: null,
  location: { hash: '', pathname: '/', href: 'http://localhost/' },
  navigator: { userAgent: 'node-verify', platform: 'node', language: 'en' },
  localStorage: localStorageStub,
  sessionStorage: localStorageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  HTMLElement: function HTMLElement() {},
  Image: function Image() {},
  Audio: function Audio() {
    return { play: () => Promise.resolve(), pause: () => {}, load: () => {}, addEventListener: () => {} };
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  Event: function Event(type) { this.type = type; },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  fetch: () => Promise.reject(new Error('fetch unavailable in verify sandbox')),
  caches: undefined,
  indexedDB: undefined,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

let bootError = null;
try {
  vm.runInContext(bundle, sandbox, { filename: 'avian-game.bundle.js', timeout: 15000 });
} catch (e) {
  bootError = e;
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

check('bundle boots without thrown error at top level', !bootError, bootError ? String(bootError && bootError.stack || bootError) : null);

const Avian = sandbox.Avian;
const ABILITY_TEMPLATES = sandbox.ABILITY_TEMPLATES;
const ACTIONS = sandbox.ACTIONS;
const FAMILY_EVOLUTION_BIRD_DATA = sandbox.FAMILY_EVOLUTION_BIRD_DATA;
const BIRDS = sandbox.BIRDS;

check('Avian namespace present', !!Avian);
check('Avian.data.combatPack.skillTrees present', !!(Avian?.data?.combatPack?.skillTrees));
check('Avian.dispatcher.execute is a function', typeof Avian?.dispatcher?.execute === 'function');
check('ABILITY_TEMPLATES is populated', !!(ABILITY_TEMPLATES && Object.keys(ABILITY_TEMPLATES).length > 0), `count=${ABILITY_TEMPLATES ? Object.keys(ABILITY_TEMPLATES).length : 0}`);
check('ACTIONS map is populated', !!(ACTIONS && Object.keys(ACTIONS).length > 0), `count=${ACTIONS ? Object.keys(ACTIONS).length : 0}`);

check('Avian.passives.onPlayerAbilityUse is a function', typeof Avian?.passives?.onPlayerAbilityUse === 'function');
check('Avian.mutations.getItem is a function', typeof Avian?.mutations?.getItem === 'function');
check('Mutations catalog populated', !!(Avian?.data?.mutations?.byId && Object.keys(Avian.data.mutations.byId).length > 1000), `count=${Avian?.data?.mutations?.byId ? Object.keys(Avian.data.mutations.byId).length : 0}`);

if (typeof sandbox.syncPlayerAbilitiesFromSkillSlots === 'function' && BIRDS?.sparrow) {
  const testPlayer = {
    birdKey: 'sparrow',
    abilities: [],
    familyEvolutionState: { skillSlots: sandbox.getBaseSkillSlotsForBird('sparrow') },
  };
  sandbox.syncPlayerAbilitiesFromSkillSlots(testPlayer);
  check('syncPlayerAbilitiesFromSkillSlots skips empty slots', testPlayer.abilities.length === 2, `got=${testPlayer.abilities.length}`);
}

if (typeof sandbox.preparePlayerCombatLoadout === 'function' && BIRDS?.sparrow) {
  const loadoutPlayer = {
    birdKey: 'sparrow',
    size: 'small',
    abilities: [],
    familyEvolutionState: { skillSlots: sandbox.getBaseSkillSlotsForBird('sparrow') },
  };
  sandbox.preparePlayerCombatLoadout(loadoutPlayer);
  check('preparePlayerCombatLoadout yields >=2 abilities for sparrow', loadoutPlayer.abilities.length >= 2, `got=${loadoutPlayer.abilities.length}`);
}

if (typeof sandbox.computePlayerEffectiveMaxEnergy === 'function') {
  const enPlayer = { birdKey: 'sparrow', size: 'small', energyBonus: 0 };
  check('computePlayerEffectiveMaxEnergy === 6', sandbox.computePlayerEffectiveMaxEnergy(enPlayer) === 6);
  check('computePlayerStartEnergy === 4', sandbox.computePlayerStartEnergy(enPlayer) === 4);
  check('computePlayerEnergyRegen === 3', sandbox.computePlayerEnergyRegen(enPlayer) === 3);
}

if (typeof sandbox.computePlayerEnergyRegenThisTurn === 'function') {
  const chilledPlayer = { birdKey: 'sparrow', size: 'small' };
  const base = sandbox.computePlayerEnergyRegen(chilledPlayer);
  const chilledRegen = sandbox.computePlayerEnergyRegenThisTurn(chilledPlayer, { chilled: { stacks: 2, turns: 2 } });
  check('chilled stacks reduce EN regen by 1 per stack', chilledRegen === Math.max(0, base - 2), `base=${base} got=${chilledRegen}`);
  const frozenRegen = sandbox.computePlayerEnergyRegenThisTurn(chilledPlayer, { frozen: { turns: 1 } });
  check('frozen blocks EN regen', frozenRegen === 0);
  const paraRegen = sandbox.computePlayerEnergyRegenThisTurn(chilledPlayer, { paralyzed: 2 });
  check('paralyzed blocks EN regen', paraRegen === 0);
}

check('globalThis.G is exported for cross-module combat', !!sandbox.G);

if (sandbox.G && typeof sandbox.preparePlayerCombatLoadout === 'function' && typeof sandbox.playerAction === 'function' && sandbox.Avian?.dispatcher?.execute) {
  const G = sandbox.G;
  G.player = {
    birdKey: 'sparrow',
    size: 'small',
    name: 'Sparrow',
    stats: { hp: 50, maxHp: 50, atk: 12, matk: 8, def: 5, mdef: 6, spd: 10, dodge: 5, acc: 80, critChance: 5 },
    abilities: [],
    energy: 4,
    energyMax: 6,
    energyRegen: 3,
    familyEvolutionState: { skillSlots: sandbox.getBaseSkillSlotsForBird('sparrow') },
  };
  G.enemy = { name: 'Test Crow', stats: { hp: 80, maxHp: 80, atk: 8, def: 4, mdef: 6, spd: 5, dodge: 0, acc: 70 }, energy: 3, energyMax: 3 };
  G.playerStatus = {};
  G.enemyStatus = {};
  G.turn = 'player';
  G.phase = 'PLAYER';
  G.turnPhase = sandbox.TURN?.PLAYER || 'PLAYER';
  G.battleOver = false;
  G.actionBusy = false;
  G.animLock = false;
  G.actionQueue = [];
  G.playerActionsThisTurn = 0;
  G.playerTurnFlags = { energyGainedThisTurn: 0, onHitTriggered: false };
  sandbox.preparePlayerCombatLoadout(G.player);
  const ab = G.player.abilities[0];
  const enBefore = G.player.energy;
  const hpBefore = G.enemy.stats.hp;
  check('combat sandbox has starter ability', !!ab?.id, `got=${ab?.id}`);
  if (ab?.id) {
    const _prevRefresh = sandbox.refreshBattleUI;
    const _prevPlan = sandbox.renderEnemyPlan;
    sandbox.refreshBattleUI = function(){};
    sandbox.renderEnemyPlan = function(){};
    try {
      await sandbox.playerAction(ab, true);
      check('playerAction spends EN', G.player.energy < enBefore, `before=${enBefore} after=${G.player.energy}`);
      const dmgDealt=hpBefore-(G.enemy.stats.hp||0);
      check('playerAction deals damage to enemy', dmgDealt>0, `before=${hpBefore} after=${G.enemy.stats.hp}`);
      check('starter damage is modest (not EN-power inflated)', dmgDealt>0 && dmgDealt<30, `dealt=${dmgDealt}`);
    } catch (e) {
      check('playerAction completes without throw', false, String(e && e.stack || e));
    } finally {
      if (_prevRefresh) sandbox.refreshBattleUI = _prevRefresh;
      if (_prevPlan) sandbox.renderEnemyPlan = _prevPlan;
    }
  }
}

if (typeof sandbox.hasMultiEnemyChainPending === 'function' && sandbox.G) {
  const G = sandbox.G;
  G.endlessMode = false;
  G._owStageEnemies = ['crow', 'magpie', 'robin'];
  G._owEnemyIndex = 0;
  G._owEnemyCount = 3;
  check('hasMultiEnemyChainPending true mid-chain', sandbox.hasMultiEnemyChainPending() === true);
  G._owEnemyIndex = 2;
  check('hasMultiEnemyChainPending false on final bird', sandbox.hasMultiEnemyChainPending() === false);
  G._owEnemyIndex = 0;
  check('getStageEncounterChainLength reads chain', sandbox.getStageEncounterChainLength() === 3);

  let rewardShown = false;
  let chainContinued = false;
  const prevShow = sandbox.showRewardScreen;
  const prevContinue = sandbox.continueToNextEncounterBird;
  const prevRestore = sandbox.restoreBattleTempPlayerStats;
  const prevSave = sandbox.saveRun;
  sandbox.showRewardScreen = () => { rewardShown = true; };
  sandbox.continueToNextEncounterBird = () => { chainContinued = true; };
  sandbox.restoreBattleTempPlayerStats = () => {};
  sandbox.saveRun = () => {};
  sandbox.spawnFloat = () => {};
  sandbox.logMsg = () => {};
  sandbox.SFX = { exp: () => {}, levelUp: () => {} };
  G._owEnemyIndex = 0;
  G.player = {
    birdKey: 'sparrow',
    name: 'Sparrow',
    birdLevel: 1,
    exp: 0,
    stats: { hp: 40, maxHp: 50, atk: 10, matk: 8, def: 5, mdef: 6, spd: 10 },
    shinyObjects: 0,
  };
  G.enemy = { name: 'Test Crow', isBoss: false, stats: { hp: 0, maxHp: 80, atk: 8, def: 4, mdef: 6, spd: 5 } };
  G.ui = { gameMode: 'story' };
  G.battleOver = true;
  G.turn = 'post';
  try {
    sandbox.postCombat();
    check('postCombat mid-chain skips reward screen', !rewardShown);
    check('postCombat mid-chain calls continueToNextEncounterBird', chainContinued);
  } catch (e) {
    check('postCombat mid-chain completes without throw', false, String(e && e.stack || e));
  }
  G._owStageEnemies = ['crow'];
  G._owEnemyIndex = 0;
  G._owEnemyCount = 1;
  rewardShown = false;
  chainContinued = false;
  const prevTimeout = sandbox.setTimeout;
  sandbox.setTimeout = (fn) => { fn(); return 0; };
  try {
    sandbox.postCombat();
    check('postCombat single-enemy schedules reward screen', rewardShown);
    check('postCombat single-enemy does not continue chain', !chainContinued);
  } catch (e) {
    check('postCombat single-enemy completes without throw', false, String(e && e.stack || e));
  }
  sandbox.setTimeout = prevTimeout;
  if (prevShow) sandbox.showRewardScreen = prevShow;
  if (prevContinue) sandbox.continueToNextEncounterBird = prevContinue;
  if (prevRestore) sandbox.restoreBattleTempPlayerStats = prevRestore;
  if (prevSave) sandbox.saveRun = prevSave;
}

const starterId = 'SPARROW_F1_L1_BASE';
check(`ABILITY_TEMPLATES[${starterId}] exists`, !!ABILITY_TEMPLATES?.[starterId]);
check(`ACTIONS[${starterId}] is a function`, typeof ACTIONS?.[starterId] === 'function');

check('FAMILY_EVOLUTION_BIRD_DATA.sparrow built from combat pack', !!FAMILY_EVOLUTION_BIRD_DATA?.sparrow);
if (FAMILY_EVOLUTION_BIRD_DATA?.sparrow) {
  const sl = FAMILY_EVOLUTION_BIRD_DATA.sparrow.slotLayout || [];
  check('sparrow slotLayout length=4', sl.length === 4);
  check('sparrow slot[0].abilityId is the starter id', sl[0]?.abilityId === starterId, `got=${sl[0]?.abilityId}`);
  check('sparrow slot[0].isStarterMain=true', sl[0]?.isStarterMain === true);
  check('sparrow has families entry', !!FAMILY_EVOLUTION_BIRD_DATA.sparrow.families?.SPARROW_F1);
  const paths = FAMILY_EVOLUTION_BIRD_DATA.sparrow.families?.SPARROW_F1?.paths || {};
  check('sparrow F1 has Power path tier 1', paths.power?.abilities?.[1] === 'SPARROW_F1_L3_POWER');
  check('sparrow F1 has Ailment path tier 1', paths.ailment?.abilities?.[1] === 'SPARROW_F1_L3_AILMENT');
  check('sparrow F1 has Utility path tier 1', paths.utility?.abilities?.[1] === 'SPARROW_F1_L3_UTILITY');
}

check('BIRDS.sparrow.startAbilities[0] = starter id', BIRDS?.sparrow?.startAbilities?.[0] === starterId, `got=${BIRDS?.sparrow?.startAbilities?.[0]}`);
check('BIRDS.sparrow.mainAttackId = starter id', BIRDS?.sparrow?.mainAttackId === starterId, `got=${BIRDS?.sparrow?.mainAttackId}`);
check('BIRDS.sparrow.passive is set', !!BIRDS?.sparrow?.passive?.id);

// Sanity: no remaining legacy ability ids in BIRDS
const legacyIds = ['rapidPeck', 'beak_jab', 'multiPeck', 'dart', 'windFeint', 'trackPrey'];
const legacyMain = legacyIds.includes(String(BIRDS?.sparrow?.mainAttackId || ''));
check('sparrow mainAttackId is NOT a legacy id', !legacyMain);

const snowyTrees = Avian?.data?.combatPack?.skillTrees;
const snowyF1 = snowyTrees?.['SNOWY_OWL_F1_L1_BASE'];
const snowyF2 = snowyTrees?.['SNOWY_OWL_F2_L1_BASE'];
check('Snowy Owl F1 starter row exists', !!snowyF1);
check('Snowy Owl F2 starter row exists', !!snowyF2);
if (snowyF1 && snowyF2) {
  check('Snowy Owl starters registered in ABILITY_TEMPLATES', !!ABILITY_TEMPLATES?.[snowyF1.id] && !!ABILITY_TEMPLATES?.[snowyF2.id]);
  check('Snowy Owl starters have shortDesc in combat pack', !!snowyF1.shortDesc && !!snowyF2.shortDesc);
  check('ABILITY_TEMPLATES use shortDesc for Snowy Owl UI', !!(ABILITY_TEMPLATES?.[snowyF1.id]?.desc) && ABILITY_TEMPLATES[snowyF1.id].desc === snowyF1.shortDesc);
  const rowSig = (r) => `${r.apCost}|${r.baseFlat}|${r.scalePct}|${r.hits}|${r.ailment}|${r.ailmentChance}|${r.shortDesc}`;
  check('Snowy Owl starters have distinct combat-pack rows', rowSig(snowyF1) !== rowSig(snowyF2), `f1=${rowSig(snowyF1)} f2=${rowSig(snowyF2)}`);
}

// Rider import: enemy debuff text must not produce self gainMatk/gainAtk riders
const allSkillTrees = Avian?.data?.combatPack?.skillTrees || {};
let riderMisparseCount = 0;
for (const id in allSkillTrees) {
  const row = allSkillTrees[id];
  const rt = String(row.riderText || '');
  const riders = row.riders || [];
  if (/loses\s+\d+(?:\.\d+)?\s*%\s*Magic\s*Attack/i.test(rt) && !/gain\s+.*Magic\s*Attack/i.test(rt) && riders.some((r) => r.kind === 'gainMatk')) {
    riderMisparseCount++;
  }
  if (/loses\s+\d+(?:\.\d+)?\s*%\s*Attack/i.test(rt) && !/Magic\s*Attack/i.test(rt.match(/loses\s+\d+(?:\.\d+)?\s*%\s*Attack/i)?.[0] || '') && !/gain\s+.*Attack/i.test(rt) && riders.some((r) => r.kind === 'gainAtk')) {
    riderMisparseCount++;
  }
}
check('no spurious gainMatk/gainAtk from enemy loses rider text', riderMisparseCount === 0, `count=${riderMisparseCount}`);

const prismSquawk = allSkillTrees['MACAW_F1_L1_BASE'];
if (prismSquawk) {
  check('Prism Squawk baseFlat is 5 (damage base, not stat buff)', prismSquawk.baseFlat === 5, `got=${prismSquawk.baseFlat}`);
  check('Prism Squawk has no gainMatk rider', !(prismSquawk.riders || []).some((r) => r.kind === 'gainMatk'));
  check('Prism Squawk has reduceEnemyMatk rider', (prismSquawk.riders || []).some((r) => r.kind === 'reduceEnemyMatk'));
}
const tacticalPrism = allSkillTrees['MACAW_F1_L3_UTILITY'];
if (tacticalPrism) {
  check('Tactical Prism Squawk keeps gainMatk rider', (tacticalPrism.riders || []).some((r) => r.kind === 'gainMatk'));
  check('Tactical Prism Squawk keeps gainMdef rider', (tacticalPrism.riders || []).some((r) => r.kind === 'gainMdef'));
}

const failed = checks.filter(c => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '[ok]  ' : '[FAIL]'} ${c.name}${c.detail ? ` -- ${c.detail}` : ''}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} of ${checks.length} checks passed.`);
process.exit(0);
