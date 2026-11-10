/* KidCoder Lab - headless smoke tests (node --test).
 * Loads the non-DOM scripts in the same order as index.html into a
 * sandbox, then generates every level across many seeds and checks that
 * the reference solutions pass their own grade(). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = [
  'js/core/util.js', 'js/core/storage.js', 'js/core/audio.js',
  'js/engines/grid.js', 'js/engines/robot-sim.js', 'js/engines/minipy.js',
  'js/data/sprites.js', 'js/data/registry.js', 'js/data/curriculum.js',
  'js/core/progress.js',
  'js/data/ex-pixel.js', 'js/data/ex-robot.js', 'js/data/ex-logic.js', 'js/data/ex-python.js'
];
const SEEDS = 12;

function boot() {
  const sandbox = { console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const rel of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.App;
}

test('index.html references every script that exists', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 20);
  for (const ref of refs) assert.ok(fs.existsSync(path.join(ROOT, ref)), 'missing ' + ref);
});

test('curriculum loads with 4 worlds and 28 levels', () => {
  const App = boot();
  assert.strictEqual(App.Curriculum.CATEGORIES.length, 4);
  assert.strictEqual(App.Curriculum.LEVELS.length, 28);
});

test('every level generates exercises for many seeds', () => {
  const App = boot();
  let total = 0;
  for (const level of App.Curriculum.LEVELS) {
    for (let s = 0; s < SEEDS; s++) {
      const set = App.Exercises.buildSet(level, 'seed' + s);
      assert.ok(set.items.length > 0, level.id);
      for (const ex of set.items) {
        assert.strictEqual(typeof ex.grade, 'function', level.id + ' has grade()');
        assert.ok(ex.prompt, level.id + ' has a prompt');
        total++;
      }
    }
  }
  assert.ok(total > 1000, 'generated ' + total);
});

function assertLogicChoices(ex, expected) {
  var values = ex.choices.map(function (choice) { return String(choice.value); });
  var labels = ex.choices.map(function (choice) { return choice.label; });
  assert.strictEqual(values.length, 4, ex.id + ' has four choices');
  values.forEach(function (value, i) {
    assert.strictEqual(values.indexOf(value), i, ex.id + ' duplicate value ' + value);
    assert.strictEqual(labels.indexOf(labels[i]), i, ex.id + ' duplicate label ' + labels[i]);
    assert.strictEqual(labels[i], value, ex.id + ' label matches submitted value');
    if (expected !== undefined) {
      assert.strictEqual(ex.grade(ex.choices[i].value).correct, value === String(expected), ex.id + ' follows the pattern');
    }
  });
  assert.strictEqual(ex.choices.filter(function (choice) {
    return ex.grade(choice.value).correct;
  }).length, 1, ex.id + ' has exactly one correct choice');
}

test('logic choices stay unique with one correct answer across every level and many seeds', function () {
  var App = boot();
  var checked = 0;
  App.Curriculum.LEVELS.filter(function (level) { return level.exercise.type === 'logic'; }).forEach(function (level) {
    for (var s = 0; s < 1000; s++) {
      App.Exercises.buildSet(level, 'seed' + s).items.forEach(function (ex) {
        if (!ex.choices) return;
        assertLogicChoices(ex);
        checked++;
      });
    }
  });
  assert.strictEqual(checked, 5000);
});

test('every sequence kind and parameter combination has unique choices and the right answer', function () {
  var App = boot();
  var level = App.Curriculum.byId.lg1;
  var generate = App.Exercises.get('logic', 'sequence');
  var cases = [];
  var shapes = [['⭐', '🌙'], ['🔴', '🔵', '🟡'], ['🐶', '🐱'], ['🌳', '🌺', '🍄'], ['▲', '■', '●']];
  var a, d;
  for (a = 1; a <= 12; a++) {
    for (d = 2; d <= 5; d++) cases.push({ kind: 'count', params: [a, d], expected: a + 5 * d });
  }
  for (a = 2; a <= 20; a++) {
    for (d = 3; d <= 8; d++) cases.push({ kind: 'skip', params: [a, d], expected: a + 5 * d });
  }
  for (a = 2; a <= 5; a++) cases.push({ kind: 'double', params: [a], expected: a * 32 });
  for (a = 1; a <= 3; a++) cases.push({ kind: 'grow', params: [a], expected: new Array(a + 5).join('●') });
  shapes.forEach(function (shape) { cases.push({ kind: 'shape', params: [], shape: shape, expected: shape[5 % shape.length] }); });
  cases.forEach(function (entry, index) {
    for (var s = 0; s < 12; s++) {
      var rng = App.util.RNG('sequence-' + index + '-' + s);
      var params = entry.params.slice();
      // Force each branch and its full parameter domain. Subsequent draws
      // repeat the minimum to exercise the former distractor-exhaustion path.
      rng.pick = function (values) { return values[0] === 'count' ? entry.kind : (entry.shape || values[0]); };
      rng.int = function (min) { return params.length ? params.shift() : min; };
      var ex = generate(level, rng, index);
      assertLogicChoices(ex, entry.expected);
    }
  });
});

test('numeric classification gives every number exactly one correct bucket', function () {
  var App = boot();
  var rng = App.util.RNG('even-numbers');
  rng.pick = function (rules) { return rules.filter(function (rule) { return rule.prop === 'even'; })[0]; };
  var ex = App.Exercises.get('logic', 'classify')(App.Curriculum.byId.lg4, rng, 0);
  var map = {};
  var values = ex.items.map(function (item) { return item.emoji; });
  ex.items.forEach(function (item, i) {
    assert.strictEqual(values.indexOf(item.emoji), i, 'unique number');
    map[item.id] = Number(item.emoji) % 2 === 0 ? 'a' : 'b';
  });
  assert.ok(ex.grade(map).correct, 'parity determines the correct classification');
  ex.items.forEach(function (item) {
    var correct = map[item.id];
    var accepted = ex.buckets.filter(function (bucket) {
      map[item.id] = bucket.id;
      return ex.grade(map).correct;
    });
    map[item.id] = correct;
    assert.strictEqual(accepted.length, 1, item.emoji + ' has one correct bucket');
    assert.strictEqual(accepted[0].id, correct);
  });
});

test('robot reference solutions reach the flag', () => {
  const App = boot();
  let checked = 0;
  for (const level of App.Curriculum.LEVELS.filter((l) => l.exercise && l.exercise.type === 'robot')) {
    for (let s = 0; s < SEEDS; s++) {
      for (const ex of App.Exercises.buildSet(level, 'seed' + s).items) {
        const res = ex.grade({ body: ex.solution, procedures: {} });
        assert.ok(res.correct, level.id + ': ' + res.message);
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});

test('robot repeats execute only their body, in order, the requested number of times', () => {
  const R = boot().Robot;
  for (const times of [0, 1, 3, 8]) {
    const world = R.makeWorld({ w: 12, h: 2, start: { x: 0, y: 0, dir: 1 }, goal: { x: times + 1, y: 0 } });
    const program = { body: [
      { op: 'repeat', times, body: [{ op: 'move' }, { op: 'right' }, { op: 'left' }] },
      { op: 'move' }
    ], procedures: {} };
    const res = R.simulate(world, program);
    assert.ok(res.success, times + ' repetitions reach the flag');
    assert.strictEqual(res.end.x, times + 1);
    assert.strictEqual(res.frames.slice(1).map((f) => f.applied.op).join(','),
      Array(times).fill('move,right,left').concat('move').join(','));
    assert.strictEqual(R.primitiveCount(program), times * 3 + 1);
  }
});

test('every repeat-enabled robot course grades loop solutions like expanded solutions', () => {
  const App = boot();
  const levels = App.Curriculum.LEVELS.filter((l) => l.cat === 'robot' && l.exercise.options.repeat);
  assert.strictEqual(levels.map((l) => l.id).join(','), 'rb5,rb6,rb7');
  let compressed = 0;
  for (const level of levels) {
    for (let s = 0; s < SEEDS; s++) {
      for (const ex of App.Exercises.buildSet(level, 'seed' + s).items) {
        const body = [];
        for (let i = 0; i < ex.solution.length;) {
          let end = i + 1;
          while (end < ex.solution.length && ex.solution[end].op === ex.solution[i].op) end++;
          body.push({ op: 'repeat', times: end - i, body: [ex.solution[i]] });
          if (end - i > 1) compressed++;
          i = end;
        }
        const expected = App.Robot.simulate(ex.world, { body: ex.solution });
        const actual = ex.grade({ body, procedures: {} });
        assert.ok(actual.correct, level.id + ': ' + actual.message);
        assert.strictEqual(JSON.stringify(actual.detail.frames), JSON.stringify(expected.frames));
      }
    }
  }
  assert.ok(compressed > 0, 'exercised repeat counts greater than one');
});

test('robot nested repeats and routine calls re-evaluate conditions each iteration', () => {
  const R = boot().Robot;
  const world = R.makeWorld({ w: 5, h: 1, start: { x: 0, y: 0, dir: 1 }, goal: { x: 4, y: 0 },
    gems: [{ x: 1, y: 0 }, { x: 3, y: 0 }] });
  const res = R.simulate(world, { body: [{ op: 'repeat', times: 2, body: [{ op: 'call', name: 'A' }] }],
    procedures: { A: [{ op: 'repeat', times: 2, body: [
      { op: 'move' }, { op: 'if', cond: 'gem', body: [{ op: 'pick' }] }
    ] }] } });
  assert.ok(res.success);
  assert.strictEqual(res.gemsCollected, 2);
  assert.strictEqual(res.frames.filter((f) => f.applied && f.applied.op === 'move').length, 4);
  assert.strictEqual(res.frames.filter((f) => f.applied && f.applied.op === 'pick').length, 2);
});

test('robot repeats stop on errors and enforce the step budget even with empty bodies', () => {
  const R = boot().Robot;
  const world = R.makeWorld({ w: 2, h: 1, start: { x: 0, y: 0, dir: 1 }, goal: { x: 1, y: 0 } });
  const crash = R.simulate(world, { body: [
    { op: 'repeat', times: 8, body: [{ op: 'move' }] }, { op: 'right' }
  ] });
  assert.strictEqual(crash.error.type, 'crash');
  assert.strictEqual(crash.frames.length, 3);
  for (const body of [[], [{ op: 'left' }]]) {
    const res = R.simulate(world, { body: [{ op: 'repeat', times: 10000, body }] });
    assert.strictEqual(res.error.type, 'timeout');
    assert.ok(res.steps <= 3001);
    assert.ok(res.frames.length <= 600);
  }
});

test('short pixel tasks have matching instructions, targets and graders', () => {
  const App = boot();
  for (const [id, limit] of [['px2', 8], ['px3', 12], ['px4', 16]]) {
    for (let s = 0; s < 100; s++) {
      const set = App.Exercises.buildSet(App.Curriculum.byId[id], 'pixels' + s);
      for (const ex of set.items) {
        const target = ex.target || ex.source;
        const points = App.Grid.toList(target);
        assert.ok(points.length > 0 && points.length <= limit, id + ' point budget');
        assert.ok(ex.grade(target).correct, id + ' target passes');
        const incomplete = App.Grid.clone(target);
        App.Grid.set(incomplete, points[0].x - 1, points[0].y - 1, null);
        assert.ok(!ex.grade(incomplete).correct, id + ' missing pixel fails');
        const instructions = ex.instructions || ex.code;
        if (instructions) {
          assert.ok(App.Grid.equals(target, App.Grid.fromList(ex.cols, ex.rows, instructions)), id + ' instructions match target');
        }
        assert.ok(points.every((p) => ex.palette.includes(p.color)), id + ' colours available');
      }
    }
  }
});

test('every shortened set can earn mastery and unlock the next level', () => {
  const App = boot();
  App.Progress.attach(App.store.createProfile({ name: 'Short practice', age: 9 }));
  for (const level of App.Curriculum.LEVELS) {
    assert.ok(App.Curriculum.levelUnlocked(App.Progress.get(), level.id), level.id + ' unlocked');
    const set = App.Exercises.buildSet(level, 'mastery');
    assert.strictEqual(set.items.length, level.exercise.count);
    for (const ex of set.items) App.Progress.record(level.id, true, ex.xp);
    const result = App.Progress.completeRun(level.id, { correct: set.items.length, total: set.items.length });
    assert.ok(result.justMastered, level.id + ' mastered in one perfect round');
  }
});

test('python reference solutions pass their own tests', () => {
  const App = boot();
  let checked = 0;
  for (const level of App.Curriculum.LEVELS.filter((l) => l.exercise && l.exercise.type === 'python')) {
    for (let s = 0; s < SEEDS; s++) {
      for (const ex of App.Exercises.buildSet(level, 'seed' + s).items) {
        if (typeof ex.solution !== 'string') continue;
        const res = ex.grade(ex.solution);
        assert.ok(res.correct, level.id + ' (' + ex.variant + '): ' + res.message + '\n' + ex.solution);
        checked++;
      }
    }
  }
  assert.ok(checked > 0);
});

test('MiniPy reports real Python error names', () => {
  const MP = boot().MiniPy;
  assert.strictEqual(MP.run('print(1 + 2)').output.trim(), '3');
  assert.strictEqual(MP.run('print(x)').error.name, 'NameError');
  assert.strictEqual(MP.run('print(1 / 0)').error.name, 'ZeroDivisionError');
  assert.strictEqual(MP.run('while True:\n    pass').error.name, 'TimeoutError');
});

test('MiniPy for and while preserve body order, counts, break and continue', () => {
  const MP = boot().MiniPy;
  for (const code of [
    'for i in range(5):',
    'i = -1\nwhile i < 4:\n    i += 1'
  ]) {
    const res = MP.run(code + '\n    if i == 1:\n        continue\n    if i == 4:\n        break\n    print(i)\n    print("body")\nprint("after")');
    assert.ok(res.ok, JSON.stringify(res.error));
    assert.strictEqual(res.output.trim(), '0\nbody\n2\nbody\n3\nbody\nafter');
  }
  for (const iterable of ['range(0)', 'range(3, 3)', '[]', '""']) {
    const res = MP.run('for i in ' + iterable + ':\n    print("body")\nprint("after")');
    assert.ok(res.ok);
    assert.strictEqual(res.output.trim(), 'after');
  }
  const descending = MP.run('for i in range(5, 0, -2):\n    print(i)\n    print("body")');
  assert.ok(descending.ok);
  assert.strictEqual(descending.output.trim(), '5\nbody\n3\nbody\n1\nbody');
});

test('MiniPy propagates function returns out of for and while loops', () => {
  const MP = boot().MiniPy;
  for (const loop of ['for i in range(3):', 'while True:']) {
    for (const value of ['7', '0', 'False', 'None']) {
      const code = 'def first():\n    ' + loop + '\n        if True:\n            return ' + value + '\n    print("fell through")\nprint(first())';
      const res = MP.run(code);
      assert.ok(res.ok, JSON.stringify(res.error));
      assert.strictEqual(res.output.trim(), value);
    }
  }
  const nested = MP.run('def first():\n    for i in range(3):\n        while True:\n            return 9\n    return 0\nprint(first())');
  assert.ok(nested.ok);
  assert.strictEqual(nested.output.trim(), '9');
});

test('MiniPy rejects a zero range step instead of executing the loop', () => {
  const res = boot().MiniPy.run('for i in range(0, 3, 0):\n    print(i)');
  assert.ok(!res.ok);
  assert.strictEqual(res.error.name, 'ValueError');
  assert.strictEqual(res.output, '');
});

test('stickers unlock in increasing order and reference real worlds', () => {
  const C = boot().Curriculum;
  const ids = C.CATEGORIES.map((c) => c.id);
  C.STICKERS.forEach((st, i) => {
    assert.ok(ids.includes(st.cat), st.id + ' uses a real world');
    if (i) assert.ok(st.stars > C.STICKERS[i - 1].stars, st.id + ' needs more stars than the one before');
  });
  assert.strictEqual(C.stickersUnlocked(0).length, 0);
  assert.strictEqual(C.stickersBetween(0, C.STICKERS[1].stars).length, 2);
  assert.strictEqual(C.nextSticker(1e6), null);
});

test('every world defines its full colour tint', () => {
  const C = boot().Curriculum;
  for (const cat of C.CATEGORIES) {
    const v = C.catVars(cat);
    for (const k of ['--cat', '--cat-soft', '--cat-line', '--cat-text', '--cat-edge']) {
      assert.match(v[k], /^#[0-9a-f]{6}$/i, cat.id + ' ' + k);
    }
  }
});
