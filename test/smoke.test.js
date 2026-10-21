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
