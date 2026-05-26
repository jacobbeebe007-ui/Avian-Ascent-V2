/**
 * E2E smoke: overworld stage 1 → battle handoff
 * Run: node scripts/test-ow-handoff.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  // Simulate fresh run save + overworld nav intent (stage 1 barn gate)
  await page.evaluate(() => {
    const save = {
      savedAt: Date.now(),
      stage: 1,
      endlessMode: false,
      player: {
        birdKey: 'sparrow',
        name: 'Test Sparrow',
        birdLevel: 1,
        class: 'striker',
        stats: { hp: 30, maxHp: 30, atk: 8, def: 4, spd: 10, acc: 85, dodge: 8, matk: 6, mdef: 4 },
        abilities: [],
        abilityInventory: [],
        endlessRewards: [],
        familyEvolutionState: { skillSlots: [] },
        _appliedClassPerkIds: {},
      },
      overworldProgress: { completedStage: 0, nodeClears: {}, worldsCompleted: {} },
      inBattle: false,
      difficulty: 'juvenile',
      codex: { abilities: {}, enemies: {}, birds: {}, artifacts: {}, statuses: {} },
      shinyObjects: 0,
      ui: { gameMode: 'story', selectionView: 'all', lockFilter: 'all' },
    };
    localStorage.setItem('avianAscent_save_v2', JSON.stringify(save));
    localStorage.setItem('avianAscent_overworld', JSON.stringify({ v: 1, active: true }));
    localStorage.setItem('avianAscent_nav', JSON.stringify({
      action: 'battle',
      nodeId: 1,
      stage: 1,
      terrain: '',
      mapId: 'main',
      nodeKey: 'main:1',
      encounter: {
        enemyCount: 3,
        slots: [
          { birdKey: 'random', mutationBand: 'grey_green', maxMutations: 1 },
          { birdKey: 'random', mutationBand: 'grey_green', maxMutations: 1 },
          { birdKey: 'random', mutationBand: 'grey_green', maxMutations: 1 },
        ],
      },
      isBonus: false,
      isWorldInterior: false,
      powerTier: 0,
    }));
  });

  await page.evaluate(() => {
    window.__handoffErrors = [];
    const orig = window.pushErrorHUD;
    if (orig) {
      window.pushErrorHUD = function (kind, msg, meta) {
        window.__handoffErrors.push({ kind, msg, stack: meta?.stack || (meta instanceof Error ? meta.stack : '') });
        return orig.apply(this, arguments);
      };
    }
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const active = document.querySelector('.screen.active')?.id || null;
    const hud = (window.__errorHudItems || []).slice?.(0, 5);
    return {
      active,
      hasEnemy: !!window.G?.enemy,
      enemyName: window.G?.enemy?.name || null,
      owStageEnemies: window.G?._owStageEnemies || null,
      pushErrorHUD: typeof window.pushErrorHUD,
      handoffErrors: window.__handoffErrors || [],
    };
  });

  console.log('Active screen:', state.active);
  console.log('Enemy:', state.enemyName, 'hasEnemy:', state.hasEnemy);
  console.log('owStageEnemies:', state.owStageEnemies);
  if (state.handoffErrors.length) {
    console.log('Handoff HUD errors:');
    state.handoffErrors.forEach((e) => console.log(' ', e.kind + ':', e.msg, e.stack?.slice?.(0, 200)));
  }
  if (errors.length) {
    console.log('Errors captured:');
    errors.slice(0, 10).forEach((e) => console.log(' ', e));
  }

  await browser.close();

  if (state.active !== 'screen-battle') {
    console.error('FAIL: expected screen-battle, got', state.active);
    process.exit(1);
  }
  if (!state.hasEnemy) {
    console.error('FAIL: no G.enemy after handoff');
    process.exit(1);
  }
  console.log('PASS: overworld handoff reached battle');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
