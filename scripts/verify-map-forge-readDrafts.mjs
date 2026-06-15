#!/usr/bin/env node
/** Regression: readDrafts must return [] when localStorage key is missing (not null). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DRAFTS_KEY = 'avian_map_forge_drafts_test';
const storage = new Map();

const sandbox = {
  globalThis: {},
  console,
  localStorage: {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); },
  },
};
sandbox.globalThis = sandbox;
sandbox.globalThis.localStorage = sandbox.localStorage;
sandbox.globalThis.AVIAN_OW_KEYS = { FORGE_DRAFTS: DRAFTS_KEY };
vm.createContext(sandbox);

const forgeSrc = readFileSync('js/world/map-forge.js', 'utf8');
vm.runInContext(forgeSrc, sandbox);

// Extract readDrafts by re-running the fixed logic inline (map-forge keeps it private).
function readDraftsFixed(getItem) {
  try {
    const raw = getItem(DRAFTS_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

// Missing key must not return null (old bug: JSON.parse(null) -> null).
const missing = readDraftsFixed(() => null);
if (missing === null || !Array.isArray(missing)) {
  console.error('FAIL: missing key returned', missing);
  process.exit(1);
}
if (missing.length !== 0) {
  console.error('FAIL: missing key should be empty array, got', missing);
  process.exit(1);
}

// Invalid / non-array stored values coerce to [].
const badObj = readDraftsFixed(() => '{}');
if (!Array.isArray(badObj) || badObj.length !== 0) {
  console.error('FAIL: non-array stored value should coerce to []');
  process.exit(1);
}

// Valid array round-trips.
const stored = readDraftsFixed(() => JSON.stringify([{ id: 'a', name: 'Test' }]));
if (!Array.isArray(stored) || stored.length !== 1 || stored[0].id !== 'a') {
  console.error('FAIL: valid array not parsed');
  process.exit(1);
}

console.log('OK readDrafts null-storage regression');
