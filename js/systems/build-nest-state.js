/* Avian Ascent — Build Nest unlock gate (Step 7 Phase 4). */
function isBuildNestUnlocked() {
  try { return localStorage.getItem('avian_buildnest_unlocked') === '1'; } catch(_) { return false; }
}
function syncBuildNestUnlockUI() {
  document.body.classList.toggle('build-nest-unlocked', isBuildNestUnlocked());
}
globalThis.isBuildNestUnlocked = isBuildNestUnlocked;
globalThis.syncBuildNestUnlockUI = syncBuildNestUnlockUI;
