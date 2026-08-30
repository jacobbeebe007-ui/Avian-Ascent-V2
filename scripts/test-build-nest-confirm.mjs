/**
 * E2E: Build Nest library confirm + enter-map buttons.
 * Run: BASE_URL=http://127.0.0.1:5173 node scripts/test-build-nest-confirm.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof globalThis.openMapForge === 'function', null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem('avian_buildnest_unlocked', '1');
    if (typeof syncBuildNestUnlockUI === 'function') syncBuildNestUnlockUI();
  });
  await page.evaluate(async () => { await globalThis.openMapForge(); });
  await page.waitForSelector('[data-forge-template="linear5"]', { timeout: 10000 });

  let failed = 0;
  function ok(label, cond) {
    if (cond) console.log('[ok]  ', label);
    else {
      console.error('[FAIL]', label);
      failed++;
    }
  }

  const confirmBtn = page.locator('[data-action="confirmMapForgeLibrary"]');
  ok('Confirm starts disabled', await confirmBtn.isDisabled());

  await page.locator('[data-forge-template="linear5"]').click();
  await page.waitForTimeout(150);
  ok('Selecting template enables Create world', (await confirmBtn.textContent() || '').includes('Create world'));
  ok('Confirm enabled after select', await confirmBtn.isEnabled());

  await confirmBtn.click();
  await page.waitForTimeout(400);
  const afterConfirm = await page.evaluate(() => {
    const screen = document.getElementById('screen-map-forge');
    const lib = document.getElementById('map-forge-library');
    const ws = document.getElementById('map-forge-workspace');
    const modal = document.getElementById('map-forge-unsaved-modal');
    return {
      isLibrary: screen?.classList.contains('is-library'),
      libOpen: lib?.classList.contains('is-open'),
      wsHidden: ws?.classList.contains('is-hidden'),
      wsDisplay: ws ? getComputedStyle(ws).display : null,
      name: document.getElementById('map-forge-name')?.value || '',
      modalOpen: !!(modal && (modal.classList.contains('open') || modal.classList.contains('active'))),
      modalDisplay: modal ? getComputedStyle(modal).display : null,
    };
  });
  ok('Confirm opens workspace', afterConfirm.wsDisplay !== 'none' && !afterConfirm.isLibrary);
  ok('Confirm did not leave an invisible discard modal', !afterConfirm.modalOpen || afterConfirm.modalDisplay === 'none');
  ok('Linear template loaded', /linear/i.test(afterConfirm.name));

  await page.locator('[data-action="openMapForgeLibrary"]').click();
  const unsavedModal = page.locator('#map-forge-unsaved-modal.open, #map-forge-unsaved-modal.active');
  const unsavedVisible = await unsavedModal.isVisible().catch(() => false);
  ok('Library from dirty workspace shows discard modal', unsavedVisible);
  if (unsavedVisible) {
    await page.locator('#map-forge-unsaved-modal [data-action="confirmMapForgeDiscard"]').click();
  }
  await page.waitForSelector('[data-forge-template="hub2"]', { state: 'visible', timeout: 8000 });
  await page.locator('[data-forge-create-template="hub2"]').click();
  await page.waitForTimeout(400);
  const hub = await page.evaluate(() => {
    const api = globalThis.__mapForgeTestApi;
    const state = api?.getState?.() || {};
    const world = (state.nodes || []).find((n) => n.job === 'world');
    if (world && api.selectNode) api.selectNode(world.id);
    const after = api?.getState?.() || {};
    const enter = document.getElementById('map-forge-edit-world-btn');
    const sideEnter = document.getElementById('map-forge-sidebar-enter-world');
    return {
      name: document.getElementById('map-forge-name')?.value || '',
      worldId: world?.id ?? null,
      enterVisible: !!(enter && enter.style.display !== 'none'),
      sideEnterVisible: !!(sideEnter && sideEnter.style.display !== 'none'),
      enterWorldVisible: after.enterWorldVisible,
    };
  });
  ok('Hub template loaded via Create', /hub/i.test(hub.name));
  ok('Selecting map gate shows header Enter this map', hub.enterVisible);
  ok('Selecting map gate shows sidebar Enter this map', hub.sideEnterVisible);

  await page.locator('#map-forge-edit-world-btn').click();
  await page.waitForTimeout(250);
  const inside = await page.evaluate(() => globalThis.__mapForgeTestApi?.getState?.() || {});
  ok('Enter this map leaves main', inside.editContext && inside.editContext !== 'main');
  ok('Exit button visible inside nested map', inside.exitWorldVisible === true);

  await page.locator('#map-forge-world-back').click();
  await page.waitForTimeout(250);
  const back = await page.evaluate(() => globalThis.__mapForgeTestApi?.getState?.() || {});
  ok('Exit returns to main map', back.editContext === 'main');

  if (errors.length) {
    console.error('[FAIL] page errors:', errors.slice(0, 4).join(' | '));
    failed++;
  }

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nBuild Nest confirm E2E passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
