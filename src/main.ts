import { AILMENTS } from './data/ailments.js';

/** Block clicks until classic shell runs — inline onclick resolves on window after legacy executes. */
document.documentElement.style.pointerEvents = 'none';

/** Legacy concatenated shell expects bare `AILMENTS`; mirror onto globalThis before loading classic bundle. */
Object.assign(globalThis, { AILMENTS });

const legacySrc = import.meta.env.DEV
  ? '/__avian_legacy_game.js'
  : `${import.meta.env.BASE_URL}assets/avian-game.js`;

await new Promise<void>((resolve, reject) => {
  const s = document.createElement('script');
  s.async = false;
  s.src = legacySrc;
  s.onload = () => resolve();
  s.onerror = () =>
    reject(
      new Error(
        `Avian Ascent: failed to load game shell (${legacySrc}). Run npm run dev or serve dist/ after npm run build.`,
      ),
    );
  document.body.appendChild(s);
}).finally(() => {
  document.documentElement.style.pointerEvents = '';
});

/** Title splash (#screen-start): wire after legacy defines takeFlightToSelect — avoids inline onclick + global race. */
const takeFlightBtn = document.getElementById('take-flight-btn');
if (takeFlightBtn) {
  if (typeof globalThis.takeFlightToSelect === 'function') {
    takeFlightBtn.addEventListener('click', () => {
      globalThis.takeFlightToSelect();
    });
  } else {
    console.warn('[Avian Ascent] takeFlightToSelect missing after shell load.');
  }
}
