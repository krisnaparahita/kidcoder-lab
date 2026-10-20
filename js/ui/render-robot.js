/* =============================================================
 * KidCoder Lab - render-robot.js
 * Block command builder + step-by-step robot simulation.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var R = App.Robot;

  App.Renderers = App.Renderers || {};

  var CS = 44, GAP = 3, PAD = 6;

  function cellXY(x) { return PAD + x * (CS + GAP); }

  function render(ex, api) {
    var world = ex.world;
    var model = { body: [], procedures: ex.tools.procedure ? { A: [] } : {} };
    var active = { list: model.body, label: 'Main program' };
    var poolCounts = null;
    if (ex.pool) {
      poolCounts = {};
      ex.pool.forEach(function (c) { poolCounts[c.op] = (poolCounts[c.op] || 0) + 1; });
    }

    /* ------------------------------ world ------------------------------ */

    var worldWrap = U.el('div.worldwrap');
    var board = U.el('div.world', {
      style: {
        gridTemplateColumns: 'repeat(' + world.w + ', ' + CS + 'px)',
        gridTemplateRows: 'repeat(' + world.h + ', ' + CS + 'px)',
        width: (world.w * (CS + GAP) + PAD * 2 - GAP) + 'px',
        height: (world.h * (CS + GAP) + PAD * 2 - GAP) + 'px'
      }
    });
    var cells = [];
    for (var y = 0; y < world.h; y++) {
      for (var x = 0; x < world.w; x++) {
        var cls = 'worldcell';
        if (R.isWall(world, x, y)) cls += ' wall';
        if (world.goal.x === x && world.goal.y === y) cls += ' goal';
        var c = U.el('div', { class: cls });
        cells.push(c);
        board.appendChild(c);
      }
    }
    var robot = U.el('div.robot', {
      style: { width: CS + 'px', height: CS + 'px' }
    }, [
      U.el('span.body', { text: '🤖' }),
      U.el('span.pack')
    ]);
    worldWrap.appendChild(board);
    worldWrap.appendChild(robot);

    function drawGems(frame) {
      cells.forEach(function (c) { c.classList.remove('gem', 'placed', 'visited'); });
      frame.gems.forEach(function (g) {
        if (!g.taken) cells[g.y * world.w + g.x].classList.add('gem');
      });
      frame.placed.forEach(function (p) {
        cells[p.y * world.w + p.x].classList.add('placed');
      });
      (ex._visited || []).forEach(function (k) {
        var parts = k.split(',');
        var cx = parseInt(parts[0], 10), cy = parseInt(parts[1], 10);
        if (cells[cy * world.w + cx]) cells[cy * world.w + cx].classList.add('visited');
      });
    }

    function placeRobot(frame, animate) {
      robot.style.left = cellXY(frame.x) + 'px';
      robot.style.top = cellXY(frame.y) + 'px';
      var arrow = robot.querySelector('.body');
      arrow.style.transform = 'rotate(' + (frame.dir * 90) + 'deg)';
      robot.querySelector('.pack').textContent = frame.carrying ? '💎' + (frame.bagCount > 1 ? frame.bagCount : '') : '';
      if (!animate) { robot.style.transition = 'none'; }
    }

    /* ----------------------------- program ----------------------------- */

    var programBox = U.el('div.program');
    var activeLabel = U.el('div.gtitle', { style: { marginBottom: '6px' } });
    var logBox = U.el('div.simlog', { text: 'Press Run to watch your robot.' });

    function opLabel(op) { return R.COMMANDS[op].label; }
    function opIcon(op) { return R.COMMANDS[op].icon; }

    function removeFrom(list, index) {
      var item = list[index];
      if (!item) return;
      if (item.op === 'repeat' || item.op === 'if') {
        collectOps(item.body || []).forEach(returnToPool);
      } else {
        returnToPool(item.op);
      }
      list.splice(index, 1);
      if (!containsList(model.body, list) && !containsList(model.procedures.A || [], list)) {
        active.list = model.body; active.label = 'Main program';
      }
      refresh();
    }

    function collectOps(list) {
      var out = [];
      (list || []).forEach(function (c) {
        if (c.body) out = out.concat(collectOps(c.body));
        else out.push(c);
      });
      return out;
    }

    function containsList(rootList, target) {
      if (rootList === target) return true;
      var found = false;
      (rootList || []).forEach(function (c) {
        if (c.body && containsList(c.body, target)) found = true;
      });
      return found;
    }

    function returnToPool(op) {
      if (poolCounts && poolCounts[op] !== undefined) poolCounts[op]++;
    }

    function takeFromPool(op) {
      if (poolCounts) {
        if (!poolCounts[op]) return false;
        poolCounts[op]--;
      }
      return true;
    }

    function renderList(list, depth) {
      var box = U.el('div');
      if (!list.length) {
        box.appendChild(U.el('div.empty', { text: depth ? 'nothing inside yet' : 'Your program is empty — add blocks below.' }));
      }
      list.forEach(function (item, i) {
        var row = U.el('div.prow');
        row.appendChild(U.el('span.n', { text: (i + 1) + '' }));
        var b = U.el('button.block.' + item.op, {
          onclick: function () { removeFrom(list, i); }
        }, [U.el('span', { text: opIcon(item.op) + ' ' + opLabel(item.op) }), U.el('span.muted', { text: ' ✕' })]);
        row.appendChild(b);

        if (item.op === 'repeat') {
          var minus = U.el('button.btn.small', { text: '−', onclick: function () { item.times = Math.max(1, item.times - 1); refresh(); } });
          var plus = U.el('button.btn.small', { text: '+', onclick: function () { item.times = Math.min(8, item.times + 1); refresh(); } });
          row.appendChild(minus);
          row.appendChild(U.el('b', { text: item.times + '×' }));
          row.appendChild(plus);
        }
        if (item.op === 'if') {
          var sel = U.el('select', {
            style: { width: 'auto', padding: '4px 8px', fontSize: '.85rem' },
            onchange: function (e) { item.cond = e.target.value; refresh(); }
          });
          Object.keys(R.CONDITIONS).forEach(function (k) {
            var o = U.el('option', { value: k, text: R.CONDITIONS[k].icon + ' ' + R.CONDITIONS[k].label });
            if (item.cond === k) o.selected = true;
            sel.appendChild(o);
          });
          row.appendChild(sel);
        }
        box.appendChild(row);

        if (item.body) {
          var g = U.el('div.group.' + item.op);
          g.appendChild(U.el('div.gtitle.row', {}, [
            U.el('span', { text: 'inside ' + opLabel(item.op).toLowerCase() }),
            U.el('button.btn.small', {
              text: active.list === item.body ? 'adding here ✓' : 'add here',
              onclick: function () { active.list = item.body; active.label = 'inside ' + opLabel(item.op).toLowerCase(); refresh(); }
            })
          ]));
          g.appendChild(renderList(item.body, depth + 1));
          box.appendChild(g);
        }
      });
      return box;
    }

    function refresh() {
      U.clear(programBox);
      activeLabel.textContent = 'Adding to: ' + active.label;
      programBox.appendChild(activeLabel);
      programBox.appendChild(renderList(model.body, 0));
      if (ex.tools.procedure) {
        var p = U.el('div', { style: { marginTop: '12px' } }, [
          U.el('div.gtitle.row', {}, [
            U.el('span', { text: '⚙️ Routine A' }),
            U.el('button.btn.small', {
              text: active.list === model.procedures.A ? 'adding here ✓' : 'add here',
              onclick: function () { active.list = model.procedures.A; active.label = 'Routine A'; refresh(); }
            })
          ]),
          renderList(model.procedures.A, 1)
        ]);
        programBox.appendChild(p);
      }
      refreshPalette();
    }

    var paletteBox = U.el('div.blockpalette');

    function refreshPalette() {
      U.clear(paletteBox);
      function addBtn(op, extra) {
        var avail = poolCounts ? (poolCounts[op] || 0) : Infinity;
        var btn = U.el('button.block.' + op + (avail ? '' : ' ghost'), {
          dataset: { op: op },
          disabled: !avail,
          onclick: function () {
            if (!takeFromPool(op)) return;
            App.audio.play('click');
            var item = extra ? Object.assign({ op: op }, extra()) : { op: op };
            active.list.push(item);
            refresh();
          }
        }, [U.el('span', { text: opIcon(op) + ' ' + opLabel(op) + (poolCounts ? ' (' + avail + ')' : '') })]);
        paletteBox.appendChild(btn);
      }

      ex.palette.forEach(function (op) { addBtn(op); });
      if (ex.tools.repeat) addBtn('repeat', function () { return { times: 3, body: [] }; });
      if (ex.tools.condition) addBtn('if', function () { return { cond: 'gem', body: [] }; });
      if (ex.tools.procedure) addBtn('call', function () { return { name: 'A' }; });
    }

    /* ---------------------------- simulation --------------------------- */

    var running = false;

    function resetWorld() {
      ex._visited = [];
      var start = { x: world.start.x, y: world.start.y, dir: world.start.dir, carrying: null, bagCount: 0, gems: world.gems.map(function (g) { return { x: g.x, y: g.y, taken: false }; }), placed: [] };
      drawGems(start);
      placeRobot(start, false);
      setTimeout(function () { robot.style.transition = ''; }, 30);
      logBox.textContent = 'Ready. Press Run.';
    }

    function animate(frames) {
      return new Promise(function (resolve) {
        if (!frames.length) { resolve(); return; }
        var i = 0;
        var speed = App.Progress.get() && App.Progress.get().settings && !App.Progress.get().settings.animation ? 0 : 260;
        function tick() {
          if (i >= frames.length) { resolve(); return; }
          var f = frames[i];
          placeRobot(f, true);
          drawGems(f);
          if (f.applied) {
            var label = f.applied.op === 'call' ? 'run ' + f.applied.name + '()' : opLabel(f.applied.op).toLowerCase();
            logBox.textContent = 'step ' + i + ': ' + label + (f.note ? '  — ' + f.note : '');
          }
          App.audio.play('step');
          i++;
          if (!speed) { tick(); return; }
          setTimeout(tick, speed);
        }
        resetWorld();
        setTimeout(tick, 120);
      });
    }

    var lastResult = null;

    function runProgram() {
      if (running) return Promise.resolve(null);
      running = true;
      var res = R.simulate(world, model);
      ex._visited = res.visited;
      lastResult = res;
      return animate(res.frames).then(function () {
        running = false;
        logBox.textContent = res.success
          ? 'Reached the flag! Gems: ' + res.gemsCollected + '/' + res.gemsTotal
          : (res.error ? res.error.message : 'Stopped. Gems: ' + res.gemsCollected + '/' + res.gemsTotal + (res.atGoal ? '' : ' — not at the flag.'));
        return model;
      });
    }

    /* ------------------------------ layout ----------------------------- */

    var simBar = U.el('div.simbar', {}, [
      U.el('button.btn.primary', { text: '▶ Run', onclick: function () { App.audio.play('click'); runProgram(); } }),
      U.el('button.btn.ghost', { text: '↺ Reset', onclick: function () { App.audio.play('click'); resetWorld(); } }),
      U.el('button.btn.ghost', { text: '🗑 Clear', onclick: function () { model.body.length = 0; if (model.procedures.A) model.procedures.A.length = 0; if (poolCounts) { ex.pool.forEach(function (c) { poolCounts[c.op] = (poolCounts[c.op] || 0) + 1; }); } active.list = model.body; active.label = 'Main program'; refresh(); resetWorld(); } })
    ]);

    var node = U.el('div.robot-area', {}, [
      U.el('div', {}, [
        worldWrap,
        U.el('div.pill', { style: { marginTop: '10px' }, text: '🚩 flag · 💎 gems · 🧱 walls' })
      ]),
      U.el('div.blocks', {}, [
        programBox,
        U.el('div', {}, [U.el('div.gtitle', { text: 'Blocks' }), paletteBox]),
        simBar,
        logBox
      ])
    ]);

    refresh();
    resetWorld();

    return {
      node: node,
      type: 'robot',
      checkLabel: 'Run & Check ▶',
      retryable: true,
      attempt: function () { return runProgram(); },
      reset: function () { resetWorld(); },
      onCorrect: function () { },
      result: function () { return lastResult; }
    };
  }

  App.Renderers.robot = { render: render };
})(window.App);
