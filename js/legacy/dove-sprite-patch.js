/* Avian Ascent — Dove enemy sprite patch (Step 7 Phase 9 legacy). */
(function () {
  'use strict';

  const _oldRenderBirdIconHTML = globalThis.renderBirdIconHTML;
  if (typeof _oldRenderBirdIconHTML === 'function') {
    globalThis.renderBirdIconHTML = function (birdKey, sizeClass, locked, faceLeft) {
      const k = String(birdKey || '').toLowerCase().replace(/[^a-z]/g, '');
      if (k === 'dove') {
        const html = `<div class="sprite4 ${sizeClass || ''} sprite-dove frame-0 ${locked ? 'locked' : ''}"></div>`;
        return faceLeft ? wrapSpriteFaceLeft(html) : html;
      }
      return _oldRenderBirdIconHTML.apply(this, arguments);
    };
  }

  function patchDoveEnemy() {
    try {
      if (Array.isArray(globalThis.ENEMIES)) {
        const dove = globalThis.ENEMIES.find((e) => String(e?.name || '').toLowerCase() === 'dove');
        if (dove) {
          dove.portraitKey = 'dove';
          dove.emoji = '🕊️';
          if (dove.stats) dove.stats.dodge = dove.stats.dodge || 10;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (typeof queueMicrotask === 'function') queueMicrotask(patchDoveEnemy);
  else if (typeof Promise !== 'undefined' && typeof Promise.resolve === 'function') Promise.resolve().then(patchDoveEnemy);
  else setTimeout(patchDoveEnemy, 0);
})();
