/**
 * World Creator canvas size helpers (map-forge.js owns drawing/tools).
 */
(function (global) {
  'use strict';

  global.getForgeMapSize = function (map, editContext) {
    const packW = typeof global.clampForgeMapWidth === 'function'
      ? global.clampForgeMapWidth(map?.mapWidth)
      : Math.max(320, Math.floor(Number(map?.mapWidth) || 1536));
    const packH = typeof global.clampForgeMapHeight === 'function'
      ? global.clampForgeMapHeight(map?.mapHeight)
      : Math.max(240, Math.floor(Number(map?.mapHeight) || 1024));
    if (editContext && editContext !== 'main') {
      const w = map?.worlds?.[editContext];
      return {
        w: w && w.mapWidth != null
          ? (typeof global.clampForgeMapWidth === 'function' ? global.clampForgeMapWidth(w.mapWidth) : packW)
          : packW,
        h: w && w.mapHeight != null
          ? (typeof global.clampForgeMapHeight === 'function' ? global.clampForgeMapHeight(w.mapHeight) : packH)
          : packH,
      };
    }
    return { w: packW, h: packH };
  };

  global.readImageSizeFromDataUrl = function (dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl) { resolve(null); return; }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        resolve(w > 0 && h > 0 ? { w, h } : null);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
