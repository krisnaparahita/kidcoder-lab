/* =============================================================
 * KidCoder Lab - grid.js
 * Pixel grid model + DOM renderer.
 * Coordinates are 1-indexed (column x, row y) with origin top-left,
 * because that is how kids read a picture: "go right 3, go down 2".
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  /** @param {number} w columns  @param {number} h rows */
  function create(w, h, fill) {
    var cells = new Array(w * h);
    for (var i = 0; i < cells.length; i++) cells[i] = fill === undefined ? null : fill;
    return { w: w, h: h, cells: cells };
  }

  function idx(grid, x, y) { return y * grid.w + x; }   // x,y are 0-based
  function inside(grid, x, y) { return x >= 0 && y >= 0 && x < grid.w && y < grid.h; }
  function get(grid, x, y) { return inside(grid, x, y) ? grid.cells[idx(grid, x, y)] : null; }
  function set(grid, x, y, v) { if (inside(grid, x, y)) grid.cells[idx(grid, x, y)] = v; }
  function cloneGrid(grid) { return { w: grid.w, h: grid.h, cells: grid.cells.slice() }; }
  function count(grid) {
    var n = 0;
    for (var i = 0; i < grid.cells.length; i++) if (grid.cells[i]) n++;
    return n;
  }

  function equals(a, b) {
    if (!a || !b || a.w !== b.w || a.h !== b.h) return false;
    for (var i = 0; i < a.cells.length; i++) {
      if ((a.cells[i] || null) !== (b.cells[i] || null)) return false;
    }
    return true;
  }

  /** list of painted cells as 1-indexed coordinate objects */
  function toList(grid) {
    var out = [];
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) {
        var c = grid.cells[idx(grid, x, y)];
        if (c) out.push({ x: x + 1, y: y + 1, color: c });
      }
    }
    return out;
  }

  function fromList(w, h, list) {
    var g = create(w, h);
    list.forEach(function (p) { set(g, p.x - 1, p.y - 1, p.color); });
    return g;
  }

  /**
   * rows: ['..R.', 'RRRR']  palette: {R:'#ff0000', '.':null}
   */
  function fromRows(rows, palette) {
    var h = rows.length, w = rows[0].length;
    var g = create(w, h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x] || '.';
        set(g, x, y, palette && palette[ch] !== undefined ? palette[ch] : (ch === '.' ? null : ch));
      }
    }
    return g;
  }

  function toRows(grid, legend) {
    var rows = [];
    for (var y = 0; y < grid.h; y++) {
      var s = '';
      for (var x = 0; x < grid.w; x++) {
        var c = grid.cells[idx(grid, x, y)];
        s += c ? (legend && legend[c] ? legend[c] : '#') : '.';
      }
      rows.push(s);
    }
    return rows;
  }

  function paintedBounds(grid) {
    var minX = grid.w, minY = grid.h, maxX = -1, maxY = -1;
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) {
        if (grid.cells[idx(grid, x, y)]) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  /** Resize + centre a pattern inside a bigger canvas (used for shuffled variants). */
  function embed(target, source, offsetX, offsetY) {
    var g = cloneGrid(target);
    for (var y = 0; y < source.h; y++) {
      for (var x = 0; x < source.w; x++) {
        var v = get(source, x, y);
        if (v) set(g, x + offsetX, y + offsetY, v);
      }
    }
    return g;
  }

  function fitCentre(w, h, source) {
    var g = create(w, h);
    var ox = Math.floor((w - source.w) / 2);
    var oy = Math.floor((h - source.h) / 2);
    return embed(g, source, Math.max(0, ox), Math.max(0, oy));
  }

  function diff(expected, actual) {
    var out = [];
    for (var y = 0; y < expected.h; y++) {
      for (var x = 0; x < expected.w; x++) {
        var a = get(expected, x, y) || null;
        var b = get(actual, x, y) || null;
        if (a !== b) out.push({ x: x + 1, y: y + 1, expected: a, actual: b });
      }
    }
    return out;
  }

  /* ----------------------------- transform ----------------------------- */

  function flipX(grid) {
    var g = create(grid.w, grid.h);
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) set(g, grid.w - 1 - x, y, get(grid, x, y));
    }
    return g;
  }

  function rotate90(grid) {
    var g = create(grid.h, grid.w);
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) set(g, grid.h - 1 - y, x, get(grid, x, y));
    }
    return g;
  }

  /** repaint using a different palette mapping (shuffle colours) */
  function recolor(grid, map) {
    var g = cloneGrid(grid);
    for (var i = 0; i < g.cells.length; i++) {
      var c = g.cells[i];
      if (c && map[c]) g.cells[i] = map[c];
    }
    return g;
  }

  /* ------------------------------ rendering ---------------------------- */

  /**
   * Render a grid as a DOM board.
   * opts: { cell:px, showCoords, readOnly, onPaint(x,y), highlight:[{x,y,kind}],
   *         cursor, showTarget, aria }
   * Returns { root, update(grid, opts) }.
   */
  function renderDOM(grid, opts) {
    opts = opts || {};
    var cellSize = opts.cell || 34;
    var root = U.el('div.gridwrap');
    var board = U.el('div.gridboard', {
      style: {
        gridTemplateColumns: 'repeat(' + grid.w + ', ' + cellSize + 'px)',
        gridTemplateRows: 'repeat(' + grid.h + ', ' + cellSize + 'px)'
      },
      role: 'grid',
      'aria-label': opts.aria || 'pixel grid'
    });
    var cells = [];
    for (var y = 0; y < grid.h; y++) {
      for (var x = 0; x < grid.w; x++) {
        (function (x, y) {
          var c = U.el('button.cell', {
            type: 'button',
            style: { width: cellSize + 'px', height: cellSize + 'px' },
            dataset: { x: String(x + 1), y: String(y + 1) },
            'aria-label': 'column ' + (x + 1) + ', row ' + (y + 1),
            onclick: function () {
              if (opts.readOnly) return;
              App.audio.play('tap');
              if (opts.onPaint) opts.onPaint(x + 1, y + 1);
            }
          });
          cells.push(c);
          board.appendChild(c);
        })(x, y);
      }
    }

    if (opts.showCoords !== false) {
      var ruler = U.el('div.gridruler', {
        style: { gridTemplateColumns: 'repeat(' + grid.w + ', ' + cellSize + 'px)' }
      });
      for (var i = 1; i <= grid.w; i++) ruler.appendChild(U.el('span.rulercol', { text: String(i) }));
      var col = U.el('div.gridruler.vertical', {
        style: { gridTemplateRows: 'repeat(' + grid.h + ', ' + cellSize + 'px)' }
      });
      for (var j = 1; j <= grid.h; j++) col.appendChild(U.el('span.rulerrow', { text: String(j) }));
      var coords = U.el('div.gridcoords', {}, [
        U.el('div.gridcorner', { text: '↘' }), ruler, col, board
      ]);
      root.appendChild(coords);
    } else {
      root.appendChild(board);
    }

    var dims = { w: grid.w, h: grid.h };

    function paint(next, nextOpts) {
      if (nextOpts) opts = Object.assign({}, opts, nextOpts);
      var src = next || grid;
      dims = { w: src.w, h: src.h };
      for (var y2 = 0; y2 < src.h; y2++) {
        for (var x2 = 0; x2 < src.w; x2++) {
          var node = cells[y2 * src.w + x2];
          if (!node) continue;
          var v = get(src, x2, y2);
          node.style.background = v || 'transparent';
          node.classList.toggle('filled', !!v);
        }
      }
      applyMarks(opts.highlight || []);
    }

    function applyMarks(marks) {
      cells.forEach(function (n) { n.classList.remove('mark-ok', 'mark-bad', 'mark-hint', 'mark-cursor'); });
      (marks || []).forEach(function (m) {
        var n = cells[(m.y - 1) * dims.w + (m.x - 1)];
        if (!n) return;
        if (m.kind === 'ok') n.classList.add('mark-ok');
        else if (m.kind === 'bad') n.classList.add('mark-bad');
        else if (m.kind === 'hint') n.classList.add('mark-hint');
        else n.classList.add('mark-cursor');
      });
    }

    function setReadOnly(v) { opts.readOnly = !!v; root.classList.toggle('readonly', !!v); }

    paint(grid);
    return { root: root, board: board, cells: cells, paint: paint, marks: applyMarks, setReadOnly: setReadOnly };
  }

  App.Grid = {
    create: create,
    get: get,
    set: set,
    inside: inside,
    clone: cloneGrid,
    count: count,
    equals: equals,
    diff: diff,
    toList: toList,
    fromList: fromList,
    fromRows: fromRows,
    toRows: toRows,
    paintedBounds: paintedBounds,
    embed: embed,
    fitCentre: fitCentre,
    flipX: flipX,
    rotate90: rotate90,
    recolor: recolor,
    renderDOM: renderDOM
  };
})(window.App);
