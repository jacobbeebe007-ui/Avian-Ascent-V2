/**
 * Combat Scenario Test Harness
 *
 * Loads the game bundle into a Node VM with DOM stubs (extracted from
 * verify-equipment-sims.mjs), builds combatants, executes controlled actions,
 * advances turns, and captures state for assertions.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { createForcedRng, withSeededRandom } from './rng.mjs';
import {
  createCleanCombatState,
  getBasicAttack,
  findAbilityBySource,
  findAbilityById,
} from './fixtures.mjs';
import {
  AssertionError,
  applyExpectMap,
  expectValue,
  expectEnergy,
  expectCooldown,
  expectActionRejected,
  expectStatus,
  expectNoStatus,
} from './assertions.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_BUNDLE = path.join(ROOT, 'js/avian-game.bundle.js');

/* ---- DOM / browser sandbox (shared) ------------------------------------ */

export function makeDomStub() {
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
      onclick: null,
      oninput: null,
      onchange: null,
    });
  }
  const cache = Object.create(null);
  return {
    body: makeEl('body'),
    head: makeEl('head'),
    documentElement: makeEl('html'),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: (id) => (cache[id] ||= makeEl('div')),
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    readyState: 'complete',
  };
}

export function makeLocalStorageStub() {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: () => null,
    get length() { return Object.keys(store).length; },
  };
}

/**
 * Create a VM context with browser stubs and load the game bundle.
 */
export function createSandbox(opts = {}) {
  const bundlePath = opts.bundlePath || DEFAULT_BUNDLE;
  if (!existsSync(bundlePath)) {
    throw new Error(`missing ${bundlePath} — run npm run bundle`);
  }

  const localStorageStub = makeLocalStorageStub();
  const search = opts.search || '?equipmentV2=1';
  const sandbox = {
    console: opts.quiet
      ? { log() {}, warn() {}, error: console.error.bind(console), info() {}, debug() {} }
      : console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    Promise,
    JSON,
    Math,
    Date,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Object,
    Array,
    Number,
    String,
    Boolean,
    Symbol,
    RegExp,
    Error,
    TypeError,
    RangeError,
    URLSearchParams,
    document: makeDomStub(),
    location: {
      hash: '',
      pathname: '/',
      href: `http://localhost/${search}`,
      search,
    },
    navigator: { userAgent: 'node-combat-scenarios', platform: 'node', language: 'en' },
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
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail;
    },
    fetch: () => Promise.reject(new Error('fetch unavailable in combat scenario sandbox')),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(bundlePath, 'utf8'),
    sandbox,
    { filename: 'avian-game.bundle.js', timeout: opts.timeout || 30000 },
  );

  if (sandbox.Avian?.flags) sandbox.Avian.flags.equipmentV2 = true;
  installUiStubs(sandbox);
  return sandbox;
}

function installUiStubs(sandbox) {
  const noop = () => {};
  const noopAsync = () => Promise.resolve();
  const names = [
    'spawnFloat', 'doAttack', 'doMiss', 'doSpell', 'doHeal', 'doShield',
    'logMsg', 'setHpBar', 'refreshBattleUI', 'renderActions', 'renderStatuses',
    'spawnTrendFloat', 'playAvatarAnim', 'setEnergyBar', 'renderEnemyPlan',
    'lockActionUI', 'renderEnergyOrbs', 'updateCombatLog',
  ];
  for (const name of names) {
    if (typeof sandbox[name] === 'function') sandbox[name] = name === 'logMsg' ? noop : noopAsync;
    else sandbox[name] = name === 'logMsg' ? noop : noopAsync;
  }
  sandbox.delay = () => Promise.resolve();
}

/* ---- State capture ----------------------------------------------------- */

export function captureState(sandbox, meta = {}) {
  const g = sandbox.G;
  const p = g.player;
  const e = g.enemy;
  const ps = p?.stats || {};
  const es = e?.stats || {};
  return {
    player: {
      energy: Number(p?.energy) || 0,
      energyMax: Number(p?.energyMax) || 0,
      energyRegen: Number(p?.energyRegen) || 0,
      hp: Number(ps.hp) || 0,
      maxHp: Number(ps.maxHp) || 0,
      armour: Number(ps.armour) || 0,
      maxArmour: Number(ps.maxArmour) || 0,
      normalMaxArmour: Number(ps.normalMaxArmour) || 0,
      magicArmour: Number(ps.magicArmour) || 0,
      maxMagicArmour: Number(ps.maxMagicArmour) || 0,
      normalMaxMagicArmour: Number(ps.normalMaxMagicArmour) || 0,
      atk: Number(ps.atk) || 0,
      def: Number(ps.def) || 0,
      matk: Number(ps.matk) || 0,
      mdef: Number(ps.mdef) || 0,
      spd: Number(ps.spd) || 0,
      dodge: Number(ps.dodge) || 0,
    },
    enemy: {
      energy: Number(e?.energy) || 0,
      hp: Number(es.hp) || 0,
      maxHp: Number(es.maxHp) || 0,
      armour: Number(es.armour) || 0,
      maxArmour: Number(es.maxArmour) || 0,
      magicArmour: Number(es.magicArmour) || 0,
      maxMagicArmour: Number(es.maxMagicArmour) || 0,
      dodge: Number(es.dodge) || 0,
    },
    playerStatus: { ...(g.playerStatus || {}) },
    enemyStatus: { ...(g.enemyStatus || {}) },
    abilityCooldowns: { ...(g.abilityCooldowns || {}) },
    meta: {
      battleOver: !!g.battleOver,
      turn: g.turn,
      enemyWasHit: !!meta.enemyWasHit,
      actionRejected: !!meta.actionRejected,
      enemyHpBefore: meta.enemyHpBefore ?? (Number(es.hp) || 0),
      playerHpBefore: meta.playerHpBefore ?? (Number(ps.hp) || 0),
      dmgDealt: meta.dmgDealt ?? 0,
      winner: meta.winner ?? null,
      lastResult: meta.lastResult ?? null,
    },
  };
}

/* ---- Action execution -------------------------------------------------- */

function resolveAbility(sandbox, ctx, action = {}) {
  const actor = action.actor === 'enemy' ? ctx.enemy : ctx.player;
  if (action.abilityId) {
    return findAbilityById(actor, action.abilityId);
  }
  if (action.source) {
    return findAbilityBySource(actor, action.source);
  }
  switch (action.type) {
    case 'basicAttack':
    case 'basic':
      return getBasicAttack(actor);
    case 'weaponA':
    case 'skill1':
      return findAbilityBySource(actor, 'weaponA');
    case 'weaponB':
    case 'skill2':
      return findAbilityBySource(actor, 'weaponB');
    case 'armour':
    case 'utility':
    case 'ultimate':
      return findAbilityBySource(actor, action.type);
    default:
      return getBasicAttack(actor);
  }
}

/**
 * Controlled player ability execution (mirrors equipment-sims but with CD + reject).
 */
export function executePlayerAbility(sandbox, ability, opts = {}) {
  const g = sandbox.G;
  const log = opts.log || [];
  if (!g?.player || !ability || ability.empty) {
    return { rejected: true, reason: 'no-ability', actionRejected: true };
  }

  if (opts.requireAffordable !== false) {
    if (typeof sandbox.canUseAbility === 'function' && !sandbox.canUseAbility(g.player, ability)) {
      return { rejected: true, reason: 'cannot-use', actionRejected: true, energy: g.player.energy };
    }
  }

  const cd = typeof sandbox.getAbilityCooldown === 'function'
    ? sandbox.getAbilityCooldown(ability.id)
    : (g.abilityCooldowns?.[ability.id] || 0);
  if (cd > 0 && !opts.ignoreCooldown) {
    return { rejected: true, reason: 'cooldown', actionRejected: true, cooldown: cd };
  }

  const energyBefore = Number(g.player.energy) || 0;
  const enemyHpBefore = Number(g.enemy?.stats?.hp) || 0;
  const enemyArmourBefore = Number(g.enemy?.stats?.armour) || 0;
  const enemyMagicArmourBefore = Number(g.enemy?.stats?.magicArmour) || 0;

  if (typeof sandbox.spendEnergy === 'function') sandbox.spendEnergy(g.player, ability);
  else {
    const cost = ability.energyCost || ability.enCost || 1;
    g.player.energy = Math.max(0, energyBefore - cost);
  }

  g.playerActionsThisTurn = (g.playerActionsThisTurn || 0) + 1;

  const Avian = sandbox.Avian;
  let row = ability._dispatcherRow || null;
  if (!row && typeof sandbox.resolveAbilityCombatRow === 'function') {
    row = sandbox.resolveAbilityCombatRow(ability);
  }
  if (!row && Avian?.equipmentActions?.skillToAbilityRow) {
    row = Avian.equipmentActions.skillToAbilityRow(ability.id, null, 'grey');
  }

  /* Commit CD before effect resolution (mirrors playerAction race fix). */
  if (opts.applyCooldown !== false && typeof sandbox.setAbilityCooldown === 'function') {
    sandbox.setAbilityCooldown(ability);
  }
  const srcKey = ability.actionSource || null;
  if (srcKey === 'utility' || (row && (row.noDamage || row.target === 'self'))) {
    g.utilityUsedThisTurn = g.utilityUsedThisTurn || {};
    g.utilityUsedThisTurn[ability.id] = true;
  }
  if (srcKey && srcKey !== 'basic') {
    g.actionUsedThisTurn = g.actionUsedThisTurn || {};
    g.actionUsedThisTurn[srcKey] = true;
  }

  let dmgDealt = 0;
  let hitsLanded = 0;
  let wasHit = false;
  let wasMiss = false;
  let lastRes = null;

  const noDamage = !row || row.noDamage || row.target === 'self' || opts.skipDamage;
  if (noDamage) {
    /* Self / utility skills: run the real dispatcher so Fortify / Ward / cleanses apply. */
    if (Avian?.dispatcher?.execute) {
      try {
        const maybePromise = Avian.dispatcher.execute(ability);
        if (maybePromise && typeof maybePromise.then === 'function') {
          /* Harness is sync; fire-and-forget only if execute is truly async with delays.
           * Utility path in dispatcher is sync aside from the async function wrapper. */
        }
      } catch (err) {
        log.push({ type: 'dispatcher-error', message: String(err && err.message || err) });
      }
    }
  } else if (g.enemy) {
    const hits = Math.max(1, Number(row.hits || row.hitCount || 1));
    const btn = (typeof sandbox.getEffectiveAbilityBtnType === 'function')
      ? sandbox.getEffectiveAbilityBtnType(ability, row)
      : (row.btnType || row.type || 'physical');
    const isMagic = btn === 'spell' || btn === 'magic' || !!opts.isMagic;

    let hitPct = 85;
    try {
      if (typeof sandbox.calculateAbilityHitChancePct === 'function') {
        const playerAcc = typeof sandbox.getPlayerEffectiveAcc === 'function'
          ? sandbox.getPlayerEffectiveAcc()
          : (g.player.stats.acc || 85);
        const enemyDodge = typeof sandbox.getEffectiveEnemyDodgeForPlayerHit === 'function'
          ? sandbox.getEffectiveEnemyDodgeForPlayerHit()
          : (g.enemy.stats.dodge || 0);
        const accPenalty = typeof sandbox.calculateAbilityAccuracyPenalty === 'function'
          ? sandbox.calculateAbilityAccuracyPenalty(row)
          : 0;
        hitPct = sandbox.calculateAbilityHitChancePct(playerAcc, enemyDodge, accPenalty);
      }
    } catch (_) { /* keep default */ }

    if (opts.forceHit === true) hitPct = 100;
    if (opts.forceHit === false) hitPct = 0;

    for (let i = 0; i < hits; i++) {
      const roll = sandbox.Math.random() * 100;
      if (roll >= hitPct) {
        wasMiss = true;
        log.push({ type: 'miss', hitIndex: i });
        continue;
      }
      g._dispatcherCombatRow = row;
      g._currentPiercePct = isMagic ? (row.pierceMdef || 0) : (row.pierceDef || 0);

      let raw = 0;
      let dealOpts = null;
      if (opts.precomputedDamage != null) {
        dealOpts = { precomputedDamage: opts.precomputedDamage, masterFullyResolved: true };
        raw = opts.precomputedDamage;
      } else if (typeof sandbox.computeEntityAbilityRawDamage === 'function') {
        raw = sandbox.computeEntityAbilityRawDamage(g.player, ability, null, isMagic);
      } else if (typeof sandbox.computeMasterOutgoingDamage === 'function'
        && typeof sandbox.usesMasterDamage === 'function'
        && sandbox.usesMasterDamage(row)) {
        const master = sandbox.computeMasterOutgoingDamage(isMagic, { id: ability.id, name: ability.name }, { hitSucceeded: true });
        if (master) {
          raw = master.damage;
          dealOpts = { precomputedDamage: raw, isCrit: !!master.isCrit, masterFullyResolved: true };
        }
      }

      const res = typeof sandbox.dealDamage === 'function'
        ? sandbox.dealDamage('enemy', raw, dealOpts?.isCrit || false, isMagic, ability, dealOpts)
        : { dmgDealt: Math.max(0, raw), wasDodged: false };

      g._dispatcherCombatRow = null;
      lastRes = res;
      if (res && !res.wasDodged) {
        hitsLanded++;
        wasHit = true;
        dmgDealt += res.dmgDealt || 0;
        log.push({ type: 'hit', hitIndex: i, dmg: res.dmgDealt || 0, isCrit: !!res.isCrit });
      } else {
        wasMiss = true;
        log.push({ type: 'dodge', hitIndex: i });
      }
      if (g.enemy.stats.hp <= 0) break;
    }
  }

  return {
    ok: true,
    actionRejected: false,
    abilityId: ability.id,
    energyBefore,
    energyAfter: Number(g.player.energy) || 0,
    energySpent: energyBefore - (Number(g.player.energy) || 0),
    enemyHpBefore,
    enemyHpAfter: Number(g.enemy?.stats?.hp) || 0,
    enemyArmourBefore,
    enemyArmourAfter: Number(g.enemy?.stats?.armour) || 0,
    enemyMagicArmourBefore,
    enemyMagicArmourAfter: Number(g.enemy?.stats?.magicArmour) || 0,
    dmgDealt,
    hitsLanded,
    enemyWasHit: wasHit,
    wasMiss,
    lastRes,
    cooldown: g.abilityCooldowns?.[ability.id] || 0,
    log,
  };
}

export function executeAction(sandbox, ctx, action = {}) {
  const type = action.type || 'basicAttack';

  if (type === 'endTurn' || type === 'advanceTurn' || type === 'playerTurnStart') {
    return advancePlayerTurn(sandbox, action);
  }
  if (type === 'tickCooldowns') {
    tickCooldowns(sandbox);
    return { ok: true, abilityCooldowns: { ...sandbox.G.abilityCooldowns } };
  }
  if (type === 'tickProtection') {
    const Avian = sandbox.Avian;
    const side = action.side || 'player';
    const stats = side === 'enemy' ? sandbox.G.enemy.stats : sandbox.G.player.stats;
    const status = side === 'enemy' ? sandbox.G.enemyStatus : sandbox.G.playerStatus;
    if (Avian?.protection?.tickProtectionStatuses) {
      Avian.protection.tickProtectionStatuses(stats, status);
    }
    return { ok: true };
  }
  if (type === 'expireFortify') {
    sandbox.Avian?.protection?.expireFortify(sandbox.G.player.stats, sandbox.G.playerStatus);
    return { ok: true };
  }
  if (type === 'expireWard') {
    sandbox.Avian?.protection?.expireWard(sandbox.G.player.stats, sandbox.G.playerStatus);
    return { ok: true };
  }
  if (type === 'applyDamage' || type === 'receiveDamage') {
    const target = action.target === 'player' || action.actor === 'enemy' ? 'player' : 'enemy';
    const amount = Number(action.amount) || 0;
    const isMagic = !!action.isMagic;
    const before = Number(sandbox.G[target === 'player' ? 'player' : 'enemy'].stats.hp) || 0;
    let res = null;
    if (typeof sandbox.dealDamage === 'function') {
      res = sandbox.dealDamage(target, amount, false, isMagic, null, {
        precomputedDamage: amount,
        masterFullyResolved: true,
        skipHitCheck: true,
      });
    } else {
      const ent = target === 'player' ? sandbox.G.player : sandbox.G.enemy;
      ent.stats.hp = Math.max(0, before - amount);
      res = { dmgDealt: before - ent.stats.hp };
    }
    return { ok: true, dmgDealt: res?.dmgDealt || 0, target, hpBefore: before };
  }
  if (type === 'dealRawProtection') {
    const Avian = sandbox.Avian;
    const target = action.target === 'player' ? sandbox.G.player : sandbox.G.enemy;
    const status = action.target === 'player' ? sandbox.G.playerStatus : sandbox.G.enemyStatus;
    const hit = Avian.protection.applyDamageThroughProtection(
      target.stats,
      status,
      Number(action.amount) || 0,
      !!action.isMagic,
    );
    if (hit.remaining > 0) {
      target.stats.hp = Math.max(0, (target.stats.hp || 0) - hit.remaining);
    }
    return { ok: true, hit };
  }

  const ability = resolveAbility(sandbox, ctx, action);
  if (!ability) {
    return { rejected: true, reason: 'ability-not-found', actionRejected: true };
  }

  const forceHit = action.forceHit != null
    ? action.forceHit
    : (action.rng?.hit != null ? action.rng.hit : undefined);

  return executePlayerAbility(sandbox, ability, {
    forceHit,
    skipDamage: !!action.skipDamage,
    precomputedDamage: action.precomputedDamage,
    isMagic: action.isMagic,
    applyCooldown: action.applyCooldown,
  });
}

/**
 * Advance to the next player turn (energy regen path used after the opening turn).
 */
export function advancePlayerTurn(sandbox, opts = {}) {
  const g = sandbox.G;
  const player = g.player;
  const before = Number(player.energy) || 0;

  /* Tick cooldowns at the boundary between turns (mirrors afterEnemyTurn). */
  if (opts.tickCooldowns !== false) tickCooldowns(sandbox);

  if (opts.tickProtection !== false) {
    const Avian = sandbox.Avian;
    if (Avian?.protection?.tickProtectionStatuses) {
      Avian.protection.tickProtectionStatuses(player.stats, g.playerStatus);
      if (g.enemy) Avian.protection.tickProtectionStatuses(g.enemy.stats, g.enemyStatus);
    }
  }

  player.energyMax = typeof sandbox.computePlayerMaxEnergy === 'function'
    ? sandbox.computePlayerMaxEnergy()
    : (player.energyMax || 6);
  player.energyRegen = typeof sandbox.computePlayerEnergyRegen === 'function'
    ? sandbox.computePlayerEnergyRegen(player)
    : 3;

  const idx = (g._playerEnergyTurnIndex | 0);
  if (idx === 0) {
    g._playerEnergyTurnIndex = 1;
    player.energy = typeof sandbox.computePlayerStartEnergy === 'function'
      ? sandbox.computePlayerStartEnergy(player)
      : Math.min(player.energyMax, 4);
  } else {
    const r = typeof sandbox.computePlayerEnergyRegenThisTurn === 'function'
      ? sandbox.computePlayerEnergyRegenThisTurn(player, g.playerStatus)
      : (player.energyRegen || 3);
    player.energy = Math.min(player.energyMax, Math.max(0, (player.energy || 0) + r));
  }

  g.playerActionsThisTurn = 0;
  g.utilityUsedThisTurn = {};
  g.actionUsedThisTurn = {};
  g.playerTurnFlags = { energyGainedThisTurn: 0, onHitTriggered: false, firstAttackResolved: false };

  return {
    ok: true,
    energyBefore: before,
    energyAfter: Number(player.energy) || 0,
    energyGained: (Number(player.energy) || 0) - before,
  };
}

export function tickCooldowns(sandbox) {
  const g = sandbox.G;
  if (!g.abilityCooldowns) return;
  for (const k of Object.keys(g.abilityCooldowns)) {
    g.abilityCooldowns[k] = Math.max(0, (g.abilityCooldowns[k] || 0) - 1);
    if (g.abilityCooldowns[k] === 0) delete g.abilityCooldowns[k];
  }
}

/* ---- Scenario runner --------------------------------------------------- */

function checkExpect(scenarioId, snapshot, expectBlock, result) {
  if (!expectBlock) return;
  const flat = { ...expectBlock };
  if (expectBlock.immediate) Object.assign(flat, expectBlock.immediate);
  if (result?.actionRejected && flat.actionRejected == null) {
    /* leave as-is */
  }
  if (flat.actionRejected != null) {
    if (flat.actionRejected) expectActionRejected(result || { actionRejected: snapshot.meta.actionRejected }, flat.reason, scenarioId);
    else expectValue(!!(result?.actionRejected || snapshot.meta.actionRejected), false, 'actionRejected', scenarioId);
    delete flat.actionRejected;
    delete flat.reason;
  }
  if (flat.playerEnergy != null) {
    expectEnergy({ energy: snapshot.player.energy }, flat.playerEnergy, scenarioId);
    delete flat.playerEnergy;
  }
  if (flat.cooldown != null && flat.skillId) {
    expectCooldown(snapshot, flat.skillId, flat.cooldown, scenarioId);
    delete flat.cooldown;
    delete flat.skillId;
  }
  if (flat.hasFortify != null) {
    if (flat.hasFortify) expectStatus({ playerStatus: snapshot.playerStatus }, 'fortify', true, scenarioId);
    else expectNoStatus({ playerStatus: snapshot.playerStatus }, 'fortify', scenarioId);
    delete flat.hasFortify;
  }
  if (flat.hasWard != null) {
    if (flat.hasWard) expectStatus({ playerStatus: snapshot.playerStatus }, 'ward', true, scenarioId);
    else expectNoStatus({ playerStatus: snapshot.playerStatus }, 'ward', scenarioId);
    delete flat.hasWard;
  }
  applyExpectMap(snapshot, flat, scenarioId);

  /* Direct numeric fields already handled by applyExpectMap aliases */
}

/**
 * Run a single data-driven scenario against a live sandbox.
 */
export function runScenario(sandbox, scenario) {
  const id = scenario.id || '???';
  const name = scenario.name || id;
  let rng = null;

  try {
    if (scenario.pending) {
      return { id, name, status: 'pending', message: scenario.pendingReason || 'pending' };
    }

    const setup = scenario.setup || {};
    /* Opening energy scenarios need turn-index 0 semantics */
    if (setup.playerEnergyTurnIndex == null && scenario.useStartEnergy) {
      setup.playerEnergyTurnIndex = 0;
    }
    const ctx = createCleanCombatState(sandbox, setup);

    if (scenario.rng) {
      rng = createForcedRng(scenario.rng);
      rng.install(sandbox.Math);
    } else if (scenario.seed != null) {
      rng = createForcedRng({ seed: scenario.seed });
      rng.install(sandbox.Math);
    }

    const enemyHpBefore = Number(ctx.enemy.stats.hp) || 0;
    const playerHpBefore = Number(ctx.player.stats.hp) || 0;
    let result = null;
    let meta = { enemyHpBefore, playerHpBefore };

    if (Array.isArray(scenario.steps) && scenario.steps.length) {
      for (const step of scenario.steps) {
        if (step.rng) {
          if (!rng) {
            rng = createForcedRng(step.rng);
            rng.install(sandbox.Math);
          } else {
            rng.force(step.rng);
          }
        }
        const stepResult = executeAction(sandbox, ctx, step.action || step);
        result = stepResult;
        meta = {
          ...meta,
          enemyWasHit: !!(stepResult && stepResult.enemyWasHit),
          actionRejected: !!(stepResult && stepResult.actionRejected),
          dmgDealt: stepResult?.dmgDealt || 0,
          lastResult: stepResult,
        };
        if (step.expect) {
          const snap = captureState(sandbox, meta);
          checkExpect(id, snap, step.expect, stepResult);
        }
        if (step.expectTriggered != null) {
          /* Passive hook placeholder — scenarios may set meta.triggered */
          const triggered = !!(stepResult?.triggered || sandbox.G?._lastPassiveTriggered);
          expectValue(triggered, !!step.expectTriggered, 'passive triggered', id);
        }
      }
    } else if (scenario.action) {
      if (scenario.action.rng) {
        if (!rng) {
          rng = createForcedRng(scenario.action.rng);
          rng.install(sandbox.Math);
        } else {
          rng.force(scenario.action.rng);
        }
      }
      result = executeAction(sandbox, ctx, scenario.action);
      meta = {
        ...meta,
        enemyWasHit: !!(result && result.enemyWasHit),
        actionRejected: !!(result && result.actionRejected),
        dmgDealt: result?.dmgDealt || 0,
        lastResult: result,
      };
    }

    if (scenario.expect?.immediate || scenario.expect) {
      const snap = captureState(sandbox, meta);
      checkExpect(id, snap, scenario.expect.immediate || scenario.expect, result);
    }

    if (scenario.expect?.endOfTurn) {
      advancePlayerTurn(sandbox, { tickCooldowns: true, tickProtection: true });
      const snap = captureState(sandbox, meta);
      checkExpect(id, snap, scenario.expect.endOfTurn, result);
    }

    if (Array.isArray(scenario.expect?.followingTurns)) {
      for (const turnExpect of scenario.expect.followingTurns) {
        advancePlayerTurn(sandbox, { tickCooldowns: true, tickProtection: true });
        const snap = captureState(sandbox, meta);
        checkExpect(id, snap, turnExpect, result);
      }
    }

    if (typeof scenario.assert === 'function') {
      scenario.assert({
        sandbox,
        ctx,
        result,
        captureState: (m) => captureState(sandbox, m || meta),
        expectValue: (a, e, msg) => expectValue(a, e, msg, id),
        expectEnergy: (c, n) => expectEnergy(c, n, id),
        expectCooldown: (g, sid, t) => expectCooldown(g, sid, t, id),
        AssertionError,
      });
    }

    if (rng && scenario.rng?.expectConsumed != null) {
      rng.expectConsumed(scenario.rng.expectConsumed, `[${id}] RNG`);
    }

    return { id, name, status: 'passed', result };
  } catch (err) {
    return {
      id,
      name,
      status: 'failed',
      error: err,
      message: err?.message || String(err),
    };
  } finally {
    if (rng) rng.uninstall(sandbox.Math);
  }
}

/**
 * Register and run a list of scenarios; print ✓/✗ lines.
 */
export function runScenarioSuite(scenarios, opts = {}) {
  const sandbox = opts.sandbox || createSandbox(opts);
  const list = scenarios.flatMap((s) => (Array.isArray(s) ? s : [s])).filter(Boolean);
  const results = [];
  let passed = 0;
  let failed = 0;
  let pending = 0;

  for (const scenario of list) {
    const r = runScenario(sandbox, scenario);
    results.push(r);
    if (r.status === 'passed') {
      passed++;
      console.log(`✓ ${r.id} ${r.name}`);
    } else if (r.status === 'pending') {
      pending++;
      console.log(`🔁 ${r.id} ${r.name}`);
      if (r.message) console.log(`  ${r.message}`);
    } else {
      failed++;
      console.log(`✗ ${r.id} ${r.name}`);
      if (r.message) {
        for (const line of String(r.message).split('\n')) {
          console.log(`  ${line}`);
        }
      }
    }
  }

  return { passed, failed, pending, total: list.length, results, sandbox };
}

export { withSeededRandom, createForcedRng, AssertionError };
