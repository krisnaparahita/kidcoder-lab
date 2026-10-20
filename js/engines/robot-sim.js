/* =============================================================
 * KidCoder Lab - robot-sim.js
 * Deterministic simulator for the block-command robot world.
 * A program is a small AST of commands; the simulator expands it
 * into a frame-by-frame trace the UI can replay / step through.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  /* dir: 0 = North (up), 1 = East, 2 = South, 3 = West */
  var DIRS = [
    { name: 'N', dx: 0, dy: -1, arrow: '▲' },
    { name: 'E', dx: 1, dy: 0, arrow: '▶' },
    { name: 'S', dx: 0, dy: 1, arrow: '▼' },
    { name: 'W', dx: -1, dy: 0, arrow: '◀' }
  ];

  /* Command catalogue used by the palette, the parser and the docs. */
  var COMMANDS = {
    move: { label: 'Move', icon: '⬆️', color: '#4dabf7', desc: 'Walk one square forward.', block: true },
    left: { label: 'Turn left', icon: '↰', color: '#9775fa', desc: 'Rotate 90° to the left.' },
    right: { label: 'Turn right', icon: '↱', color: '#9775fa', desc: 'Rotate 90° to the right.' },
    pick: { label: 'Pick', icon: '🤏', color: '#f59f00', desc: 'Take the gem you are standing on.' },
    put: { label: 'Put', icon: '📦', color: '#f59f00', desc: 'Drop what you carry on this square.' },
    repeat: { label: 'Repeat', icon: '🔁', color: '#38d9a9', desc: 'Do the blocks inside N times.', container: true, param: 'times' },
    if: { label: 'If', icon: '❓', color: '#ff8787', desc: 'Do the blocks inside only when the test is true.', container: true, param: 'cond' },
    call: { label: 'Run', icon: '⚙️', color: '#ffd43b', desc: 'Run a saved routine.', param: 'name' }
  };

  var CONDITIONS = {
    gem: { label: 'gem here', icon: '💎', desc: 'True when a gem is on this square.' },
    wall: { label: 'wall ahead', icon: '🧱', desc: 'True when the square in front is blocked.' },
    goal: { label: 'at the flag', icon: '🚩', desc: 'True when standing on the flag.' },
    carrying: { label: 'carrying', icon: '🎒', desc: 'True when the robot holds something.' }
  };

  function key(x, y) { return x + ',' + y; }

  function makeWorld(cfg) {
    var w = {
      w: cfg.w,
      h: cfg.h,
      walls: {},
      start: { x: cfg.start.x, y: cfg.start.y, dir: cfg.start.dir || 0 },
      goal: { x: cfg.goal.x, y: cfg.goal.y },
      gems: (cfg.gems || []).map(function (g) { return { x: g.x, y: g.y }; }),
      holes: {},
      name: cfg.name || ''
    };
    (cfg.walls || []).forEach(function (p) { w.walls[key(p.x, p.y)] = true; });
    return w;
  }

  function isWall(world, x, y) {
    return x < 0 || y < 0 || x >= world.w || y >= world.h || !!world.walls[key(x, y)];
  }

  /* ------------------------------ program ------------------------------ */

  function cmd(op, extra) { return Object.assign({ op: op }, extra || {}); }

  function emptyProgram() { return { body: [], procedures: {} }; }

  function cloneProgram(p) {
    return { body: U.clone(p.body || []), procedures: U.clone(p.procedures || {}) };
  }

  /** Flatten to primitive ops (for length checks / hints). */
  function flatten(list, procedures, depth) {
    depth = depth || 0;
    if (depth > 12) return [];
    var out = [];
    (list || []).forEach(function (c) {
      if (c.op === 'repeat') {
        for (var i = 0; i < (c.times || 1); i++) out = out.concat(flatten(c.body, procedures, depth + 1));
      } else if (c.op === 'if') {
        out = out.concat(flatten(c.body, procedures, depth + 1));
      } else if (c.op === 'call') {
        out = out.concat(flatten(procedures[c.name] || [], procedures, depth + 1));
      } else {
        out.push(c);
      }
    });
    return out;
  }

  function primitiveCount(program) { return flatten(program.body, program.procedures).length; }

  function blockCount(list) {
    var n = 0;
    (list || []).forEach(function (c) {
      n += 1;
      if (c.body) n += blockCount(c.body);
    });
    return n;
  }

  /** Human readable pseudo-code, shown next to the blocks. */
  function toString(program, indent) {
    indent = indent || 0;
    var pad = new Array(indent + 1).join('  ');
    var lines = [];
    (program.body || []).forEach(function (c) {
      if (c.op === 'repeat') {
        lines.push(pad + 'repeat ' + c.times + ' times:');
        lines.push(toString({ body: c.body }, indent + 1));
      } else if (c.op === 'if') {
        lines.push(pad + 'if ' + (CONDITIONS[c.cond] ? CONDITIONS[c.cond].label : c.cond) + ':');
        lines.push(toString({ body: c.body }, indent + 1));
      } else if (c.op === 'call') {
        lines.push(pad + 'run ' + c.name + '()');
      } else {
        lines.push(pad + COMMANDS[c.op].label.toLowerCase());
      }
    });
    return lines.join('\n');
  }

  /* ----------------------------- simulation ---------------------------- */

  var MAX_STEPS = 3000;
  var MAX_FRAMES = 600;

  function snapshot(state, applied, note) {
    return {
      x: state.x, y: state.y, dir: state.dir,
      carrying: state.bag.length ? state.bag[state.bag.length - 1] : null,
      bagCount: state.bag.length,
      gems: state.gems.map(function (g) { return { x: g.x, y: g.y, taken: g.taken }; }),
      placed: state.placed.map(function (p) { return { x: p.x, y: p.y }; }),
      applied: applied ? U.clone(applied) : null,
      note: note || null
    };
  }

  /**
   * @returns { frames, success, reason, gemsCollected, gemsTotal, steps, error }
   */
  function simulate(world, program) {
    var state = {
      x: world.start.x, y: world.start.y, dir: world.start.dir,
      bag: [],                      // the robot can carry several gems
      gems: world.gems.map(function (g) { return { x: g.x, y: g.y, taken: false }; }),
      placed: []
    };
    var frames = [snapshot(state, null, 'Start here')];
    var steps = 0;
    var error = null;
    var procedures = program.procedures || {};
    var visited = [];

    function gemAt(x, y) {
      for (var i = 0; i < state.gems.length; i++) {
        if (!state.gems[i].taken && state.gems[i].x === x && state.gems[i].y === y) return state.gems[i];
      }
      return null;
    }

    function test(cond) {
      var ahead = DIRS[state.dir];
      var nx = state.x + ahead.dx, ny = state.y + ahead.dy;
      switch (cond) {
        case 'gem': return !!gemAt(state.x, state.y);
        case 'wall': return isWall(world, nx, ny);
        case 'goal': return state.x === world.goal.x && state.y === world.goal.y;
        case 'carrying': return state.bag.length > 0;
        default: return false;
      }
    }

    function exec(list, depth) {
      if (error || depth > 16) return;
      for (var i = 0; i < list.length; i++) {
        if (error) return;
        if (++steps > MAX_STEPS) { error = { type: 'timeout', message: 'Too many steps! The robot stopped to rest.' }; return; }
        var c = list[i];
        var note = null;

        if (c.op === 'move') {
          var d = DIRS[state.dir];
          var nx = state.x + d.dx, ny = state.y + d.dy;
          if (isWall(world, nx, ny)) {
            note = 'Bump! A wall is in front.';
            error = { type: 'crash', message: 'Oops — the robot walked into a wall.' };
          } else {
            state.x = nx; state.y = ny;
            visited.push(key(nx, ny));
          }
        } else if (c.op === 'left') {
          state.dir = (state.dir + 3) % 4;
        } else if (c.op === 'right') {
          state.dir = (state.dir + 1) % 4;
        } else if (c.op === 'pick') {
          var g = gemAt(state.x, state.y);
          if (g) { g.taken = true; state.bag.push('gem'); note = 'Picked a gem!'; }
          else { note = 'No gem here.'; error = { type: 'pick', message: 'There is no gem on this square.' }; }
        } else if (c.op === 'put') {
          if (!state.bag.length) { error = { type: 'put', message: 'The robot is not carrying anything.' }; }
          else {
            state.bag.pop();
            state.placed.push({ x: state.x, y: state.y });
            note = 'Put it down.';
          }
        } else if (c.op === 'repeat') {
          exec(c.body || [], depth + 1);
          continue;
        } else if (c.op === 'if') {
          if (test(c.cond)) exec(c.body || [], depth + 1);
          else note = 'Skipped (test was false)';
          if (error) return;
        } else if (c.op === 'call') {
          exec(procedures[c.name] || [], depth + 1);
          continue;
        } else {
          note = 'Unknown command';
        }

        if (frames.length < MAX_FRAMES) frames.push(snapshot(state, c, note));
        if (error) return;
      }
    }

    exec(program.body || [], 0);

    var collected = state.gems.filter(function (g) { return g.taken; }).length;
    var atGoal = state.x === world.goal.x && state.y === world.goal.y;
    var allGems = collected === state.gems.length;

    return {
      frames: frames,
      success: !error && atGoal && allGems,
      atGoal: atGoal,
      gemsCollected: collected,
      gemsTotal: state.gems.length,
      steps: steps,
      error: error,
      visited: visited,
      end: { x: state.x, y: state.y, dir: state.dir }
    };
  }

  App.Robot = {
    DIRS: DIRS,
    COMMANDS: COMMANDS,
    CONDITIONS: CONDITIONS,
    makeWorld: makeWorld,
    isWall: isWall,
    cmd: cmd,
    emptyProgram: emptyProgram,
    cloneProgram: cloneProgram,
    flatten: flatten,
    primitiveCount: primitiveCount,
    blockCount: blockCount,
    toString: toString,
    simulate: simulate
  };
})(window.App);
