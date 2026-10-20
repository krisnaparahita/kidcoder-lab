/* =============================================================
 * KidCoder Lab - render-python.js
 * Code editor, output terminal and turtle canvas.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var MP = App.MiniPy;

  App.Renderers = App.Renderers || {};

  /* ------------------------------- editor ------------------------------ */

  function makeEditor(initial) {
    var ta = document.createElement('textarea');
    ta.value = initial || '';
    ta.spellcheck = false;
    ta.setAttribute('aria-label', 'Python code editor');

    var gutter = U.el('div.gutter', { text: '1' });

    function refreshGutter() {
      var n = ta.value.split('\n').length;
      var s = '';
      for (var i = 1; i <= n; i++) s += i + '\n';
      gutter.textContent = s;
      gutter.scrollTop = ta.scrollTop;
    }

    ta.addEventListener('input', refreshGutter);
    ta.addEventListener('scroll', function () { gutter.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
        refreshGutter();
      }
    });

    function insert(text) {
      var start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + text.length;
      ta.focus();
      refreshGutter();
    }

    var SNIPPETS = [
      ['print()', 'print("")'],
      ['for', '\nfor i in range(3):\n    print(i)'],
      ['if', '\nif x > 5:\n    print("big")\nelse:\n    print("small")'],
      ['while', '\nn = 0\nwhile n < 3:\n    print(n)\n    n = n + 1'],
      ['def', '\ndef greet(name):\n    return "Hi " + name'],
      ['turtle', '\nforward(50)\nleft(90)']
    ];

    var tools = U.el('div.tools');
    SNIPPETS.forEach(function (s) {
      tools.appendChild(U.el('button', { text: s[0], onclick: function () { insert(s[1]); } }));
    });
    tools.appendChild(U.el('button', { text: '⇥ indent', onclick: function () { insert('    '); } }));

    var node = U.el('div.editor', {}, [tools, U.el('div', { style: { position: 'relative' } }, [gutter, ta])]);
    setTimeout(refreshGutter, 0);

    return {
      node: node,
      get: function () { return ta.value; },
      set: function (v) { ta.value = v; refreshGutter(); },
      focus: function () { ta.focus(); }
    };
  }

  /* ------------------------------- turtle ------------------------------ */

  function drawTurtle(canvas, turtle, animate) {
    var dpr = window.devicePixelRatio || 1;
    var size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var pts = [];
    turtle.segs.forEach(function (s) { pts.push([s.x1, s.y1], [s.x2, s.y2]); });
    turtle.dots.forEach(function (d) { pts.push([d.x, d.y]); });
    pts.push([0, 0]);
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    var pad = 18;
    var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    var scale = Math.min((size - pad * 2) / bw, (size - pad * 2) / bh);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    var ox = (size - bw * scale) / 2 - minX * scale;
    var oy = (size - bh * scale) / 2 - minY * scale;

    function clear() {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#fbfcff';
      ctx.fillRect(0, 0, size, size);
      // faint grid
      ctx.strokeStyle = '#eef1f9';
      ctx.lineWidth = 1;
      for (var g = 0; g <= size; g += 32) {
        ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(size, g); ctx.stroke();
      }
    }

    function drawUpTo(n) {
      clear();
      ctx.lineCap = 'round';
      for (var i = 0; i < n && i < turtle.segs.length; i++) {
        var s = turtle.segs[i];
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1, s.width);
        ctx.beginPath();
        ctx.moveTo(s.x1 * scale + ox, s.y1 * scale + oy);
        ctx.lineTo(s.x2 * scale + ox, s.y2 * scale + oy);
        ctx.stroke();
      }
      if (n >= turtle.segs.length) {
        turtle.dots.forEach(function (d) {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(d.x * scale + ox, d.y * scale + oy, Math.max(2, d.size / 2), 0, Math.PI * 2);
          ctx.fill();
        });
        turtle.texts.forEach(function (t) {
          ctx.fillStyle = t.color;
          ctx.font = '14px monospace';
          ctx.fillText(t.text, t.x * scale + ox, t.y * scale + oy);
        });
        // turtle marker
        var last = turtle.segs[turtle.segs.length - 1];
        var px = last ? last.x2 : 0, py = last ? last.y2 : 0;
        ctx.fillStyle = '#2f9e44';
        ctx.font = '18px serif';
        ctx.fillText('🐢', px * scale + ox - 9, py * scale + oy + 7);
      }
    }

    drawUpTo(turtle.segs.length);
    if (animate && turtle.segs.length > 1) {
      clear();
      var i = 0;
      (function step() {
        i += 2;
        drawUpTo(Math.min(i, turtle.segs.length));
        if (i < turtle.segs.length) requestAnimationFrame(step);
      })();
    }
  }

  /* ------------------------------- terminal ---------------------------- */

  function terminal() {
    var box = U.el('div.terminal');
    return {
      node: box,
      clear: function () { box.textContent = ''; },
      write: function (text, cls) {
        var span = U.el('span' + (cls ? '.' + cls : ''), { text: text });
        box.appendChild(span);
        box.scrollTop = box.scrollHeight;
      },
      line: function (text, cls) { box.appendChild(U.el('div' + (cls ? '.' + cls : ''), { text: text })); box.scrollTop = box.scrollHeight; }
    };
  }

  /* ------------------------------- predict ----------------------------- */

  function predict(ex, api) {
    var codeBox = U.el('div.code-list', { style: { maxHeight: 'none', fontSize: '1rem' } });
    ex.code.split('\n').forEach(function (l) {
      codeBox.appendChild(U.el('div', { html: highlight(l) }));
    });
    var wrap = U.el('div.choices');
    var locked = false;
    ex.choices.forEach(function (c) {
      var btn = U.el('button.choice', {
        onclick: function () {
          if (locked) return;
          locked = true;
          App.audio.play('click');
          btn.classList.add('on');
          api.submit(c.value).then(function (res) {
            btn.classList.add(res && res.correct ? 'right' : 'wrong');
          });
        }
      });
      btn.appendChild(U.el('pre', { text: c.label }));
      wrap.appendChild(btn);
    });
    return {
      node: U.el('div.work', {}, [codeBox, wrap]),
      attempt: function () { return null; },
      autoSubmit: true
    };
  }

  function highlight(line) {
    var esc = U.escapeHtml(line);
    esc = esc.replace(/(&quot;[^&]*?&quot;|"[^"]*")/g, '<span class="cm">$1</span>');
    esc = esc.replace(/\b(for|if|else|elif|while|in|range|print|def|return|import|and|or|not|True|False)\b/g, '<span class="nu">$1</span>');
    return esc;
  }

  /* --------------------------- write / turtle -------------------------- */

  function codeTask(ex, api) {
    var editor = makeEditor(ex.starter || '');
    var term = terminal();
    var canvas = null;
    var canvasWrap = null;

    if (ex.showTurtle) {
      canvas = document.createElement('canvas');
      canvas.className = 'turtle';
      canvasWrap = U.el('div.canvaswrap', {}, [canvas]);
    }

    function run() {
      term.clear();
      var inputs = (ex.tests && ex.tests[0] && ex.tests[0].inputs) ? ex.tests[0].inputs : ['robot'];
      var res = MP.run(editor.get(), { inputs: inputs });
      if (!res.ok) {
        term.line(res.error.name + (res.error.line ? ' (line ' + res.error.line + ')' : '') + ': ' + res.error.message, 'err');
        if (res.error.hint) term.line('💡 ' + res.error.hint, 'dim');
        App.audio.play('wrong');
      } else {
        if (res.lines.length) res.lines.forEach(function (l) { term.line(l, 'ok'); });
        else term.line('(the program printed nothing)', 'dim');
        term.line('✔ ran in ' + res.steps + ' steps', 'dim');
        if (canvas && res.turtle) drawTurtle(canvas, res.turtle, true);
      }
      return res;
    }

    var runBtn = U.el('button.btn.ok', { text: '▶ Run my code', onclick: function () { App.audio.play('click'); run(); } });

    var left = U.el('div', {}, [
      editor.node,
      U.el('div.row', { style: { marginTop: '10px' } }, [runBtn])
    ]);
    var right = U.el('div.stack', {}, [term.node]);
    if (canvasWrap) right.appendChild(canvasWrap);

    return {
      node: U.el('div.work.code-shell', {}, [left, right]),
      type: 'python',
      checkLabel: 'Check my code ✓',
      retryable: true,
      attempt: function () { return editor.get(); },
      revealSolution: function () { if (ex.solution) editor.set(ex.solution); run(); },
      reset: function () { editor.set(ex.starter || ''); term.clear(); if (canvas) drawTurtle(canvas, new MP.Turtle(), false); }
    };
  }

  var MAP = { 'predict': predict, 'write': codeTask, 'turtle': codeTask, 'project': codeTask };

  App.Renderers.python = {
    render: function (ex, api) {
      var fn = MAP[ex.variant] || codeTask;
      var r = fn(ex, api);
      r.type = 'python';
      return r;
    },
    makeEditor: makeEditor,
    drawTurtle: drawTurtle
  };
})(window.App);
