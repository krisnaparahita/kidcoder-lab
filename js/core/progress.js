/* =============================================================
 * KidCoder Lab - progress.js
 * All rules that turn "an answer was given" into XP, stars,
 * mastery, unlocks and badges. Kept separate from the UI so the
 * learning rules can be tested and tuned in one place.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var C = App.Curriculum;

  var state = { profile: null, data: null };

  function attach(profile) {
    state.profile = profile;
    state.data = App.store.loadProgress(profile.id);
    if (state.data.combo === undefined) state.data.combo = 0;
    if (state.data.bestCombo === undefined) state.data.bestCombo = 0;
    return state.data;
  }

  function get() { return state.data; }
  function profile() { return state.profile; }

  function save() {
    if (!state.profile) return;
    state.data.lastSavedAt = Date.now();
    App.store.saveProgress(state.profile.id, state.data);
    App.store.updateProfile(state.profile.id, { lastActiveAt: Date.now() });
  }

  function touchStreak() {
    var today = U.todayKey();
    if (state.data.lastPracticeDay !== today) {
      state.data.streakDays = (state.data.streakDays || 0) + 1;
      state.data.lastPracticeDay = today;
    }
  }

  /** One answer. Returns {combo, xpGained, correct} */
  function record(levelId, correct, xp) {
    var d = state.data;
    var stat = App.store.getLevelStat(d, levelId, C.levelUnlocked(d, levelId));
    stat.attempts++;
    d.totalAttempts++;
    touchStreak();
    if (correct) {
      stat.correct++;
      d.totalCorrect++;
      d.combo = (d.combo || 0) + 1;
      if (d.combo > (d.bestCombo || 0)) d.bestCombo = d.combo;
      var gained = xp || 0;
      d.xp += gained;
      stat.xp = (stat.xp || 0) + gained;
      return { combo: d.combo, xpGained: gained, correct: true };
    }
    d.combo = 0;
    return { combo: 0, xpGained: 0, correct: false };
  }

  function addTime(ms) {
    state.data.totalTimeMs += ms;
    var stat = App.store.getLevelStat(state.data, App.Runner.levelId || '', true);
    if (stat) stat.timeMs = (stat.timeMs || 0) + ms;
  }

  function levelTime(levelId, ms) {
    var stat = App.store.getLevelStat(state.data, levelId, true);
    stat.timeMs = (stat.timeMs || 0) + ms;
    state.data.totalTimeMs += ms;
  }

  /**
   * Called when a practice set finishes.
   * @returns { stars, mastered, levelStars, unlockedLevels:[], newBadges:[], xp }
   */
  function completeRun(levelId, summary) {
    var d = state.data;
    var level = C.byId[levelId];
    var stat = App.store.getLevelStat(d, levelId, true);
    stat.runs++;
    var accuracy = summary.total ? summary.correct / summary.total : 0;
    stat.bestAccuracy = Math.max(stat.bestAccuracy || 0, accuracy);

    var wasMastered = stat.mastered;
    var mastered = C.levelMastered(level, stat);
    var stars = C.starsFor(level, accuracy);

    var before = { stars: stat.stars || 0, mastered: wasMastered };
    stat.stars = Math.max(stat.stars || 0, stars);
    stat.mastered = stat.mastered || mastered;
    if (mastered && !wasMastered) {
      stat.masteredAt = Date.now();
      d.xp += (level.xp || 30);                       // mastery bonus
      d.stars += 1;                                    // mastery star
    } else if (stars > before.stars) {
      d.stars += (stars - before.stars);
    }

    d.history.unshift({ at: Date.now(), levelId: levelId, correct: summary.correct, total: summary.total, xp: summary.xp || 0 });
    if (d.history.length > 100) d.history.length = 100;

    // unlock the next level in the category
    var unlocked = [];
    var cat = C.categoryOf(levelId);
    if (cat && mastered) {
      var nextIdx = level.positionInCategory + 1;
      if (nextIdx < cat.levels.length) {
        var nxt = cat.levels[nextIdx];
        if (!d.levels[nxt.id]) {
          d.levels[nxt.id] = App.store.newLevelStat(nxt.id, true);
          unlocked.push(nxt);
        } else if (!d.levels[nxt.id].unlocked) {
          d.levels[nxt.id].unlocked = true;
          unlocked.push(nxt);
        }
      }
    }
    // opening a whole new category?
    C.CATEGORIES.forEach(function (c) {
      if (c.requires && C.categoryUnlocked(d, c.id)) {
        var first = c.levels[0];
        if (first && !d.levels[first.id]) {
          d.levels[first.id] = App.store.newLevelStat(first.id, true);
          if (unlocked.indexOf(first) < 0) unlocked.push(first);
        }
      }
    });

    var newBadges = awardBadges();
    save();
    return {
      stars: stars,
      levelStars: stat.stars,
      mastered: stat.mastered,
      justMastered: mastered && !wasMastered,
      accuracy: accuracy,
      unlockedLevels: unlocked,
      newBadges: newBadges
    };
  }

  function awardBadges() {
    var d = state.data;
    var earned = [];
    C.BADGES.forEach(function (b) {
      var has = d.badges.some(function (x) { return x.id === b.id; });
      if (!has) {
        try {
          if (b.test(d)) { d.badges.push({ id: b.id, earnedAt: Date.now() }); earned.push(b); }
        } catch (e) { /* a badge test must never break the app */ }
      }
    });
    return earned;
  }

  function galleryAdd(item) {
    state.data.gallery.unshift(Object.assign({ id: U.uid('art'), createdAt: Date.now() }, item));
    if (state.data.gallery.length > 60) state.data.gallery.length = 60;
    save();
    return state.data.gallery[0];
  }

  function galleryRemove(id) {
    state.data.gallery = state.data.gallery.filter(function (g) { return g.id !== id; });
    save();
  }

  function markConcept(id) {
    if (state.data.seenConcepts.indexOf(id) < 0) state.data.seenConcepts.push(id);
  }

  /** Portfolio of saved Python projects (kept in the gallery namespace). */
  function saveProject(title, code) {
    return galleryAdd({ type: 'code', title: title, code: code });
  }

  function reset(profileId) {
    var fresh = App.store.loadProgress(profileId);
    App.store.saveProgress(profileId, {
      schema: 1, profileId: profileId, xp: 0, coins: 0, stars: 0, streakDays: 0,
      lastPracticeDay: null, combo: 0, bestCombo: 0, totalCorrect: 0, totalAttempts: 0,
      totalTimeMs: 0, levels: {}, badges: [], gallery: [], seenConcepts: [], history: [],
      settings: { sound: true, animation: true, largeText: false, reducedMotion: false }
    });
    state.data = App.store.loadProgress(profileId);
    return state.data;
  }

  function levelSummary() {
    var d = state.data;
    return C.LEVELS.map(function (l) {
      var st = d.levels[l.id] || {};
      return {
        level: l,
        unlocked: C.levelUnlocked(d, l.id),
        mastered: !!st.mastered,
        stars: st.stars || 0,
        correct: st.correct || 0,
        attempts: st.attempts || 0,
        accuracy: st.attempts ? (st.correct / st.attempts) : 0
      };
    });
  }

  function totals() {
    var d = state.data;
    var mastered = C.LEVELS.filter(function (l) { return d.levels[l.id] && d.levels[l.id].mastered; }).length;
    return {
      xp: d.xp || 0,
      stars: d.stars || 0,
      mastered: mastered,
      total: C.LEVELS.length,
      accuracy: d.totalAttempts ? d.totalCorrect / d.totalAttempts : 0,
      attempts: d.totalAttempts || 0,
      timeMs: d.totalTimeMs || 0,
      streak: d.streakDays || 0
    };
  }

  App.Progress = {
    attach: attach,
    get: get,
    profile: profile,
    save: save,
    record: record,
    levelTime: levelTime,
    completeRun: completeRun,
    awardBadges: awardBadges,
    galleryAdd: galleryAdd,
    galleryRemove: galleryRemove,
    markConcept: markConcept,
    saveProject: saveProject,
    reset: reset,
    levelSummary: levelSummary,
    totals: totals
  };
})(window.App);
