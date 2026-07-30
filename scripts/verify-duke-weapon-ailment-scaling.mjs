/**
 * Duke orange kit, weapon single-stat scaling, and 100% on-land ailments.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

let failed = 0;
function fail(msg) {
  failed += 1;
  console.error('[FAIL]', msg);
}
function ok(msg) {
  console.log('[ok]  ', msg);
}

/* ---- Unit: ailment chance + shock normalize (no full bundle) ---- */
{
  const ctx = { globalThis: {}, console, Math, Number, Object, Array, String };
  ctx.globalThis = ctx;
  vm.runInNewContext(read('js/data/ailment-rules.js'), ctx);
  vm.runInNewContext(read('js/systems/ability-rider-parser.js'), ctx);

  ok('deterministicOnLand flag', !!ctx.AILMENT_RULES.application.deterministicOnLand);
  const bossG = { enemy: { isBoss: true } };
  const det = ctx.resolveAilmentChance(100, 'enemy', bossG, { skipResist: true });
  if (det !== 100) fail(`100% skipResist expected 100, got ${det}`);
  else ok('100% on-land skips boss resist');

  if (!ctx.isDeterministicOnLandChance(100, {})) fail('isDeterministicOnLandChance(100)');
  else ok('isDeterministicOnLandChance(100)');
  if (ctx.isDeterministicOnLandChance(50, {})) fail('50% should not be deterministic');
  else ok('50% not deterministic');

  const resist = ctx.resolveAilmentChance(100, 'enemy', bossG, {});
  if (resist !== 100) fail(`deterministic resolve without skipResist should still be 100, got ${resist}`);
  else ok('resolveAilmentChance(100) ignores resist via deterministicOnLand');

  const fifty = ctx.resolveAilmentChance(50, 'enemy', bossG, {});
  if (fifty !== 30) fail(`50% vs boss resist 20 expected 30, got ${fifty}`);
  else ok('50% still respects boss resist');

  const norm = ctx.Avian?.systems?.abilityRiderParser?.normalizeAilmentId
    || ctx.normalizeAilmentId;
  /* parser may only attach via Avian — call parse path */
  const parseFn = ctx.Avian && ctx.Avian.systems && ctx.Avian.systems.abilityRiderParser;
  if (parseFn && typeof parseFn.normalizeAilmentId === 'function') {
    if (parseFn.normalizeAilmentId('Shock') !== 'shock') fail('Shock → shock');
    else ok('Shock normalizes to shock');
    if (parseFn.normalizeAilmentId('Paralysed') !== 'paralyzed') fail('Paralysed → paralyzed');
    else ok('Paralysed stays paralyzed');
  } else {
    /* Fall back: re-run parser into sandbox with export probe */
    const pctx = { globalThis: {}, console, Math, Number, Object, Array, String };
    pctx.globalThis = pctx;
    vm.runInNewContext(read('js/bootstrap/_namespace.js'), pctx);
    vm.runInNewContext(read('js/systems/ability-rider-parser.js'), pctx);
    const row = {};
    pctx.Avian.systems.abilityRiderParser.parseAilmentFieldsFromText(row, 'On hit, apply 1 Shock stack.');
    if (row.ailment !== 'shock') fail(`parse Shock expected shock, got ${row.ailment}`);
    else ok('parse rider Shock → shock');
  }
}

/* ---- Bundle: Duke kit + weapon scaling ---- */
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');
if (!existsSync(bundlePath)) {
  console.error('missing bundle — run npm run bundle first');
  process.exit(1);
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
const ls = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
})();

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, JSON, Math, Date, Map, Set, Object, Array, Number, String, Boolean, Error,
  document: makeDomStub(),
  location: { hash: '', pathname: '/', href: 'http://localhost/?equipmentV2=1', search: '?equipmentV2=1' },
  navigator: { userAgent: 'node-verify' },
  localStorage: ls, sessionStorage: ls,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  addEventListener: () => {}, removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  fetch: () => Promise.reject(new Error('no fetch')),
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'avian-game.bundle.js', timeout: 30000 });

const Avian = sandbox.Avian;
const eq = Avian.equipment;
if (!Avian.flags?.equipmentV2) fail('equipmentV2 off');
if (typeof sandbox.makeDukeBlakiston !== 'function') fail('makeDukeBlakiston missing');
else {
  sandbox.G = sandbox.G || {};
  sandbox.G.stage = 20;
  sandbox.G.difficulty = 'juvenile';
  sandbox.G.endlessMode = false;
  sandbox.G.player = { birdLevel: 10, birdKey: 'sparrow', class: 'rogue', stats: { atk: 10, def: 10, matk: 5, mdef: 5, dex: 10, spd: 10, hp: 50, maxHp: 50 } };
  if (sandbox.DIFFICULTIES == null) sandbox.DIFFICULTIES = { juvenile: { mult: 1 } };

  const duke = sandbox.makeDukeBlakiston();
  if (duke.aiType === 'boss_duke') fail('Duke should not use legacy boss_duke AI');
  else ok('Duke no longer uses boss_duke AI');
  if (eq.getEnemyClassId(duke) !== 'inquisitor') fail(`Duke class id ${eq.getEnemyClassId(duke)}`);
  else ok('Duke equipment class = inquisitor');

  eq.assignEnemyEquipmentLoadout(duke, { stage: 20, tier: 'boss', variance: false, seed: 2020 });
  const gear = duke.equipment || {};
  if (gear.mainHand !== 'WPN-030') fail(`Duke mainHand expected WPN-030, got ${gear.mainHand}`);
  else ok('Duke orange weapon WPN-030');
  if (gear.armour !== 'ARM-006') fail(`Duke armour expected ARM-006, got ${gear.armour}`);
  else ok('Duke orange armour ARM-006');

  const abs = duke.abilities || [];
  const ids = abs.filter((a) => a && !a.empty).map((a) => a.id);
  if (ids.some((id) => String(id).startsWith('duke'))) fail(`legacy duke skill still present: ${ids.join(',')}`);
  else ok('no legacy duke* skill ids');
  if (!ids.includes('WSK-009') && !ids.includes('WSK-010')) fail(`missing weapon skills, got ${ids.join(',')}`);
  else ok(`Duke weapon skills present (${ids.filter((i) => /^WSK-/.test(i)).join(',')})`);
  if (!ids.includes('ESK-002')) fail(`missing armour skill ESK-002, got ${ids.join(',')}`);
  else ok('Duke armour skill ESK-002');
}

/* Weapon scaling: Dex-only vs Might */
{
  const actions = Avian.equipmentActions;
  const items = Avian.data.equipment.items;
  const dexWpn = Object.values(items).find((it) => it.scalingStat === 'DEX' && it.skill1 && it.minDamage > 0);
  const atkWpn = Object.values(items).find((it) => it.scalingStat === 'ATK' && it.skill1 && it.minDamage > 0);
  const matkWpn = Object.values(items).find((it) => it.scalingStat === 'MATK' && it.skill1 && it.minDamage > 0);
  if (!dexWpn || !atkWpn || !matkWpn) fail('missing sample weapons');
  else {
    function dmgFor(wpn, stats) {
      const row = actions.skillToAbilityRow(wpn.skill1, wpn, wpn.rarity);
      const r = sandbox.calculateDamage({
        attacker: { stats },
        target: { stats: { def: 10, mdef: 10 } },
        ability: row,
        hitSucceeded: true,
        rollWeapon: false,
        battleState: {},
        bonusFractions: [],
      });
      return { damage: r.damage, pre: r.preMitigation, relevant: r.components?.relevantStat, scale: row.scalingStat };
    }
    const highDex = dmgFor(dexWpn, { atk: 5, dex: 40, matk: 5 });
    const highMight = dmgFor(dexWpn, { atk: 40, dex: 5, matk: 5 });
    if (!(highDex.pre > highMight.pre)) fail(`Dex weapon should scale with Dex (${highDex.pre} vs ${highMight.pre})`);
    else ok(`Dex weapon tracks Dex (${dexWpn.id} pre ${highDex.pre} > ${highMight.pre})`);
    if (String(highDex.scale).toUpperCase() !== 'DEX') fail(`Dex weapon scaleStat ${highDex.scale}`);
    else ok('Dex weapon scalingStat=DEX');

    const mightHi = dmgFor(atkWpn, { atk: 40, dex: 5, matk: 5 });
    const mightLo = dmgFor(atkWpn, { atk: 5, dex: 40, matk: 5 });
    if (!(mightHi.pre > mightLo.pre)) fail(`Might weapon should scale with Might`);
    else ok(`Might weapon tracks Might (${atkWpn.id})`);

    const focHi = dmgFor(matkWpn, { atk: 5, dex: 5, matk: 40 });
    const focLo = dmgFor(matkWpn, { atk: 40, dex: 5, matk: 5 });
    if (!(focHi.pre > focLo.pre)) fail(`Focus weapon should scale with Focus`);
    else ok(`Focus weapon tracks Focus (${matkWpn.id})`);

    /* Wrapper must unwrap to weapon-first Dex scaling */
    const row = actions.skillToAbilityRow(dexWpn.skill1, dexWpn, dexWpn.rarity);
    const wrap = { id: row.id, _dispatcherRow: row };
    const viaWrap = sandbox.calculateDamage({
      attacker: { stats: { atk: 5, dex: 40, matk: 5 } },
      target: { stats: { def: 10, mdef: 10 } },
      ability: wrap,
      hitSucceeded: true,
      rollWeapon: false,
      battleState: {},
      bonusFractions: [],
    });
    if (viaWrap.preMitigation !== highDex.pre) fail(`wrapper unwrap mismatch ${viaWrap.preMitigation} vs ${highDex.pre}`);
    else ok('calculateDamage unwraps _dispatcherRow');
  }
}

/* Shock combo wires to shock, not paralyzed */
{
  const actions = Avian.equipmentActions;
  const shock = actions.skillToAbilityRow('COMBO_SHOCK_TALON', null, 'blue');
  if (!shock) fail('COMBO_SHOCK_TALON missing');
  else if (shock.ailment !== 'shock') fail(`COMBO_SHOCK_TALON ailment expected shock, got ${shock.ailment}`);
  else ok('COMBO_SHOCK_TALON applies shock');
  if (Number(shock.ailmentChance) !== 100) fail(`shock combo chance ${shock.ailmentChance}`);
  else ok('shock combo ailmentChance 100');
}

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log('\nOK duke kit / weapon scaling / ailment 100%');
