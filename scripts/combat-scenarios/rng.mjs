/**
 * Deterministic / forced RNG for combat scenario tests.
 *
 * Supports:
 *   createForcedRng([0.10, 0.99, …])
 *   rng.force({ hit: true, critical: false, ailment: true, damageRoll: 'average' })
 *
 * Hit rolls in the game use `Math.random() * 100 < hitPct` (or `>=` for miss).
 * Returning 0.0 guarantees a hit; returning 0.999 guarantees a miss when hitPct ≤ 99.
 * Crit rolls use `Math.random() * 100 < critChance` — same mapping.
 */

export function mulberry32(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function outcomeToUnit(key, value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(0.999999, value));
  }
  switch (key) {
    case 'hit':
      return value ? 0.0 : 0.999;
    case 'critical':
    case 'crit':
      return value ? 0.0 : 0.999;
    case 'ailment':
      return value ? 0.0 : 0.999;
    case 'dodge':
      /* Defender dodge success → treat as miss-path high roll on attacker hit check. */
      return value ? 0.999 : 0.0;
    case 'damageRoll':
      if (value === 'min') return 0.0;
      if (value === 'max') return 0.999;
      if (value === 'average' || value === 'avg') return 0.5;
      return 0.5;
    default:
      if (value === true) return 0.0;
      if (value === false) return 0.999;
      return 0.5;
  }
}

/**
 * @param {number[]|object|null} plan
 * @returns {{ next: Function, force: Function, install: Function, uninstall: Function, consumed: Function, expectConsumed: Function, remaining: Function }}
 */
export function createForcedRng(plan = null) {
  const queue = [];
  let consumed = 0;
  let prevRandom = null;
  let installed = false;
  let seededFn = null;

  function enqueueFromPlan(p) {
    if (p == null) return;
    if (Array.isArray(p)) {
      for (const v of p) queue.push(Number(v));
      return;
    }
    if (typeof p === 'object') {
      /* Readable order: hit → critical → ailment → damageRoll → extras */
      const order = ['hit', 'critical', 'crit', 'dodge', 'ailment', 'damageRoll'];
      const seen = new Set();
      for (const key of order) {
        if (Object.prototype.hasOwnProperty.call(p, key)) {
          queue.push(outcomeToUnit(key, p[key]));
          seen.add(key);
        }
      }
      for (const key of Object.keys(p)) {
        if (seen.has(key)) continue;
        if (key === 'seed') {
          seededFn = mulberry32(p.seed);
          continue;
        }
        if (key === 'values' && Array.isArray(p.values)) {
          for (const v of p.values) queue.push(Number(v));
          continue;
        }
        queue.push(outcomeToUnit(key, p[key]));
      }
    }
  }

  enqueueFromPlan(plan);

  function next() {
    if (queue.length) {
      consumed++;
      return queue.shift();
    }
    if (seededFn) {
      consumed++;
      return seededFn();
    }
    consumed++;
    return 0.5;
  }

  function force(spec) {
    enqueueFromPlan(spec);
    return api;
  }

  function install(mathObj = Math) {
    if (installed) return api;
    prevRandom = mathObj.random;
    mathObj.random = next;
    installed = true;
    return api;
  }

  function uninstall(mathObj = Math) {
    if (!installed) return api;
    if (prevRandom) mathObj.random = prevRandom;
    prevRandom = null;
    installed = false;
    return api;
  }

  const api = {
    next,
    force,
    install,
    uninstall,
    consumed: () => consumed,
    remaining: () => queue.length,
    expectConsumed(expected, message = 'RNG roll count') {
      if (consumed !== expected) {
        const err = new Error(
          `${message}: expected ${expected} random roll(s), consumed ${consumed}` +
          (queue.length ? ` (${queue.length} forced value(s) unused)` : ''),
        );
        err.code = 'RNG_COUNT';
        throw err;
      }
    },
    expectExhausted(message = 'Forced RNG values unused') {
      if (queue.length) {
        const err = new Error(`${message}: ${queue.length} value(s) left: [${queue.join(', ')}]`);
        err.code = 'RNG_UNUSED';
        throw err;
      }
    },
  };
  return api;
}

/**
 * Install a seeded Math.random for the duration of fn.
 */
export function withSeededRandom(seed, fn, mathObj = Math) {
  const prev = mathObj.random;
  mathObj.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    mathObj.random = prev;
  }
}
