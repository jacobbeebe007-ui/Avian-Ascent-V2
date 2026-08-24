/**
 * E2E: Build Nest opens World Creator library (not a black screen).
 * Run: BASE_URL=http://127.0.0.1:8000 node scripts/test-build-nest-open.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof globalThis.openMapForge === 'function', null, { timeout: 15000 });

  await page.evaluate(() => {
    localStorage.setItem('avian_buildnest_unlocked', '1');
    if (typeof syncBuildNestUnlockUI === 'function') syncBuildNestUnlockUI();
  });

  const beforeOpen = await page.evaluate(() => {
    const screen = document.getElementById('screen-map-forge');
    const lib = document.getElementById('map-forge-library');
    const ws = document.getElementById('map-forge-workspace');
    return {
      screenActive: screen?.classList.contains('active'),
      libOpen: lib?.classList.contains('is-open'),
      wsHidden: ws?.classList.contains('is-hidden'),
      libDisplay: lib ? getComputedStyle(lib).display : null,
      wsDisplay: ws ? getComputedStyle(ws).display : null,
      libText: (lib?.textContent || '').trim().slice(0, 80),
    };
  });

  await page.evaluate(async () => {
    await globalThis.openMapForge();
  });

  await page.waitForTimeout(300);

  const afterOpen = await page.evaluate(() => {
    const screen = document.getElementById('screen-map-forge');
    const lib = document.getElementById('map-forge-library');
    const ws = document.getElementById('map-forge-workspace');
    const libRect = lib?.getBoundingClientRect();
    return {
      screenActive: screen?.classList.contains('active'),
      isLibrary: screen?.classList.contains('is-library'),
      libOpen: lib?.classList.contains('is-open'),
      wsHidden: ws?.classList.contains('is-hidden'),
      libDisplay: lib ? getComputedStyle(lib).display : null,
      wsDisplay: ws ? getComputedStyle(ws).display : null,
      libHeight: libRect?.height || 0,
      hasWorldCreatorTitle: (lib?.textContent || '').includes('World Creator'),
      hasNewWorld: (lib?.textContent || '').includes('New world'),
    };
  });

  await page.screenshot({ path: path.join(ROOT, 'scripts', '_build-nest-open.png'), fullPage: true });

  let failed = 0;
  function ok(label, cond) {
    if (cond) console.log('[ok]  ', label);
    else {
      console.error('[FAIL]', label);
      failed++;
    }
  }

  ok('bundle loaded openMapForge', true);
  ok('screen-map-forge active after open', afterOpen.screenActive);
  ok('library has is-open', afterOpen.libOpen);
  ok('library display not none', afterOpen.libDisplay !== 'none');
  ok('library has visible height', afterOpen.libHeight > 100);
  ok('World Creator title rendered', afterOpen.hasWorldCreatorTitle);
  ok('New world section rendered', afterOpen.hasNewWorld);
  ok('workspace hidden while in library', afterOpen.wsHidden || afterOpen.wsDisplay === 'none');

  if (errors.length) {
    console.error('[FAIL] page errors:', errors.slice(0, 5).join(' | '));
    failed++;
  }

  console.log('beforeOpen', JSON.stringify(beforeOpen));
  console.log('afterOpen', JSON.stringify(afterOpen));

  await browser.close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
