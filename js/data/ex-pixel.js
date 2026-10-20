/* =============================================================
 * KidCoder Lab - ex-pixel.js
 * Generators for the Pixel Lab.
 * Every generator is pure: (level, seed) -> one exercise object
 * with a grade(attempt) function. Same seed -> same exercise, so
 * "practise again" simply uses a new seed to shuffle the set.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var G = App.Grid;
  var S = App.Sprites;

  var HEX_TO_NAME = {};
  Object.keys(S.PALETTE).forEach(function (n) { HEX_TO_NAME[S.PALETTE[n]] = n; });
  function nameOf(hex) { return HEX_TO_NAME[hex] || 'colour'; }

  function kidPalette(rng, n) {
    return rng.sample(S.SWATCHES, n || 3);
  }

  function makeId(level, seed, i) { return level.id + ':' + seed + ':' + i; }

  /* ------------------------------- px1 -------------------------------- */

  function findCell(level, rng, i) {
    var size = rng.int(5, 7);
    var tx = rng.int(1, size), ty = rng.int(1, size);
    var kind = rng.chance(0.6) ? 'click' : 'read';
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'find-cell',
      cols: size, rows: size,
      kind: kind,
      target: { x: tx, y: ty },
      marker: S.PALETTE[rng.pick(S.PALETTE_NAMES)]
    };
    if (kind === 'click') {
      ex.prompt = 'Click the pixel at column ' + tx + ', row ' + ty + '.';
      ex.hint = 'Start at the top-left corner. Go right ' + tx + ' column' + (tx > 1 ? 's' : '') + ', then down ' + ty + ' row' + (ty > 1 ? 's' : '') + '.';
      ex.grade = function (a) {
        var ok = a && a.x === tx && a.y === ty;
        return { correct: ok, message: ok ? 'Yes! That is (' + tx + ', ' + ty + ').' : 'Not this one. Count right first, then down.' };
      };
    } else {
      var opts = [{ x: tx, y: ty }];
      var guard = 0;
      while (opts.length < 4 && guard++ < 50) {
        var c = { x: rng.int(1, size), y: rng.int(1, size) };
        if (!opts.some(function (o) { return o.x === c.x && o.y === c.y; })) opts.push(c);
      }
      ex.prompt = 'The marked pixel is which coordinate?';
      ex.hint = 'Column = how far right (see the numbers on top). Row = how far down.';
      ex.choices = rng.shuffle(opts).map(function (o) {
        return { id: o.x + ',' + o.y, label: '(' + o.x + ', ' + o.y + ')', value: o };
      });
      ex.grade = function (a) {
        var ok = a && a.x === tx && a.y === ty;
        return { correct: ok, message: ok ? 'Correct — column ' + tx + ', row ' + ty + '.' : 'Remember: (column, row) = (right, down).' };
      };
    }
    return ex;
  }

  /* ------------------------------- px2 -------------------------------- */

  function paintList(level, rng, i) {
    var size = rng.int(6, 8);
    var shape = rng.chance(0.5) ? S.randomShape(rng, size) : S.randomVariant(rng);
    var src = shape.grid.w === size ? shape.grid : G.fitCentre(size, size, shape.grid);
    var list = G.toList(src);
    // keep the list kid-sized
    if (list.length > 24) list = rng.sample(list, 24);
    // the target must contain exactly the pixels we ask for, otherwise the
    // exercise could never be solved
    src = G.fromList(size, size, list);
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'paint-list',
      cols: size, rows: size,
      palette: Array.from(new Set(list.map(function (p) { return p.color; }))),
      instructions: rng.shuffle(list),
      target: src,
      title: shape.title
    };
    ex.prompt = 'Follow the instruction list. Paint every line in order.';
    ex.hint = 'Pick a colour, then click the pixel. "Paint (3, 2)" means column 3, row 2.';
    ex.grade = function (attemptGrid) {
      var diffs = G.diff(src, attemptGrid);
      if (!diffs.length) return { correct: true, message: 'Perfect! Every pixel is in the right place.', detail: [] };
      return {
        correct: false,
        message: diffs.length + ' pixel' + (diffs.length > 1 ? 's are' : ' is') + ' not right yet.',
        detail: diffs.slice(0, 12)
      };
    };
    return ex;
  }

  /* ------------------------------- px3 -------------------------------- */

  function copyShape(level, rng, i) {
    var size = rng.int(6, 8);
    var shape = rng.chance(0.45) ? S.randomShape(rng, size) : S.randomVariant(rng);
    var src = shape.grid.w === size ? shape.grid : G.fitCentre(size, size, shape.grid);
    var palette = Array.from(new Set(G.toList(src).map(function (p) { return p.color; })));
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'copy-shape',
      cols: size, rows: size,
      source: src,
      palette: palette,
      title: shape.title
    };
    ex.prompt = 'Copy the picture onto the empty grid.';
    ex.hint = 'Work row by row. For each coloured pixel ask: which column? which row?';
    ex.grade = function (attemptGrid) {
      var diffs = G.diff(src, attemptGrid);
      if (!diffs.length) return { correct: true, message: 'Spot on! Same picture, pixel for pixel.', detail: [] };
      return { correct: false, message: 'Close! ' + diffs.length + ' pixel' + (diffs.length > 1 ? 's' : '') + ' still differ.', detail: diffs.slice(0, 12) };
    };
    return ex;
  }

  /* ------------------------------- px4 -------------------------------- */

  function spriteCode(level, rng, i) {
    var size = 8;
    var v = S.randomVariant(rng);
    var src = v.grid;
    var list = G.toList(src);
    // Sort by row then column so the "code" reads like a file
    list.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var palette = Array.from(new Set(list.map(function (p) { return p.color; })));
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'sprite-code',
      cols: size, rows: size,
      target: src,
      palette: palette,
      code: list.map(function (p) {
        return { x: p.x, y: p.y, color: p.color, text: 'pixel(' + p.x + ', ' + p.y + ', "' + nameOf(p.color) + '")' };
      }),
      title: v.title
    };
    ex.prompt = 'This code is the ONLY description of the picture. Paint it.';
    ex.hint = 'pixel(column, row, "colour"). Do the first line, then the next.';
    ex.grade = function (attemptGrid) {
      var diffs = G.diff(src, attemptGrid);
      if (!diffs.length) return { correct: true, message: 'You rebuilt the sprite from pure code!', detail: [] };
      return { correct: false, message: diffs.length + ' pixel' + (diffs.length > 1 ? 's' : '') + ' missing or wrong.', detail: diffs.slice(0, 12) };
    };
    return ex;
  }

  /* ------------------------------- px5 -------------------------------- */

  function rowCode(level, rng, i) {
    var size = rng.int(6, 8);
    var shape = rng.chance(0.6) ? S.randomShape(rng, size) : S.randomVariant(rng);
    var src = shape.grid.w === size ? shape.grid : G.fitCentre(size, size, shape.grid);
    var rows = [];
    for (var y = 0; y < src.h; y++) {
      var runs = [];
      var cur = null, run = 0;
      for (var x = 0; x < src.w; x++) {
        var c = G.get(src, x, y) || null;
        if (c === cur) run++;
        else {
          if (run > 0) runs.push({ count: run, color: cur });
          cur = c; run = 1;
        }
      }
      if (run > 0 && cur) runs.push({ count: run, color: cur });
      if (!runs.length) runs.push({ count: 0, color: null });
      rows.push({ row: y + 1, runs: runs });
    }
    var palette = Array.from(new Set(G.toList(src).map(function (p) { return p.color; })));
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'row-code',
      cols: size, rows: size,
      target: src,
      palette: palette,
      rowCodes: rows
    };
    ex.prompt = 'Each line is one row of the picture. Paint the rows.';
    ex.hint = 'Row 1 is the top. "2 red" means two red pixels next to each other, starting at column 1.';
    ex.grade = function (attemptGrid) {
      var diffs = G.diff(src, attemptGrid);
      if (!diffs.length) return { correct: true, message: 'The compressed code unpacked into the right picture.', detail: [] };
      return { correct: false, message: diffs.length + ' pixel' + (diffs.length > 1 ? 's' : '') + ' still differ.', detail: diffs.slice(0, 12) };
    };
    return ex;
  }

  /* ------------------------------- px6 -------------------------------- */

  var THEMES = ['a robot face', 'your favourite animal', 'a rocket in space', 'a sunny flower', 'a yummy cupcake', 'a spooky ghost', 'a house with a door', 'a fish in the sea'];

  function freeDraw(level, rng, i) {
    var size = 10;
    var theme = rng.pick(THEMES);
    var ex = {
      id: makeId(level, rng.seed, i),
      type: 'pixel', variant: 'free-draw',
      cols: size, rows: size,
      palette: kidPalette(rng, 6),
      theme: theme,
      minPixels: 10
    };
    ex.prompt = 'Draw ' + theme + '.';
    ex.hint = 'Use at least 10 pixels. When you like it, press Check — we will show you the code for it.';
    ex.grade = function (attemptGrid) {
      var n = G.count(attemptGrid);
      if (n < ex.minPixels) return { correct: false, message: 'Nice start! Paint at least ' + ex.minPixels + ' pixels (you have ' + n + ').' };
      return { correct: true, message: 'Beautiful! Your picture is saved to the gallery.', save: true };
    };
    return ex;
  }

  App.Exercises = App.Exercises || { generators: {}, register: null };
  App.Exercises.register('pixel', 'find-cell', findCell);
  App.Exercises.register('pixel', 'paint-list', paintList);
  App.Exercises.register('pixel', 'copy-shape', copyShape);
  App.Exercises.register('pixel', 'sprite-code', spriteCode);
  App.Exercises.register('pixel', 'row-code', rowCode);
  App.Exercises.register('pixel', 'free-draw', freeDraw);
})(window.App);
