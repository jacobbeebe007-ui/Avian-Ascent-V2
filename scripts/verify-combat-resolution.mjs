/* Runtime verification: boot the bundle in a Node vm sandbox and assert that
 * player ability resolution works end-to-end after the legacy combat excision.
 *
 *   - Sparrow's startAbilities / slotAbilities resolve from the combat pack
 *   - ABILITY_TEMPLATES[starter] is a populated row from the combat data pack
 *   - ACTIONS[starter] is a function (dispatcher proxy)
 *   - Avian.dispatcher.execute resolves the ability without throwing
 *   - FAMILY_EVOLUTION_BIRD_DATA stays empty (family evolution retired)
 *   - ensureFamilyEvolutionState emits no [family-evolution] warnings
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
check('calculateDamage exported on globalThis', typeof sandbox.calculateDamage === 'function');
check('clampCritChancePct exported on globalThis', typeof sandbox.clampCritChancePct === 'function');
check('MIN_HIT_CHANCE is 15', sandbox.MIN_HIT_CHANCE === 15, `got=${sandbox.MIN_HIT_CHANCE}`);
check('miss path returns zero damage', sandbox.calculateDamage({ hitSucceeded: false, attacker: {}, target: {}, ability: { apCost: 1 } }).damage === 0);
check('Crow hit preview 60%', sandbox.calculateAbilityHitChancePct(78, 18, 0) === 60, `got=${sandbox.calculateAbilityHitChancePct(78, 18, 0)}`);
check('computeMasterOutgoingDamage exported', typeof sandbox.computeMasterOutgoingDamage === 'function');

const sparrowStarterId = Avian?.data?.combatPack?.abilityAliases?.SPARROW_F1_L1_BASE
  || (typeof sandbox.getBaseSkillSlotsForBird === 'function' ? sandbox.getBaseSkillSlotsForBird('sparrow')?.[0]?.abilityId : null)
  || 'SPARROW_S1_RAPID_PECK_FAMILY_S1';
check('legacy SPARROW_F1_L1_BASE aliases to canonical starter', Avian?.data?.combatPack?.abilityAliases?.SPARROW_F1_L1_BASE === sparrowStarterId);
const starterRow = Avian?.data?.combatPack?.skillTrees?.[sparrowStarterId];
if (starterRow) {
  if (typeof sandbox.enrichCombatRow === 'function') sandbox.enrichCombatRow(starterRow);
  check('starter row has abilityPower', starterRow.abilityPower != null, `power=${starterRow.abilityPower}`);
  check('starter row has damageStat', !!starterRow.damageStat, `stat=${starterRow.damageStat}`);
  check('starter row has enCost', starterRow.enCost != null || starterRow.apCost != null, `en=${starterRow.enCost || starterRow.apCost}`);
}

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
  const frozenRegen = sandbox.computePlayerEnergyRegenThisTurn(chilledPlayer, { frozen: { pendingSkip: true } });
  check('frozen blocks EN regen', frozenRegen === 0);
  const paraRegen = sandbox.computePlayerEnergyRegenThisTurn(chilledPlayer, { paralyzed: 2 });
  check('paralyzed blocks EN regen', paraRegen === 0);
}

check('AILMENT_RULES exported', !!sandbox.AILMENT_RULES);
check('tickEndOfTurnAilments exported', typeof sandbox.tickEndOfTurnAilments === 'function');
check('tickStartOfTurnControl exported', typeof sandbox.tickStartOfTurnControl === 'function');
check('consumeFrozenSkip exported', typeof sandbox.consumeFrozenSkip === 'function');
check('applyAilmentDamage exported', typeof sandbox.applyAilmentDamage === 'function');
check('resolveAilmentChance exported', typeof sandbox.resolveAilmentChance === 'function');

if (typeof sandbox.getAbilityEnergyCost === 'function' && sandbox.G) {
  const ab = { id: 'test', level: 1, btnType: 'physical' };
  sandbox.G.playerStatus = { frozen: { pendingSkip: true } };
  sandbox.G.player = sandbox.G.player || { stats: {} };
  const cost = sandbox.getAbilityEnergyCost(ab, sandbox.G.player);
  check('frozen no longer adds +1 EN cost', cost <= 2, `got=${cost}`);
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

const starterId = BIRDS?.sparrow?.mainAttackId || BIRDS?.sparrow?.startAbilities?.[0] || '';
check('BIRDS.sparrow.startAbilities set from combat pack', Array.isArray(BIRDS?.sparrow?.startAbilities) && BIRDS.sparrow.startAbilities.length >= 2);
check('BIRDS.sparrow.slotAbilities has 7 entries', Array.isArray(BIRDS?.sparrow?.slotAbilities) && BIRDS.sparrow.slotAbilities.length === 7);
check(`sparrow starter ability in ABILITY_TEMPLATES`, !!starterId && !!ABILITY_TEMPLATES?.[starterId], `starter=${starterId}`);
check(`ACTIONS[sparrow starter] is a function`, !!starterId && typeof ACTIONS?.[starterId] === 'function');
check('FAMILY_EVOLUTION_BIRD_DATA is empty (family evolution retired)', !FAMILY_EVOLUTION_BIRD_DATA || Object.keys(FAMILY_EVOLUTION_BIRD_DATA).length === 0);

check('BIRDS.sparrow.mainAttackId matches startAbilities[0]', BIRDS?.sparrow?.mainAttackId === BIRDS?.sparrow?.startAbilities?.[0], `got=${BIRDS?.sparrow?.mainAttackId}`);
check('BIRDS.sparrow.passive is set', !!BIRDS?.sparrow?.passive?.id);

const birdKeys = BIRDS && typeof BIRDS === 'object' ? Object.keys(BIRDS) : [];
const missingSlotAbilityBirds = [];
const slotAbilityIssues = [];
for (const birdKey of birdKeys) {
  const bd = BIRDS[birdKey];
  const slots = bd?.slotAbilities;
  const start = bd?.startAbilities;
  if (!Array.isArray(start) || start.length < 2 || !start[0] || !start[1]) {
    missingSlotAbilityBirds.push(birdKey);
    continue;
  }
  if (!Array.isArray(slots) || slots.length !== 7) {
    slotAbilityIssues.push(`${birdKey}:slotAbilities=${slots?.length ?? 0}`);
    continue;
  }
  if (!slots[0] || !slots[1]) {
    slotAbilityIssues.push(`${birdKey}:starterIds=${slots[0] || ''}|${slots[1] || ''}`);
  }
}
check('every BIRDS key has startAbilities (2 starters)', missingSlotAbilityBirds.length === 0, missingSlotAbilityBirds.join(', ') || 'none');
check('every bird slotAbilities has 7 entries with starters', slotAbilityIssues.length === 0, slotAbilityIssues.join(', ') || 'none');

if (typeof sandbox.ensureFamilyEvolutionState === 'function') {
  const familyEvolutionWarnBirds = [];
  const prevWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('[family-evolution]')) {
      const match = msg.match(/birdKey=([^;]+)/);
      if (match) familyEvolutionWarnBirds.push(match[1]);
    }
    prevWarn(...args);
  };
  try {
    for (const birdKey of birdKeys) {
      sandbox.ensureFamilyEvolutionState({ birdKey, abilities: [] });
    }
    check('ensureFamilyEvolutionState emits no family-evolution warnings for any bird', familyEvolutionWarnBirds.length === 0, familyEvolutionWarnBirds.join(', ') || 'none');
  } finally {
    console.warn = prevWarn;
  }
}

if (typeof sandbox.usesFamilySkillEvolution === 'function') {
  check('usesFamilySkillEvolution is always false', sandbox.usesFamilySkillEvolution({ birdKey: 'sparrow' }) === false);
}

if (typeof sandbox.materializeEnemySkillsFromWorkbookKit === 'function') {
  const stub = { birdKey: 'sparrow', abilities: [] };
  const ok = sandbox.materializeEnemySkillsFromWorkbookKit(stub, 'sparrow', 1, 'striker', null, { unlockSlots: 2 });
  check('materializeEnemySkillsFromWorkbookKit works from slotAbilities', ok === true && Array.isArray(stub.abilities) && stub.abilities.length === 2);
}

// Sanity: no remaining legacy ability ids in BIRDS
const legacyIds = ['rapidPeck', 'beak_jab', 'multiPeck', 'dart', 'windFeint', 'trackPrey'];
const legacyMain = legacyIds.includes(String(BIRDS?.sparrow?.mainAttackId || ''));
check('sparrow mainAttackId is NOT a legacy id', !legacyMain);

const snowyTrees = Avian?.data?.combatPack?.skillTrees;
const snowyCanon1 = Avian?.data?.combatPack?.abilityAliases?.SNOWY_OWL_F1_L1_BASE;
const snowyCanon2 = Avian?.data?.combatPack?.abilityAliases?.SNOWY_OWL_F2_L1_BASE;
const snowyF1 = snowyCanon1 && snowyTrees?.[snowyCanon1];
const snowyF2 = snowyCanon2 && snowyTrees?.[snowyCanon2];
check('Snowy Owl legacy F1 alias resolves', !!snowyCanon1 && !!snowyF1);
check('Snowy Owl legacy F2 alias resolves', !!snowyCanon2 && !!snowyF2);
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

const macawStarterId = Avian?.data?.combatPack?.abilityAliases?.MACAW_F1_L1_BASE || 'MACAW_S1_BEAK_FAMILY_S1';
const prismSquawk = allSkillTrees[macawStarterId];
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

if (typeof sandbox.getEnemyEnergyProfile === 'function') {
  const enProf = sandbox.getEnemyEnergyProfile();
  check('enemy energy max is 6', enProf.maxEN === 6, `got=${enProf.maxEN}`);
  check('enemy energy start is 4', enProf.startEN === 4, `got=${enProf.startEN}`);
  check('enemy energy regen is 3', enProf.regenEN === 3, `got=${enProf.regenEN}`);
}

if (typeof globalThis.getCombatStatMagnitude === 'function') {
  check('Minor Dodge Up is 6', globalThis.getCombatStatMagnitude('dodge', 'up', 'minor') === 6);
  check('Major Dodge Up is 8', globalThis.getCombatStatMagnitude('dodge', 'up', 'major') === 8);
  check('Grand Dodge Up is 12', globalThis.getCombatStatMagnitude('dodge', 'up', 'grand') === 12);
}

if (typeof sandbox.dealDamage === 'function' && sandbox.G) {
  const G = sandbox.G;
  const enemyAbId = sparrowStarterId;
  const enemyAb = { id: enemyAbId, level: 1, btnType: 'physical', type: 'physical' };
  G.player = {
    birdKey: 'sparrow',
    stats: { hp: 40, maxHp: 40, dodge: 10, def: 8, mdef: 8 },
    energy: 4,
    energyMax: 6,
  };
  G.playerStatus = {};
  G.enemy = {
    name: 'Test Enemy',
    stats: { hp: 30, maxHp: 30, atk: 12, acc: 80, matk: 10 },
    abilities: [enemyAb],
  };
  G.enemyStatus = {};
  G._activePlayerAbility = enemyAb;
  G._incomingAttackKind = 'physical';
  let enemyHitOk = false;
  let enemyHitErr = null;
  try {
    const hit = sandbox.dealDamage('player', 12, false, false, enemyAb);
    enemyHitOk = !!(hit && typeof hit.dmgDealt === 'number');
  } catch (err) {
    enemyHitErr = err;
  }
  check('dealDamage player target does not throw (enemyEnCost defined)', enemyHitOk && !enemyHitErr, enemyHitErr ? String(enemyHitErr) : `dmg=${enemyHitOk}`);
}

// Ability briefs: displayText effect phrasing in combat previews
if (typeof sandbox.buildAbilityCombatBrief === 'function' && typeof sandbox.enrichCombatRow === 'function') {
  const rapidPeck = allSkillTrees['SPARROW_S1_RAPID_PECK_FAMILY_S1'];
  const hedgerowWrit = allSkillTrees['SPARROW_S3_WRIT_FAMILY_S1'];
  if (rapidPeck) {
    sandbox.enrichCombatRow(rapidPeck);
    const rapidBrief = sandbox.buildAbilityCombatBrief({ id: rapidPeck.id }, rapidPeck);
    check('Rapid Peck brief includes authored dodge rider line', /gain \+8 Dodge/i.test(rapidBrief), rapidBrief);
    check('Rapid Peck brief avoids shorthand dodge rider', !/^\+\d+ Dodge if faster/m.test(rapidBrief.split('\n').pop() || ''), rapidBrief);
  }
  if (hedgerowWrit) {
    sandbox.enrichCombatRow(hedgerowWrit);
    const writBrief = sandbox.buildAbilityCombatBrief({ id: hedgerowWrit.id }, hedgerowWrit);
    const writHtml = typeof sandbox.buildAbilityCombatBriefHtml === 'function'
      ? sandbox.buildAbilityCombatBriefHtml({ id: hedgerowWrit.id }, hedgerowWrit)
      : '';
    check('Hedgerow Writ brief uses chance-to-apply ailment phrasing', /Has a 20% chance to apply Blinded/i.test(writBrief), writBrief);
    check('Hedgerow Writ brief HTML colorizes Blinded', writHtml.includes('<span') && /Blinded/i.test(writHtml), writHtml.slice(0, 120));
  }
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
