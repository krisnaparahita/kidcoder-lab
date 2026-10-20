/* =============================================================
 * KidCoder Lab - render-pixel.js
 * All Pixel Lab widgets: grid boards, palettes, code lists.
 * Contract: render(ex, api) -> { node, attempt(), reset(), autoSubmit }
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var G = App.Grid;
  var S = App.Sprites;

  App.Renderers = App.Renderers || {};

  var NAME_BY_HEX = {};
  Object.keys(S.PALETTE).forEach(function (n) { NAME_BY_HEX[S.PALETTE[n]] = n; });
  function nameOf(hex) { return NAME_BY_HEX[hex] || 'colour'; }

  /** Palette row + a shared "current colour" holder. */
  function paletteRow(colours, state, onChange) {
    var row = U.el('div.palette');
    state.color = state.color || colours[0];
    colours.forEach(function (c) {
      var sw = U.el('button.swatch', {
        title: nameOf(c),
        dataset: { color: c },
        style: { background: c },
        onclick: function () {
          state.color = c;
          App.audio.play('click');
          row.querySelectorAll('.swatch').forEach(function (n) { n.classList.remove('on'); });
          sw.classList.add('on');
          if (onChange) onChange(c);
        }
      });
      sw.appendChild(U.el('span.nm', { text: nameOf(c) }));
      if (c === state.color) sw.classList.add('on');
      row.appendChild(sw);
    });
    var er = U.el('button.swatch.eraser', {
      title: 'eraser',
      onclick: function () {
        state.color = null;
        row.querySelectorAll('.swatch').forEach(function (n) { n.classList.remove('on'); });
        er.classList.add('on');
      }
    });
    er.appendChild(U.el('span.nm', { text: 'erase' }));
    row.appendChild(er);
    return row;
  }

  /** Editable board + palette. Returns { node, grid, view } */
  function paintBoard(ex, opts) {
    opts = opts || {};
    var cell = opts.cell || (ex.cols > 8 ? 30 : 36);
    var grid = G.create(ex.cols, ex.rows);
    var state = { color: (ex.palette && ex.palette[0]) || S.PALETTE.red };
    var view = G.renderDOM(grid, {
      cell: cell,
      onPaint: function (x, y) {
        G.set(grid, x - 1, y - 1, state.color);
        view.paint(grid);
        App.audio.play('tap');
      }
    });
    var node = U.el('div.stack', {}, [
      paletteRow(ex.palette || [S.PALETTE.red, S.PALETTE.blue, S.PALETTE.yellow], state),
      U.el('div', { style: { marginTop: '26px' } }, [view.root])
    ]);
    return {
      node: node,
      grid: grid,
      view: view,
      reset: function () { grid.cells.fill(null); view.paint(grid); }
    };
  }

  function readOnlyBoard(grid, cell) {
    var view = G.renderDOM(grid, { cell: cell || 34, readOnly: true, showCoords: false });
    return view.root;
  }

  /* ------------------------------ find-cell ---------------------------- */

  function findCell(ex, api) {
    if (ex.kind === 'read') {
      var marked = G.create(ex.cols, ex.rows);
      G.set(marked, ex.target.x - 1, ex.target.y - 1, ex.marker);
      var view = G.renderDOM(marked, { cell: 38, readOnly: true });
      var node = U.el('div.work', {}, [
        U.el('div.center', {}, [view.root]),
        choiceRow(ex, api, function (c) { return api.submit(c.value); })
      ]);
      return { node: node, attempt: function () { return null; }, autoSubmit: true };
    }

    var view = G.renderDOM(G.create(ex.cols, ex.rows), {
      cell: 38,
      onPaint: function (x, y) {
        var ok = x === ex.target.x && y === ex.target.y;
        view.marks([{ x: x, y: y, kind: ok ? 'ok' : 'bad' }]);
        setTimeout(function () { api.submit({ x: x, y: y }); }, ok ? 420 : 620);
      }
    });
    var node = U.el('div.work.center', {}, [view.root]);
    return { node: node, attempt: function () { return null; }, autoSubmit: true };
  }

  /* ------------------------------ shared MC ---------------------------- */

  function choiceRow(ex, api, onPick) {
    var wrap = U.el('div.choices', { style: { marginTop: '16px' } });
    ex.choices.forEach(function (c) {
      var btn = U.el('button.choice', {
        onclick: function () {
          wrap.querySelectorAll('.choice').forEach(function (b) { b.classList.remove('on'); });
          btn.classList.add('on');
          App.audio.play('click');
          onPick(c);
        }
      });
      if (c.label.indexOf('\n') >= 0 || c.label.length > 24) {
        btn.appendChild(U.el('pre', { text: c.label }));
      } else {
        btn.textContent = c.label;
      }
      wrap.appendChild(btn);
    });
    return wrap;
  }

  /* ------------------------------ paint list --------------------------- */

  function codeList(lines, opts) {
    opts = opts || {};
    var box = U.el('div.code-list');
    lines.forEach(function (l, i) {
      var row = U.el('div', {}, [
        U.el('span.ln', { text: (i + 1) + '.' }),
        U.el('span', { html: l })
      ]);
      box.appendChild(row);
    });
    return box;
  }

  function paintList(ex, api) {
    var board = paintBoard(ex);
    var lines = ex.instructions.map(function (p) {
      return 'paint (<span class="nu">' + p.x + '</span>, <span class="nu">' + p.y + '</span>) ' +
        '<span class="cm">' + nameOf(p.color) + '</span>';
    });
    var node = U.el('div.work', {}, [
      U.el('div.row.wrap', { style: { alignItems: 'flex-start' } }, [
        U.el('div', { style: { flex: '1 1 260px' } }, [
          U.el('h4', { text: 'Instructions' }),
          codeList(lines)
        ]),
        U.el('div', { style: { flex: '0 0 auto' } }, [board.node])
      ])
    ]);
    return {
      node: node,
      attempt: function () { return board.grid; },
      reset: board.reset,
      feedback: function (res) { if (res.detail && res.detail.length) board.view.marks(res.detail.map(function (d) { return { x: d.x, y: d.y, kind: 'bad' }; })); }
    };
  }

  /* ------------------------------ copy shape --------------------------- */

  function copyShape(ex, api) {
    var board = paintBoard(ex);
    var node = U.el('div.work', {}, [
      U.el('div.row.wrap', { style: { alignItems: 'flex-start' } }, [
        U.el('div', { style: { flex: '0 0 auto', textAlign: 'center' } }, [
          U.el('h4', { text: 'Copy this' }),
          readOnlyBoard(ex.source, ex.cols > 8 ? 28 : 34)
        ]),
        U.el('div', { style: { flex: '0 0 auto' } }, [board.node])
      ])
    ]);
    return {
      node: node,
      attempt: function () { return board.grid; },
      reset: board.reset,
      feedback: function (res) { if (res.detail && res.detail.length) board.view.marks(res.detail.map(function (d) { return { x: d.x, y: d.y, kind: 'bad' }; })); }
    };
  }

  /* ------------------------------ sprite code -------------------------- */

  function spriteCode(ex, api) {
    var board = paintBoard(ex, { cell: 34 });
    var lines = ex.code.map(function (p) {
      return 'pixel(<span class="nu">' + p.x + '</span>, <span class="nu">' + p.y + '</span>, ' +
        '<span class="cm">"' + nameOf(p.color) + '"</span>)';
    });
    var node = U.el('div.work', {}, [
      U.el('div.row.wrap', { style: { alignItems: 'flex-start' } }, [
        U.el('div', { style: { flex: '1 1 300px' } }, [
          U.el('h4', { text: 'sprite.txt (' + ex.code.length + ' lines)' }),
          codeList(lines)
        ]),
        U.el('div', { style: { flex: '0 0 auto' } }, [board.node])
      ])
    ]);
    return {
      node: node,
      attempt: function () { return board.grid; },
      reset: board.reset,
      feedback: function (res) { if (res.detail && res.detail.length) board.view.marks(res.detail.map(function (d) { return { x: d.x, y: d.y, kind: 'bad' }; })); }
    };
  }

  /* ------------------------------- row code ---------------------------- */

  function rowCode(ex, api) {
    var board = paintBoard(ex);
    var lines = (ex.rowCodes || []).map(function (r) {
      if (!r.runs.length || (r.runs.length === 1 && !r.runs[0].color)) return 'row ' + r.row + ': (empty)';
      return 'row ' + r.row + ': ' + r.runs.map(function (run) {
        return '<span class="nu">' + run.count + '</span> <span class="cm">' + nameOf(run.color) + '</span>';
      }).join(', ');
    });
    var node = U.el('div.work', {}, [
      U.el('div.row.wrap', { style: { alignItems: 'flex-start' } }, [
        U.el('div', { style: { flex: '1 1 280px' } }, [
          U.el('h4', { text: 'Compressed picture' }),
          codeList(lines)
        ]),
        U.el('div', { style: { flex: '0 0 auto' } }, [board.node])
      ])
    ]);
    return {
      node: node,
      attempt: function () { return board.grid; },
      reset: board.reset,
      feedback: function (res) { if (res.detail && res.detail.length) board.view.marks(res.detail.map(function (d) { return { x: d.x, y: d.y, kind: 'bad' }; })); }
    };
  }

  /* ------------------------------- free draw --------------------------- */

  function freeDraw(ex, api) {
    var board = paintBoard(ex, { cell: 30 });
    var node = U.el('div.work', {}, [board.node]);
    return {
      node: node,
      attempt: function () { return board.grid; },
      reset: board.reset,
      onCorrect: function (res) {
        if (res.save) {
          App.Progress.galleryAdd({
            type: 'pixel',
            title: ex.theme,
            cols: ex.cols,
            rows: ex.rows,
            cells: board.grid.cells.slice(),
            w: ex.cols, h: ex.rows
          });
        }
      }
    };
  }

  /* ------------------------------ dispatcher --------------------------- */

  var MAP = {
    'find-cell': findCell,
    'paint-list': paintList,
    'copy-shape': copyShape,
    'sprite-code': spriteCode,
    'row-code': rowCode,
    'free-draw': freeDraw
  };

  App.Renderers.pixel = {
    render: function (ex, api) {
      var fn = MAP[ex.variant] || paintList;
      var r = fn(ex, api);
      r.type = 'pixel';
      return r;
    },
    paletteRow: paletteRow,
    paintBoard: paintBoard,
    readOnlyBoard: readOnlyBoard,
    choiceRow: choiceRow
  };
})(window.App);
