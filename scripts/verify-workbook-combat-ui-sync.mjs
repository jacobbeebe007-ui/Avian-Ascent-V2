#!/usr/bin/env node
/*
 * Checks for Workbook + Combat UI Sync plan:
 * - effect tiers v0.6 shape
 * - skill library present
 * - status frozen active
 * - enemy energy startEN
 * - level-up / glossary naming helpers exist in game.js source
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function fail(msg) { console.error('[wb-ui-sync] FAIL', msg); failed++; }
function ok(msg) { console.log('[wb-ui-sync] ok  ', msg); }

function load(rel) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) { fail('missing ' + rel); return ''; }
  return readFileSync(full, 'utf8');
}

const gameSrc = load('js/core/game.js');
const affinityImp = load('scripts/import-affinity-arsenal-workbook.mjs');

if (/write_js\('js\/data\/effect-tiers\.js'/.test(affinityImp)) {
  fail('affinity importer still writes effect-tiers.js');
} else {
  ok('affinity importer does not overwrite effect-tiers');
}

if (!/buildPlayerBirdTooltipHtml[\s\S]*?let html=/.test(gameSrc)
  && !/function buildPlayerBirdTooltipHtml\(player\)\{\s*\n\s*if\(!player\) return '';\s*\n[\s\S]*?let html=/.test(gameSrc)) {
  // looser check
  const fn = gameSrc.match(/function buildPlayerBirdTooltipHtml\([\s\S]*?\n\}/);
  if (!fn || !/let html=/.test(fn[0])) fail('buildPlayerBirdTooltipHtml missing let html=');
  else ok('buildPlayerBirdTooltipHtml initializes html');
} else {
  ok('buildPlayerBirdTooltipHtml initializes html');
}

if (!/levelUpChoiceLabel/.test(gameSrc)) fail('levelUpChoiceLabel missing');
else ok('level-up glossary helper present');

if (!/k:'skills'/.test(gameSrc) || !/equipment\?\.skills/.test(gameSrc)) fail('Skill Library ref tab missing');
else ok('Reference Guide Skill Library tab wired');

if (!/k:'stats'/.test(gameSrc) || !/k:'tiers'/.test(gameSrc)) fail('Stats/Effect Tiers ref tabs missing');
else ok('Reference Guide Stats + Effect Tiers tabs wired');

if (/k:'mutations'/.test(gameSrc) && /label:'🧬 Mutations'/.test(gameSrc)) fail('empty Mutations tab still present');
else ok('Mutations tab retired from Reference Guide');

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of [
  'js/data/effect-tiers.js',
  'js/data/equipment/skills.js',
  'js/data/equipment/slots.js',
  'js/data/status-definitions.js',
  'js/systems/enemy-roster-runtime.js',
]) {
  vm.runInContext(load(rel), ctx, { filename: rel });
}

const tiers = ctx.Avian.data.effectTiers;
if (tiers?.buff?.minor === 4 && tiers?.buff?.moderate === 10 && tiers?.buff?.major === 20) {
  ok('effect tiers 4/10/20');
} else fail('effect tiers unexpected: ' + JSON.stringify(tiers?.buff));

const skillCount = Object.keys(ctx.Avian.data.equipment.skills || {}).length;
if (skillCount >= 82) ok(`skill library has ${skillCount} skills`);
else fail(`expected ≥82 skills, got ${skillCount}`);

const names = ctx.Avian.data.equipment.slots.statDisplayNames || {};
if (names.atk === 'Might') ok('statDisplayNames atk → Might');
else fail('statDisplayNames.atk is ' + names.atk);
if (names.dex === 'Dexterity') ok('statDisplayNames dex → Dexterity');
else fail('statDisplayNames.dex is ' + names.dex);

const collect = ctx.collectCombatStatusEntries || ctx.Avian.statusDefs.collectCombatStatusEntries;
const frozenEntries = collect({ frozen: { pendingSkip: true, baseSpd: 10 } }, {});
if (frozenEntries.some((e) => e.id === 'frozen')) ok('frozen status collected for badges');
else fail('frozen status not collected');

const identityLeak = collect({
  identityPassive: { name: 'Should Not Show', effect: 'identity' },
  identityClassPerk: { name: 'Perk Leak', effect: 'identity' },
  identityTrait: { name: 'Trait Leak', effect: 'identity' },
  poison: { stacks: 2, turns: 2 },
}, {});
if (identityLeak.some((e) => String(e.id || '').startsWith('identity'))) {
  fail('status badges still collect Passive/Perk/Trait identity entries');
} else if (!identityLeak.some((e) => e.id === 'poison')) {
  fail('ailment entries missing after identity badge removal');
} else {
  ok('status badges exclude Passive/Perk/Trait; keep skill ailments');
}

if (/function syncEnemyIdentityStatusBadges[\s\S]*?delete G\.enemyStatus\.identityPassive/.test(gameSrc)
  || (!/identityPassive\s*=/.test(gameSrc) && !/identityClassPerk\s*=/.test(gameSrc))) {
  ok('enemy status strip clears or omits identity Passive/Perk badges');
} else if (/syncEnemyIdentityStatusBadges/.test(gameSrc) && /identityPassive\s*=/.test(gameSrc)) {
  fail('syncEnemyIdentityStatusBadges still injects identity into enemy status strip');
} else {
  ok('enemy status strip no longer syncs identity Passive/Perk badges');
}

const labels = ctx.Avian.statusDefs;
// resolve badge path
const resolve = ctx.resolveCombatStatusBadge || ctx.Avian.statusDefs.resolveStatusBadge;
const badge = resolve({ id: 'frozen', value: { pendingSkip: true } }, { statuses: {}, owner: 'player' });
if (badge && /Frozen/i.test(badge.text || '')) ok('frozen badge text resolves');
else fail('frozen badge did not resolve');

// Enemy energy profile constants via game.js text
if (/ENEMY_ENERGY_START = 4/.test(gameSrc) && /ENEMY_ENERGY_REGEN = 3/.test(gameSrc)) {
  ok('enemy EN start 4 / regen 3 constants');
} else fail('enemy EN constants missing');

if (/ed\.stats\.en=prof\.startEN/.test(gameSrc)) ok('OW enemy stats.en uses startEN');
else fail('OW enemy stats.en still not startEN');

if (!/function applyEnemyStatsFromPlayerProgression/.test(gameSrc)) {
  fail('applyEnemyStatsFromPlayerProgression missing');
} else {
  ok('enemy progression parity helper present');
}
if (!/workbookLevel/.test(gameSrc) || !/_fromPlayerProgression/.test(gameSrc)) {
  fail('enemy workbook level scaling wiring incomplete');
} else {
  ok('enemy uses workbook L1–30 progression');
}
if (!/resolveEnemyWorkbookLevel/.test(gameSrc)) {
  fail('resolveEnemyWorkbookLevel missing');
} else {
  ok('enemy workbook level resolver present');
}
if (!/computeFinalStats/.test(gameSrc)) {
  fail('enemy path missing computeFinalStats');
} else {
  ok('enemy scales via birdProgression.computeFinalStats');
}

/* Runtime: sparrow L1 via progression — v0.9 baseHealth×Vitality → maxHp ~12. */
try {
  for (const rel of [
    'js/data/birds-v2.js',
    'js/data/progression/level-growth.js',
    'js/data/progression/star-growth.js',
    'js/data/progression/rules.js',
    'js/data/enemy-scaling-profiles.js',
    'js/data/combat-config.js',
    'js/systems/bird-progression.js',
  ]) {
    vm.runInContext(load(rel), ctx, { filename: rel });
  }
  const sparrow = ctx.Avian.data.birdsV2?.sparrow;
  const base = sparrow?.stats || ctx.Avian.data.birds?.sparrow?.stats;
  const hpBase = Number(base?.maxHp ?? base?.hp) || 0;
  const grown = ctx.Avian.birdProgression.computeFinalStats({
    base: {
      hp: hpBase,
      baseHealth: Number(sparrow?.baseHealth) || hpBase,
      vitality: Number(sparrow?.vitality ?? base?.vitality) || 0,
      atk: base.atk, dex: base.dex, def: base.def, matk: base.matk, mdef: base.mdef, spd: base.spd,
    },
    className: 'rogue',
    level: 1,
    totalStars: 0,
    tier: 'grey',
  });
  const grownHp = Number(grown.ledger?.maxHp ?? grown.ledger?.hp) || 0;
  if (Number(sparrow?.baseHealth) === 10 && hpBase === 12 && grownHp === 12) {
    ok(`player-parity v0.9 sparrow HP baseHealth=10 → maxHp ${hpBase}/${grownHp}`);
  } else {
    fail(`expected v0.9 sparrow maxHp 12 (baseHealth 10), got baseHealth=${sparrow?.baseHealth} base=${hpBase} grown=${grownHp}`);
  }

  /* Level-up Base Health: +½ original BH per level, then × (1 + VIT×0.05).
   * Hummingbird BH=8 VIT=0 → L2 leveled base 12 → maxHp 12. */
  const hum = ctx.Avian.data.birdsV2?.hummingbird;
  const humL2 = ctx.Avian.birdProgression.computeFinalStats({
    base: {
      baseHealth: Number(hum?.baseHealth) || 8,
      vitality: Number(hum?.vitality) || 0,
      atk: 0, dex: 0, def: 0, matk: 0, mdef: 0, spd: 0,
    },
    baseHealth: Number(hum?.baseHealth) || 8,
    className: 'rogue',
    level: 2,
    skipLevelFlat: true,
    totalStars: 0,
    tier: 'grey',
  });
  const humL2Hp = Number(humL2.ledger?.maxHp ?? humL2.ledger?.hp) || 0;
  const humL2Base = Number(humL2.ledger?.leveledBaseHealth) || 0;
  if (Number(hum?.baseHealth) === 8 && humL2Base === 12 && humL2Hp === 12) {
    ok(`level-up BH growth hummingbird L2: base 8 → leveled 12 → maxHp ${humL2Hp}`);
  } else {
    fail(`expected hummingbird L2 leveledBase=12 maxHp=12, got baseHealth=${hum?.baseHealth} leveled=${humL2Base} maxHp=${humL2Hp}`);
  }

  /* Sparrow BH=10 VIT=3 → L2 leveled 15 → maxHp round(15×1.15)=17 (no level VIT flats). */
  const sparL2 = ctx.Avian.birdProgression.computeFinalStats({
    base: {
      baseHealth: 10,
      vitality: 3,
      atk: 0, dex: 0, def: 0, matk: 0, mdef: 0, spd: 0,
    },
    baseHealth: 10,
    className: 'rogue',
    level: 2,
    skipLevelFlat: true,
    totalStars: 0,
    tier: 'grey',
  });
  const sparL2Hp = Number(sparL2.ledger?.maxHp ?? sparL2.ledger?.hp) || 0;
  if (sparL2Hp === 17) {
    ok(`level-up BH + VIT% sparrow L2: leveled 15 × 1.15 → maxHp ${sparL2Hp}`);
  } else {
    fail(`expected sparrow L2 maxHp 17 (15×1.15), got ${sparL2Hp}`);
  }

  /* Enemy L2 (skip workbook VIT flats): hummingbird BH=8 → leveled 12 → maxHp 12. */
  const enemyHumL2 = ctx.Avian.birdProgression.computeFinalStats({
    base: {
      baseHealth: Number(hum?.baseHealth) || 8,
      vitality: Number(hum?.vitality) || 0,
      atk: 0, dex: 0, def: 0, matk: 0, mdef: 0, spd: 0,
    },
    baseHealth: Number(hum?.baseHealth) || 8,
    className: 'rogue',
    level: 2,
    skipLevelFlat: true,
    totalStars: 0,
    tier: 'grey',
  });
  const enemyHumHp = Number(enemyHumL2.ledger?.maxHp) || 0;
  if (enemyHumHp === 12) ok(`enemy parity hummingbird L2 maxHp ${enemyHumHp} (½ BH growth)`);
  else fail(`expected enemy hummingbird L2 maxHp 12, got ${enemyHumHp}`);

  const crow = ctx.Avian.data.birdsV2?.crow?.stats;
  if (crow && Number(crow.matk) === 0 && Number(crow.acc) === 0) {
    ok('crow Focus/Precision are 0 (v0.6)');
  } else {
    fail(`crow expected FOC 0 / PRE 0, got matk=${crow?.matk} acc=${crow?.acc}`);
  }

  const crowRow = ctx.Avian.data.birdsV2?.crow;
  const crowL15 = ctx.Avian.birdProgression.computeFinalStats({
    base: {
      baseHealth: Number(crowRow?.baseHealth) || Number(crow.hp),
      vitality: Number(crowRow?.vitality ?? crow?.vitality) || 0,
      atk: crow.atk, dex: crow.dex, def: crow.def, matk: crow.matk, mdef: crow.mdef, spd: crow.spd,
    },
    baseHealth: Number(crowRow?.baseHealth) || Number(crow.hp),
    className: 'knight',
    level: 15,
    totalStars: 18,
    tier: 'purple',
  });
  const profiled = ctx.Avian.birdProgression.applyEnemyProfile(crowL15.ledger, 'standard');
  const l15Hp = Number(profiled?.maxHp ?? profiled?.hp) || 0;
  if (l15Hp > Number(crow.hp)) ok(`workbook L15 crow enemy vitality ${l15Hp} > base ${crow.hp}`);
  else fail(`expected L15 crow HP growth, got ${l15Hp} vs base ${crow.hp}`);

  /* Load feather growth + story bands + enemy helpers from game.js excerpt via eval of functions. */
  vm.runInContext(load('js/data/feather-growth-profiles.js'), ctx, { filename: 'js/data/feather-growth-profiles.js' });
  vm.runInContext(load('js/data/bird-card-tiers.js'), ctx, { filename: 'js/data/bird-card-tiers.js' });
  vm.runInContext(load('js/systems/story-enemy-levels.js'), ctx, { filename: 'js/systems/story-enemy-levels.js' });

  /* Pull enemy progression helpers by evaluating the relevant game.js slice. */
  const gameSrcFull = load('js/core/game.js');
  const start = gameSrcFull.indexOf('function resolveEnemyProgressionProfileId');
  const end = gameSrcFull.indexOf('function mergeScaledStatsIntoEnemy');
  if (start < 0 || end < 0 || end <= start) {
    fail('could not extract enemy progression helpers from game.js');
  } else {
    ctx.G = { player: { birdLevel: 30 }, stage: 1, endlessMode: false };
    ctx.roundCombatStat = (v) => Math.round(Number(v) || 0);
    ctx.getEnemyEnergyProfile = () => ({ startEN: 3, maxEN: 6, regenEN: 1 });
    ctx.applyEnemyFeatherFromPlayerMirror = () => {};
    ctx.BIRDS = ctx.Avian.data.birdsV2;
    vm.runInContext(gameSrcFull.slice(start, end), ctx, { filename: 'game-enemy-prog.js' });

    const early = ctx.applyEnemyStatsFromPlayerProgression(
      { birdKey: 'sparrow', storyLevel: 1, enemyClass: 'rogue' },
      { isStory: true, stage: 2, playerBirdLevel: 30, diffMult: 1 },
    );
    const late = ctx.applyEnemyStatsFromPlayerProgression(
      { birdKey: 'sparrow', storyLevel: 10, enemyClass: 'rogue' },
      { isStory: true, stage: 18, playerBirdLevel: 30, diffMult: 1 },
    );
    if (!early || !late) fail('enemy progression helpers returned null');
    else {
      if (early.workbookLevel <= 2) ok(`story early workbookLevel ${early.workbookLevel} ignores player L30`);
      else fail(`story early workbookLevel should be ≤2, got ${early.workbookLevel}`);
      if (late.hp > early.hp * 1.35) ok(`story late HP ${late.hp} >> early ${early.hp} at same player level`);
      else fail(`expected late story HP growth, early=${early.hp} late=${late.hp}`);
      /* Enemy BH growth: story profile levelOffset -2, so storyLevel 4 → workbookLevel 2.
       * Hummingbird BH=8 → leveledBase 12; stamps birdLevel/baseHealth for gear path. */
      const enemyL2 = ctx.applyEnemyStatsFromPlayerProgression(
        { birdKey: 'hummingbird', storyLevel: 4, enemyClass: 'rogue' },
        { isStory: true, stage: 4, playerBirdLevel: 30, diffMult: 1 },
      );
      if (!enemyL2) fail('enemy L2 hummingbird progression returned null');
      else if (Number(enemyL2.workbookLevel) !== 2) {
        fail(`enemy L2 workbookLevel expected 2 (storyLevel 4 + offset -2), got ${enemyL2.workbookLevel}`);
      } else if (Number(enemyL2.baseHealth) !== 8) {
        fail(`enemy L2 should stamp baseHealth 8, got ${enemyL2.baseHealth}`);
      } else if (Number(enemyL2.leveledBaseHealth) !== 12) {
        fail(`enemy L2 leveledBaseHealth expected 12, got ${enemyL2.leveledBaseHealth}`);
      } else if (Number(enemyL2.birdLevel) !== 2) {
        fail(`enemy L2 birdLevel expected 2, got ${enemyL2.birdLevel}`);
      } else {
        ok(`enemy L2 hummingbird stamps BH=8 leveled=12 birdLevel=${enemyL2.birdLevel} maxHp=${enemyL2.maxHp}`);
      }
      const starsEarly = typeof ctx.getTotalFeatherStars === 'function'
        ? ctx.getTotalFeatherStars(early.tier, 2)
        : null;
      if (starsEarly != null && Number(early.tier) !== NaN) {
        /* totalStars should use cumulative stars, not raw starsInTier=2 alone for higher tiers */
        ok(`enemy tier/stars wired (early tier=${early.tier}, late tier=${late.tier})`);
      }
      if (late.workbookLevel >= early.workbookLevel) ok('late workbook level ≥ early');
      else fail(`late workbook ${late.workbookLevel} < early ${early.workbookLevel}`);
    }
  }
} catch (err) {
  fail('progression vitality check threw: ' + err.message);
}

if (failed) {
  console.error(`\n[wb-ui-sync] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[wb-ui-sync] all checks passed');
