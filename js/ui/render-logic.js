/* =============================================================
 * KidCoder Lab - render-logic.js
 * Widgets for patterns, decomposition, classification, debugging
 * and the yes/no detective game.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  App.Renderers = App.Renderers || {};

  function mcBlock(ex, api, renderLabel) {
    var wrap = U.el('div.choices');
    var locked = false;
    ex.choices.forEach(function (c, idx) {
      var btn = U.el('button.choice', {
        onclick: function () {
          if (locked) return;
          locked = true;
          App.audio.play('click');
          wrap.querySelectorAll('.choice').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
          api.submit(c.value).then(function (res) {
            btn.classList.add(res && res.correct ? 'right' : 'wrong');
          });
        }
      });
      if (renderLabel) renderLabel(btn, c); else btn.textContent = c.label;
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* ------------------------------ sequence ----------------------------- */

  function sequence(ex, api) {
    var row = U.el('div.pattern-row');
    ex.items.forEach(function (it) {
      row.appendChild(U.el('div.slot', { text: it }));
    });
    row.appendChild(U.el('div.slot.q', { text: '?' }));
    var node = U.el('div.work', {}, [row, mcBlock(ex, api, function (btn, c) {
      if (c.label.length > 12) { btn.appendChild(U.el('pre', { text: c.label })); }
      else btn.textContent = c.label;
    })]);
    return { node: node, attempt: function () { return null; }, autoSubmit: true };
  }

  /* ------------------------------ odd one ------------------------------ */

  function odd(ex, api) {
    var grid = U.el('div.choices');
    var locked = false;
    ex.items.forEach(function (item, idx) {
      var btn = U.el('button.choice', {
        onclick: function () {
          if (locked) return;
          locked = true;
          App.audio.play('click');
          btn.classList.add('on');
          api.submit(idx).then(function (res) {
            btn.classList.add(res && res.correct ? 'right' : 'wrong');
          });
        }
      }, [U.el('div', { style: { fontSize: '38px' }, text: item.emoji })]);
      grid.appendChild(btn);
    });
    return { node: U.el('div.work', {}, [grid]), attempt: function () { return null; }, autoSubmit: true };
  }

  /* ---------------------------- order steps ---------------------------- */

  function orderSteps(ex, api) {
    var order = [];
    var pool = U.el('div.step-pool');
    var answer = U.el('div.answer-list');
    var list = U.el('ol');
    answer.appendChild(list);

    function refresh() {
      U.clear(pool);
      ex.pool.forEach(function (s) {
        var used = order.indexOf(s.id) >= 0;
        var b = U.el('button.s' + (used ? '.used' : ''), {
          disabled: used,
          onclick: function () {
            order.push(s.id);
            App.audio.play('click');
            refresh();
          }
        }, [
          U.el('span.pill', { text: String(order.length + 1) }),
          U.el('span', { text: s.label })
        ]);
        pool.appendChild(b);
      });
      U.clear(list);
      order.forEach(function (id, i) {
        var s = ex.pool.filter(function (p) { return p.id === id; })[0];
        list.appendChild(U.el('li', { text: s ? s.label : '' }));
      });
      if (!order.length) {
        U.clear(answer);
        answer.appendChild(U.el('div.muted', { text: 'Tap the steps below in the right order.' }));
      } else if (!answer.contains(list)) {
        U.clear(answer); answer.appendChild(list);
      }
    }

    var bar = U.el('div.row', {}, [
      U.el('button.btn.ghost.small', { text: '↶ Undo', onclick: function () { order.pop(); refresh(); } }),
      U.el('button.btn.ghost.small', { text: 'Clear', onclick: function () { order = []; refresh(); } })
    ]);

    refresh();
    return {
      node: U.el('div.work', {}, [
        U.el('h4', { text: ex.title }),
        answer, bar,
        U.el('div', { style: { marginTop: '12px' } }, [pool])
      ]),
      type: 'logic',
      retryable: true,
      attempt: function () { return order.slice(); },
      reset: function () { order = []; refresh(); }
    };
  }

  /* ------------------------------ classify ----------------------------- */

  function classify(ex, api) {
    var map = {};
    var selected = null;

    var tray = U.el('div.row.wrap', { style: { marginBottom: '14px' } });
    var buckets = U.el('div.buckets');

    function refreshTray() {
      U.clear(tray);
      ex.items.forEach(function (it) {
        var placed = !!map[it.id];
        var chip = U.el('button.item-chip' + (selected === it.id ? '.sel' : ''), {
          dataset: { id: it.id },
          disabled: placed,
          onclick: function () { selected = it.id; refreshTray(); }
        }, [U.el('span', { text: it.emoji })]);
        tray.appendChild(chip);
      });
      if (Object.keys(map).length === ex.items.length) {
        tray.appendChild(U.el('span.pill', { text: 'all placed ✓' }));
      }
    }

    function refreshBuckets() {
      U.clear(buckets);
      ex.buckets.forEach(function (b) {
        var box = U.el('div.bucket', {
          dataset: { id: b.id },
          onclick: function () {
            if (!selected) return;
            map[selected] = b.id;
            selected = null;
            App.audio.play('tap');
            refreshTray(); refreshBuckets();
          }
        });
        box.appendChild(U.el('h4', { text: b.label }));
        var items = U.el('div.items');
        ex.items.forEach(function (it) {
          if (map[it.id] === b.id) {
            items.appendChild(U.el('span.item-chip', {
              onclick: function (e) { e.stopPropagation(); delete map[it.id]; refreshTray(); refreshBuckets(); },
              title: 'click to take it out'
            }, [U.el('span', { text: it.emoji })]));
          }
        });
        box.appendChild(items);
        buckets.appendChild(box);
      });
    }

    refreshTray(); refreshBuckets();
    return {
      node: U.el('div.work', {}, [
        U.el('p.muted', { text: '1) Tap an item   2) Tap the group it belongs to' }),
        tray, buckets
      ]),
      type: 'logic',
      retryable: true,
      attempt: function () { return Object.assign({}, map); },
      reset: function () { map = {}; selected = null; refreshTray(); refreshBuckets(); }
    };
  }

  /* -------------------------------- bug -------------------------------- */

  function bug(ex, api) {
    var box = U.el('div.step-pool');
    var locked = false;
    ex.steps.forEach(function (s, idx) {
      var b = U.el('button.s', {
        onclick: function () {
          if (locked) return;
          locked = true;
          App.audio.play('click');
          api.submit(idx).then(function (res) {
            if (res && res.correct) b.classList.add('picked');
            else b.style.borderColor = 'var(--bad)';
          });
        }
      }, [U.el('span.pill', { text: String(idx + 1) }), U.el('span', { text: s })]);
      box.appendChild(b);
    });
    return {
      node: U.el('div.work', {}, [U.el('h4', { text: 'Plan: ' + ex.title }), box]),
      attempt: function () { return null; },
      autoSubmit: true
    };
  }

  /* ------------------------------ detective ---------------------------- */

  function detective(ex, api) {
    var asked = 0;
    var alive = {};
    ex.suspects.forEach(function (s) { alive[s.id] = true; });
    var guessed = null;

    var grid = U.el('div.suspects');
    var qbox = U.el('div.qlist');
    var log = U.el('div.simlog');

    function refresh() {
      U.clear(grid);
      ex.suspects.forEach(function (s) {
        var out = !alive[s.id] && guessed !== s.id;
        var b = U.el('button.suspect' + (out ? '.out' : ''), {
          dataset: { id: s.id },
          onclick: function () {
            if (!alive[s.id]) return;
            guessed = s.id;
            refresh();
            api.submit({ guessed: s.id, asked: asked });
          }
        }, [
          U.el('div.e', { text: s.emoji }),
          U.el('div.attrs', { text: s.legs + ' legs · ' + s.size + ' · ' + s.home + ' · ' + s.hue })
        ]);
        grid.appendChild(b);
      });

      U.clear(qbox);
      ex.questions.forEach(function (q) {
        var yes = ex.suspects.filter(function (s) { return alive[s.id] && q.test(s); }).length;
        var totalAlive = ex.suspects.filter(function (s) { return alive[s.id]; }).length;
        var btn = U.el('button.qbtn', {
          onclick: function () {
            if (totalAlive <= 1 || guessed) return;
            var answer = ex.suspects.filter(function (s) { return alive[s.id] && q.test(s); }).length > 0
              && (function () {
                var secret = ex.suspects.filter(function (s) { return s.id === ex.secretId; })[0];
                return q.test(secret);
              })();
            ex.suspects.forEach(function (s) {
              if (alive[s.id] && q.test(s) !== answer) alive[s.id] = false;
            });
            asked++;
            log.textContent += 'Q' + asked + ': ' + q.label + ' → ' + (answer ? 'YES' : 'NO') + '\n';
            refresh();
          }
        }, [
          U.el('span', { text: q.label }),
          U.el('span.cnt', { text: ' ' + yes + '/' + totalAlive })
        ]);
        qbox.appendChild(btn);
      });
    }

    refresh();
    return {
      node: U.el('div.work', {}, [
        U.el('p.muted', { text: 'Ask smart questions (aim for about half), then tap the creature.' }),
        grid,
        U.el('h4', { style: { marginTop: '14px' }, text: 'Questions' }),
        qbox,
        log
      ]),
      attempt: function () { return null; },
      autoSubmit: true,
      reset: function () { asked = 0; guessed = null; ex.suspects.forEach(function (s) { alive[s.id] = true; }); refresh(); }
    };
  }

  var MAP = {
    'sequence': sequence,
    'odd': odd,
    'order-steps': orderSteps,
    'classify': classify,
    'bug': bug,
    'detective': detective
  };

  App.Renderers.logic = {
    render: function (ex, api) {
      var fn = MAP[ex.variant] || sequence;
      var r = fn(ex, api);
      r.type = 'logic';
      return r;
    },
    mcBlock: mcBlock
  };
})(window.App);
