/* =============================================================
 * KidCoder Lab - minipy.js
 * A small, safe, dependency-free Python interpreter.
 *
 * Why not Pyodide? It is ~10 MB and needs a network round-trip on
 * first load. For a 6-12 year old audience we want instant feedback
 * and offline capability, and the curriculum only uses a subset of
 * Python. The engine below implements that subset with:
 *   - real Python syntax (indentation, for/range, if/elif/else, while)
 *   - real Python error names (SyntaxError, NameError, ...)
 *   - a step/time budget so an accidental `while True` never freezes
 *   - a turtle that records draw operations for the canvas renderer
 * The `run()` contract is engine-agnostic: swapping in Pyodide later
 * only means re-implementing this one function.
 * ============================================================= */
(function (App) {
  'use strict';

  var KEYWORDS = {
    'if': 1, 'elif': 1, 'else': 1, 'while': 1, 'for': 1, 'in': 1, 'def': 1,
    'return': 1, 'break': 1, 'continue': 1, 'pass': 1, 'and': 1, 'or': 1,
    'not': 1, 'True': 1, 'False': 1, 'None': 1, 'import': 1, 'from': 1, 'as': 1,
    'lambda': 1, 'global': 1
  };

  function PyError(name, message, line, col) {
    var e = new Error(message);
    e.name = name;
    e.pyName = name;
    e.line = line;
    e.col = col;
    return e;
  }

  /* ============================ Tokenizer ============================ */

  function tokenize(src) {
    src = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    var toks = [];
    var stack = [0];
    var i = 0, line = 1, lineStart = true, depth = 0;

    function push(type, value, ln) { toks.push({ type: type, value: value, line: ln || line }); }

    var MULTI = ['**=', '//=', '**', '//', '<=', '>=', '==', '!=', '<>', '+=', '-=', '*=', '/=', '%='];
    var SINGLE = '+-*/%=<>()[]{},.:;';

    while (i < src.length) {
      var ch = src[i];

      if (ch === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }

      if (lineStart) {
        var j = i, spaces = 0;
        while (j < src.length && src[j] === ' ') { j++; spaces++; }
        var k = j;
        while (k < src.length && (src[k] === ' ' || src[k] === '\t')) k++;
        if (k >= src.length || src[k] === '\n' || src[k] === '#') {
          i = src.indexOf('\n', k);
          if (i < 0) i = src.length; else { i++; line++; }
          continue;                                   // blank / comment-only line
        }
        var top = stack[stack.length - 1];
        if (spaces > top) { stack.push(spaces); push('INDENT', spaces, line); }
        else if (spaces < top) {
          while (stack[stack.length - 1] > spaces) { stack.pop(); push('DEDENT', spaces, line); }
          if (stack[stack.length - 1] !== spaces) {
            throw PyError('IndentationError', 'This line is not lined up with the block above it.', line);
          }
        }
        i = j; lineStart = false;
        continue;
      }

      if (ch === '\n') {
        i++; line++;
        if (depth === 0) { push('NEWLINE', '\n', line - 1); lineStart = true; }
        continue;
      }
      if (ch === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (ch === ' ' || ch === '\t') { i++; continue; }

      // ---- strings
      if (ch === '"' || ch === "'") {
        var quote = ch, start = ++i, buf = '', startLine = line;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\n') throw PyError('SyntaxError', 'A text value is missing its closing ' + quote, startLine);
          if (src[i] === '\\') {
            var esc = src[++i];
            buf += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
            i++;
          } else { buf += src[i++]; }
        }
        if (i >= src.length) throw PyError('SyntaxError', 'A text value is missing its closing ' + quote, startLine);
        i++;
        push('STRING', buf, startLine);
        continue;
      }

      // ---- numbers
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var ns = i, seenDot = false;
        while (i < src.length) {
          var c = src[i];
          if (/[0-9]/.test(c)) { i++; }
          else if (c === '.' && !seenDot) { seenDot = true; i++; }
          else break;
        }
        push('NUMBER', parseFloat(src.slice(ns, i)), line);
        continue;
      }

      // ---- names
      if (/[A-Za-z_]/.test(ch)) {
        var ss = i;
        while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
        var word = src.slice(ss, i);
        push(KEYWORDS[word] ? 'KEYWORD' : 'NAME', word, line);
        continue;
      }

      // ---- operators
      var matched = false;
      for (var m = 0; m < MULTI.length; m++) {
        if (src.substr(i, MULTI[m].length) === MULTI[m]) {
          push('OP', MULTI[m], line); i += MULTI[m].length; matched = true; break;
        }
      }
      if (matched) continue;

      if (SINGLE.indexOf(ch) >= 0) {
        if ('([{'.indexOf(ch) >= 0) depth++;
        if (')]}'.indexOf(ch) >= 0) depth--;
        push('OP', ch, line); i++;
        continue;
      }

      throw PyError('SyntaxError', 'I do not understand the symbol "' + ch + '".', line);
    }

    if (depth > 0) throw PyError('SyntaxError', 'A bracket was opened but never closed.', line);
    if (toks.length && toks[toks.length - 1].type !== 'NEWLINE') push('NEWLINE', '\n', line);
    while (stack.length > 1) { stack.pop(); push('DEDENT', 0, line); }
    push('EOF', null, line);
    return toks;
  }

  /* ============================== Parser ============================== */

  function Parser(toks) { this.t = toks; this.i = 0; }
  Parser.prototype = {
    peek: function (k) {
      var tk = this.t[this.i] || { type: 'EOF' };
      if (!k) return tk.type;
      return tk.value === k || tk.type === k;
    },
    cur: function () { return this.t[this.i] || { type: 'EOF', line: 0 }; },
    next: function () { return this.t[this.i++]; },
    accept: function (v) { if (this.peek(v)) { this.i++; return true; } return false; },
    expect: function (v, what) {
      if (!this.accept(v)) {
        var tk = this.cur();
        throw PyError('SyntaxError', 'Expected "' + (what || v) + '" around line ' + tk.line + '.', tk.line);
      }
    },
    skipNewlines: function () { while (this.peek('NEWLINE')) this.i++; },

    parseModule: function () {
      this.skipNewlines();
      var body = [];
      while (this.cur().type !== 'EOF') {
        body.push(this.statement());
        this.skipNewlines();
      }
      return { t: 'Module', body: body };
    },

    parseBlock: function () {
      this.expect('NEWLINE', 'end of line');
      if (this.cur().type !== 'INDENT') {
        var tk = this.cur();
        throw PyError('IndentationError', 'This block needs indented lines underneath it.', tk.line);
      }
      this.next();
      var body = [];
      while (this.cur().type !== 'DEDENT' && this.cur().type !== 'EOF') {
        body.push(this.statement());
        this.skipNewlines();
      }
      if (this.cur().type === 'DEDENT') this.next();
      if (!body.length) throw PyError('IndentationError', 'This block is empty — add at least one line inside it.', this.cur().line);
      return body;
    },

    statement: function () {
      var tk = this.cur();
      if (tk.type === 'KEYWORD') {
        switch (tk.value) {
          case 'if': return this.parseIf();
          case 'while': return this.parseWhile();
          case 'for': return this.parseFor();
          case 'def': return this.parseDef();
          case 'pass': this.next(); this.eat(); return { t: 'Pass', line: tk.line };
          case 'break': this.next(); this.eat(); return { t: 'Break', line: tk.line };
          case 'continue': this.next(); this.eat(); return { t: 'Continue', line: tk.line };
          case 'import': return this.parseImport();
          case 'from': return this.parseFromImport();
        }
      }
      if (tk.type === 'KEYWORD' && tk.value === 'return') {
        this.next();
        var val = null;
        if (!this.peek('NEWLINE')) val = this.expr();
        this.eat();
        return { t: 'Return', value: val, line: tk.line };
      }
      return this.simpleStatement();
    },

    eat: function () {
      if (this.cur().type === 'NEWLINE') { this.next(); return; }
      if (this.cur().type === 'EOF' || this.cur().type === 'DEDENT') return;
      var tk = this.cur();
      throw PyError('SyntaxError', 'Unexpected extra code on line ' + tk.line + '.', tk.line);
    },

    parseIf: function () {
      var line = this.cur().line; this.next();
      var test = this.expr();
      this.expect(':');
      var body = this.parseBlock();
      var orelse = [];
      if (this.peek('elif')) {
        orelse = [this.parseIf()];        // parseIf() consumes the "elif" itself
      } else if (this.peek('else')) {
        this.next();
        this.expect(':');
        orelse = this.parseBlock();
      }
      return { t: 'If', test: test, body: body, orelse: orelse, line: line };
    },

    parseWhile: function () {
      var line = this.cur().line; this.next();
      var test = this.expr();
      this.expect(':');
      var body = this.parseBlock();
      return { t: 'While', test: test, body: body, line: line };
    },

    parseFor: function () {
      var line = this.cur().line; this.next();
      if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'for needs a variable name.', line);
      var target = this.next().value;
      if (!this.accept('in')) throw PyError('SyntaxError', 'for needs the word "in".', line);
      var iter = this.expr();
      this.expect(':');
      var body = this.parseBlock();
      return { t: 'For', target: target, iter: iter, body: body, line: line };
    },

    parseDef: function () {
      var line = this.cur().line; this.next();
      if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'def needs a function name.', line);
      var name = this.next().value;
      this.expect('(');
      var params = [];
      while (!this.peek(')')) {
        if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'Bad parameter name.', line);
        params.push(this.next().value);
        if (!this.accept(',')) break;
      }
      this.expect(')');
      this.expect(':');
      var body = this.parseBlock();
      return { t: 'Def', name: name, params: params, body: body, line: line };
    },

    parseImport: function () {
      var line = this.cur().line; this.next();
      var names = [];
      do {
        if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'Bad import.', line);
        names.push(this.next().value);
      } while (this.accept(','));
      this.eat();
      return { t: 'Import', names: names, line: line };
    },

    parseFromImport: function () {
      var line = this.cur().line; this.next();
      var mod = this.cur().type === 'NAME' ? this.next().value : '*';
      if (!this.accept('import')) throw PyError('SyntaxError', 'Expected "import".', line);
      var names = [];
      if (this.accept('*')) names.push('*');
      else {
        do {
          if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'Bad import.', line);
          names.push(this.next().value);
        } while (this.accept(','));
      }
      this.eat();
      return { t: 'FromImport', module: mod, names: names, line: line };
    },

    simpleStatement: function () {
      var line = this.cur().line;
      var left = this.expr();

      var aug = null;
      ['+=', '-=', '*=', '/=', '//=', '%='].forEach(function (op) {
        if (this.peek(op)) { aug = op; }
      }, this);
      if (aug) {
        this.next();
        var rhs = this.expr();
        this.eat();
        if (left.t !== 'Name' && left.t !== 'Index') {
          throw PyError('SyntaxError', 'You can only change the value of a name or a list item.', line);
        }
        return { t: 'AugAssign', op: aug.slice(0, -1), target: left, value: rhs, line: line };
      }

      if (this.peek('=') && this.t[this.i].type === 'OP') {
        this.next();
        var val = this.expr();
        this.eat();
        if (left.t !== 'Name' && left.t !== 'Index') {
          throw PyError('SyntaxError', 'You can only store a value in a name or a list item.', line);
        }
        return { t: 'Assign', target: left, value: val, line: line };
      }

      this.eat();
      return { t: 'ExprStmt', value: left, line: line };
    },

    /* -------------------------- expressions -------------------------- */

    expr: function () { return this.orTest(); },

    orTest: function () {
      var node = this.andTest(), values = [node];
      while (this.peek('or')) { this.next(); values.push(this.andTest()); }
      return values.length === 1 ? node : { t: 'BoolOp', op: 'or', values: values, line: node.line };
    },

    andTest: function () {
      var node = this.notTest(), values = [node];
      while (this.peek('and')) { this.next(); values.push(this.notTest()); }
      return values.length === 1 ? node : { t: 'BoolOp', op: 'and', values: values, line: node.line };
    },

    notTest: function () {
      if (this.peek('not')) {
        var line = this.cur().line; this.next();
        return { t: 'UnaryOp', op: 'not', operand: this.notTest(), line: line };
      }
      return this.comparison();
    },

    comparison: function () {
      var left = this.arith(), pairs = [];
      while (true) {
        var tk = this.cur();
        if (tk.type === 'OP' && ['==', '!=', '<', '>', '<=', '>=', '<>'].indexOf(tk.value) >= 0) {
          this.next(); pairs.push([tk.value, this.arith()]);
        } else if (tk.type === 'KEYWORD' && (tk.value === 'in' || tk.value === 'not')) {
          if (tk.value === 'not' && this.t[this.i + 1] && this.t[this.i + 1].value === 'in') {
            this.next(); this.next(); pairs.push(['not in', this.arith()]);
          } else if (tk.value === 'in') {
            this.next(); pairs.push(['in', this.arith()]);
          } else break;
        } else break;
      }
      if (!pairs.length) return left;
      return { t: 'Compare', left: left, pairs: pairs, line: left.line };
    },

    arith: function () {
      var node = this.term();
      while (this.peek('+') || this.peek('-')) {
        var op = this.next().value;
        node = { t: 'BinOp', op: op, left: node, right: this.term(), line: node.line };
      }
      return node;
    },

    term: function () {
      var node = this.factor();
      while (this.peek('*') || this.peek('/') || this.peek('//') || this.peek('%')) {
        var op = this.next().value;
        node = { t: 'BinOp', op: op, left: node, right: this.factor(), line: node.line };
      }
      return node;
    },

    factor: function () {
      if (this.peek('-') || this.peek('+')) {
        var op = this.next().value;
        return { t: 'UnaryOp', op: op, operand: this.factor(), line: this.cur().line };
      }
      return this.power();
    },

    power: function () {
      var base = this.atom();
      if (this.peek('**')) {
        this.next();
        base = { t: 'BinOp', op: '**', left: base, right: this.factor(), line: base.line };
      }
      return base;
    },

    atom: function () {
      var tk = this.cur();
      if (tk.type === 'NUMBER') { this.next(); return { t: 'Num', value: tk.value, line: tk.line }; }
      if (tk.type === 'STRING') { this.next(); return { t: 'Str', value: tk.value, line: tk.line }; }
      if (tk.type === 'KEYWORD') {
        if (tk.value === 'True') { this.next(); return { t: 'Bool', value: true, line: tk.line }; }
        if (tk.value === 'False') { this.next(); return { t: 'Bool', value: false, line: tk.line }; }
        if (tk.value === 'None') { this.next(); return { t: 'None', line: tk.line }; }
      }
      if (tk.type === 'NAME') {
        this.next();
        var node = { t: 'Name', id: tk.value, line: tk.line };
        if (this.peek('(')) { this.next(); node = { t: 'Call', func: node, args: this.callArgs(), line: tk.line }; }
        return node;
      }
      if (this.peek('(')) {
        this.next();
        var inner = this.expr();
        this.expect(')', ')');
        var n = { t: 'Paren', value: inner, line: tk.line };
        if (this.peek('(')) { this.next(); n = { t: 'Call', func: inner, args: this.callArgs(), line: tk.line }; }
        return n;
      }
      if (this.peek('[')) {
        this.next();
        var items = [];
        while (!this.peek(']')) {
          items.push(this.expr());
          if (!this.accept(',')) break;
        }
        this.expect(']', ']');
        return { t: 'List', items: items, line: tk.line };
      }
      throw PyError('SyntaxError', 'Unexpected "' + (tk.value === null ? 'end of code' : tk.value) + '" on line ' + tk.line + '.', tk.line);
    },

    callArgs: function () {
      var args = [];
      while (!this.peek(')')) {
        // simple keyword arg support: name=value
        if (this.cur().type === 'NAME' && this.t[this.i + 1] && this.t[this.i + 1].type === 'OP' && this.t[this.i + 1].value === '=') {
          var n = this.next().value; this.next();
          args.push({ kw: n, value: this.expr() });
        } else {
          args.push({ value: this.expr() });
        }
        if (!this.accept(',')) break;
      }
      this.expect(')', ')');
      return args;
    },

    trailer: function (node) {
      while (true) {
        if (this.peek('.')) {
          this.next();
          if (this.cur().type !== 'NAME') throw PyError('SyntaxError', 'Expected a name after the dot.', this.cur().line);
          var attr = this.next().value;
          node = { t: 'Attr', value: node, attr: attr, line: this.cur().line };
          if (this.peek('(')) { this.next(); node = { t: 'Call', func: node, args: this.callArgs(), line: this.cur().line }; }
        } else if (this.peek('[')) {
          this.next();
          var lo = null, hi = null, isSlice = false;
          if (!this.peek(':')) lo = this.expr();
          if (this.accept(':')) { isSlice = true; if (!this.peek(']')) hi = this.expr(); }
          this.expect(']', ']');
          node = isSlice ? { t: 'Slice', value: node, lo: lo, hi: hi, line: this.cur().line }
            : { t: 'Index', value: node, index: lo, line: this.cur().line };
        } else if (this.peek('(')) {
          this.next();
          node = { t: 'Call', func: node, args: this.callArgs(), line: this.cur().line };
        } else break;
      }
      return node;
    }
  };

  /* trailers must be applied inside atom/power */
  var _power = Parser.prototype.power;
  Parser.prototype.power = function () {
    var base = this.factorAtom();
    if (this.peek('**')) {
      this.next();
      base = { t: 'BinOp', op: '**', left: base, right: this.factor(), line: base.line };
    }
    return this.trailer(base);
  };
  Parser.prototype.factorAtom = Parser.prototype.atom;
  Parser.prototype.atom = function () {
    var tk = this.cur();
    if (tk.type === 'NUMBER') { this.next(); return { t: 'Num', value: tk.value, line: tk.line }; }
    if (tk.type === 'STRING') { this.next(); return { t: 'Str', value: tk.value, line: tk.line }; }
    if (tk.type === 'KEYWORD') {
      if (tk.value === 'True') { this.next(); return { t: 'Bool', value: true, line: tk.line }; }
      if (tk.value === 'False') { this.next(); return { t: 'Bool', value: false, line: tk.line }; }
      if (tk.value === 'None') { this.next(); return { t: 'None', line: tk.line }; }
    }
    if (tk.type === 'NAME') { this.next(); return { t: 'Name', id: tk.value, line: tk.line }; }
    if (this.peek('(')) {
      this.next();
      var inner = this.expr();
      this.expect(')', ')');
      return { t: 'Paren', value: inner, line: tk.line };
    }
    if (this.peek('[')) {
      this.next();
      var items = [];
      while (!this.peek(']')) { items.push(this.expr()); if (!this.accept(',')) break; }
      this.expect(']', ']');
      return { t: 'List', items: items, line: tk.line };
    }
    throw PyError('SyntaxError', 'Unexpected "' + (tk.value === null ? 'end of code' : tk.value) + '" on line ' + tk.line + '.', tk.line);
  };

  function parse(src) {
    var toks = tokenize(src);
    var p = new Parser(toks);
    return p.parseModule();
  }

  /* =========================== Interpreter =========================== */

  function truthy(v) {
    if (v === null || v === undefined || v === false || v === true) return v === true;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }

  function repr(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return String(Math.round(v * 1e10) / 1e10);
    }
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (Array.isArray(v)) return '[' + v.map(repr).join(', ') + ']';
    if (v && v.__py === 'func') return '<function ' + v.name + '>';
    if (v && v.__py === 'builtin') return '<built-in ' + v.name + '>';
    if (v && v.__py === 'module') return '<module ' + v.name + '>';
    if (v && v.__py === 'turtle') return '<turtle>';
    return String(v);
  }

  function str(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e10) / 1e10);
    if (typeof v === 'string') return v;
    return repr(v);
  }

  function num(v, line, op) {
    if (typeof v === 'boolean') v = v ? 1 : 0;
    if (typeof v !== 'number') {
      throw PyError('TypeError', 'You can only use numbers with "' + op + '", not ' + typeName(v) + '.', line);
    }
    return v;
  }

  function typeName(v) {
    if (v === null || v === undefined) return 'NoneType';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'boolean') return 'bool';
    if (Array.isArray(v)) return 'list';
    if (v && v.__py === 'func') return 'function';
    return 'object';
  }

  function deepEq(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
      return true;
    }
    if (a === null || b === null || a === undefined || b === undefined) {
      return (a === null || a === undefined) && (b === null || b === undefined);
    }
    return a === b;
  }

  /* ------------------------------ Turtle ------------------------------ */

  var PALETTE_NAMES = {
    red: '#e03131', orange: '#f76707', yellow: '#fcc419', green: '#2f9e44',
    blue: '#1c7ed6', cyan: '#22b8cf', purple: '#7048e8', pink: '#e64980',
    black: '#1f2440', white: '#ffffff', brown: '#8b5e3c', grey: '#868e96', gray: '#868e96'
  };

  function Turtle() {
    this.x = 0; this.y = 0;
    this.angle = 0;            // degrees, 0 = east, counter-clockwise
    this.pen = true;
    this.color = '#1c7ed6';
    this.width = 3;
    this.speed = 5;
    this.segs = [];
    this.dots = [];
    this.texts = [];
    this.visible = true;
  }

  function resolveColor(c) {
    if (typeof c !== 'string') return '#1c7ed6';
    if (c[0] === '#') return c;
    return PALETTE_NAMES[c.toLowerCase()] || c;
  }

  Turtle.prototype = {
    _move: function (dist) {
      var r = (this.angle * Math.PI) / 180;
      var nx = this.x + Math.cos(r) * dist;
      var ny = this.y - Math.sin(r) * dist;   // screen y grows downward
      if (this.pen) this.segs.push({ x1: this.x, y1: this.y, x2: nx, y2: ny, color: this.color, width: this.width });
      this.x = nx; this.y = ny;
    },
    forward: function (d) { this._move(typeof d === 'number' ? d : 50); },
    backward: function (d) { this._move(-(typeof d === 'number' ? d : 50)); },
    left: function (a) { this.angle += (typeof a === 'number' ? a : 90); },
    right: function (a) { this.angle -= (typeof a === 'number' ? a : 90); },
    penup: function () { this.pen = false; },
    pendown: function () { this.pen = true; },
    pencolor: function (c) { this.color = resolveColor(c); },
    pensize: function (w) { this.width = Math.max(1, typeof w === 'number' ? w : 3); },
    speed: function (s) { this.speed = s; },
    home: function () { this.x = 0; this.y = 0; this.angle = 0; },
    goto: function (x, y) {
      if (this.pen) this.segs.push({ x1: this.x, y1: this.y, x2: x, y2: y, color: this.color, width: this.width });
      this.x = x; this.y = y;
    },
    setheading: function (a) { this.angle = typeof a === 'number' ? a : 0; },
    dot: function (size, c) { this.dots.push({ x: this.x, y: this.y, size: size || 8, color: resolveColor(c || this.color) }); },
    write: function (t) { this.texts.push({ x: this.x, y: this.y, text: String(t), color: this.color }); },
    clear: function () { this.segs = []; this.dots = []; this.texts = []; },
    circle: function (r, extent) {
      var steps = 36, ext = extent === undefined ? 360 : extent;
      var stepLen = (2 * Math.PI * (r || 30)) / steps * (ext / 360);
      var turn = ext / steps;
      for (var i = 0; i < steps; i++) { this._move(stepLen); this.left(turn); }
    },
    reset: function () { this.clear(); this.home(); this.pen = true; this.color = '#1c7ed6'; this.width = 3; }
  };

  function makeTurtleObject(t) {
    var o = { __py: 'turtle', _t: t };
    ['forward', 'backward', 'left', 'right', 'penup', 'pendown', 'pencolor', 'pensize',
      'speed', 'home', 'goto', 'setheading', 'dot', 'write', 'clear', 'circle', 'reset'].forEach(function (m) {
        o[m] = {
          __py: 'builtin', name: m,
          fn: function (args) { return t[m].apply(t, args.map(function (a) { return a.value; })); }
        };
      });
    o.fd = o.forward; o.bk = o.backward; o.back = o.backward;
    o.lt = o.left; o.rt = o.right; o.pu = o.penup; o.pd = o.pendown;
    o.color = o.pencolor; o.width = o.pensize;
    return o;
  }

  /* ---------------------------- Environment --------------------------- */

  function Env(parent) { this.vars = Object.create(null); this.parent = parent || null; }
  Env.prototype.get = function (name) {
    var e = this;
    while (e) { if (name in e.vars) return e.vars[name]; e = e.parent; }
    return undefined;
  };
  Env.prototype.set = function (name, v) { this.vars[name] = v; };
  Env.prototype.assign = function (name, v) {
    var e = this;
    while (e) { if (name in e.vars) { e.vars[name] = v; return true; } e = e.parent; }
    return false;
  };

  /* --------------------------- Method tables -------------------------- */

  function pyMethod(name, fn) { return { __py: 'builtin', name: name, fn: fn }; }

  var STR_METHODS = {
    upper: function (s) { return s.toUpperCase(); },
    lower: function (s) { return s.toLowerCase(); },
    title: function (s) { return s.replace(/\w\S*/g, function (t) { return t[0].toUpperCase() + t.slice(1).toLowerCase(); }); },
    strip: function (s) { return s.trim(); },
    capitalize: function (s) { return s.charAt(0).toUpperCase() + s.slice(1); },
    split: function (s, sep) { return sep === undefined || sep === null ? s.split(/\s+/).filter(function (x) { return x; }) : s.split(sep); },
    replace: function (s, a, b) { return s.split(a).join(b); },
    count: function (s, sub) { return s.split(sub).length - 1; },
    find: function (s, sub) { return s.indexOf(sub); },
    startswith: function (s, p) { return s.indexOf(p) === 0; },
    endswith: function (s, p) { return s.length >= p.length && s.lastIndexOf(p) === s.length - p.length; },
    zfill: function (s, n) { return s.padStart(n || 0, '0'); }
  };

  var LIST_METHODS = {
    append: function (l, v) { l.push(v); },
    extend: function (l, v) { v.forEach(function (x) { l.push(x); }); },
    pop: function (l, i) { return i === undefined ? l.pop() : l.splice(i < 0 ? l.length + i : i, 1)[0]; },
    remove: function (l, v) { var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else throw PyError('ValueError', 'That item is not in the list.'); },
    reverse: function (l) { l.reverse(); },
    sort: function (l) { l.sort(function (a, b) { return a > b ? 1 : a < b ? -1 : 0; }); },
    count: function (l, v) { return l.filter(function (x) { return deepEq(x, v); }).length; },
    index: function (l, v) { var i = l.findIndex(function (x) { return deepEq(x, v); }); if (i < 0) throw PyError('ValueError', 'That item is not in the list.'); return i; },
    copy: function (l) { return l.slice(); },
    clear: function (l) { l.length = 0; }
  };

  /* ----------------------------- Runtime ------------------------------ */

  function Interp(hooks, limits) {
    this.hooks = hooks || {};
    this.limits = Object.assign({ maxSteps: 200000, maxMs: 2500, maxOutput: 200 }, limits || {});
    this.steps = 0;
    this.start = Date.now();
    this.out = [];
    this.turtle = new Turtle();
    this.global = new Env(null);
    this.builtins = this.makeBuiltins();
    this.inputQueue = (hooks && hooks.inputs) ? hooks.inputs.slice() : [];
  }

  Interp.prototype.tick = function (line) {
    this.steps++;
    if (this.steps > this.limits.maxSteps) throw PyError('TimeoutError', 'Your program ran for too long — check for a loop that never ends.', line);
    if ((this.steps & 1023) === 0 && Date.now() - this.start > this.limits.maxMs) {
      throw PyError('TimeoutError', 'Your program ran for too long — check for a loop that never ends.', line);
    }
  };

  Interp.prototype.emit = function (text) {
    if (this.out.length >= this.limits.maxOutput) return;
    this.out.push(text);
    if (this.hooks.print) this.hooks.print(text);
  };

  Interp.prototype.makeBuiltins = function () {
    var self = this;
    function b(name, fn) { return { __py: 'builtin', name: name, fn: fn }; }

    var builtins = {
      print: b('print', function (args) {
        var parts = args.map(function (a) { return a.kw ? a.kw + '=' + str(a.value) : str(a.value); });
        var line = parts.join(' ');
        self.emit(line);
        return null;
      }),
      len: b('len', function (args) {
        var v = args[0] && args[0].value;
        if (typeof v === 'string' || Array.isArray(v)) return v.length;
        throw PyError('TypeError', 'len() works on text and lists.');
      }),
      range: b('range', function (args) {
        var a = args.map(function (x) { return num(x.value, 0, 'range'); });
        var start = 0, stop = 0, step = 1;
        if (a.length === 1) { stop = a[0]; }
        else if (a.length === 2) { start = a[0]; stop = a[1]; }
        else { start = a[0]; stop = a[1]; step = a[2] || 1; }
        if (step === 0) throw PyError('ValueError', 'range() step cannot be 0.');
        var out = [];
        for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
          out.push(i);
          if (out.length > 100000) break;
        }
        return out;
      }),
      str: b('str', function (args) { return str(args[0] && args[0].value); }),
      int: b('int', function (args) {
        var v = args[0] && args[0].value;
        if (typeof v === 'string') { var n = parseInt(v, 10); if (isNaN(n)) throw PyError('ValueError', '"' + v + '" is not a whole number.'); return n; }
        return Math.trunc(num(v, 0, 'int'));
      }),
      float: b('float', function (args) { return num(args[0] && args[0].value, 0, 'float'); }),
      round: b('round', function (args) {
        var v = num(args[0] && args[0].value, 0, 'round');
        var d = args[1] ? num(args[1].value, 0, 'round') : 0;
        var f = Math.pow(10, d);
        return Math.round(v * f) / f;
      }),
      abs: b('abs', function (args) { return Math.abs(num(args[0] && args[0].value, 0, 'abs')); }),
      min: b('min', function (args) {
        var vals = args.length === 1 ? (args[0].value || []) : args.map(function (a) { return a.value; });
        return Math.min.apply(null, vals);
      }),
      max: b('max', function (args) {
        var vals = args.length === 1 ? (args[0].value || []) : args.map(function (a) { return a.value; });
        return Math.max.apply(null, vals);
      }),
      sum: b('sum', function (args) {
        var l = args[0] && args[0].value;
        if (!Array.isArray(l)) throw PyError('TypeError', 'sum() needs a list.');
        return l.reduce(function (a, b) { return a + num(b, 0, '+'); }, 0);
      }),
      list: b('list', function (args) {
        var v = args[0] && args[0].value;
        if (typeof v === 'string') return v.split('');
        if (Array.isArray(v)) return v.slice();
        throw PyError('TypeError', 'list() needs text or a list.');
      }),
      sorted: b('sorted', function (args) {
        var v = args[0] && args[0].value;
        if (!Array.isArray(v)) throw PyError('TypeError', 'sorted() needs a list.');
        return v.slice().sort(function (a, b) { return a > b ? 1 : a < b ? -1 : 0; });
      }),
      input: b('input', function (args) {
        var prompt = args[0] ? str(args[0].value) : '';
        if (self.inputQueue.length) { var v = self.inputQueue.shift(); self.emit(prompt + v); return v; }
        if (self.hooks.input) { var r = self.hooks.input(prompt); self.emit(prompt + r); return r; }
        self.emit(prompt);
        return '';
      }),
      type: b('type', function (args) { return typeName(args[0] && args[0].value); })
    };

    var tObj = makeTurtleObject(this.turtle);
    var turtleModule = { __py: 'module', name: 'turtle' };
    Object.keys(tObj).forEach(function (k) { if (k.indexOf('__') !== 0) turtleModule[k] = tObj[k]; });
    turtleModule.Turtle = { __py: 'builtin', name: 'Turtle', fn: function () { return makeTurtleObject(self.turtle); } };

    var mathModule = {
      __py: 'module', name: 'math', pi: Math.PI,
      sqrt: pyMethod('sqrt', function (args) { return Math.sqrt(num(args[0].value, 0, 'sqrt')); }),
      floor: pyMethod('floor', function (args) { return Math.floor(num(args[0].value, 0, 'floor')); }),
      ceil: pyMethod('ceil', function (args) { return Math.ceil(num(args[0].value, 0, 'ceil')); }),
      abs: pyMethod('abs', function (args) { return Math.abs(num(args[0].value, 0, 'abs')); })
    };

    Object.keys(builtins).forEach(function (k) { self.global.set(k, builtins[k]); });

    // top-level turtle shortcuts so `forward(50)` works without an import
    ['forward', 'fd', 'backward', 'back', 'bk', 'left', 'lt', 'right', 'rt', 'penup', 'pu',
      'pendown', 'pd', 'pencolor', 'color', 'pensize', 'width', 'speed', 'home', 'goto',
      'setheading', 'dot', 'write', 'clear'].forEach(function (m) {
        self.global.set(m, tObj[m]);
      });
    self.global.set('t', tObj);
    self.global.set('turtle', turtleModule);
    self.global.set('math', mathModule);
    self._modules = { turtle: turtleModule, math: mathModule };
    return builtins;
  };

  /* ------------------------------ exec -------------------------------- */

  var SIGNAL = { BREAK: {}, CONTINUE: {}, RETURN: {} };

  Interp.prototype.execBody = function (body, env) {
    for (var i = 0; i < body.length; i++) {
      var r = this.exec(body[i], env);
      if (r === SIGNAL.BREAK || r === SIGNAL.CONTINUE || r === SIGNAL.RETURN) return r;
      if (r && r.value !== undefined) return r;
    }
    return null;
  };

  Interp.prototype.exec = function (node, env) {
    if (!node) return null;
    this.tick(node.line);
    switch (node.t) {
      case 'Module': return this.execBody(node.body, env);
      case 'Pass': return null;
      case 'Break': return SIGNAL.BREAK;
      case 'Continue': return SIGNAL.CONTINUE;

      case 'ExprStmt': this.eval(node.value, env); return null;

      case 'Assign': {
        var v = this.eval(node.value, env);
        if (node.target.t === 'Name') env.set(node.target.id, v);
        else if (node.target.t === 'Index') this.setIndex(node.target, v, env);
        return null;
      }

      case 'AugAssign': {
        var cur = node.target.t === 'Name' ? env.get(node.target.id) : this.evalIndex(node.target, env);
        var rhs = this.eval(node.value, env);
        var res = this.binop(node.op, cur, rhs, node.line);
        if (node.target.t === 'Name') env.assign(node.target.id, res);
        else this.setIndex(node.target, res, env);
        return null;
      }

      case 'If': {
        if (truthy(this.eval(node.test, env))) return this.execBody(node.body, env);
        if (node.orelse && node.orelse.length) {
          if (node.orelse[0].t === 'If') return this.exec(node.orelse[0], env);
          return this.execBody(node.orelse, env);
        }
        return null;
      }

      case 'While': {
        var guard = 0;
        while (truthy(this.eval(node.test, env))) {
          this.tick(node.line);
          if (++guard > 100000) throw PyError('TimeoutError', 'This loop never finishes. Check the condition.', node.line);
          var r = this.execBody(node.body, env);
          if (r === SIGNAL.BREAK) break;
          if (r === SIGNAL.RETURN) return r;
        }
        return null;
      }

      case 'For': {
        var it = this.eval(node.iter, env);
        if (typeof it === 'string') it = it.split('');
        if (!Array.isArray(it)) throw PyError('TypeError', 'You can only loop over a list, text or range().', node.line);
        for (var k = 0; k < it.length; k++) {
          this.tick(node.line);
          env.set(node.target, it[k]);
          var fr = this.execBody(node.body, env);
          if (fr === SIGNAL.BREAK) break;
          if (fr === SIGNAL.RETURN) return fr;
        }
        return null;
      }

      case 'Def': {
        var fn = { __py: 'func', name: node.name, params: node.params, body: node.body, env: env };
        env.set(node.name, fn);
        return null;
      }

      case 'Return': {
        var rv = node.value ? this.eval(node.value, env) : null;
        return { value: rv };
      }

      case 'Import': {
        var self2 = this;
        node.names.forEach(function (n) {
          if (self2._modules[n]) env.set(n, self2._modules[n]);
        });
        return null;
      }

      case 'FromImport': {
        var mod = this._modules[node.module];
        if (!mod) return null;
        var self3 = this;
        node.names.forEach(function (n) {
          if (n === '*') Object.keys(mod).forEach(function (kk) { if (kk.indexOf('__') !== 0) env.set(kk, mod[kk]); });
          else if (mod[n] !== undefined) env.set(n, mod[n]);
        });
        return null;
      }
    }
    throw PyError('SyntaxError', 'That code is not supported yet (line ' + node.line + ').', node.line);
  };

  Interp.prototype.evalIndex = function (node, env) {
    var container = this.eval(node.value, env);
    var i = this.eval(node.index, env);
    if (typeof container === 'string') {
      var si = num(i, node.line, 'index');
      if (si < 0) si += container.length;
      if (si < 0 || si >= container.length) throw PyError('IndexError', 'There is no character at position ' + i + '.', node.line);
      return container[si];
    }
    if (Array.isArray(container)) {
      var li = num(i, node.line, 'index');
      if (li < 0) li += container.length;
      if (li < 0 || li >= container.length) throw PyError('IndexError', 'The list has no item number ' + i + '.', node.line);
      return container[li];
    }
    throw PyError('TypeError', 'You can only use [ ] with text or a list.', node.line);
  };

  Interp.prototype.setIndex = function (node, value, env) {
    var container = this.eval(node.value, env);
    if (!Array.isArray(container)) throw PyError('TypeError', 'You can only change an item inside a list.', node.line);
    var i = num(this.eval(node.index, env), node.line, 'index');
    if (i < 0) i += container.length;
    if (i < 0 || i >= container.length) throw PyError('IndexError', 'The list has no item number ' + i + '.', node.line);
    container[i] = value;
  };

  Interp.prototype.callValue = function (fn, args, node, env) {
    var line = node.line;
    if (!fn || (typeof fn !== 'object')) {
      throw PyError('TypeError', typeName(fn) + ' is not something you can call ().', line);
    }
    if (fn.__py === 'builtin') {
      var evaluated = args.map(function (a) { return { kw: a.kw, value: this.eval(a.value, env) }; }, this);
      return fn.fn(evaluated, env);
    }
    if (fn.__py === 'func') {
      var local = new Env(fn.env);
      if (args.length > fn.params.length) throw PyError('TypeError', fn.name + '() takes ' + fn.params.length + ' value(s) but got ' + args.length + '.', line);
      for (var i = 0; i < fn.params.length; i++) {
        var a = args[i];
        local.set(fn.params[i], a ? this.eval(a.value, env) : null);
      }
      var r = this.execBody(fn.body, local);
      if (r && r.value !== undefined) return r.value;
      return null;
    }
    throw PyError('TypeError', 'That is not a function.', line);
  };

  Interp.prototype.binop = function (op, a, b, line) {
    switch (op) {
      case '+':
        if (typeof a === 'string' && typeof b === 'string') return a + b;
        if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
        if (typeof a === 'string' && typeof b === 'number') throw PyError('TypeError', 'You cannot add text and a number. Try str(' + b + ').', line);
        if (typeof a === 'number' && typeof b === 'string') throw PyError('TypeError', 'You cannot add a number and text. Try str(' + a + ').', line);
        return num(a, line, '+') + num(b, line, '+');
      case '-': return num(a, line, '-') - num(b, line, '-');
      case '*':
        if ((typeof a === 'string' && typeof b === 'number') || (typeof a === 'number' && typeof b === 'string')) {
          var s = typeof a === 'string' ? a : b, n = typeof a === 'number' ? a : b;
          var out = '';
          for (var i = 0; i < Math.max(0, Math.floor(n)); i++) out += s;
          return out;
        }
        if (Array.isArray(a) && typeof b === 'number') { var o = []; for (var j = 0; j < Math.floor(b); j++) o = o.concat(a); return o; }
        return num(a, line, '*') * num(b, line, '*');
      case '/':
        if (num(b, line, '/') === 0) throw PyError('ZeroDivisionError', 'You cannot divide by zero.', line);
        return num(a, line, '/') / num(b, line, '/');
      case '//':
        if (num(b, line, '//') === 0) throw PyError('ZeroDivisionError', 'You cannot divide by zero.', line);
        return Math.floor(num(a, line, '//') / num(b, line, '//'));
      case '%':
        if (num(b, line, '%') === 0) throw PyError('ZeroDivisionError', 'You cannot divide by zero.', line);
        return num(a, line, '%') % num(b, line, '%');
      case '**': return Math.pow(num(a, line, '**'), num(b, line, '**'));
    }
    throw PyError('SyntaxError', 'Unknown operator ' + op, line);
  };

  Interp.prototype.compare = function (op, a, b, line) {
    switch (op) {
      case '==': return deepEq(a, b);
      case '!=':
      case '<>': return !deepEq(a, b);
      case '<': return num(a, line, '<') < num(b, line, '<');
      case '>': return num(a, line, '>') > num(b, line, '>');
      case '<=': return num(a, line, '<=') <= num(b, line, '<=');
      case '>=': return num(a, line, '>=') >= num(b, line, '>=');
      case 'in':
        if (typeof b === 'string') return typeof a === 'string' && b.indexOf(a) >= 0;
        if (Array.isArray(b)) return b.some(function (x) { return deepEq(x, a); });
        throw PyError('TypeError', '"in" needs a list or text on the right.', line);
      case 'not in':
        if (typeof b === 'string') return !(typeof a === 'string' && b.indexOf(a) >= 0);
        if (Array.isArray(b)) return !b.some(function (x) { return deepEq(x, a); });
        throw PyError('TypeError', '"in" needs a list or text on the right.', line);
    }
    return false;
  };

  Interp.prototype.eval = function (node, env) {
    if (!node) return null;
    this.tick(node.line);
    switch (node.t) {
      case 'Num': return node.value;
      case 'Str': return node.value;
      case 'Bool': return node.value;
      case 'None': return null;
      case 'Paren': return this.eval(node.value, env);

      case 'Name': {
        var v = env.get(node.id);
        if (v === undefined) {
          throw PyError('NameError', 'I do not know the name "' + node.id + '". Did you spell it right?', node.line);
        }
        return v;
      }

      case 'List': return node.items.map(function (it) { return this.eval(it, env); }, this);

      case 'BinOp': return this.binop(node.op, this.eval(node.left, env), this.eval(node.right, env), node.line);

      case 'UnaryOp':
        if (node.op === 'not') return !truthy(this.eval(node.operand, env));
        return node.op === '-' ? -num(this.eval(node.operand, env), node.line, '-') : num(this.eval(node.operand, env), node.line, '+');

      case 'BoolOp': {
        if (node.op === 'and') {
          var last = null;
          for (var i = 0; i < node.values.length; i++) {
            last = this.eval(node.values[i], env);
            if (!truthy(last)) return last;
          }
          return last;
        }
        var lastOr = null;
        for (var j = 0; j < node.values.length; j++) {
          lastOr = this.eval(node.values[j], env);
          if (truthy(lastOr)) return lastOr;
        }
        return lastOr;
      }

      case 'Compare': {
        var left = this.eval(node.left, env);
        for (var p = 0; p < node.pairs.length; p++) {
          var op = node.pairs[p][0];
          var right = this.eval(node.pairs[p][1], env);
          if (!this.compare(op, left, right, node.line)) return false;
          left = right;
        }
        return true;
      }

      case 'Index': return this.evalIndex(node, env);

      case 'Slice': {
        var src = this.eval(node.value, env);
        var lo = node.lo ? num(this.eval(node.lo, env), node.line, 'slice') : 0;
        var hi = node.hi ? num(this.eval(node.hi, env), node.line, 'slice') : (typeof src === 'string' ? src.length : src.length);
        if (typeof src !== 'string' && !Array.isArray(src)) throw PyError('TypeError', 'You can only slice text or lists.', node.line);
        return src.slice(lo, hi);
      }

      case 'Attr': {
        var obj = this.eval(node.value, env);
        if (obj && obj.__py === 'module' && obj[node.attr] !== undefined) return obj[node.attr];
        if (obj && obj.__py === 'turtle' && typeof obj[node.attr] === 'function') return obj[node.attr];
        if (typeof obj === 'string' && STR_METHODS[node.attr]) {
          return pyMethod(node.attr, (function (name) {
            return function (args) { return STR_METHODS[name].apply(null, [obj].concat(args.map(function (a) { return a.value; }))); };
          })(node.attr));
        }
        if (Array.isArray(obj) && LIST_METHODS[node.attr]) {
          return pyMethod(node.attr, (function (name) {
            return function (args) { return LIST_METHODS[name].apply(null, [obj].concat(args.map(function (a) { return a.value; }))); };
          })(node.attr));
        }
        throw PyError('AttributeError', typeName(obj) + ' has no "' + node.attr + '".', node.line);
      }

      case 'Call': {
        // method on a string / list resolved lazily through Attr
        var target = node.func;
        if (target.t === 'Attr' && !(target.value.t === 'Name' && env.get(target.value.id) && env.get(target.value.id).__py)) {
          var base = this.eval(target.value, env);
          if (typeof base === 'string' && STR_METHODS[target.attr]) {
            var sargs = node.args.map(function (a) { return this.eval(a.value, env); }, this);
            return STR_METHODS[target.attr].apply(null, [base].concat(sargs));
          }
          if (Array.isArray(base) && LIST_METHODS[target.attr]) {
            var largs = node.args.map(function (a) { return this.eval(a.value, env); }, this);
            return LIST_METHODS[target.attr].apply(null, [base].concat(largs));
          }
        }
        var fn = this.eval(target, env);
        return this.callValue(fn, node.args, node, env);
      }
    }
    throw PyError('SyntaxError', 'That expression is not supported yet (line ' + node.line + ').', node.line);
  };

  /* ============================== Public API ============================= */

  var FRIENDLY = {
    SyntaxError: 'Python could not read this line. Check spelling, colons ":" and brackets.',
    IndentationError: 'Python uses spaces at the start of a line to group code. Line up the block!',
    NameError: 'A name is unknown — check the spelling and where the variable was created.',
    TypeError: 'Two things were mixed that do not go together (like text + number).',
    IndexError: 'You asked for a list item that does not exist.',
    ZeroDivisionError: 'You cannot divide by zero.',
    ValueError: 'The value is not allowed here.',
    AttributeError: 'That thing does not have this ability.',
    TimeoutError: 'The program kept running — maybe a loop never ends?'
  };

  function friendly(err) {
    var name = err.pyName || err.name || 'Error';
    return (FRIENDLY[name] || '') + (err.line ? '' : '');
  }

  /**
   * run(code, opts) -> { ok, output, lines, error:{name,message,hint,line}, turtle, steps }
   * opts: { inputs:[], maxSteps, maxMs, onPrint }
   */
  function run(code, opts) {
    opts = opts || {};
    var lines = [];
    var hooks = {
      print: function (s) { lines.push(s); if (opts.onPrint) opts.onPrint(s); },
      inputs: opts.inputs || [],
      input: opts.input
    };
    try {
      var ast = parse(code);
      var interp = new Interp(hooks, { maxSteps: opts.maxSteps, maxMs: opts.maxMs });
      var r = interp.exec(ast, interp.global);
      return {
        ok: true,
        output: lines.join('\n'),
        lines: lines,
        steps: interp.steps,
        turtle: interp.turtle,
        error: null
      };
    } catch (e) {
      return {
        ok: false,
        output: lines.join('\n'),
        lines: lines,
        steps: 0,
        turtle: null,
        error: {
          name: e.pyName || 'Error',
          message: e.message || String(e),
          hint: friendly(e),
          line: e.line || null
        }
      };
    }
  }

  /** Syntax pre-check without executing (used to show squiggles while typing). */
  function checkSyntax(code) {
    try { parse(code); return { ok: true }; }
    catch (e) { return { ok: false, line: e.line, message: e.message, name: e.pyName }; }
  }

  App.MiniPy = {
    run: run,
    parse: parse,
    tokenize: tokenize,
    checkSyntax: checkSyntax,
    Turtle: Turtle,
    repr: repr,
    str: str,
    KEYWORDS: KEYWORDS
  };
})(window.App);
