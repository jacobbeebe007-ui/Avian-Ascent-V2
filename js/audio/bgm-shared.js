/* Avian Ascent — shared BGM helpers (index.html + overworld page). */
(function initBgmShared(global) {
  const MUSIC_SETTINGS_KEY = 'avian_music_v1';
  const ACCESS_KEY = 'avian_accessibility_v1';
  const MUSIC_OVERRIDES_KEY = 'avian_music_overrides_v1';
  const DEFAULT_VOLUME_PCT = 50;
  const AUDIO_BASE = './assets/audio/';

  const TRACKS = Object.freeze({
    menu: {
      id: 'menu',
      title: 'Blakiston Theme',
      src: AUDIO_BASE + 'Blakiston_Theme.mp3',
      roles: ['menu', 'preview'],
    },
    sharp_beak: {
      id: 'sharp_beak',
      title: 'Sharp Beak Quick Wing',
      src: AUDIO_BASE + 'Sharp_Beak_Quick_Wing.mp3',
      roles: ['battle', 'preview'],
    },
    brittle_waltz: {
      id: 'brittle_waltz',
      title: 'The Brittle Waltz',
      src: AUDIO_BASE + 'The_Brittle_Waltz.mp3',
      roles: ['battle', 'preview'],
    },
    pigeon_jig: {
      id: 'pigeon_jig',
      title: "The Pigeon's Desperate Jig",
      src: AUDIO_BASE + 'The_Pigeon_s_Desperate_Jig.mp3',
      roles: ['battle', 'preview'],
    },
    last_thermal: {
      id: 'last_thermal',
      title: 'The Last Thermal',
      src: AUDIO_BASE + 'The_Last_Thermal-Overworld.mp3',
      roles: ['overworld', 'preview'],
    },
    duke: {
      id: 'duke',
      title: 'Duke Blakiston Battle',
      src: AUDIO_BASE + 'Duke_Blakiston_Battle.mp3',
      roles: ['duke'],
    },
  });

  const PREVIEW_TRACK_IDS = ['menu', 'sharp_beak', 'brittle_waltz', 'pigeon_jig', 'last_thermal', 'duke'];
  const SELECTABLE_TRACK_IDS = ['menu', 'sharp_beak', 'brittle_waltz', 'pigeon_jig', 'last_thermal', 'duke'];
  const BATTLE_TRACK_IDS = ['sharp_beak', 'brittle_waltz', 'pigeon_jig'];
  const DEFAULT_ROLE_TRACKS = Object.freeze({ menu: 'menu', overworld: 'last_thermal' });

  const fadeState = new WeakMap();

  function getMusicSettings() {
    try {
      const raw = JSON.parse(global.localStorage.getItem(MUSIC_SETTINGS_KEY) || '{}');
      const vol = Number(raw.volume);
      let cfgVol = DEFAULT_VOLUME_PCT;
      try {
        const cfg = JSON.parse(global.localStorage.getItem(ACCESS_KEY) || '{}');
        if (Number.isFinite(Number(cfg.audio?.music))) cfgVol = Number(cfg.audio.music);
      } catch (_) { /* noop */ }
      return {
        muted: !!raw.muted,
        volume: Number.isFinite(vol) ? Math.max(0, Math.min(100, vol)) : cfgVol,
      };
    } catch (_) {
      return { muted: false, volume: DEFAULT_VOLUME_PCT };
    }
  }

  function getAudioVolumeMultipliers() {
    let cfg = {};
    try { cfg = JSON.parse(global.localStorage.getItem(ACCESS_KEY) || '{}'); } catch (_) { /* noop */ }
    const a = cfg.audio || {};
    const master = Math.max(0, Math.min(1, (Number(a.master) || 100) / 100));
    const music = Math.max(0, Math.min(1, (Number(a.music) || DEFAULT_VOLUME_PCT) / 100));
    return { master, music, masterMusic: master * music };
  }

  function getTargetVolume() {
    const s = getMusicSettings();
    const mult = getAudioVolumeMultipliers();
    return s.muted ? 0 : Math.max(0, Math.min(1, (s.volume / 100) * mult.masterMusic));
  }

  function normalizeRole(role) {
    return role === 'menu' || role === 'battle' || role === 'overworld' ? role : null;
  }

  function normalizeTrackChoice(choice) {
    if (!choice || choice === 'default') return 'default';
    return TRACKS[choice] ? choice : 'default';
  }

  function getMusicOverrides() {
    const defaults = { menu: 'default', battle: 'default', overworld: 'default' };
    try {
      const raw = JSON.parse(global.localStorage.getItem(MUSIC_OVERRIDES_KEY) || '{}');
      return {
        menu: normalizeTrackChoice(raw.menu),
        battle: normalizeTrackChoice(raw.battle),
        overworld: normalizeTrackChoice(raw.overworld),
      };
    } catch (_) {
      return defaults;
    }
  }

  function saveMusicOverrides(overrides) {
    const prev = getMusicOverrides();
    const next = {
      menu: normalizeTrackChoice(overrides?.menu ?? prev.menu),
      battle: normalizeTrackChoice(overrides?.battle ?? prev.battle),
      overworld: normalizeTrackChoice(overrides?.overworld ?? prev.overworld),
    };
    try { global.localStorage.setItem(MUSIC_OVERRIDES_KEY, JSON.stringify(next)); } catch (_) { /* noop */ }
    return next;
  }

  function setTrackForRole(role, trackIdOrDefault) {
    const r = normalizeRole(role);
    if (!r) return getMusicOverrides();
    return saveMusicOverrides({ [r]: normalizeTrackChoice(trackIdOrDefault) });
  }

  function getTrackForRole(role) {
    const r = normalizeRole(role);
    if (!r) return null;
    const choice = getMusicOverrides()[r];
    if (choice && choice !== 'default' && TRACKS[choice]) return TRACKS[choice];
    if (r === 'battle') return pickRandomBattleTrack();
    return TRACKS[DEFAULT_ROLE_TRACKS[r]] || null;
  }

  function listSelectableTracks() {
    return SELECTABLE_TRACK_IDS.map((id) => TRACKS[id]).filter(Boolean);
  }

  function cancelFade(el) {
    const st = fadeState.get(el);
    if (!st) return;
    if (st.raf != null) {
      global.cancelAnimationFrame(st.raf);
      st.raf = null;
    }
    st.active = false;
    st.fadeOut = false;
  }

  function stopImmediate(el) {
    if (!el) return;
    cancelFade(el);
    try {
      el.pause();
      el.currentTime = 0;
    } catch (_) { /* noop */ }
  }

  function applyVolumeSettings(el) {
    if (!el) return;
    const s = getMusicSettings();
    const target = getTargetVolume();
    el.muted = !!s.muted;
    if (!el.paused && !fadeState.get(el)?.active) {
      el.volume = target;
    }
  }

  function fadeIn(el, opts) {
    if (!el) return;
    const target = opts?.targetVolume != null ? opts.targetVolume : getTargetVolume();
    if (target <= 0.001) {
      stopImmediate(el);
      return;
    }
    cancelFade(el);
    const st = { active: true, fadeOut: false, raf: null };
    fadeState.set(el, st);
    const dur = Math.max(200, Number(opts?.durationMs) || 1200);
    el.muted = false;
    el.volume = 0;
    if (opts?.src) {
      el.src = opts.src;
      el.load();
    }
    if (opts?.loop != null) el.loop = !!opts.loop;
    try { el.currentTime = 0; el.play().catch(() => {}); } catch (_) { /* noop */ }
    const t0 = performance.now();
    function tick(now) {
      if (!st.active) { st.raf = null; return; }
      const u = Math.min(1, (now - t0) / dur);
      el.volume = Math.max(0, target * u);
      if (u >= 1) {
        el.volume = target;
        st.active = false;
        st.raf = null;
        return;
      }
      st.raf = global.requestAnimationFrame(tick);
    }
    st.raf = global.requestAnimationFrame(tick);
  }

  function fadeOut(el, opts) {
    if (!el) {
      if (typeof opts?.onDone === 'function') opts.onDone();
      return;
    }
    if (el.paused) {
      stopImmediate(el);
      if (typeof opts?.onDone === 'function') opts.onDone();
      return;
    }
    cancelFade(el);
    const st = { active: true, fadeOut: true, raf: null };
    fadeState.set(el, st);
    const fromVol = Number(el.volume) || getTargetVolume();
    const dur = Math.max(200, Number(opts?.durationMs) || 1400);
    const t0 = performance.now();
    function tick(now) {
      if (!st.active) { st.raf = null; return; }
      const u = Math.min(1, (now - t0) / dur);
      el.volume = Math.max(0, fromVol * (1 - u));
      if (u >= 1) {
        try { el.pause(); el.currentTime = 0; } catch (_) { /* noop */ }
        st.active = false;
        st.fadeOut = false;
        st.raf = null;
        applyVolumeSettings(el);
        if (typeof opts?.onDone === 'function') opts.onDone();
        return;
      }
      st.raf = global.requestAnimationFrame(tick);
    }
    st.raf = global.requestAnimationFrame(tick);
  }

  function isFadeActive(el) {
    const st = fadeState.get(el);
    return !!(st && st.active);
  }

  function isFadeOutActive(el) {
    const st = fadeState.get(el);
    return !!(st && st.active && st.fadeOut);
  }

  function pickRandomBattleTrack() {
    const id = BATTLE_TRACK_IDS[Math.floor(Math.random() * BATTLE_TRACK_IDS.length)];
    return TRACKS[id];
  }

  function getTrack(id) {
    return TRACKS[id] || null;
  }

  function listPreviewTracks() {
    return PREVIEW_TRACK_IDS.map((id) => TRACKS[id]).filter(Boolean);
  }

  const api = {
    TRACKS,
    PREVIEW_TRACK_IDS,
    SELECTABLE_TRACK_IDS,
    BATTLE_TRACK_IDS,
    getMusicSettings,
    getAudioVolumeMultipliers,
    getTargetVolume,
    getMusicOverrides,
    saveMusicOverrides,
    setTrackForRole,
    getTrackForRole,
    pickRandomBattleTrack,
    getTrack,
    listPreviewTracks,
    listSelectableTracks,
    fadeIn,
    fadeOut,
    stopImmediate,
    cancelFade,
    applyVolumeSettings,
    isFadeActive,
    isFadeOutActive,
  };

  global.BgmShared = api;
  if (!global.Avian) global.Avian = {};
  global.Avian.audio = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
