/**
 * IndexedDB storage for Map Forge drafts and active custom/playtest maps.
 * Avoids localStorage quota errors from large base64 background payloads.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'avian_map_forge';
  const DB_VERSION = 1;
  const STORE_DRAFTS = 'drafts';
  const STORE_ACTIVE = 'activeMap';
  const ACTIVE_KEY = 'current';

  const KEYS = global.AVIAN_OW_KEYS || {};
  const LEGACY_DRAFTS_KEY = KEYS.FORGE_DRAFTS || 'avian_map_forge_drafts';
  const LEGACY_ACTIVE_KEY = KEYS.CUSTOM_MAP || 'avian_map_forge_active_map';

  let _dbPromise = null;
  let _migrationPromise = null;

  function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_ACTIVE)) db.createObjectStore(STORE_ACTIVE);
      };
    });
    return _dbPromise;
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }

  function reqResult(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
    });
  }

  async function idbGetAllDrafts(db) {
    const tx = db.transaction(STORE_DRAFTS, 'readonly');
    const store = tx.objectStore(STORE_DRAFTS);
    const rows = await reqResult(store.getAll());
    await txDone(tx);
    return Array.isArray(rows) ? rows : [];
  }

  async function idbPutDraft(db, map) {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).put(map);
    await txDone(tx);
  }

  async function idbDeleteDraft(db, id) {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).delete(String(id || ''));
    await txDone(tx);
  }

  async function idbGetActive(db) {
    const tx = db.transaction(STORE_ACTIVE, 'readonly');
    const row = await reqResult(tx.objectStore(STORE_ACTIVE).get(ACTIVE_KEY));
    await txDone(tx);
    return row || null;
  }

  async function idbPutActive(db, map) {
    const tx = db.transaction(STORE_ACTIVE, 'readwrite');
    tx.objectStore(STORE_ACTIVE).put(map, ACTIVE_KEY);
    await txDone(tx);
  }

  async function idbClearActive(db) {
    const tx = db.transaction(STORE_ACTIVE, 'readwrite');
    tx.objectStore(STORE_ACTIVE).delete(ACTIVE_KEY);
    await txDone(tx);
  }

  function readLegacyDrafts() {
    try {
      const raw = global.localStorage.getItem(LEGACY_DRAFTS_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function readLegacyActiveMap() {
    try {
      const raw = global.localStorage.getItem(LEGACY_ACTIVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.nodes) || !parsed.nodes.length) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function clearLegacyStorage() {
    try {
      global.localStorage.removeItem(LEGACY_DRAFTS_KEY);
      global.localStorage.removeItem(LEGACY_ACTIVE_KEY);
    } catch (_) {}
  }

  /** One-time migration from localStorage to IndexedDB. */
  global.migrateMapForgeStorageAsync = async function () {
    if (_migrationPromise) return _migrationPromise;
    _migrationPromise = (async () => {
      let db;
      try {
        db = await openDb();
      } catch (_) {
        return false;
      }

      const legacyDrafts = readLegacyDrafts();
      const legacyActive = readLegacyActiveMap();
      if (!legacyDrafts.length && !legacyActive) return true;

      const existing = await idbGetAllDrafts(db);
      if (!existing.length && legacyDrafts.length) {
        for (const draft of legacyDrafts) {
          if (draft && draft.id) await idbPutDraft(db, draft);
        }
      }
      if (legacyActive) {
        const cur = await idbGetActive(db);
        if (!cur) await idbPutActive(db, legacyActive);
      }
      clearLegacyStorage();
      return true;
    })();
    return _migrationPromise;
  };

  global.readForgeDraftsAsync = async function () {
    try {
      await global.migrateMapForgeStorageAsync();
      const db = await openDb();
      return await idbGetAllDrafts(db);
    } catch (_) {
      return readLegacyDrafts();
    }
  };

  global.writeForgeDraftAsync = async function (map) {
    if (!map || !map.id) return false;
    await global.migrateMapForgeStorageAsync();
    try {
      const db = await openDb();
      await idbPutDraft(db, map);
      return true;
    } catch (_) {
      return false;
    }
  };

  global.deleteForgeDraftAsync = async function (id) {
    if (!id) return false;
    await global.migrateMapForgeStorageAsync();
    try {
      const db = await openDb();
      await idbDeleteDraft(db, id);
      return true;
    } catch (_) {
      return false;
    }
  };

  global.persistCustomOverworldMapAsync = async function (mapDef) {
    if (!mapDef || !Array.isArray(mapDef.nodes) || !mapDef.nodes.length) return false;
    await global.migrateMapForgeStorageAsync();
    try {
      const db = await openDb();
      await idbPutActive(db, mapDef);
      global.__AVIAN_CUSTOM_MAP_CACHE = mapDef;
      return true;
    } catch (_) {
      return false;
    }
  };

  global.loadCustomOverworldMapAsync = async function () {
    if (global.__AVIAN_CUSTOM_MAP_CACHE) return global.__AVIAN_CUSTOM_MAP_CACHE;
    await global.migrateMapForgeStorageAsync();
    try {
      const db = await openDb();
      const map = await idbGetActive(db);
      if (map && Array.isArray(map.nodes) && map.nodes.length) {
        global.__AVIAN_CUSTOM_MAP_CACHE = map;
        return map;
      }
    } catch (_) {}
    const legacy = readLegacyActiveMap();
    if (legacy) global.__AVIAN_CUSTOM_MAP_CACHE = legacy;
    return legacy;
  };

  global.clearCustomOverworldMapAsync = async function () {
    global.__AVIAN_CUSTOM_MAP_CACHE = null;
    try {
      const db = await openDb();
      await idbClearActive(db);
    } catch (_) {}
    try {
      global.localStorage.removeItem(LEGACY_ACTIVE_KEY);
    } catch (_) {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
