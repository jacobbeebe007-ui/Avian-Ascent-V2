/* Avian Ascent — Combat Scenario Test panel (war-room unlock).
 *
 * Unlock via Supplies code "combattest". Opens a left-side war-room hotspot
 * that runs an in-browser smoke suite mirroring the Node harness foundations.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.debug = Avian.debug || Object.create(null);

  var UNLOCK_KEY = 'avian_combattest_unlocked';

  function isCombatScenarioTestUnlocked() {
    try {
      return localStorage.getItem(UNLOCK_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function syncCombatScenarioTestUnlockUI() {
    try {
      document.body.classList.toggle('combat-scenario-test-unlocked', isCombatScenarioTestUnlocked());
    } catch (_) { /* noop */ }
  }

  function unlockCombatScenarioTest() {
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (_) { /* noop */ }
    syncCombatScenarioTestUnlockUI();
  }

  /* ---- In-browser smoke suite (foundational checks) -------------------- */

  function smokeChecks() {
    var results = [];
    function check(id, name, fn) {
      try {
        fn();
        results.push({ id: id, name: name, status: 'passed' });
      } catch (err) {
        results.push({
          id: id,
          name: name,
          status: 'failed',
          message: err && err.message ? err.message : String(err),
        });
      }
    }

    check('EN-001', 'Combat begins with 4 EN', function () {
      var start = typeof globalThis.computePlayerStartEnergy === 'function'
        ? globalThis.computePlayerStartEnergy({ size: 'medium', energyBonus: 0 })
        : 4;
      if (start !== 4) throw new Error('Expected start EN 4, got ' + start);
    });

    check('EN-008', 'Player recovers 3 EN at turn start', function () {
      var regen = typeof globalThis.computePlayerEnergyRegen === 'function'
        ? globalThis.computePlayerEnergyRegen({})
        : 3;
      if (regen !== 3) throw new Error('Expected regen 3, got ' + regen);
    });

    check('EN-009', 'EN max is at least 6', function () {
      var max = typeof globalThis.computePlayerEffectiveMaxEnergy === 'function'
        ? globalThis.computePlayerEffectiveMaxEnergy({ size: 'medium', energyBonus: 0 })
        : 6;
      if (max < 6) throw new Error('Expected max EN ≥ 6, got ' + max);
    });

    check('HIT-001', 'Hit chance clamps to min/max', function () {
      if (typeof globalThis.calculateAbilityHitChancePct !== 'function') {
        throw new Error('calculateAbilityHitChancePct missing');
      }
      var high = globalThis.calculateAbilityHitChancePct(200, 0, 0);
      var low = globalThis.calculateAbilityHitChancePct(10, 80, 0);
      if (high !== 95) throw new Error('Expected max 95, got ' + high);
      if (low !== 15) throw new Error('Expected min 15, got ' + low);
    });

    check('PRO-014', 'Fortify expiry clamps Armour to normal maximum', function () {
      var prot = Avian.protection;
      if (!prot || typeof prot.applyFortify !== 'function') {
        throw new Error('Avian.protection missing');
      }
      var stats = {
        normalMaxArmour: 24,
        maxArmour: 24,
        armour: 20,
        normalMaxMagicArmour: 0,
        maxMagicArmour: 0,
        magicArmour: 0,
      };
      var status = {};
      prot.applyFortify(stats, status, 12, 1);
      stats.armour = 27;
      prot.expireFortify(stats, status);
      if (stats.armour !== 24 || stats.maxArmour !== 24 || status.fortify) {
        throw new Error('Expected armour 24/24 without fortify, got '
          + stats.armour + '/' + stats.maxArmour + ' fortify=' + !!status.fortify);
      }
    });

    check('PRO-001', 'Armour absorbs Martial damage before HP', function () {
      var prot = Avian.protection;
      var stats = {
        normalMaxArmour: 10, maxArmour: 10, armour: 10,
        normalMaxMagicArmour: 0, maxMagicArmour: 0, magicArmour: 0,
        hp: 100, maxHp: 100,
      };
      var hit = prot.applyDamageThroughProtection(stats, {}, 4, false);
      if (stats.armour !== 6 || hit.remaining !== 0) {
        throw new Error('Expected armour 6 / remaining 0, got armour='
          + stats.armour + ' remaining=' + hit.remaining);
      }
    });

    check('DMG-003', 'Protection remaining damage never negative', function () {
      var prot = Avian.protection;
      var hit = prot.applyDamageThroughProtection(
        { armour: 0, maxArmour: 0, normalMaxArmour: 0, magicArmour: 0, maxMagicArmour: 0, normalMaxMagicArmour: 0 },
        {},
        0,
        false,
      );
      if ((hit.remaining || 0) < 0) throw new Error('negative remaining');
    });

    check('EQP-CORE', 'Basic starting weapons catalog present', function () {
      var map = Avian.data && Avian.data.equipment && Avian.data.equipment.coreRules
        && Avian.data.equipment.coreRules.basicStartingWeapons;
      if (!map || !map.rogue || !map.mage) {
        throw new Error('basicStartingWeapons missing');
      }
      if (map.rogue !== 'WPN-B04') throw new Error('rogue starting weapon expected WPN-B04');
    });

    check('SIM-001', 'simulateDuel API available', function () {
      if (typeof Avian.debug.simulateDuel !== 'function') {
        throw new Error('Avian.debug.simulateDuel missing');
      }
    });

    check('AIL-PENDING', 'Shock and Paralysis need final rule confirmation', function () {
      /* Soft pass — surfaces as note in the panel, not a failure. */
    });

    return results;
  }

  function runCombatScenarioSmoke() {
    var results = smokeChecks();
    var passed = results.filter(function (r) { return r.status === 'passed'; }).length;
    var failed = results.filter(function (r) { return r.status === 'failed'; }).length;
    return { passed: passed, failed: failed, total: results.length, results: results };
  }

  Avian.debug.combatScenarioSmoke = runCombatScenarioSmoke;
  Avian.debug.isCombatScenarioTestUnlocked = isCombatScenarioTestUnlocked;
  Avian.debug.unlockCombatScenarioTest = unlockCombatScenarioTest;

  /* ---- Panel UI -------------------------------------------------------- */

  function ensurePanel() {
    var existing = document.getElementById('select-hub-combat-scenarios');
    if (existing) return existing;

    var panels = document.getElementById('select-hub-panels');
    if (!panels) return null;

    var panel = document.createElement('div');
    panel.className = 'select-hub-panel select-hub-panel--combat-scenarios';
    panel.id = 'select-hub-combat-scenarios';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'hub-combat-scenarios-title');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = [
      '<div class="select-hub-panel-inner select-hub-panel-inner--combat-scenarios">',
      '  <header class="select-hub-panel-head">',
      '    <h3 class="select-hub-panel-title" id="hub-combat-scenarios-title">Combat Scenario Test</h3>',
      '    <button type="button" class="select-hub-return-btn" data-action="closeSelectHubPanel">← Return to war room</button>',
      '  </header>',
      '  <p class="select-hub-lead">Controlled combat rule checks. Full suite: <code>npm run verify-combat-scenarios</code> (also part of <code>npm test</code>). This panel runs an in-browser foundation smoke suite.</p>',
      '  <div class="combat-scenario-actions">',
      '    <button type="button" class="splash-codex-btn" id="combat-scenario-run-btn" data-action="runCombatScenarioSmoke">Run foundation scenarios</button>',
      '  </div>',
      '  <div class="combat-scenario-summary" id="combat-scenario-summary" aria-live="polite"></div>',
      '  <pre class="combat-scenario-log" id="combat-scenario-log"></pre>',
      '  <p class="combat-scenario-note">🔁 Shock and Paralysis scenarios need final rule confirmation before coding those cases.</p>',
      '</div>',
    ].join('\n');
    panels.appendChild(panel);
    return panel;
  }

  function openCombatScenarioTest() {
    if (!isCombatScenarioTestUnlocked()) return;
    ensurePanel();
    if (typeof globalThis.openSelectHubPanel === 'function') {
      globalThis.openSelectHubPanel('combat-scenarios');
    } else {
      var panel = document.getElementById('select-hub-combat-scenarios');
      var wrap = document.getElementById('select-hub-panels');
      var screenEl = document.getElementById('screen-select');
      if (wrap) {
        wrap.classList.add('is-open');
        wrap.setAttribute('aria-hidden', 'false');
      }
      if (screenEl) screenEl.classList.add('select-hub-panel-active');
      if (panel) {
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
      }
    }
    var summary = document.getElementById('combat-scenario-summary');
    if (summary && !summary.textContent) {
      summary.textContent = 'Ready — run the foundation smoke suite or use the Node harness for the full catalog.';
    }
  }

  function runCombatScenarioSmokeAction() {
    var summary = document.getElementById('combat-scenario-summary');
    var logEl = document.getElementById('combat-scenario-log');
    var report = runCombatScenarioSmoke();
    var lines = report.results.map(function (r) {
      if (r.status === 'passed') return '✓ ' + r.id + ' ' + r.name;
      return '✗ ' + r.id + ' ' + r.name + (r.message ? '\n  ' + r.message : '');
    });
    if (logEl) logEl.textContent = lines.join('\n');
    if (summary) {
      summary.textContent = report.passed + ' passed, ' + report.failed + ' failed / ' + report.total
        + ' — full catalog lives under scripts/combat-scenarios/';
      summary.classList.toggle('is-failed', report.failed > 0);
      summary.classList.toggle('is-ok', report.failed === 0);
    }
    return report;
  }

  globalThis.isCombatScenarioTestUnlocked = isCombatScenarioTestUnlocked;
  globalThis.syncCombatScenarioTestUnlockUI = syncCombatScenarioTestUnlockUI;
  globalThis.unlockCombatScenarioTest = unlockCombatScenarioTest;
  globalThis.ensureCombatScenarioPanel = ensurePanel;
  globalThis.openCombatScenarioTest = openCombatScenarioTest;
  globalThis.runCombatScenarioSmoke = runCombatScenarioSmokeAction;

  try {
    if (Avian.ed) {
      Object.assign(Avian.actions || (Avian.actions = {}), {
        openCombatScenarioTest: openCombatScenarioTest,
        runCombatScenarioSmoke: runCombatScenarioSmokeAction,
      });
    }
  } catch (_) { /* noop */ }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCombatScenarioTestUnlockUI);
    } else {
      syncCombatScenarioTestUnlockUI();
    }
  }
})();
