/* =============================================================
 * KidCoder Lab - ex-robot.js
 * Robot worlds are generated (never hand-drawn) and always come
 * with a known solution, so every world is guaranteed solvable.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var R = App.Robot;
  var DIRS = R.DIRS;

  function key(x, y) { return x + ',' + y; }

  /** Random self-avoiding walk -> { start, cells, commands } */
  function buildPath(rng, w, h, start, maxSteps, opts) {
    var visited = {};
    visited[key(start.x, start.y)] = true;
    var cur = { x: start.x, y: start.y };
    var dir = start.dir;
    var commands = [];   // [{op}] primitives (move / turn / pick)
    var cells = [{ x: cur.x, y: cur.y }];

    for (var s = 0; s < maxSteps; s++) {
      var candidates = [];
      var straight = dir;
      var leftD = (dir + 3) % 4;
      var rightD = (dir + 1) % 4;
      if (opts.turns) {
        if (rng.chance(0.5)) candidates = [straight, leftD, rightD];
        else candidates = rng.chance(0.5) ? [leftD, rightD, straight] : [rightD, leftD, straight];
      } else {
        candidates = [straight];
      }
      var moved = false;
      for (var c = 0; c < candidates.length; c++) {
        var d = candidates[c];
        var nx = cur.x + DIRS[d].dx, ny = cur.y + DIRS[d].dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (visited[key(nx, ny)]) continue;
        if (d !== dir) commands.push({ op: d === leftD ? 'left' : 'right' });
        commands.push({ op: 'move' });
        dir = d;
        cur = { x: nx, y: ny };
        visited[key(cur.x, cur.y)] = true;
        cells.push({ x: cur.x, y: cur.y });
        moved = true;
        break;
      }
      if (!moved) break;
    }
    return { start: { x: start.x, y: start.y, dir: start.dir }, cells: cells, commands: commands, endDir: dir };
  }

  function generateWorld(rng, opts) {
    var size = opts.size || rng.int(6, 8);
    var w = size, h = size;
    var maxSteps = opts.maxLen || rng.int(4, 9);

    var start;
    var guard = 0;
    do {
      start = { x: rng.int(0, w - 1), y: rng.int(0, h - 1), dir: rng.int(0, 3) };
      var d0 = DIRS[start.dir];
      guard++;
    } while ((start.x + d0.dx < 0 || start.x + d0.dx >= w || start.y + d0.dy < 0 || start.y + d0.dy >= h) && guard < 60);

    var path = buildPath(rng, w, h, start, maxSteps, opts);
    if (path.cells.length < 2) {                       // retry with a safer start
      start.dir = rng.int(0, 3);
      path = buildPath(rng, w, h, start, maxSteps, opts);
    }

    var onPath = {};
    path.cells.forEach(function (c) { onPath[key(c.x, c.y)] = true; });

    // decorative walls that never block the solution path
    var walls = [];
    if (opts.obstacles) {
      var budget = Math.floor((w * h - path.cells.length) * 0.22);
      for (var t = 0; t < budget * 3 && walls.length < budget; t++) {
        var wx = rng.int(0, w - 1), wy = rng.int(0, h - 1);
        if (onPath[key(wx, wy)]) continue;
        if (walls.some(function (p) { return p.x === wx && p.y === wy; })) continue;
        walls.push({ x: wx, y: wy });
      }
    }

    var goal = path.cells[path.cells.length - 1];
    var commands = path.commands.slice();

    // gems sit on the path -> insert a pick right after arriving
    var gems = [];
    if (opts.gems) {
      var gemCount = Math.min(rng.int(1, 3), Math.max(1, path.cells.length - 2));
      var usable = path.cells.slice(1, path.cells.length - 1);
      var picks = rng.sample(usable, Math.min(gemCount, usable.length));
      picks.forEach(function (cell) {
        gems.push({ x: cell.x, y: cell.y });
      });
      // rebuild commands with pick inserted
      var newCmds = [];
      var stepIdx = 0;
      var cur = { x: path.start.x, y: path.start.y };
      for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        newCmds.push(cmd);
        if (cmd.op === 'move') {
          stepIdx++;
          cur = path.cells[stepIdx];
          if (gems.some(function (g) { return g.x === cur.x && g.y === cur.y; })) newCmds.push({ op: 'pick' });
        }
      }
      commands = newCmds;
    }

    var world = R.makeWorld({
      w: w, h: h, start: path.start, goal: { x: goal.x, y: goal.y },
      walls: walls, gems: gems
    });
    return { world: world, solution: commands, path: path };
  }

  function paletteFor(opts) {
    var ops = ['move'];
    if (opts.turns !== false) ops.push('left', 'right');
    if (opts.gems) ops.push('pick', 'put');
    return ops;
  }

  function toolsFor(opts) {
    return {
      repeat: !!opts.repeat,
      condition: !!opts.condition || !!opts.procedure,
      procedure: !!opts.procedure
    };
  }

  /* ------------------------------ variants ----------------------------- */

  function orderVariant(level, rng, i, opts) {
    var gen = generateWorld(rng, opts);
    var pool = U.clone(gen.solution);
    var ex = {
      id: level.id + ':' + rng.seed + ':' + i,
      type: 'robot', variant: 'order',
      world: gen.world,
      pool: pool,
      solution: gen.solution,
      par: gen.solution.length,
      palette: paletteFor(opts),
      tools: toolsFor(opts)
    };
    ex.prompt = 'Tap the blocks in the right order, then press Run.';
    ex.hint = 'The arrow shows where the robot looks. A turn changes the arrow but does not move the robot.';
    ex.grade = function (program) {
      var res = R.simulate(ex.world, program);
      if (res.success) {
        return { correct: true, message: 'The robot reached the flag!', detail: res };
      }
      var msg = res.error ? res.error.message
        : (res.gemsCollected < res.gemsTotal ? 'You missed ' + (res.gemsTotal - res.gemsCollected) + ' gem(s).' : 'The robot did not reach the flag.');
      return { correct: false, message: msg, detail: res };
    };
    return ex;
  }

  function buildVariant(level, rng, i, opts) {
    var gen = generateWorld(rng, opts);
    var ex = {
      id: level.id + ':' + rng.seed + ':' + i,
      type: 'robot', variant: 'build',
      world: gen.world,
      solution: gen.solution,
      par: gen.solution.length,
      palette: paletteFor(opts),
      tools: toolsFor(opts)
    };
    var bits = ['Build a program that gets the robot to the flag'];
    if (ex.world.gems.length) bits.push('and collects all ' + ex.world.gems.length + ' gem(s)');
    ex.prompt = bits.join(' ') + '.';
    ex.hint = opts.repeat
      ? 'Long straight parts are perfect for Repeat.'
      : 'Plan the route first, then add the blocks. Use Step to watch one command at a time.';
    ex.grade = function (program) {
      var res = R.simulate(ex.world, program);
      if (res.success) {
        var used = R.primitiveCount(program);
        var extra = used <= ex.par ? ' Great — that is the shortest route!' : ' Can you do it in fewer commands?';
        return { correct: true, message: 'Success!' + extra, detail: res, efficient: used <= ex.par };
      }
      var msg = res.error ? res.error.message
        : (res.gemsCollected < res.gemsTotal ? 'You missed ' + (res.gemsTotal - res.gemsCollected) + ' gem(s).' : 'The robot did not reach the flag yet.');
      return { correct: false, message: msg, detail: res };
    };
    return ex;
  }

  App.Exercises.register('robot', 'order', orderVariant);
  App.Exercises.register('robot', 'build', buildVariant);
})(window.App);
