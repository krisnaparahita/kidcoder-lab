/* =============================================================
 * KidCoder Lab - storage.js
 * Local-first persistence. Every profile lives in the browser cache
 * (localStorage) so sessions are independent per device / per kid.
 * No account, no server, no network access required.
 * ============================================================= */
(function (App) {
  'use strict';

  var KEY_PROFILES = 'kidcoder.profiles.v1';
  var KEY_CLIENT = 'kidcoder.client.v1';
  var PROGRESS_PREFIX = 'kidcoder.progress.v1.';
  var SCHEMA = 1;

  /* -------------- low level: works even if storage blocked -------------- */

  var memory = {};
  var backend = (function () {
    try {
      var probe = '__kidcoder_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      // Safari private mode / disabled storage -> fall back to RAM
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; },
        setItem: function (k, v) { memory[k] = String(v); },
        removeItem: function (k) { delete memory[k]; }
      };
    }
  })();

  var persistent = backend === window.localStorage;

  function readJSON(key, fallback) {
    try {
      var raw = backend.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val === null || val === undefined ? fallback : val;
    } catch (e) {
      console.warn('[storage] corrupt entry, resetting:', key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[storage] write failed (quota?):', key, e);
      return false;
    }
  }

  function remove(key) { try { backend.removeItem(key); } catch (e) { /* ignore */ } }

  /* --------------------------- client record --------------------------- */

  function getClient() {
    var c = readJSON(KEY_CLIENT, null);
    if (!c || c.schema !== SCHEMA) {
      c = { schema: SCHEMA, activeProfileId: null, lastVisited: null, launches: 0 };
      writeJSON(KEY_CLIENT, c);
    }
    return c;
  }

  function saveClient(c) { writeJSON(KEY_CLIENT, c); return c; }

  /* ------------------------------ profiles ----------------------------- */

  function listProfiles() {
    var data = readJSON(KEY_PROFILES, null);
    if (!data || !Array.isArray(data.profiles)) {
      data = { schema: SCHEMA, profiles: [] };
      writeJSON(KEY_PROFILES, data);
    }
    return data.profiles;
  }

  function saveProfiles(list) { writeJSON(KEY_PROFILES, { schema: SCHEMA, profiles: list }); }

  function getProfile(id) {
    var list = listProfiles();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐧', '🐙', '🦄', '🐝', '🐢', '🦉', '🐳', '🤖'];

  function createProfile(input) {
    var list = listProfiles();
    var id = App.util.uid('p');
    var profile = {
      id: id,
      name: String(input.name || 'Coder').slice(0, 24),
      avatar: input.avatar || AVATARS[list.length % AVATARS.length],
      age: App.util.clamp(parseInt(input.age, 10) || 6, 4, 14),
      pin: input.pin ? String(input.pin).slice(0, 8) : '',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };
    list.push(profile);
    saveProfiles(list);
    saveProgress(id, newProgress(id));
    return profile;
  }

  function updateProfile(id, patch) {
    var list = listProfiles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        Object.keys(patch).forEach(function (k) { list[i][k] = patch[k]; });
        list[i].lastActiveAt = Date.now();
        saveProfiles(list);
        return list[i];
      }
    }
    return null;
  }

  function deleteProfile(id) {
    saveProfiles(listProfiles().filter(function (p) { return p.id !== id; }));
    remove(PROGRESS_PREFIX + id);
    var c = getClient();
    if (c.activeProfileId === id) { c.activeProfileId = null; saveClient(c); }
  }

  /* ------------------------------ progress ----------------------------- */

  function newProgress(profileId) {
    return {
      schema: SCHEMA,
      profileId: profileId,
      xp: 0,
      coins: 0,
      stars: 0,                 // total stars earned
      streakDays: 0,
      lastPracticeDay: null,
      combo: 0,
      bestCombo: 0,
      totalCorrect: 0,
      totalAttempts: 0,
      totalTimeMs: 0,
      levels: {},               // levelId -> LevelStat
      badges: [],               // [{id, earnedAt}]
      gallery: [],              // [{id, title, type, grid, createdAt}]
      seenConcepts: [],         // concept ids introduced
      history: [],              // [{at, levelId, correct, total, xp}]
      settings: { sound: true, animation: true, largeText: false, reducedMotion: false }
    };
  }

  function newLevelStat(levelId, unlocked) {
    return {
      levelId: levelId,
      unlocked: !!unlocked,
      attempts: 0,
      correct: 0,
      runs: 0,               // completed practice sets
      bestAccuracy: 0,
      bestCombo: 0,
      stars: 0,
      mastered: false,
      masteredAt: null,
      lastSeed: null,
      timeMs: 0
    };
  }

  function loadProgress(profileId) {
    var p = readJSON(PROGRESS_PREFIX + profileId, null);
    if (!p || p.schema !== SCHEMA) p = newProgress(profileId);
    // back-fill defensively so old saves never break the UI
    var base = newProgress(profileId);
    Object.keys(base).forEach(function (k) {
      if (p[k] === undefined) p[k] = base[k];
    });
    if (!p.levels) p.levels = {};
    return p;
  }

  function saveProgress(profileId, progress) {
    progress.profileId = profileId;
    writeJSON(PROGRESS_PREFIX + profileId, progress);
    return progress;
  }

  function getLevelStat(progress, levelId, defaultUnlocked) {
    if (!progress.levels[levelId]) progress.levels[levelId] = newLevelStat(levelId, defaultUnlocked);
    return progress.levels[levelId];
  }

  /* --------------------------- active profile -------------------------- */

  function getActiveId() { return getClient().activeProfileId; }

  function setActiveId(id) {
    var c = getClient();
    c.activeProfileId = id;
    c.lastVisited = Date.now();
    c.launches = (c.launches || 0) + 1;
    saveClient(c);
    if (id) updateProfile(id, { lastActiveAt: Date.now() });
    return id;
  }

  /* -------------------------- import / export -------------------------- */

  function exportProfile(id) {
    return {
      kind: 'kidcoder-profile',
      schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      profile: getProfile(id),
      progress: loadProgress(id)
    };
  }

  function importProfile(payload, opts) {
    if (!payload || payload.kind !== 'kidcoder-profile' || !payload.profile) {
      throw new Error('This file is not a KidCoder Lab profile backup.');
    }
    var p = payload.profile;
    var existing = getProfile(p.id);
    var id = p.id;
    if (existing && !(opts && opts.overwrite)) {
      id = App.util.uid('p');   // import as a copy
      p.id = id;
    }
    var list = listProfiles();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) idx = i;
    if (idx >= 0) list[idx] = p; else list.push(p);
    saveProfiles(list);
    var prog = payload.progress || newProgress(id);
    prog.profileId = id;
    prog.schema = SCHEMA;
    saveProgress(id, prog);
    return p;
  }

  /* ------------------------------- misc -------------------------------- */

  function estimateBytes() {
    var total = 0;
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf('kidcoder.') === 0) {
          total += (k.length + (window.localStorage.getItem(k) || '').length) * 2;
        }
      }
    } catch (e) { /* ignore */ }
    return total;
  }

  App.store = {
    AVATARS: AVATARS,
    isPersistent: persistent,
    listProfiles: listProfiles,
    getProfile: getProfile,
    createProfile: createProfile,
    updateProfile: updateProfile,
    deleteProfile: deleteProfile,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    getLevelStat: getLevelStat,
    newLevelStat: newLevelStat,
    getActiveId: getActiveId,
    setActiveId: setActiveId,
    exportProfile: exportProfile,
    importProfile: importProfile,
    estimateBytes: estimateBytes,
    getClient: getClient,
    saveClient: saveClient
  };
})(window.App);
