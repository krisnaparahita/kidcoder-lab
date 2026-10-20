/* =============================================================
 * KidCoder Lab - runner.js
 * The level flow: Learn -> Practice (shuffled set) -> Summary.
 * This is the only place that talks to both the renderers and
 * the progress engine.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var C = App.Curriculum;

  var state = {
    level: null,
    set: null,
    index: 0,
    correct: 0,
    xp: 0,
    startedAt: 0,
    renderer: null,
    ex: null,
    wrongCount: 0,
    container: null,
    finished: false
  };

  /* ------------------------------- helpers ----------------------------- */

  function catColour(level) {
    var cat = C.categoryOf(level.id);
    return cat ? cat.colour : 'var(--primary)';
  }

  function header(level, subtitle) {
    return U.el('div.runner-head', {}, [
      U.el('button.btn.icon.ghost', { text: '←', title: 'Back to the map', onclick: function () { App.audio.play('click'); App.go('#/map'); } }),
      U.el('div', {}, [
        U.el('h2', { text: level.icon + ' ' + level.title }),
        U.el('div.muted', { text: subtitle })
      ]),
      U.el('div.spacer'),
      U.el('span.pill.tag-cat', { style: { '--cat': catColour(level) }, text: (C.categoryOf(level.id) || {}).title || '' })
    ]);
  }

  function dots(n, index, marks) {
    var d = U.el('div.dots');
    for (var i = 0; i < n; i++) {
      var cls = '';
      if (marks[i] === true) cls = 'done';
      else if (marks[i] === false) cls = 'bad';
      if (i === index && !state.finished) cls += ' now';
      d.appendChild(U.el('i', { class: cls }));
    }
    return d;
  }

  /* ----------------------------- learn screen -------------------------- */

  function renderLearn(container, level) {
    var stat = App.store.getLevelStat(App.Progress.get(), level.id, true);
    var cat = C.categoryOf(level.id);
    var card = U.el('div.concept', { style: { '--cat': cat.colour } }, [
      U.el('div.row.wrap', { style: { marginBottom: '10px' } }, [
        U.el('span.pill', { text: 'Step ' + (level.positionInCategory + 1) + ' of ' + cat.levels.length }),
        U.el('span.pill', { text: cat.icon + ' ' + cat.title }),
        U.el('span.pill', { text: 'age ' + cat.age })
      ]),
      U.el('h2', { text: level.icon + ' ' + level.title }),
      U.el('ul.teach', {}, level.teach.map(function (t) { return U.el('li', { html: t }); })),
      U.el('div.big-note', { html: level.concept }),
      U.el('div.row.wrap', { style: { marginTop: '16px' } }, [
        U.el('button.btn.primary.big', {
          text: '▶ Start practice (' + level.exercise.count + ' exercises)',
          onclick: function () { App.audio.play('click'); startPractice(container, level); }
        })
      ])
    ]);

    if (stat.attempts > 0) {
      card.appendChild(U.el('p.muted', {
        style: { marginTop: '14px' },
        text: 'You have tried this level ' + stat.attempts + ' time(s), ' + stat.correct +
          ' correct. Every practice round is shuffled, so it stays fresh.'
      }));
    }

    U.mount(container, [
      header(level, 'Learn the idea first'),
      card
    ]);
  }

  /* ---------------------------- practice loop -------------------------- */

  function startPractice(container, level) {
    var seed = U.uid('s');
    state.level = level;
    state.set = App.Exercises.buildSet(level, seed);
    state.index = 0;
    state.correct = 0;
    state.xp = 0;
    state.marks = [];
    state.wrongCount = 0;
    state.finished = false;
    state.startedAt = Date.now();
    var stat = App.store.getLevelStat(App.Progress.get(), level.id, true);
    stat.lastSeed = seed;
    App.Progress.markConcept(level.id);
    renderExercise(container);
  }

  function renderExercise(container) {
    var level = state.level;
    var ex = state.set.items[state.index];
    state.ex = ex;
    state.wrongCount = 0;
    state.renderer = null;

    var work = U.el('div.work');
    var feedback = U.el('div');
    var actions = U.el('div.row.wrap', { style: { marginTop: '14px' } });

    var api = {
      submit: function (value) {
        return Promise.resolve(value).then(function (v) { return gradeExercise(v, container); });
      },
      settings: (App.Progress.get().settings || {})
    };

    var renderer = (App.Renderers[ex.type] || App.Renderers.logic).render(ex, api);
    state.renderer = renderer;
    work.appendChild(renderer.node);

    var hintBtn = U.el('button.btn.ghost.small', {
      text: '💡 Hint',
      onclick: function () {
        App.audio.play('click');
        feedback.innerHTML = '';
        feedback.appendChild(U.el('div.feedback.info', { text: '💡 ' + ex.hint }));
      }
    });

    var checkBtn = null;
    if (!renderer.autoSubmit) {
      checkBtn = U.el('button.btn.primary.big', {
        text: renderer.checkLabel || 'Check ✓',
        onclick: function () {
          App.audio.play('click');
          var maybe = renderer.attempt();
          Promise.resolve(maybe).then(function (v) { return gradeExercise(v, container); });
        }
      });
      actions.appendChild(checkBtn);
    }
    actions.appendChild(hintBtn);

    var card = U.el('div.ex-card', {}, [
      U.el('div.ex-head', {}, [
        U.el('div.ex-prompt', { html: '<b>Exercise ' + (state.index + 1) + ' of ' + state.set.items.length + '</b><br>' + ex.prompt }),
        U.el('div.spacer'),
        dots(state.set.items.length, state.index, state.marks)
      ]),
      work,
      actions,
      feedback
    ]);

    U.mount(container, [
      header(level, 'Practise — ' + (C.categoryOf(level.id) || {}).title),
      card
    ]);

    state.feedbackBox = feedback;
    state.actionsBox = actions;
    state.card = card;
  }

  function gradeExercise(attempt, container) {
    var ex = state.ex;
    var level = state.level;
    var feedback = state.feedbackBox;
    var res;
    try {
      res = ex.grade(attempt);
    } catch (e) {
      res = { correct: false, message: 'Something went wrong checking that. Try again.' };
    }

    U.clear(feedback);
    U.clear(state.actionsBox);

    if (res.correct) {
      var rec = App.Progress.record(level.id, true, ex.xp || 5);
      state.xp += rec.xpGained;
      state.correct++;
      state.marks[state.index] = true;
      App.audio.play('correct');
      if (state.renderer && state.renderer.onCorrect) state.renderer.onCorrect(res);

      feedback.appendChild(U.el('div.feedback.ok.pop', {}, [
        U.el('div', { text: '✅ ' + res.message }),
        U.el('div.muted', { text: '+' + (ex.xp || 5) + ' XP' + (rec.combo > 2 ? '  ·  combo ×' + rec.combo : '') })
      ]));

      var last = state.index >= state.set.items.length - 1;
      state.actionsBox.appendChild(U.el('button.btn.primary.big', {
        text: last ? 'See results →' : 'Next exercise →',
        onclick: function () {
          App.audio.play('click');
          if (last) finish(container);
          else { state.index++; renderExercise(container); }
        }
      }));
      if (!last) {
        state.actionsBox.appendChild(U.el('button.btn.ghost', {
          text: '↺ Restart this one',
          onclick: function () { App.audio.play('click'); renderExercise(container); }
        }));
      }
    } else {
      state.wrongCount++;
      var firstWrong = !ex._wrongRecorded;
      if (firstWrong) {
        ex._wrongRecorded = true;
        App.Progress.record(level.id, false, 0);
      }
      App.audio.play('wrong');
      feedback.appendChild(U.el('div.feedback.bad.shake', {}, [
        U.el('div', { text: '❌ ' + res.message }),
        res.detail && res.detail.error ? U.el('pre', { text: res.detail.error.hint || '' }) : null
      ]));

      if (state.renderer && state.renderer.retryable) {
        state.actionsBox.appendChild(U.el('button.btn.warn.big', {
          text: '↻ Try again',
          onclick: function () {
            App.audio.play('click');
            if (state.renderer.reset) state.renderer.reset();
            U.clear(feedback);
            U.clear(state.actionsBox);
            buildActions();
          }
        }));
      }

      if (state.wrongCount >= 2 && state.renderer && state.renderer.revealSolution) {
        state.actionsBox.appendChild(U.el('button.btn.ghost', {
          text: '👀 Show me the answer',
          onclick: function () {
            state.renderer.revealSolution();
            U.clear(feedback);
            feedback.appendChild(U.el('div.feedback.info', { text: 'Here is one working answer. Read it, then try to write it yourself.' }));
          }
        }));
      }

      // for non-retryable exercises: show the answer and move on
      if (!state.renderer.retryable) {
        if (state.renderer.markAnswer) state.renderer.markAnswer(res);
        state.marks[state.index] = false;
        state.actionsBox.appendChild(U.el('button.btn.ghost.big', {
          text: state.index >= state.set.items.length - 1 ? 'See results →' : 'Next exercise →',
          onclick: function () {
            App.audio.play('click');
            if (state.index >= state.set.items.length - 1) finish(container);
            else { state.index++; renderExercise(container); }
          }
        }));
      }
      buildActions(false);
    }
    return res;
  }

  function buildActions(isRetry) {
    // nothing extra needed: buttons were already added by the caller
  }

  /* ------------------------------- summary ----------------------------- */

  function finish(container) {
    state.finished = true;
    var level = state.level;
    var elapsed = Date.now() - state.startedAt;
    App.Progress.levelTime(level.id, elapsed);

    var result = App.Progress.completeRun(level.id, {
      correct: state.correct,
      total: state.set.items.length,
      xp: state.xp,
      timeMs: elapsed
    });

    var stars = '';
    for (var i = 0; i < 3; i++) stars += i < result.stars ? '⭐' : '☆';

    var box = U.el('div.ex-card.summary', {}, [
      U.el('div.bigstars', { text: stars }),
      U.el('h2', { text: state.correct + ' / ' + state.set.items.length + ' correct' }),
      U.el('div.xp', { text: '+' + state.xp + ' XP' }),
      U.el('p.muted', { text: 'Accuracy ' + Math.round(result.accuracy * 100) + '% · time ' + U.humanTime(elapsed) })
    ]);

    if (result.justMastered) {
      App.audio.play('win');
      box.appendChild(U.el('div.feedback.ok.pop', { style: { marginTop: '14px' }, text: '🏆 Level mastered! The next step is unlocked.' }));
    } else if (!result.mastered) {
      box.appendChild(U.el('div.feedback.info', {
        style: { marginTop: '14px' },
        html: 'Not mastered yet — you need <b>' + (level.mastery.correct) + '</b> correct answers at <b>' +
          Math.round(level.mastery.accuracy * 100) + '%</b> accuracy. Practise again, the exercises will be different!'
      }));
    }

    result.unlockedLevels.forEach(function (l) {
      box.appendChild(U.el('div.feedback.ok', { text: '🔓 New level unlocked: ' + l.icon + ' ' + l.title }));
    });
    result.newBadges.forEach(function (b) {
      App.audio.play('badge');
      box.appendChild(U.el('div.badge-pop', { style: { marginTop: '12px' } }, [
        U.el('div.bi', { text: b.icon }),
        U.el('div', {}, [U.el('b', { text: 'Badge earned: ' + b.title }), U.el('div.muted', { text: b.desc })])
      ]));
    });

    var actions = U.el('div.row.wrap', { style: { marginTop: '18px', justifyContent: 'center' } }, [
      U.el('button.btn.primary.big', {
        text: '🔀 Practise again (new exercises)',
        onclick: function () { App.audio.play('click'); startPractice(container, level); }
      })
    ]);

    var next = C.nextLevel(App.Progress.get(), level.id);
    if (next && C.levelUnlocked(App.Progress.get(), next.id)) {
      actions.appendChild(U.el('button.btn.ok.big', {
        text: 'Next: ' + next.icon + ' ' + next.title + ' →',
        onclick: function () { App.audio.play('click'); App.go('#/level/' + next.id); }
      }));
    }
    actions.appendChild(U.el('button.btn.ghost.big', {
      text: 'Back to map',
      onclick: function () { App.audio.play('click'); App.go('#/map'); }
    }));
    box.appendChild(actions);

    U.mount(container, [header(level, 'Results'), box]);
  }

  /* -------------------------------- api -------------------------------- */

  App.Runner = {
    levelId: null,
    state: state,          // exposed for debugging / automated tests
    render: function (container, levelId) {
      var level = C.byId[levelId];
      if (!level) { App.go('#/map'); return; }
      App.Runner.levelId = levelId;
      state.level = level;
      renderLearn(container, level);
    }
  };
})(window.App);
