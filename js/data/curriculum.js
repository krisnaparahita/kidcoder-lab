/* =============================================================
 * KidCoder Lab - curriculum.js
 * The single source of truth for the learning path.
 *
 * Design rules encoded here:
 *  - strictly sequential levels inside a category (no skipping)
 *  - a category opens only after the previous one is partly mastered
 *  - every level states a mastery gate (correct answers + accuracy)
 *  - exercises are generated, never hard-coded -> infinite shuffled practice
 * ============================================================= */
(function (App) {
  'use strict';

  var CATEGORIES = [
    {
      id: 'pixels',
      title: 'Pixel Lab',
      icon: '🎨',
      age: '6+',
      colour: '#ff6b6b',
      blurb: 'Learn how a picture is made of tiny squares — and how to describe every square with numbers.',
      skills: ['Coordinates', 'Following instructions', 'Precision'],
      requires: null
    },
    {
      id: 'robot',
      title: 'Robot Lab',
      icon: '🤖',
      age: '6+',
      colour: '#4dabf7',
      blurb: 'Arrange command blocks, run the simulation, and watch your robot walk, turn and collect.',
      skills: ['Sequencing', 'Debugging', 'Loops', 'Conditions'],
      requires: { category: 'pixels', mastered: 3 }
    },
    {
      id: 'logic',
      title: 'Logic Lab',
      icon: '🧩',
      age: '7+',
      colour: '#9775fa',
      blurb: 'Spot patterns, break big jobs into small steps, and think like a detective.',
      skills: ['Patterns', 'Decomposition', 'Classification'],
      requires: { category: 'pixels', mastered: 3 }
    },
    {
      id: 'python',
      title: 'Python Lab',
      icon: '🐍',
      age: '9+',
      colour: '#38d9a9',
      blurb: 'Real Python — typing code, running it, and drawing with a turtle.',
      skills: ['Syntax', 'Variables', 'Loops', 'Functions', 'Drawing'],
      requires: { category: 'robot', mastered: 3 }
    }
  ];

  var LEVELS = [
    /* ============================ PIXEL LAB ============================ */
    {
      id: 'px1', cat: 'pixels', title: 'Find the Pixel', icon: '🔍', xp: 30,
      teach: [
        'A picture on a computer is a <b>grid</b> of tiny squares called <b>pixels</b>.',
        'We name a pixel with two numbers: <b>column</b> (how far right) and <b>row</b> (how far down).',
        'Column 1 is the left edge. Row 1 is the top edge.'
      ],
      concept: 'Every pixel has an address: <b>(column, row)</b>. To find pixel (3, 2): go <b>right 3</b>, then <b>down 2</b>.',
      exercise: { type: 'pixel', variant: 'find-cell', count: 7 },
      mastery: { correct: 6, accuracy: 0.75 }
    },
    {
      id: 'px2', cat: 'pixels', title: 'Paint by Coordinate', icon: '🖍️', xp: 35,
      teach: [
        'An instruction for a computer looks like: <b>paint (4, 2) red</b>.',
        'Computers are very literal — they do exactly what you say, in the order you say it.',
        'That is why the <b>order</b> and the <b>exact numbers</b> matter.'
      ],
      concept: 'A list of instructions is a <b>program</b>. Follow the list from top to bottom, one line at a time.',
      exercise: { type: 'pixel', variant: 'paint-list', count: 6 },
      mastery: { correct: 5, accuracy: 0.75 }
    },
    {
      id: 'px3', cat: 'pixels', title: 'Copy the Picture', icon: '🖼️', xp: 40,
      teach: [
        'Now you read a finished picture and rebuild it yourself.',
        'Count carefully: left to right for the column, top to bottom for the row.',
        'Tip: find the <b>first</b> coloured pixel, then follow the shape.'
      ],
      concept: 'Reading a picture is the same skill as writing one: you turn what you see into (column, row) pairs.',
      exercise: { type: 'pixel', variant: 'copy-shape', count: 5 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'px4', cat: 'pixels', title: 'Sprite from Code', icon: '👾', xp: 50,
      teach: [
        'Game artists write sprites as a list of pixels.',
        'The code below is the <b>only</b> description of the picture — there is no drawing.',
        'If you type every line correctly, the picture appears. That is how computers store images.'
      ],
      concept: 'A sprite is data: <b>[column, row, colour]</b> lines. Change one number and the picture changes.',
      exercise: { type: 'pixel', variant: 'sprite-code', count: 5 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'px5', cat: 'pixels', title: 'Row Codes', icon: '📏', xp: 45,
      teach: [
        'Writing one line per pixel is slow. We can <b>compress</b> it.',
        'A row code says how many pixels of each colour come one after another: <b>2 red, 3 blue</b>.',
        'Computers use this trick to make image files smaller.'
      ],
      concept: 'Compression = describing the same picture with fewer symbols. Same information, shorter code.',
      exercise: { type: 'pixel', variant: 'row-code', count: 5 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'px6', cat: 'pixels', title: 'Pixel Artist', icon: '🌟', xp: 40,
      teach: [
        'Now you are the designer. Draw anything you like.',
        'When you finish, the app will show you the <b>code</b> for your picture.',
        'Save your work — it goes into your gallery on this device.'
      ],
      concept: 'You have gone both ways: <b>picture → code</b> and <b>code → picture</b>. That is what programmers do all day.',
      exercise: { type: 'pixel', variant: 'free-draw', count: 3 },
      mastery: { correct: 2, accuracy: 0.6 }
    },

    /* ============================ ROBOT LAB ============================ */
    {
      id: 'rb1', cat: 'robot', title: 'Go, Robot!', icon: '⬆️', xp: 30,
      teach: [
        'A robot only understands the <b>commands</b> you give it.',
        '<b>Move</b> walks one square forward, in the direction the robot is facing.',
        'Put the commands in the right <b>order</b> — that order is your program.'
      ],
      concept: 'A program is a <b>sequence</b>: step 1, step 2, step 3 … in exactly that order.',
      exercise: { type: 'robot', variant: 'order', count: 5, options: { turns: false, gems: false, maxLen: 4 } },
      mastery: { correct: 4, accuracy: 0.75 }
    },
    {
      id: 'rb2', cat: 'robot', title: 'Turn Around', icon: '↰', xp: 35,
      teach: [
        '<b>Turn left</b> and <b>Turn right</b> change the direction the robot faces — they do not move it.',
        'To go around a corner you need: move, move, turn, move, move.',
        'The little arrow on the robot shows which way is "forward".'
      ],
      concept: 'Turning changes <b>state</b> (which way the robot points). Later moves depend on it.',
      exercise: { type: 'robot', variant: 'order', count: 5, options: { turns: true, gems: false, maxLen: 6 } },
      mastery: { correct: 4, accuracy: 0.75 }
    },
    {
      id: 'rb3', cat: 'robot', title: 'Route to the Flag', icon: '🚩', xp: 45,
      teach: [
        'Now you build the program yourself from the block palette.',
        'Plan first: look at the flag, then decide the moves and turns.',
        'Press <b>Step</b> to watch one command at a time. Debugging is a normal part of coding!'
      ],
      concept: 'Programming is <b>plan → write → run → fix</b>. Almost nobody gets it right on the first try.',
      exercise: { type: 'robot', variant: 'build', count: 5, options: { turns: true, gems: false, obstacles: true, maxLen: 9 } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'rb4', cat: 'robot', title: 'Collect the Gems', icon: '💎', xp: 45,
      teach: [
        '<b>Pick</b> takes the gem on the square where the robot stands.',
        'The robot must <b>stand on</b> the gem, so you need to arrive there first.',
        '<b>Put</b> drops whatever the robot is carrying.'
      ],
      concept: 'Commands can change the <b>world</b>, not just the robot. That is how games keep score.',
      exercise: { type: 'robot', variant: 'build', count: 5, options: { turns: true, gems: true, obstacles: true, maxLen: 10 } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'rb5', cat: 'robot', title: 'Repeat, Repeat', icon: '🔁', xp: 55,
      teach: [
        'Typing the same block ten times is boring. Use <b>Repeat</b>.',
        '<b>Repeat 4</b> runs the blocks inside it four times.',
        'Short programs are easier to read and to fix.'
      ],
      concept: 'A <b>loop</b> repeats a block of commands. Programmers look for repeating patterns and loop them.',
      exercise: { type: 'robot', variant: 'build', count: 5, options: { turns: true, gems: true, repeat: true, maxLen: 12 } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'rb6', cat: 'robot', title: 'Smart Robot', icon: '❓', xp: 60,
      teach: [
        '<b>If</b> asks a question: "Is there a gem here?" — and only runs the blocks inside when the answer is yes.',
        'This makes one program work in many different worlds.',
        'A robot with <b>if</b> can make decisions by itself.'
      ],
      concept: 'A <b>condition</b> lets a program choose. This is the first step from a script to real intelligence.',
      exercise: { type: 'robot', variant: 'build', count: 4, options: { turns: true, gems: true, repeat: true, condition: true, maxLen: 14 } },
      mastery: { correct: 3, accuracy: 0.7 }
    },
    {
      id: 'rb7', cat: 'robot', title: 'Robot Routines', icon: '⚙️', xp: 65,
      teach: [
        'Give a group of blocks a <b>name</b> and you can run it whenever you want.',
        'This is called a <b>function</b> (or a routine).',
        'Functions let you think in big steps: "walk to the wall" instead of ten little moves.'
      ],
      concept: 'Naming a block of code is <b>abstraction</b>: hiding details behind a name. It is the biggest idea in programming.',
      exercise: { type: 'robot', variant: 'build', count: 4, options: { turns: true, gems: true, repeat: true, procedure: true, maxLen: 14 } },
      mastery: { correct: 3, accuracy: 0.7 }
    },

    /* ============================ LOGIC LAB ============================ */
    {
      id: 'lg1', cat: 'logic', title: 'Patterns', icon: '🔢', xp: 35,
      teach: [
        'A pattern is a rule that repeats. Find the rule and you can predict what comes next.',
        'Look at the <b>change</b> from one item to the next, not just the items.',
        'Patterns are everywhere in maths, music and code.'
      ],
      concept: 'Analytical thinking starts with: <b>what changes, and by how much?</b>',
      exercise: { type: 'logic', variant: 'sequence', count: 7 },
      mastery: { correct: 5, accuracy: 0.7 }
    },
    {
      id: 'lg2', cat: 'logic', title: 'Odd One Out', icon: '🚫', xp: 35,
      teach: [
        'To find the odd one, first find the <b>rule</b> that the others follow.',
        'Say the rule out loud: "all of them are red except…"',
        'A good rule explains <b>every</b> item except one.'
      ],
      concept: 'Classifying means finding the property that splits a group. Programmers do this with <b>if</b>.',
      exercise: { type: 'logic', variant: 'odd', count: 6 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'lg3', cat: 'logic', title: 'Step by Step', icon: '🥪', xp: 40,
      teach: [
        'Big jobs are scary. Small steps are easy.',
        'Put the steps in the right order — a computer (and a little brother) needs the exact order.',
        'This skill is called <b>decomposition</b>.'
      ],
      concept: 'Decomposition = breaking one big problem into ordered, checkable steps.',
      exercise: { type: 'logic', variant: 'order-steps', count: 6 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'lg4', cat: 'logic', title: 'Sort It Out', icon: '🗂️', xp: 40,
      teach: [
        'Sorting means putting things into groups that share a rule.',
        'The rule must be clear: "round" vs "not round", not "nice" vs "boring".',
        'Clear rules are what make a program runnable by a machine.'
      ],
      concept: 'A rule a computer can check is <b>testable</b>: it always gives yes or no.',
      exercise: { type: 'logic', variant: 'classify', count: 6 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'lg5', cat: 'logic', title: 'Find the Bug', icon: '🐞', xp: 45,
      teach: [
        'A <b>bug</b> is a step that is wrong, missing, or in the wrong place.',
        'Read the plan, imagine doing it, and the bug usually jumps out.',
        'Finding bugs is a real job — it is called debugging.'
      ],
      concept: 'Debugging is <b>simulating the program in your head</b> and comparing it with what you wanted.',
      exercise: { type: 'logic', variant: 'bug', count: 6 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'lg6', cat: 'logic', title: 'Yes / No Detective', icon: '🕵️', xp: 45,
      teach: [
        'Every yes/no question should cut the suspects roughly in half.',
        'That is how you find the answer with the fewest questions.',
        'Computers search exactly this way — it is called <b>binary search</b>.'
      ],
      concept: 'Good questions remove the most possibilities. That is the heart of algorithmic thinking.',
      exercise: { type: 'logic', variant: 'detective', count: 5 },
      mastery: { correct: 4, accuracy: 0.7 }
    },

    /* ============================ PYTHON LAB =========================== */
    {
      id: 'py1', cat: 'python', title: 'Read the Code', icon: '📖', xp: 40,
      teach: [
        'Real Python is just text. The computer reads it top to bottom.',
        '<b>print()</b> writes a message on the screen.',
        'You do not type yet — you predict the output. Reading code is half of coding.'
      ],
      concept: 'Code is an <b>instruction written in text</b>. Predicting output proves you understand it.',
      exercise: { type: 'python', variant: 'predict', count: 6 },
      mastery: { correct: 5, accuracy: 0.7 }
    },
    {
      id: 'py2', cat: 'python', title: 'Print & Text', icon: '💬', xp: 45,
      teach: [
        'Text in Python goes inside quotes: <code>print("Hello")</code>.',
        'You can print many things: <code>print("Hi", 5)</code>.',
        'Spelling and brackets must be exact — the computer never guesses.'
      ],
      concept: 'A <b>string</b> is text. Python needs the quotes to know where the text starts and ends.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'print' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py3', cat: 'python', title: 'Variables & Maths', icon: '🧮', xp: 50,
      teach: [
        'A <b>variable</b> is a named box that stores a value: <code>age = 9</code>.',
        'Use it later: <code>print(age + 1)</code>.',
        'Python knows + - * / and brackets, just like a calculator.'
      ],
      concept: 'Variables let a program <b>remember</b>. Names are for humans; the value is for the machine.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'variables' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py4', cat: 'python', title: 'Loops with for', icon: '🔁', xp: 55,
      teach: [
        '<code>for i in range(4):</code> repeats the indented lines four times.',
        'The lines inside the loop must be <b>indented</b> (press the indent button).',
        'Indentation is how Python knows what is inside the loop.'
      ],
      concept: 'A <b>for loop</b> repeats over a sequence. Indentation defines the block.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'for' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py5', cat: 'python', title: 'Decisions with if', icon: '🔀', xp: 60,
      teach: [
        '<code>if age > 10:</code> runs the block only when the test is true.',
        'Add <code>else:</code> for "otherwise", and <code>elif:</code> for another test.',
        'Remember the colon <b>:</b> at the end of the test line.'
      ],
      concept: 'Conditions make programs <b>branch</b>: different input, different path, same code.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'if' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py6', cat: 'python', title: 'While & Input', icon: '⏳', xp: 60,
      teach: [
        '<code>while</code> repeats <b>as long as</b> the test is true.',
        'Always make sure something changes inside, or it will never stop!',
        '<code>input()</code> asks the user a question and remembers the answer.'
      ],
      concept: 'A while loop needs a condition that eventually becomes false — that is the <b>exit condition</b>.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'while' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py7', cat: 'python', title: 'Lists & Functions', icon: '📚', xp: 65,
      teach: [
        'A <b>list</b> holds many values: <code>colours = ["red", "blue"]</code>.',
        '<code>def</code> creates your own command: <code>def greet(name):</code>.',
        'Functions and lists are the two tools that make big programs possible.'
      ],
      concept: 'Data structures (lists) + reusable code (functions) = programs that scale.',
      exercise: { type: 'python', variant: 'write', count: 5, options: { topic: 'lists' } },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py8', cat: 'python', title: 'Turtle Artist', icon: '🐢', xp: 70,
      teach: [
        'A turtle is a pen that walks. <code>forward(50)</code> draws a line.',
        '<code>left(90)</code> and <code>right(90)</code> turn it. <code>penup()</code> lifts the pen.',
        'Loops + turtle = geometric art. That is generative design.'
      ],
      concept: 'Drawing with code means describing a shape as <b>repeated moves and turns</b>.',
      exercise: { type: 'python', variant: 'turtle', count: 5 },
      mastery: { correct: 4, accuracy: 0.7 }
    },
    {
      id: 'py9', cat: 'python', title: 'Mini Project', icon: '🏆', xp: 90,
      teach: [
        'Now build something of your own: a times table, a counter, a star, a story.',
        'Start tiny, run it, then add one more thing. Repeat.',
        'Save it — your project stays in your profile on this device.'
      ],
      concept: 'Projects are how skills stick: <b>build → run → fix → extend</b>.',
      exercise: { type: 'python', variant: 'project', count: 3 },
      mastery: { correct: 2, accuracy: 0.6 }
    }
  ];

  /* ------------------------------- index ------------------------------- */

  var byId = {};
  var byCat = {};
  LEVELS.forEach(function (l, i) {
    l.index = i;
    byId[l.id] = l;
    (byCat[l.cat] = byCat[l.cat] || []).push(l);
  });
  CATEGORIES.forEach(function (c) {
    c.levels = byCat[c.id] || [];
    c.levels.forEach(function (l, i) { l.positionInCategory = i; });
  });

  function categoryOf(levelId) {
    var l = byId[levelId];
    return l ? CATEGORIES.filter(function (c) { return c.id === l.cat; })[0] : null;
  }

  function masteredInCategory(progress, catId) {
    var n = 0;
    (byCat[catId] || []).forEach(function (l) {
      var st = progress.levels[l.id];
      if (st && st.mastered) n++;
    });
    return n;
  }

  function categoryUnlocked(progress, catId) {
    var cat = CATEGORIES.filter(function (c) { return c.id === catId; })[0];
    if (!cat || !cat.requires) return true;
    return masteredInCategory(progress, cat.requires.category) >= cat.requires.mastered;
  }

  /** A level opens when the previous level in its category is mastered. */
  function levelUnlocked(progress, levelId) {
    var l = byId[levelId];
    if (!l) return false;
    if (!categoryUnlocked(progress, l.cat)) return false;
    if (l.positionInCategory === 0) return true;
    var prev = byCat[l.cat][l.positionInCategory - 1];
    var st = progress.levels[prev.id];
    return !!(st && st.mastered);
  }

  function nextLevel(progress, levelId) {
    var l = byId[levelId];
    if (!l) return null;
    var list = byCat[l.cat];
    if (l.positionInCategory + 1 < list.length) return list[l.positionInCategory + 1];
    // next category
    var ci = CATEGORIES.findIndex(function (c) { return c.id === l.cat; });
    for (var i = ci + 1; i < CATEGORIES.length; i++) {
      if (categoryUnlocked(progress, CATEGORIES[i].id) && CATEGORIES[i].levels.length) {
        return CATEGORIES[i].levels[0];
      }
    }
    return null;
  }

  /** The very first thing a new profile should play. */
  function recommendedLevel(progress) {
    for (var i = 0; i < LEVELS.length; i++) {
      var l = LEVELS[i];
      if (!levelUnlocked(progress, l.id)) continue;
      var st = progress.levels[l.id];
      if (!st || !st.mastered) return l;
    }
    return LEVELS[LEVELS.length - 1];
  }

  function starsFor(level, accuracy, runs) {
    if (accuracy >= 0.95) return 3;
    if (accuracy >= 0.8) return 2;
    if (accuracy >= (level.mastery.accuracy || 0.7)) return 1;
    return 0;
  }

  function levelMastered(level, stat) {
    var m = level.mastery || { correct: 4, accuracy: 0.7 };
    var acc = stat.attempts ? stat.correct / stat.attempts : 0;
    return stat.correct >= m.correct && acc >= m.accuracy;
  }

  /* -------------------------------- badges ----------------------------- */

  var BADGES = [
    { id: 'first-steps', icon: '👣', title: 'First Steps', desc: 'Finish your very first exercise.', test: function (p) { return p.totalAttempts >= 1; } },
    { id: 'pixel-pro', icon: '🎨', title: 'Pixel Pro', desc: 'Master every Pixel Lab level.', test: function (p) { return masteredInCategory(p, 'pixels') === (byCat.pixels || []).length; } },
    { id: 'robot-whisperer', icon: '🤖', title: 'Robot Whisperer', desc: 'Master every Robot Lab level.', test: function (p) { return masteredInCategory(p, 'robot') === (byCat.robot || []).length; } },
    { id: 'logic-legend', icon: '🧩', title: 'Logic Legend', desc: 'Master every Logic Lab level.', test: function (p) { return masteredInCategory(p, 'logic') === (byCat.logic || []).length; } },
    { id: 'pythonista', icon: '🐍', title: 'Pythonista', desc: 'Master every Python Lab level.', test: function (p) { return masteredInCategory(p, 'python') === (byCat.python || []).length; } },
    { id: 'sharpshooter', icon: '🎯', title: 'Sharpshooter', desc: 'Get 20 answers right in a row without a mistake.', test: function (p) { return (p.bestCombo || 0) >= 20; } },
    { id: 'collector', icon: '⭐', title: 'Collector', desc: 'Earn 25 stars.', test: function (p) { return p.stars >= 25; } },
    { id: 'persistent', icon: '🔥', title: 'Keep Going', desc: 'Practise on 5 different days.', test: function (p) { return (p.streakDays || 0) >= 5; } },
    { id: 'artist', icon: '🖼️', title: 'Gallery Artist', desc: 'Save 5 drawings to your gallery.', test: function (p) { return (p.gallery || []).length >= 5; } },
    { id: 'scholar', icon: '📚', title: 'Scholar', desc: 'Answer 200 exercises.', test: function (p) { return p.totalAttempts >= 200; } }
  ];

  App.Curriculum = {
    CATEGORIES: CATEGORIES,
    LEVELS: LEVELS,
    BADGES: BADGES,
    byId: byId,
    byCat: byCat,
    categoryOf: categoryOf,
    categoryUnlocked: categoryUnlocked,
    levelUnlocked: levelUnlocked,
    masteredInCategory: masteredInCategory,
    nextLevel: nextLevel,
    recommendedLevel: recommendedLevel,
    starsFor: starsFor,
    levelMastered: levelMastered
  };
})(window.App);
