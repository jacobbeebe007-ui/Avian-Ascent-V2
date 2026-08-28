/* War Room tutorial modal — tabbed onboarding shown on first War Room visit. */
const WARROOM_TUTORIAL_LS_KEY = 'avian_warroom_tutorial_dismissed';

function isWarRoomTutorialDismissed() {
  try {
    return localStorage.getItem(WARROOM_TUTORIAL_LS_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function setWarRoomTutorialDismissed(dismissed) {
  try {
    if (dismissed) localStorage.setItem(WARROOM_TUTORIAL_LS_KEY, '1');
    else localStorage.removeItem(WARROOM_TUTORIAL_LS_KEY);
  } catch (_) { /* noop */ }
}

function resetWarRoomTutorialDismissCheckbox() {
  const cb = document.getElementById('warroom-tutorial-dismiss');
  if (cb) cb.checked = false;
}

function openWarRoomTutorial() {
  const m = document.getElementById('warroom-tutorial-modal');
  if (!m) return;
  resetWarRoomTutorialDismissCheckbox();
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const activeTab = m.querySelector('.warroom-tutorial-tab.active');
  if (activeTab) activeTab.focus({ preventScroll: true });
}

function closeWarRoomTutorial() {
  const m = document.getElementById('warroom-tutorial-modal');
  if (!m) return;
  const dismiss = document.getElementById('warroom-tutorial-dismiss')?.checked;
  if (dismiss) setWarRoomTutorialDismissed(true);
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  try {
    const settingsStillOpen = document.getElementById('settings-modal')?.classList.contains('open');
    if (!settingsStillOpen && typeof globalThis.notifyOwUiEmbedClose === 'function') globalThis.notifyOwUiEmbedClose();
  } catch (_) { /* noop */ }
}

function selectWarRoomTutorialTab(ev) {
  const btn = ev?.target?.closest?.('[data-warroom-tutorial-tab]');
  if (!btn) return;
  const tab = btn.dataset.warroomTutorialTab;
  document.querySelectorAll('.warroom-tutorial-tab').forEach((t) => {
    const on = t === btn || t.dataset.warroomTutorialTab === tab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-warroom-tutorial-panel]').forEach((p) => {
    const on = p.dataset.warroomTutorialPanel === tab;
    p.classList.toggle('active', on);
    p.hidden = !on;
  });
}

function maybeShowWarRoomTutorial() {
  if (isWarRoomTutorialDismissed()) return;
  const screen = document.getElementById('screen-select');
  if (!screen?.classList.contains('active')) return;
  if (document.getElementById('warroom-tutorial-modal')?.classList.contains('open')) return;
  openWarRoomTutorial();
}

globalThis.openWarRoomTutorial = openWarRoomTutorial;
globalThis.closeWarRoomTutorial = closeWarRoomTutorial;
globalThis.selectWarRoomTutorialTab = selectWarRoomTutorialTab;
globalThis.maybeShowWarRoomTutorial = maybeShowWarRoomTutorial;

(function registerWarRoomTutorialActions() {
  const Avian = globalThis.Avian || (globalThis.Avian = { actions: {}, debug: {} });
  if (!Avian.actions) Avian.actions = Object.create(null);
  Avian.actions.openWarRoomTutorial = openWarRoomTutorial;
  Avian.actions.closeWarRoomTutorial = closeWarRoomTutorial;
  Avian.actions.selectWarRoomTutorialTab = selectWarRoomTutorialTab;
})();
