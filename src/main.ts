import { AILMENTS } from './data/ailments.js';

/** Legacy concatenated shell expects bare `AILMENTS`; mirror onto globalThis before loading classic bundle. */
Object.assign(globalThis, { AILMENTS });

const legacySrc = import.meta.env.DEV
  ? '/__avian_legacy_game.js'
  : `${import.meta.env.BASE_URL}assets/avian-game.js`;

const s = document.createElement('script');
s.async = false;
s.src = legacySrc;
document.body.appendChild(s);
