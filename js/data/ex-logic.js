/* =============================================================
 * KidCoder Lab - ex-logic.js
 * Structured & analytical thinking: patterns, decomposition,
 * classification, debugging and binary-search style reasoning.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  function makeId(level, rng, i) { return level.id + ':' + rng.seed + ':' + i; }

  function mc(rng, correctValue, wrongValues, labelFn) {
    var opts = [correctValue].concat(rng.sample(wrongValues, Math.min(3, wrongValues.length)));
    while (opts.length < 4) opts.push(wrongValues[opts.length % wrongValues.length]);
    return rng.shuffle(opts).map(function (v, i) {
      return { id: 'o' + i, label: labelFn(v), value: v };
    });
  }

  /* ------------------------------ patterns ----------------------------- */

  function sequence(level, rng, i) {
    var kind = rng.pick(['count', 'skip', 'double', 'shape', 'grow']);
    var items = [], answers = [], prompt = '', hint = '';

    if (kind === 'count') {
      var a = rng.int(1, 12), d = rng.int(2, 5);
      prompt = 'What number comes next?';
      hint = 'Look at the jump from one number to the next.';
      for (var k = 0; k < 5; k++) items.push(String(a + d * k));
      answers = [a + d * 5];
    } else if (kind === 'skip') {
      var b = rng.int(2, 20), e = rng.int(3, 8);
      prompt = 'What number comes next?';
      hint = 'Add the same amount every time.';
      for (var k2 = 0; k2 < 5; k2++) items.push(String(b + e * k2));
      answers = [b + e * 5];
    } else if (kind === 'double') {
      var s = rng.int(2, 5);
      prompt = 'What number comes next?';
      hint = 'This pattern multiplies instead of adding.';
      var v = s;
      for (var k3 = 0; k3 < 5; k3++) { items.push(String(v)); v = v * 2; }
      answers = [v];
    } else if (kind === 'shape') {
      var emojiSets = [['⭐', '🌙'], ['🔴', '🔵', '🟡'], ['🐶', '🐱'], ['🌳', '🌺', '🍄'], ['▲', '■', '●']];
      var set = rng.pick(emojiSets);
      prompt = 'What comes next in the pattern?';
      hint = 'Find the part that repeats, then continue it.';
      for (var k4 = 0; k4 < 5; k4++) items.push(set[k4 % set.length]);
      answers = [set[5 % set.length]];
    } else {
      var start = rng.int(1, 3), inc = 1;
      prompt = 'What comes next in the pattern?';
      hint = 'Each row has one more than the row before.';
      var n = start;
      for (var k5 = 0; k5 < 4; k5++) {
        items.push(new Array(n + 1).join('●'));
        n += inc;
      }
      answers = [new Array(n + 1).join('●')];
    }

    var wrong = [];
    var guard = 0;
    while (wrong.length < 6 && guard++ < 60) {
      var cand;
      if (kind === 'shape' || kind === 'grow') {
        cand = kind === 'grow' ? new Array(rng.int(1, 9) + 1).join('●') : rng.pick(['⭐', '🌙', '🔴', '🔵', '🟡', '🐶', '🐱', '🌳', '🌺', '🍄', '▲', '■', '●']);
      } else {
        cand = String(Math.max(1, parseInt(answers[0], 10) + rng.int(-9, 9)));
      }
      if (cand !== answers[0] && wrong.indexOf(cand) < 0 && items.indexOf(cand) < 0) wrong.push(cand);
    }

    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'sequence',
      items: items,
      prompt: prompt,
      hint: hint
    };
    ex.choices = mc(rng, answers[0], wrong, function (v) { return String(v); });
    ex.grade = function (a) {
      var ok = String(a) === String(answers[0]);
      return { correct: ok, message: ok ? 'Yes! You found the rule.' : 'Check the change between two neighbours in the row.' };
    };
    return ex;
  }

  /* ---------------------------- odd one out ---------------------------- */

  var GROUPS = {
    animals: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐸'],
    vehicles: ['🚗', '🚌', '🚕', '🚓', '🚑', '🚒', '🚚', '🛵'],
    fruits: ['🍎', '🍌', '🍇', '🍓', '🍑', '🍍', '🥝', '🍒'],
    sports: ['⚽', '🏀', '🏈', '🎾', '🏐', '🥎', '🏓', '🎱'],
    weather: ['☀️', '🌧️', '⛄', '🌈', '⚡', '🌪️', '🌤️', '❄️'],
    music: ['🎸', '🥁', '🎹', '🎺', '🎻', '🪕', '🎷', '📻']
  };

  function odd(level, rng, i) {
    var names = Object.keys(GROUPS);
    var a = rng.pick(names);
    var b = rng.pick(names.filter(function (n) { return n !== a; }));
    var items = rng.sample(GROUPS[a], 4).map(function (e) { return { emoji: e }; });
    var oddOne = { emoji: rng.pick(GROUPS[b]) };
    var all = rng.shuffle(items.concat([oddOne]));
    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'odd',
      items: all,
      prompt: 'Which one does not belong?',
      hint: 'First find the rule that four of them follow.'
    };
    ex.grade = function (choiceIndex) {
      var ok = all[choiceIndex] === oddOne;
      return { correct: ok, message: ok ? 'Right — it is the only one from a different group.' : 'That one fits the rule. Look for the stranger.' };
    };
    return ex;
  }

  /* --------------------------- decomposition --------------------------- */

  var PROCEDURES = [
    { title: 'Make a cheese sandwich', steps: ['Take two slices of bread', 'Spread butter on one slice', 'Put cheese on the slice', 'Put the second slice on top', 'Cut the sandwich'] },
    { title: 'Brush your teeth', steps: ['Wet the toothbrush', 'Put toothpaste on the brush', 'Brush the top teeth', 'Brush the bottom teeth', 'Rinse your mouth', 'Wash the brush'] },
    { title: 'Plant a seed', steps: ['Fill a pot with soil', 'Make a small hole', 'Drop the seed in', 'Cover the seed with soil', 'Water the pot', 'Put it in the sun'] },
    { title: 'Wash your hands', steps: ['Turn on the water', 'Wet your hands', 'Add soap', 'Rub both sides of your hands', 'Rinse the soap off', 'Dry your hands'] },
    { title: 'Send a letter', steps: ['Write the letter', 'Fold the paper', 'Put it in an envelope', 'Write the address', 'Stick on a stamp', 'Post it in a mailbox'] },
    { title: 'Pack your school bag', steps: ['Check your timetable', 'Put in the books you need', 'Add your pencil case', 'Add your water bottle', 'Zip the bag', 'Put it by the door'] },
    { title: 'Make a cup of hot chocolate', steps: ['Boil water', 'Put cocoa in the cup', 'Pour the hot water in', 'Stir the drink', 'Add marshmallows', 'Let it cool a little'] },
    { title: 'Get ready for bed', steps: ['Put on pyjamas', 'Brush your teeth', 'Read a story', 'Turn off the big light', 'Turn on the night light', 'Close your eyes'] }
  ];

  function orderSteps(level, rng, i) {
    var proc = rng.pick(PROCEDURES);
    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'order-steps',
      title: proc.title,
      steps: proc.steps,
      pool: rng.shuffle(proc.steps.map(function (s, idx) { return { id: 's' + idx, label: s }; })),
      prompt: 'Tap the steps in the correct order to: ' + proc.title.toLowerCase() + '.',
      hint: 'Ask yourself: what MUST happen first?'
    };
    ex.grade = function (orderIds) {
      var chosen = orderIds.map(function (id) {
        var s = ex.pool.filter(function (p) { return p.id === id; })[0];
        return s ? s.label : '';
      });
      var ok = chosen.length === proc.steps.length && chosen.every(function (s, k) { return s === proc.steps[k]; });
      if (!ok) {
        var firstBad = chosen.findIndex(function (s, k) { return s !== proc.steps[k]; });
        return {
          correct: false,
          message: firstBad < 0 ? 'Not every step is placed yet.' : 'Step ' + (firstBad + 1) + ' is not right yet. What has to happen before it?',
          detail: { firstBad: firstBad }
        };
      }
      return { correct: true, message: 'Perfect order — that is decomposition!' };
    };
    return ex;
  }

  /* ---------------------------- classification -------------------------- */

  var BUCKET_RULES = [
    { a: 'Things with wheels', b: 'Things without wheels', items: [{ e: '🚗', a: true }, { e: '🚌', a: true }, { e: '🍎', a: false }, { e: '🚲', a: true }, { e: '🐶', a: false }, { e: '🛒', a: true }], prop: 'wheels' },
    { a: 'Living things', b: 'Not living', items: [{ e: '🌳', a: true }, { e: '🐟', a: true }, { e: '🪑', a: false }, { e: '🌷', a: true }, { e: '🧸', a: false }, { e: '🐝', a: true }], prop: 'alive' },
    { a: 'Things you can eat', b: 'Things you cannot eat', items: [{ e: '🍌', a: true }, { e: '🍞', a: true }, { e: '🧦', a: false }, { e: '🥕', a: true }, { e: '🔧', a: false }, { e: '🍇', a: true }], prop: 'food' },
    { a: 'Things that fly', b: 'Things that do not fly', items: [{ e: '🦅', a: true }, { e: '✈️', a: true }, { e: '🐢', a: false }, { e: '🦋', a: true }, { e: '🚂', a: false }, { e: '🐧', a: false }], prop: 'flies' },
    { a: 'Made of metal', b: 'Not metal', items: [{ e: '🔑', a: true }, { e: '🥄', a: true }, { e: '🧁', a: false }, { e: '🔩', a: true }, { e: '🌻', a: false }, { e: '⚙️', a: true }], prop: 'metal' },
    { a: 'Even numbers', b: 'Odd numbers', items: [{ e: '2', a: true }, { e: '7', a: false }, { e: '8', a: true }, { e: '11', a: false }, { e: '14', a: true }, { e: '5', a: false }], prop: 'even' }
  ];

  function classify(level, rng, i) {
    var rule = rng.pick(BUCKET_RULES);
    var items = rng.shuffle(rule.items.slice(0, 6)).map(function (it, idx) {
      return { id: 'i' + idx, emoji: it.e, bucket: it.a ? 'a' : 'b' };
    });
    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'classify',
      buckets: [{ id: 'a', label: rule.a }, { id: 'b', label: rule.b }],
      items: items,
      prompt: 'Put every item in the right group.',
      hint: 'Read both group names first, then decide each item.'
    };
    ex.grade = function (map) {
      var wrong = items.filter(function (it) { return map[it.id] !== it.bucket; });
      if (!wrong.length) return { correct: true, message: 'All sorted with a clear rule!' };
      return { correct: false, message: wrong.length + ' item' + (wrong.length > 1 ? 's' : '') + ' in the wrong group.' };
    };
    return ex;
  }

  /* ------------------------------- debug -------------------------------- */

  function bug(level, rng, i) {
    var proc = rng.pick(PROCEDURES);
    var steps = proc.steps.slice();
    var kind = rng.chance(0.5) ? 'nonsense' : 'moved';
    var badIndex;
    if (kind === 'nonsense') {
      var other = rng.pick(PROCEDURES.filter(function (p) { return p !== proc; }));
      badIndex = rng.int(1, steps.length - 1);
      steps[badIndex] = rng.pick(other.steps);
    } else {
      var from = rng.int(1, steps.length - 1);
      var moved = steps.splice(from, 1)[0];
      badIndex = Math.min(steps.length, Math.max(0, rng.int(0, steps.length - 1)));
      steps.splice(badIndex, 0, moved);
    }
    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'bug',
      title: proc.title,
      steps: steps,
      badIndex: badIndex,
      prompt: 'This plan for "' + proc.title.toLowerCase() + '" has one bug. Tap the step that is wrong.',
      hint: kind === 'nonsense' ? 'One step does not belong here at all.' : 'One step happens at the wrong time.'
    };
    ex.grade = function (idx) {
      var ok = idx === badIndex;
      return { correct: ok, message: ok ? 'Bug found!' : 'That step is fine — keep looking.' };
    };
    return ex;
  }

  /* ------------------------------ detective ----------------------------- */

  var CREATURES = ['🐶', '🐱', '🐟', '🐸', '🦅', '🐢', '🦋', '🐘', '🐧', '🦁', '🐙', '🐴', '🦉', '🦀'];
  var LEGS = [0, 2, 4];
  var SIZES = ['small', 'big'];
  var HOMES = ['water', 'land', 'air'];
  var HUES = ['red', 'blue', 'green', 'yellow'];

  function detective(level, rng, i) {
    var pool = rng.sample(CREATURES, 8);
    var suspects = pool.map(function (e, idx) {
      return {
        id: 'c' + idx, emoji: e,
        legs: rng.pick(LEGS), size: rng.pick(SIZES), home: rng.pick(HOMES), hue: rng.pick(HUES)
      };
    });
    // make sure at least a couple of attributes split the group
    suspects[0].legs = 4; suspects[1].legs = 0;
    suspects[2].home = 'water'; suspects[3].home = 'air';

    var questions = [];
    LEGS.forEach(function (l) { questions.push({ id: 'legs' + l, label: 'Does it have ' + l + ' legs?', test: function (s) { return s.legs === l; } }); });
    SIZES.forEach(function (s) { questions.push({ id: 'size' + s, label: 'Is it ' + s + '?', test: function (c) { return c.size === s; } }); });
    HOMES.forEach(function (h) { questions.push({ id: 'home' + h, label: 'Does it live in the ' + h + '?', test: function (c) { return c.home === h; } }); });
    HUES.forEach(function (h) { questions.push({ id: 'hue' + h, label: 'Is it ' + h + '?', test: function (c) { return c.hue === h; } }); });

    var secret = rng.pick(suspects);
    var ex = {
      id: makeId(level, rng, i),
      type: 'logic', variant: 'detective',
      suspects: suspects,
      questions: questions,
      secretId: secret.id,
      optimal: 3,
      prompt: 'One creature is hiding. Ask yes/no questions, then tap it.',
      hint: 'A good question cuts the suspects roughly in half.'
    };
    ex.grade = function (attempt) {
      if (!attempt || !attempt.guessed) return { correct: false, message: 'Tap the creature you think it is.' };
      var right = attempt.guessed === secret.id;
      var used = attempt.asked || 0;
      if (right && used <= 4) return { correct: true, message: 'Found it in ' + used + ' question' + (used === 1 ? '' : 's') + '!' };
      if (right) return { correct: true, message: 'Found it — try to use fewer questions next time.' };
      return { correct: false, message: 'Not this one. Ask another question first.' };
    };
    return ex;
  }

  App.Exercises.register('logic', 'sequence', sequence);
  App.Exercises.register('logic', 'odd', odd);
  App.Exercises.register('logic', 'order-steps', orderSteps);
  App.Exercises.register('logic', 'classify', classify);
  App.Exercises.register('logic', 'bug', bug);
  App.Exercises.register('logic', 'detective', detective);
})(window.App);
