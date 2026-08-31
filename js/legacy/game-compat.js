/* Avian Ascent — legacy global compatibility shims (Step 7).
 *
 * Central place for deprecated aliases. New code should use Avian.* namespaces.
 * This file loads late in the bundle; it only adds aliases when targets exist.
 */
(function () {
  'use strict';

  const Avian = globalThis.Avian || (globalThis.Avian = {});
  const helpers = Avian.helpers;

  function exposeLegacyGlobals() {
    if (helpers) {
      if (typeof helpers.formatCombatNumber === 'function' && !globalThis.formatCombatNumber) {
        globalThis.formatCombatNumber = helpers.formatCombatNumber;
      }
      if (typeof helpers.normalizeRewardTier === 'function' && !globalThis.normalizeRewardTier) {
        globalThis.normalizeRewardTier = helpers.normalizeRewardTier;
      }
    }
    if (Avian.debug && Avian.debug.telemetry && typeof Avian.debug.telemetry.summary === 'function') {
      if (!globalThis.getTelemetrySummary) globalThis.getTelemetrySummary = Avian.debug.telemetry.summary;
    }
  }

  Avian.legacy = Avian.legacy || Object.create(null);
  Avian.legacy.exposeLegacyGlobals = exposeLegacyGlobals;
  exposeLegacyGlobals();
})();
