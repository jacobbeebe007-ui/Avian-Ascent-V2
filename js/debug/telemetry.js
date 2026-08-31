/* Avian Ascent — run telemetry and highscore records (Step 7 Phase 2). */
(function () {
  'use strict';

  const TELEMETRY_KEY = 'avianAscent_telemetry_v1';
  const HIGHSCORE_KEY = 'avian_highscores_v1';

  function loadTelemetry() {
    try {
      return JSON.parse(localStorage.getItem(TELEMETRY_KEY) || '{"runs":[],"meta":{}}');
    } catch (_) {
      return { runs: [], meta: {} };
    }
  }

  function saveTelemetry(data) {
    try {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function telemetryPushRun(run) {
    const data = loadTelemetry();
    data.runs = Array.isArray(data.runs) ? data.runs : [];
    data.runs.unshift(run);
    data.runs = data.runs.slice(0, 120);
    saveTelemetry(data);
  }

  function getTelemetrySummary() {
    const runs = loadTelemetry().runs || [];
    if (!runs.length) return { runs: 0, avgStage: 0, topDeaths: [], winRateByBird: [] };
    const deaths = new Map();
    const birds = new Map();
    let stageTotal = 0;
    for (const r of runs) {
      stageTotal += Number(r.stageReached || 1);
      const death = String(r.deathCause || 'unknown');
      deaths.set(death, (deaths.get(death) || 0) + 1);
      const b = String(r.bird || 'unknown');
      if (!birds.has(b)) birds.set(b, { bird: b, runs: 0, wins: 0 });
      const row = birds.get(b);
      row.runs++;
      if (r.won) row.wins++;
    }
    return {
      runs: runs.length,
      avgStage: +(stageTotal / runs.length).toFixed(2),
      topDeaths: [...deaths.entries()].sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5),
      winRateByBird: [...birds.values()].map(function (x) {
        return Object.assign({}, x, { winRate: +((x.wins / Math.max(1, x.runs)) * 100).toFixed(1) });
      }).sort(function (a, b) { return b.winRate - a.winRate; }),
    };
  }

  function getRunSnapshot() {
    const G = globalThis.G || {};
    const p = G.player || {};
    const templates = globalThis.ABILITY_TEMPLATES || {};
    return {
      birdKey: p.birdKey || 'unknown',
      birdName: p.name || 'Unknown',
      stage: G.endlessMode && G.stage > 20 ? 'Endless ' + (G.endlessBattle || Math.max(1, G.stage - 20)) : 'Stage ' + (G.stage || 1),
      stageNumber: Number(G.stage || 1),
      endless: !!G.endlessMode,
      stats: Object.assign({}, p.stats || {}),
      abilities: (p.abilities || []).map(function (a) {
        const t = templates[a.id];
        return (t && t.name ? t.name : a.id) + ' Lv' + (a.level || 1);
      }),
      upgrades: (G.collectedRewards || []).map(function (r) { return r.name; }),
      ts: Date.now(),
    };
  }

  function saveHighscoreEntry(won) {
    won = !!won;
    const snap = getRunSnapshot();
    const entry = Object.assign({}, snap, { won: won });
    try {
      const rows = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || '[]');
      rows.push(entry);
      rows.sort(function (a, b) {
        return (b.stageNumber || 0) - (a.stageNumber || 0) || Number(!!b.won) - Number(!!a.won);
      });
      localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(rows.slice(0, 20)));
    } catch (_) {}
  }

  function renderHighscoreBoard() {
    const grid = document.getElementById('highscore-grid');
    if (!grid) return;
    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || '[]');
    } catch (_) {
      rows = [];
    }
    if (!rows.length) {
      grid.innerHTML = '<div class="run-card"><div class="run-stage">No highscores yet</div><div class="run-meta">Finish a run to log your best attempts.</div></div>';
      return;
    }
    grid.innerHTML = rows.slice(0, 8).map(function (r, i) {
      return (
        '<div class="run-card">' +
        '<div class="run-stage">#' + (i + 1) + ' · ' + r.stage + (r.won ? ' · 👑 Win' : '') + '</div>' +
        '<div class="run-bird">' + (r.birdName || r.birdKey) + '</div>' +
        '<div class="run-meta">HP ' + ((r.stats && r.stats.hp) || 0) + '/' + ((r.stats && r.stats.maxHp) || 0) +
        ' · ATK ' + ((r.stats && r.stats.atk) || 0) + ' · DEF ' + ((r.stats && r.stats.def) || 0) +
        ' · SPD ' + ((r.stats && r.stats.spd) || 0) + '</div>' +
        '<div class="run-meta">' + (r.abilities || []).slice(0, 3).join(' · ') + '</div>' +
        '<div class="run-meta">Upgrades: ' + (((r.upgrades || []).slice(0, 2).join(' · ')) || '—') + '</div>' +
        '</div>'
      );
    }).join('');
  }

  const Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.debug = Avian.debug || Object.create(null);
  Avian.debug.telemetry = {
    load: loadTelemetry,
    save: saveTelemetry,
    pushRun: telemetryPushRun,
    summary: getTelemetrySummary,
    getRunSnapshot: getRunSnapshot,
    saveHighscoreEntry: saveHighscoreEntry,
    renderHighscoreBoard: renderHighscoreBoard,
  };

  globalThis.loadTelemetry = loadTelemetry;
  globalThis.saveTelemetry = saveTelemetry;
  globalThis.telemetryPushRun = telemetryPushRun;
  globalThis.getTelemetrySummary = getTelemetrySummary;
  globalThis.getRunSnapshot = getRunSnapshot;
  globalThis.saveHighscoreEntry = saveHighscoreEntry;
  globalThis.renderHighscoreBoard = renderHighscoreBoard;

  if (typeof globalThis.registerGameModule === 'function') {
    globalThis.registerGameModule({
      id: 'telemetry-persistence',
      onRunEnd: function (ctx) {
        const G = globalThis.G || {};
        telemetryPushRun({
          bird: (ctx && ctx.bird) || (G.player && G.player.birdKey) || 'unknown',
          won: !!(ctx && ctx.won),
          stageReached: (ctx && ctx.stageReached) || G.stage || 1,
          deathCause: (ctx && ctx.deathCause) || 'unknown',
          at: Date.now(),
          endless: !!(ctx && ctx.endless != null ? ctx.endless : G.endlessMode),
        });
      },
    });
  }
})();
