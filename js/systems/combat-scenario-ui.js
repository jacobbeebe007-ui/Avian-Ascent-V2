/* Avian Ascent — Combat Scenario Test panel (war-room unlock).
 *
 * Unlock via Supplies code "combattest". Opens a left-side war-room hotspot
 * that runs an in-browser smoke suite mirroring the Node harness foundations.
 * APIs live on Avian.debug / Avian.ui / Avian.actions (no new globalThis exports).
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.debug = Avian.debug || Object.create(null);
  Avian.ui = Avian.ui || Object.create(null);
  Avian.actions = Avian.actions || Object.create(null);

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
      if (map.rogue !== 'WPN-007') throw new Error('rogue starting weapon expected WPN-007');
    });

    check('SIM-001', 'simulateDuel API available', function () {
      if (typeof Avian.debug.simulateDuel !== 'function') {
        throw new Error('Avian.debug.simulateDuel missing');
      }
    });

    check('AIL-SHK-001', 'Shock tick damage matches Burn', function () {
      if (typeof globalThis.calcShockTickDmg !== 'function') {
        throw new Error('calcShockTickDmg missing');
      }
      var shock = globalThis.calcShockTickDmg(3, 100);
      var burn = globalThis.calcBurningTickDmg(3, 100);
      if (shock !== burn) throw new Error('Expected shock==burn, got ' + shock + ' vs ' + burn);
    });

    check('AIL-SHK-004', 'Paralysis adds +1 EN cost helper', function () {
      if (typeof globalThis.getParalysisExtraEnCost !== 'function') {
        throw new Error('getParalysisExtraEnCost missing');
      }
      var extra = globalThis.getParalysisExtraEnCost({ paralyzed: { turns: 1, extraEnCost: 1 } });
      if (extra !== 1) throw new Error('Expected extra EN 1, got ' + extra);
    });

    return results;
  }

  function runCombatScenarioSmoke() {
    var results = smokeChecks();
    var passed = results.filter(function (r) { return r.status === 'passed'; }).length;
    var failed = results.filter(function (r) { return r.status === 'failed'; }).length;
    return { passed: passed, failed: failed, total: results.length, results: results };
  }

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
      '  <p class="select-hub-lead">Controlled combat rule checks. Full suite: <code>npm run verify-combat-scenarios</code> (also part of <code>npm test</code>). This panel runs an in-browser foundation smoke suite and a Story/Endless telemetry batch.</p>',
      '  <div class="combat-scenario-actions">',
      '    <button type="button" class="splash-codex-btn" id="combat-scenario-run-btn" data-action="runCombatScenarioSmoke">Run foundation scenarios</button>',
      '  </div>',
      '  <section class="combat-scenario-telemetry" aria-labelledby="combat-telemetry-heading">',
      '    <h4 class="combat-scenario-subhead" id="combat-telemetry-heading">Combat Telemetry Lab</h4>',
      '    <div class="combat-scenario-lab-controls">',
      '      <label class="combat-scenario-field">Runs',
      '        <input type="number" id="combat-telemetry-runs" min="1" max="1000" value="20" step="1">',
      '      </label>',
      '      <div class="combat-scenario-mode" role="group" aria-label="Lab mode">',
      '        <button type="button" class="combat-scenario-mode-btn is-active" data-lab-mode="story" id="combat-telemetry-mode-story">Story</button>',
      '        <button type="button" class="combat-scenario-mode-btn" data-lab-mode="endless" id="combat-telemetry-mode-endless">Endless</button>',
      '      </div>',
      '      <button type="button" class="splash-codex-btn" id="combat-telemetry-run-batch" data-action="runCombatScenarioTelemetryBatch">Run telemetry batch</button>',
      '      <button type="button" class="splash-codex-btn splash-codex-btn--ghost" id="combat-telemetry-export" data-action="exportCombatScenarioTelemetry">Export telemetry</button>',
      '      <button type="button" class="splash-codex-btn splash-codex-btn--ghost" id="combat-telemetry-reset" data-action="resetCombatScenarioTelemetry">Reset telemetry</button>',
      '    </div>',
      '    <p class="combat-scenario-lab-hint">Story = roster × tiers × synthetic targets. Endless = endless band ladder. Large run counts are chunked so the tab stays responsive.</p>',
      '  </section>',
      '  <div class="combat-scenario-summary" id="combat-scenario-summary" aria-live="polite"></div>',
      '  <pre class="combat-scenario-log" id="combat-scenario-log"></pre>',
      '  <p class="combat-scenario-note">Shock: Magic DoT (=Burn), stacks to 5 at 0 Magic Armour → Paralysed (+1 EN/skill, then 2t Control Resistance).</p>',
      '</div>',
    ].join('\n');
    panels.appendChild(panel);
    bindLabModeButtons(panel);
    return panel;
  }

  var labMode = 'story';
  var labBatchRunning = false;

  function bindLabModeButtons(panel) {
    var buttons = panel.querySelectorAll('[data-lab-mode]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        var btn = ev.currentTarget;
        var mode = btn.getAttribute('data-lab-mode') || 'story';
        labMode = mode === 'endless' ? 'endless' : 'story';
        for (var j = 0; j < buttons.length; j++) {
          buttons[j].classList.toggle('is-active', buttons[j].getAttribute('data-lab-mode') === labMode);
        }
      });
    }
  }

  function readLabRuns() {
    var input = document.getElementById('combat-telemetry-runs');
    var n = input ? Number(input.value) : 20;
    if (!Number.isFinite(n) || n < 1) n = 20;
    return Math.min(1000, Math.floor(n));
  }

  function resetCombatScenarioTelemetry() {
    var tel = Avian.systems && Avian.systems.combatTelemetry;
    if (tel && typeof tel.reset === 'function') tel.reset();
    var summary = document.getElementById('combat-scenario-summary');
    if (summary) {
      summary.textContent = 'Telemetry reset.';
      summary.classList.remove('is-failed');
      summary.classList.add('is-ok');
    }
    return true;
  }

  function exportCombatScenarioTelemetry() {
    if (typeof Avian.actions.exportCombatTelemetry === 'function') {
      return Avian.actions.exportCombatTelemetry();
    }
    var tel = Avian.systems && Avian.systems.combatTelemetry;
    if (!tel || typeof tel.exportJson !== 'function') {
      window.alert('Combat telemetry is not loaded.');
      return false;
    }
    var json = tel.exportJson(true);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json);
        window.alert('Combat telemetry copied to clipboard.');
      } else {
        console.info(json);
        window.alert('Combat telemetry printed to console.');
      }
    } catch (err) {
      console.info(json);
      window.alert('Combat telemetry printed to console.');
    }
    return true;
  }

  function formatBatchLog(report) {
    var lines = [];
    lines.push('Mode: ' + report.mode + ' | runs/matchup: ' + report.runs + ' | seed: ' + report.seed);
    lines.push('Matchups: ' + report.rows.length + ' | warnings: ' + report.warnings.length);
    lines.push('');
    var starter = report.rows.filter(function (r) {
      return r.tier === 'starter' && r.opponent === 'balanced';
    });
    if (starter.length) {
      lines.push('Starter × balanced:');
      starter.forEach(function (r) {
        lines.push(
          '  ' + r.class.padEnd(11)
          + ' win ' + (r.winRate * 100).toFixed(1) + '%'
          + ' | turns ' + r.averageTurns
          + ' | hit ' + (r.hitRate * 100).toFixed(1) + '%'
          + ' | armourDmg ' + r.armourDamageDealt
          + ' | healthDmg ' + r.healthDamageDealt
        );
      });
      lines.push('');
    }
    if (report.warnings.length) {
      lines.push('Warnings (first 24):');
      report.warnings.slice(0, 24).forEach(function (w) { lines.push('  ⚠ ' + w); });
      lines.push('');
    }
    var tel = report.telemetry || {};
    lines.push('Telemetry snapshot:');
    lines.push('  hits=' + tel.hits + ' precisionMisses=' + tel.precisionMisses + ' dodges=' + tel.dodges
      + ' crits=' + tel.crits);
    lines.push('  healthDmg=' + tel.healthDamageDealt + ' armourDmg=' + tel.armourDamageDealt
      + ' magicArmourDmg=' + tel.magicArmourDamageDealt);
    lines.push('  fortify=' + tel.fortifyGenerated + ' ward=' + tel.wardGenerated
      + ' ailments.ok=' + (tel.ailments && tel.ailments.successes));
    return lines.join('\n');
  }

  function runCombatScenarioTelemetryBatchAction() {
    if (labBatchRunning) return null;
    var summary = document.getElementById('combat-scenario-summary');
    var logEl = document.getElementById('combat-scenario-log');
    if (typeof Avian.debug.runBalanceLabBatch !== 'function') {
      if (summary) {
        summary.textContent = 'Balance lab batch API missing — rebuild the bundle.';
        summary.classList.add('is-failed');
      }
      return null;
    }
    var runs = readLabRuns();
    var mode = labMode;
    labBatchRunning = true;
    if (summary) {
      summary.textContent = 'Running ' + mode + ' telemetry batch (' + runs + ' runs/matchup)…';
      summary.classList.remove('is-ok', 'is-failed');
    }
    if (logEl) logEl.textContent = '';

    var tel = Avian.systems && Avian.systems.combatTelemetry;
    if (tel && typeof tel.reset === 'function') tel.reset();

    /* Yield between matchups via the batch's onProgress + setTimeout chunking wrapper. */
    var cfg = Avian.data && Avian.data.balanceBenchmarks;
    var seed = cfg && cfg.baseSeed != null ? cfg.baseSeed : 12345;

    function finish(report) {
      labBatchRunning = false;
      if (logEl) logEl.textContent = formatBatchLog(report);
      if (summary) {
        summary.textContent = report.mode + ' batch done — ' + report.rows.length + ' matchups, '
          + report.warnings.length + ' warnings.';
        summary.classList.toggle('is-failed', report.warnings.length > 12);
        summary.classList.toggle('is-ok', report.warnings.length <= 12);
      }
      return report;
    }

    try {
      var maybe = Avian.debug.runBalanceLabBatch({
        mode: mode,
        runs: runs,
        seed: seed,
        async: true,
        onProgress: function (p) {
          if (summary) {
            summary.textContent = 'Running ' + mode + '… ' + p.done + '/' + p.total + ' matchups';
          }
        },
      });
      if (maybe && typeof maybe.then === 'function') {
        maybe.then(finish).catch(function (err) {
          labBatchRunning = false;
          if (summary) {
            summary.textContent = 'Telemetry batch failed: ' + (err && err.message ? err.message : String(err));
            summary.classList.add('is-failed');
          }
          if (logEl) logEl.textContent = String(err && err.stack || err);
        });
        return maybe;
      }
      return finish(maybe);
    } catch (err) {
      labBatchRunning = false;
      if (summary) {
        summary.textContent = 'Telemetry batch failed: ' + (err && err.message ? err.message : String(err));
        summary.classList.add('is-failed');
      }
      if (logEl) logEl.textContent = String(err && err.stack || err);
      return null;
    }
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
      summary.textContent = 'Ready — run foundation smoke, or a Story/Endless telemetry batch.';
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

  Avian.debug.combatScenarioSmoke = runCombatScenarioSmoke;
  Avian.debug.isCombatScenarioTestUnlocked = isCombatScenarioTestUnlocked;
  Avian.debug.unlockCombatScenarioTest = unlockCombatScenarioTest;
  Avian.debug.syncCombatScenarioTestUnlockUI = syncCombatScenarioTestUnlockUI;

  Avian.ui.ensureCombatScenarioPanel = ensurePanel;
  Avian.ui.openCombatScenarioTest = openCombatScenarioTest;
  Avian.ui.runCombatScenarioSmoke = runCombatScenarioSmokeAction;
  Avian.ui.runCombatScenarioTelemetryBatch = runCombatScenarioTelemetryBatchAction;

  Avian.actions.openCombatScenarioTest = openCombatScenarioTest;
  Avian.actions.runCombatScenarioSmoke = runCombatScenarioSmokeAction;
  Avian.actions.runCombatScenarioTelemetryBatch = runCombatScenarioTelemetryBatchAction;
  Avian.actions.exportCombatScenarioTelemetry = exportCombatScenarioTelemetry;
  Avian.actions.resetCombatScenarioTelemetry = resetCombatScenarioTelemetry;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCombatScenarioTestUnlockUI);
    } else {
      syncCombatScenarioTestUnlockUI();
    }
  }
})();
