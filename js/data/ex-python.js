/* =============================================================
 * KidCoder Lab - ex-python.js
 * Python tasks: read code (predict), write code (graded by
 * running it against hidden tests) and turtle drawing.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var MP = App.MiniPy;

  function makeId(level, rng, i) { return level.id + ':' + rng.seed + ':' + i; }
  function norm(s) { return String(s).split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').trim(); }

  /* ------------------------------- predict ------------------------------ */

  var PREDICTS = [
    { code: 'x = {n}\nprint(x * 2)', params: function (r) { return { n: r.int(2, 9) }; } },
    { code: 'for i in range({n}):\n    print(i)', params: function (r) { return { n: r.int(2, 4) }; } },
    { code: 'n = {n}\nif n > 3:\n    print("big")\nelse:\n    print("small")', params: function (r) { return { n: r.int(1, 8) }; } },
    { code: 'total = 0\nfor i in range(1, {n}):\n    total = total + i\nprint(total)', params: function (r) { return { n: r.int(3, 6) }; } },
    { code: 'colours = ["red", "blue", "green"]\nprint(len(colours))', params: function () { return {}; } },
    { code: 'i = 0\nwhile i < {n}:\n    i = i + 1\nprint(i)', params: function (r) { return { n: r.int(2, 6) }; } },
    { code: 'print("{word}".upper())', params: function (r) { return { word: r.pick(['cat', 'robot', 'pixel', 'cake']) }; } },
    { code: 'for i in range({n}):\n    if i == 1:\n        print("one")\n    else:\n        print("zero")', params: function (r) { return { n: r.int(2, 3) }; } },
    { code: 'name = "{word}"\nprint("Hello", name)', params: function (r) { return { word: r.pick(['Ada', 'Sam', 'Mia', 'Leo']) }; } },
    { code: 'nums = [{a}, {b}]\nprint(nums[0] + nums[1])', params: function (r) { return { a: r.int(1, 9), b: r.int(1, 9) }; } }
  ];

  function predict(level, rng, i) {
    var tpl = rng.pick(PREDICTS);
    var params = tpl.params(rng);
    var code = U.fmt(tpl.code, params);
    var res = MP.run(code);
    var correct = res.ok ? res.output : 'error';

    var wrong = [];
    var guard = 0;
    var lines = correct.split('\n');
    if (lines.length === 1 && /^-?\d+$/.test(correct)) {
      var n = parseInt(correct, 10);
      [n + 1, n - 1, n + 2, n * 2, n + 3].forEach(function (v) { if (String(v) !== correct) wrong.push(String(v)); });
    } else {
      var alt1 = lines.slice().reverse().join('\n');
      var alt2 = lines.slice(0, Math.max(1, lines.length - 1)).join('\n');
      var alt3 = lines.concat([lines[lines.length - 1]]).join('\n');
      [alt1, alt2, alt3].forEach(function (v) { if (v !== correct && v) wrong.push(v); });
    }
    while (wrong.length < 3 && guard++ < 20) {
      var cand = /^-?\d+$/.test(correct) ? String(parseInt(correct, 10) + guard + 3) : correct + '!';
      if (cand !== correct && wrong.indexOf(cand) < 0) wrong.push(cand);
    }

    var ex = {
      id: makeId(level, rng, i),
      type: 'python', variant: 'predict',
      code: code,
      prompt: 'What does this program print?',
      hint: 'Read it line by line, like the computer does.'
    };
    var opts = [correct].concat(rng.sample(wrong, 3));
    ex.choices = rng.shuffle(opts).map(function (v, k) { return { id: 'p' + k, label: v, value: v }; });
    ex.grade = function (a) {
      var ok = norm(a) === norm(correct);
      return { correct: ok, message: ok ? 'Exactly right.' : 'Run it in your head again — start at the first line.' };
    };
    return ex;
  }

  /* -------------------------------- write ------------------------------ */

  function task(level, rng, i, cfg) {
    var ex = {
      id: makeId(level, rng, i),
      type: 'python', variant: cfg.variant || 'write',
      prompt: cfg.prompt,
      hint: cfg.hint,
      starter: cfg.starter || '',
      solution: cfg.solution,
      tests: cfg.tests,
      showTurtle: !!cfg.showTurtle,
      inputs: (cfg.tests && cfg.tests[0] && cfg.tests[0].inputs) || []
    };
    if (cfg.check) {
      ex.grade = function (code) {
        return cfg.check(code, ex);
      };
    } else {
      ex.grade = function (code) {
        for (var t = 0; t < ex.tests.length; t++) {
          var test = ex.tests[t];
          var res = MP.run(code, { inputs: test.inputs || [] });
          if (!res.ok) {
            return {
              correct: false,
              message: res.error.name + ' on line ' + (res.error.line || '?') + ': ' + res.error.message,
              detail: { error: res.error, test: test }
            };
          }
          if (norm(res.output) !== norm(test.expect)) {
            return {
              correct: false,
              message: 'Almost! I expected:\n' + test.expect + '\nbut your program printed:\n' + (res.output || '(nothing)'),
              detail: { got: res.output, expected: test.expect, test: test }
            };
          }
        }
        return { correct: true, message: 'It works! 🎉' };
      };
    }
    return ex;
  }

  var WORDS = ['robot', 'pixel', 'tiger', 'rocket', 'panda'];

  function writeTask(level, rng, i, topic) {
    if (topic === 'print') {
      var word = rng.pick(WORDS);
      var n = rng.int(2, 9);
      var kind = rng.int(0, 2);
      if (kind === 0) {
        return task(level, rng, i, {
          prompt: 'Print exactly this message: <b>' + word + ' lab</b>',
          hint: 'print("...") — the text goes inside quotes.',
          starter: 'print("' + word + ' lab")',
          solution: 'print("' + word + ' lab")',
          tests: [{ expect: word + ' lab' }]
        });
      }
      if (kind === 1) {
        return task(level, rng, i, {
          prompt: 'Print two things on one line: the word <b>Hi</b> and the number <b>' + n + '</b>.',
          hint: 'print("Hi", ' + n + ') — commas add a space.',
          starter: 'print("Hi", ' + n + ')',
          solution: 'print("Hi", ' + n + ')',
          tests: [{ expect: 'Hi ' + n }]
        });
      }
      var a = rng.int(2, 9), b = rng.int(2, 9);
      return task(level, rng, i, {
        prompt: 'Print the answer to <b>' + a + ' + ' + b + '</b>.',
        hint: 'Python is a calculator: print(' + a + ' + ' + b + ')',
        starter: 'print(' + a + ' + ' + b + ')',
        solution: 'print(' + a + ' + ' + b + ')',
        tests: [{ expect: String(a + b) }]
      });
    }

    if (topic === 'variables') {
      var x = rng.int(3, 12), y = rng.int(2, 8);
      var kind2 = rng.int(0, 2);
      if (kind2 === 0) {
        return task(level, rng, i, {
          prompt: 'Store <b>' + x + '</b> in a variable called <b>age</b>, then print it.',
          hint: 'age = ' + x + '  then  print(age)',
          starter: 'age = ' + x + '\nprint(age)',
          solution: 'age = ' + x + '\nprint(age)',
          tests: [{ expect: String(x) }]
        });
      }
      if (kind2 === 1) {
        return task(level, rng, i, {
          prompt: 'Make two variables: <b>a = ' + x + '</b> and <b>b = ' + y + '</b>. Print <b>a * b</b>.',
          hint: 'Use * for multiply.',
          starter: 'a = ' + x + '\nb = ' + y + '\nprint(a * b)',
          solution: 'a = ' + x + '\nb = ' + y + '\nprint(a * b)',
          tests: [{ expect: String(x * y) }]
        });
      }
      return task(level, rng, i, {
        prompt: 'Start <b>score = ' + x + '</b>, add <b>' + y + '</b> to it, then print score.',
        hint: 'score = score + ' + y + '  (or score += ' + y + ')',
        starter: 'score = ' + x + '\nscore = score + ' + y + '\nprint(score)',
        solution: 'score = ' + x + '\nscore = score + ' + y + '\nprint(score)',
        tests: [{ expect: String(x + y) }]
      });
    }

    if (topic === 'for') {
      var count = rng.int(3, 5);
      var kind3 = rng.int(0, 2);
      if (kind3 === 0) {
        return task(level, rng, i, {
          prompt: 'Use a <b>for</b> loop to print the numbers 0 to ' + (count - 1) + ' (one per line).',
          hint: 'for i in range(' + count + '):\n    print(i)',
          starter: 'for i in range(' + count + '):\n    print(i)',
          solution: 'for i in range(' + count + '):\n    print(i)',
          tests: [{ expect: Array.from({ length: count }, function (_, k) { return String(k); }).join('\n') }]
        });
      }
      if (kind3 === 1) {
        var w = rng.pick(WORDS);
        return task(level, rng, i, {
          prompt: 'Use a loop to print the word <b>' + w + '</b> exactly ' + count + ' times.',
          hint: 'Put print("' + w + '") inside the loop, indented.',
          starter: 'for i in range(' + count + '):\n    print("' + w + '")',
          solution: 'for i in range(' + count + '):\n    print("' + w + '")',
          tests: [{ expect: Array.from({ length: count }, function () { return w; }).join('\n') }]
        });
      }
      var total = 0;
      for (var q = 1; q <= count; q++) total += q;
      return task(level, rng, i, {
        prompt: 'Add the numbers 1 to ' + count + ' with a loop and print the total.',
        hint: 'total = 0  before the loop, then  total = total + i  inside it.',
        starter: 'total = 0\nfor i in range(1, ' + (count + 1) + '):\n    total = total + i\nprint(total)',
        solution: 'total = 0\nfor i in range(1, ' + (count + 1) + '):\n    total = total + i\nprint(total)',
        tests: [{ expect: String(total) }]
      });
    }

    if (topic === 'if') {
      var age = rng.int(5, 15);
      var kind4 = rng.int(0, 2);
      if (kind4 === 0) {
        return task(level, rng, i, {
          prompt: 'If <b>age</b> is 10 or more print <b>big</b>, otherwise print <b>small</b>.',
          hint: 'if age >= 10:\n    print("big")\nelse:\n    print("small")',
          starter: 'age = ' + age + '\nif age >= 10:\n    print("big")\nelse:\n    print("small")',
          solution: 'age = ' + age + '\nif age >= 10:\n    print("big")\nelse:\n    print("small")',
          tests: [{ expect: age >= 10 ? 'big' : 'small' }]
        });
      }
      if (kind4 === 1) {
        var num = rng.int(1, 20);
        return task(level, rng, i, {
          prompt: 'Print <b>even</b> if number is even, else <b>odd</b>.',
          hint: 'number % 2 == 0 means "no remainder".',
          starter: 'number = ' + num + '\nif number % 2 == 0:\n    print("even")\nelse:\n    print("odd")',
          solution: 'number = ' + num + '\nif number % 2 == 0:\n    print("even")\nelse:\n    print("odd")',
          tests: [{ expect: num % 2 === 0 ? 'even' : 'odd' }]
        });
      }
      var score = rng.int(5, 90);
      var want = score > 50 ? 'win' : (score > 20 ? 'ok' : 'try');
      return task(level, rng, i, {
        prompt: 'score over 50 → <b>win</b>; over 20 → <b>ok</b>; otherwise → <b>try</b>.',
        hint: 'Use if / elif / else. Do not forget the colons.',
        starter: 'score = ' + score + '\nif score > 50:\n    print("win")\nelif score > 20:\n    print("ok")\nelse:\n    print("try")',
        solution: 'score = ' + score + '\nif score > 50:\n    print("win")\nelif score > 20:\n    print("ok")\nelse:\n    print("try")',
        tests: [{ expect: want }]
      });
    }

    if (topic === 'while') {
      var top = rng.int(3, 6);
      var kind5 = rng.int(0, 2);
      if (kind5 === 0) {
        return task(level, rng, i, {
          prompt: 'Use <b>while</b> to print every number from 0 up to ' + (top - 1) + '.',
          hint: 'n = 0\nwhile n < ' + top + ':\n    print(n)\n    n = n + 1',
          starter: 'n = 0\nwhile n < ' + top + ':\n    print(n)\n    n = n + 1',
          solution: 'n = 0\nwhile n < ' + top + ':\n    print(n)\n    n = n + 1',
          tests: [{ expect: Array.from({ length: top }, function (_, k) { return String(k); }).join('\n') }]
        });
      }
      if (kind5 === 1) {
        return task(level, rng, i, {
          prompt: 'Count down: print ' + top + ', then ' + (top - 1) + ', … down to 1.',
          hint: 'while n > 0:  then take 1 away inside the loop.',
          starter: 'n = ' + top + '\nwhile n > 0:\n    print(n)\n    n = n - 1',
          solution: 'n = ' + top + '\nwhile n > 0:\n    print(n)\n    n = n - 1',
          tests: [{ expect: Array.from({ length: top }, function (_, k) { return String(top - k); }).join('\n') }]
        });
      }
      var nm = rng.pick(['Ada', 'Leo', 'Mia', 'Sam']);
      return task(level, rng, i, {
        prompt: 'Ask for a name with <b>input()</b> and print <b>Hello</b> plus the name.',
        hint: 'name = input("Name? ")\nprint("Hello", name)',
        starter: 'name = input("Name? ")\nprint("Hello", name)',
        solution: 'name = input("Name? ")\nprint("Hello", name)',
        tests: [{ inputs: [nm], expect: 'Name? ' + nm + '\nHello ' + nm }]
      });
    }

    /* lists & functions */
    var items = rng.sample(['red', 'blue', 'green', 'yellow', 'pink'], 3);
    var kind6 = rng.int(0, 2);
    if (kind6 === 0) {
      return task(level, rng, i, {
        prompt: 'Make a list with ' + items.length + ' colours and print how many there are.',
        hint: 'colours = ["red", "blue"]  then  print(len(colours))',
        starter: 'colours = ["' + items.join('", "') + '"]\nprint(len(colours))',
        solution: 'colours = ["' + items.join('", "') + '"]\nprint(len(colours))',
        tests: [{ expect: String(items.length) }]
      });
    }
    if (kind6 === 1) {
      return task(level, rng, i, {
        prompt: 'Use a loop to print every colour in the list, one per line.',
        hint: 'for c in colours:\n    print(c)',
        starter: 'colours = ["' + items.join('", "') + '"]\nfor c in colours:\n    print(c)',
        solution: 'colours = ["' + items.join('", "') + '"]\nfor c in colours:\n    print(c)',
        tests: [{ expect: items.join('\n') }]
      });
    }
    var who = rng.pick(['Ada', 'Sam', 'Zoe']);
    return task(level, rng, i, {
      prompt: 'Write a <b>function</b> greet(name) that returns <b>Hi </b> plus the name. Then print greet("' + who + '").',
      hint: 'def greet(name):\n    return "Hi " + name',
      starter: 'def greet(name):\n    return "Hi " + name\n\nprint(greet("' + who + '"))',
      solution: 'def greet(name):\n    return "Hi " + name\n\nprint(greet("' + who + '"))',
      tests: [{ expect: 'Hi ' + who }]
    });
  }

  /* ------------------------------- turtle ------------------------------ */

  var TURTLE_TASKS = [
    { title: 'a square', minSegs: 4, closed: true, starter: 'for i in range(4):\n    forward(60)\n    left(90)', hint: 'Four times: forward, then turn 90 degrees.' },
    { title: 'a triangle', minSegs: 3, closed: true, starter: 'for i in range(3):\n    forward(70)\n    left(120)', hint: 'Three sides, and 3 x 120 = 360 degrees.' },
    { title: 'a pentagon', minSegs: 5, closed: true, starter: 'for i in range(5):\n    forward(50)\n    left(72)', hint: 'Five sides: turn 360/5 = 72 degrees.' },
    { title: 'a star', minSegs: 5, closed: true, starter: 'for i in range(5):\n    forward(80)\n    right(144)', hint: 'Turn right by 144 degrees each time.' },
    { title: 'a staircase', minSegs: 6, closed: false, starter: 'for i in range(6):\n    forward(20)\n    left(90)\n    forward(20)\n    right(90)', hint: 'Go forward, go up, go forward, go down — repeat.' },
    { title: 'a zigzag', minSegs: 6, closed: false, starter: 'for i in range(6):\n    forward(30)\n    left(60)\n    forward(30)\n    right(60)', hint: 'Alternate left and right turns.' },
    { title: 'two squares', minSegs: 8, closed: false, starter: 'for s in range(2):\n    for i in range(4):\n        forward(40)\n        left(90)\n    penup()\n    forward(60)\n    pendown()', hint: 'Draw one square, lift the pen, move, draw again.' },
    { title: 'a colourful hexagon', minSegs: 6, closed: true, starter: 'for i in range(6):\n    pencolor("purple")\n    forward(45)\n    left(60)', hint: 'Six sides: turn 360/6 = 60 degrees.' }
  ];

  function turtleTask(level, rng, i) {
    var t = rng.pick(TURTLE_TASKS);
    return task(level, rng, i, {
      variant: 'turtle',
      showTurtle: true,
      prompt: 'Draw <b>' + t.title + '</b> with the turtle.',
      hint: t.hint,
      starter: t.starter,
      solution: t.starter,
      tests: [],
      check: function (code) {
        var res = MP.run(code);
        if (!res.ok) {
          return { correct: false, message: res.error.name + ' on line ' + (res.error.line || '?') + ': ' + res.error.message, detail: res };
        }
        var segs = res.turtle.segs;
        if (segs.length < t.minSegs) {
          return { correct: false, message: 'The turtle drew ' + segs.length + ' line(s). ' + t.title + ' needs at least ' + t.minSegs + '.', detail: res };
        }
        if (t.closed) {
          var last = segs[segs.length - 1];
          var dist = Math.hypot(last.x2 - segs[0].x1, last.y2 - segs[0].y1);
          if (dist > 12) {
            return { correct: false, message: 'Almost! The shape does not close — check your turn angle.', detail: res };
          }
        }
        return { correct: true, message: 'Beautiful turtle art!', detail: res };
      }
    });
  }

  /* ------------------------------- project ----------------------------- */

  var PROJECTS = [
    { title: 'Times table', brief: 'Print the 7 times table from 7 x 1 to 7 x 10.', starter: 'for i in range(1, 11):\n    print(7 * i)', hint: 'Loop from 1 to 10 and multiply.' },
    { title: 'Even or odd counter', brief: 'Print every number from 1 to 20 and say "even" or "odd" after it.', starter: 'for n in range(1, 21):\n    if n % 2 == 0:\n        print(n, "even")\n    else:\n        print(n, "odd")', hint: 'Use % 2 to test for even.' },
    { title: 'Shout machine', brief: 'Ask for a word with input() and print it three times in CAPITALS.', starter: 'word = input("Word? ")\nfor i in range(3):\n    print(word.upper())', hint: '.upper() makes text loud.' },
    { title: 'Rainbow squares', brief: 'Draw 4 squares in different colours.', starter: 'colours = ["red", "blue", "green", "purple"]\nfor c in colours:\n    pencolor(c)\n    for i in range(4):\n        forward(40)\n        left(90)\n    penup()\n    forward(55)\n    pendown()', hint: 'One loop inside another loop.' }
  ];

  function projectTask(level, rng, i) {
    var p = rng.pick(PROJECTS);
    return task(level, rng, i, {
      variant: 'project',
      showTurtle: true,
      prompt: '<b>' + p.title + '.</b> ' + p.brief,
      hint: p.hint,
      starter: p.starter,
      solution: p.starter,
      tests: [],
      check: function (code) {
        var res = MP.run(code, { inputs: ['robot'] });
        if (!res.ok) {
          return { correct: false, message: res.error.name + ' on line ' + (res.error.line || '?') + ': ' + res.error.message, detail: res };
        }
        var lines = res.lines.length;
        var segs = res.turtle ? res.turtle.segs.length : 0;
        if (lines + segs < 4) return { correct: false, message: 'Good start — make the program do a bit more (at least 4 lines of output or 4 drawn lines).', detail: res };
        return { correct: true, message: 'Project complete! Save it if you like it.', detail: res };
      }
    });
  }

  App.Exercises.register('python', 'predict', predict);
  App.Exercises.register('python', 'write', function (level, rng, i, opts) {
    return writeTask(level, rng, i, (opts && opts.topic) || 'print');
  });
  App.Exercises.register('python', 'turtle', turtleTask);
  App.Exercises.register('python', 'project', projectTask);
})(window.App);
