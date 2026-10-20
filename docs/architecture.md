# KidCoder Lab — Architecture Document

| Field | Value |
| --- | --- |
| System | KidCoder Lab v1.0 |
| Style | Client-only single-page application, layered, no build step |
| Runtime | Any modern browser (ES5-compatible JavaScript, no transpiler, no bundler) |
| Persistence | `localStorage` (in-memory fallback) |
| Network | None at runtime |

---

## 1. Architecture drivers

| Driver | Decision it forces |
| --- | --- |
| **Must work on a school tablet without a server** | Zero backend; all state in `localStorage`; zero runtime network calls |
| **Target age starts at 6** | One concept per screen, huge tap targets, tap-only interactions (no drag-and-drop), instant feedback |
| **"No skipping the fundamentals"** | A curriculum graph with hard prerequisites evaluated on every navigation |
| **Infinite shuffled practice** | Procedural, seeded generators instead of a static question bank |
| **Real Python for older kids** | An embedded interpreter with a sandbox budget |
| **Fast first paint on slow devices** | No framework, no WASM; ~120 KB of hand-written JS; classic `<script>` tags so the app also runs from `file://` |

### 1.1 Key trade-off: the Python engine

Two options were considered:

| Option | Pros | Cons |
| --- | --- | --- |
| **Pyodide** (CPython in WebAssembly) | Real CPython, full standard library | ~10 MB download, seconds of start-up, needs a CDN on first use |
| **MiniPy** (built-in subset interpreter) | Instant, offline, deterministic, fully sandboxable, real Python *syntax* and *error names* | Implements the taught subset only |

**Decision: MiniPy**, behind an engine-agnostic `run()` contract. The curriculum never
leaves the subset, kids get sub-millisecond feedback on cheap devices, and swapping in
Pyodide later means re-implementing one function (§6.4).

---

## 2. System context

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (one device)                  │
│                                                              │
│   Kid  ──►  KidCoder Lab SPA  ──►  localStorage              │
│   Parent ─►  (index.html)          • kidcoder.profiles.v1    │
│                                    • kidcoder.progress.v1.*  │
│                                    • kidcoder.client.v1      │
│                                                              │
│   (optional) export / import  ──►  JSON file on the device   │
└──────────────────────────────────────────────────────────────┘
        no HTTP calls, no cookies, no analytics, no CDN
```

---

## 3. Layered architecture

```
┌───────────────────────────────────────────────────────────────┐
│  L4  UI / Screens      home.js  runner.js  render-*.js        │
│      (DOM only; no learning rules, no grading logic)          │
├───────────────────────────────────────────────────────────────┤
│  L3  Learning rules    progress.js  curriculum.js  registry.js │
│      (XP, stars, mastery, unlocks, badges, set assembly)      │
├───────────────────────────────────────────────────────────────┤
│  L2  Engines           grid.js  robot-sim.js  minipy.js       │
│      (pure logic: pixel grids, simulation, code execution)    │
├───────────────────────────────────────────────────────────────┤
│  L1  Platform          util.js  storage.js  audio.js          │
│      (seeded RNG, DOM builder, persistence, sound)            │
└───────────────────────────────────────────────────────────────┘
```

Dependencies only ever point **downwards**. L2 engines know nothing about the DOM;
L4 renderers know nothing about scoring.

---

## 4. Module map

```
index.html
css/
  theme.css            design tokens, reset, buttons, cards, animation keyframes
  app.css              screens + every exercise widget
js/
  core/
    util.js            RNG (mulberry32), el() DOM builder, formatting, clone, sleep
    storage.js         profiles + per-profile progress in localStorage, import/export
    audio.js           WebAudio synth (no audio assets)
    progress.js        XP / stars / mastery / unlock / badge rules
    app.js             hash router, top bar, modal, toast, boot
  engines/
    grid.js            pixel grid model + DOM board renderer (1-indexed coords)
    robot-sim.js       command AST, world model, frame-by-frame simulator
    minipy.js          tokenizer → parser → tree-walking interpreter + turtle
  data/
    sprites.js         8×8 pixel-art library, palettes, shape generators
    registry.js        exercise generator registry + buildSet(level, seed)
    curriculum.js      4 worlds, 28 levels, gates, badges (single source of truth)
    ex-pixel.js        generators: find-cell, paint-list, copy-shape,
                       sprite-code, row-code, free-draw
    ex-robot.js        world generator with guaranteed solution + order/build variants
    ex-logic.js        generators: sequence, odd, order-steps, classify, bug, detective
    ex-python.js       generators: predict, write (5 topics), turtle, project
  ui/
    render-pixel.js    boards, palettes, code lists
    render-robot.js    block builder, world view, animation
    render-logic.js    MC, ordering, buckets, suspect board
    render-python.js   editor, terminal, turtle canvas
    runner.js          Learn → Practice → Results state machine
    home.js            profiles, map, category, dashboard, gallery, settings
docs/
  requirements.md
  architecture.md
```

Load order matters because each file captures its dependencies into a local alias at
IIFE time (`var C = App.Curriculum`). `curriculum.js` therefore loads **before**
`progress.js`. This is the single ordering constraint in `index.html`.

---

## 5. Runtime flow — one practice round

```
App.go('#/level/px4')
      │
      ▼
router (app.js) ──► Runner.render(container, levelId)
      │                    │
      │                    ▼
      │            [LEARN]  concept card from curriculum.js
      │                    │  "Start practice"
      │                    ▼
      │            seed = uid()
      │            Exercises.buildSet(level, seed)
      │                    │  ├─ rootRng = RNG(hash(levelId|seed))
      │                    │  ├─ subRng  = RNG(rootRng.int())  per item
      │                    │  └─ shuffle presentation order
      │                    ▼
      │            [PRACTICE]  for each exercise:
      │                    │
      │                    ├─ Renderers[type].render(ex, api)
      │                    │        returns { node, attempt(), reset(), autoSubmit, retryable }
      │                    │
      │                    ├─ kid interacts → api.submit(payload)   (or Check → attempt())
      │                    │
      │                    ├─ ex.grade(attempt) ──► { correct, message, detail }
      │                    │
      │                    ├─ Progress.record(levelId, correct, xp)
      │                    │
      │                    └─ feedback → Next / Try again / Show me
      │                    ▼
      │            [RESULTS] Progress.completeRun(...)
      │                       ├─ stars, mastery, unlock next level
      │                       ├─ awardBadges()
      │                       └─ save()
      ▼
   Practise again (new seed) · Next level · Back to map
```

---

## 6. Engine design

### 6.1 Seeded RNG (`util.js`)

`mulberry32` over a 32-bit seed. Generators receive an `RNG` object exposing
`int`, `pick`, `shuffle`, `sample`, `chance`, `weighted`. Determinism is what allows
**stateless grading**: the grader recomputes the answer from the exercise it holds
instead of looking it up in a key.

### 6.2 Pixel grid (`grid.js`)

* Model: `{ w, h, cells: [hex|null] }`, row-major, **0-based internally, 1-based in the UI**.
* Operations: `get/set`, `equals`, `diff`, `toList`, `fromRows`, `fitCentre`, `flipX`,
  `rotate90`, `recolor` — the transform trio is what makes a shuffled variant of the
  same sprite look new to a child.
* `renderDOM()` builds a CSS-grid board with rulers, per-cell ARIA labels and a mark
  layer (`ok` / `bad` / `hint`) used by feedback.

### 6.3 Robot simulator (`robot-sim.js`)

```
Program AST:  {op:'move'|'left'|'right'|'pick'|'put'}
              {op:'repeat', times, body:[…]}
              {op:'if', cond:'gem'|'wall'|'goal'|'carrying', body:[…]}
              {op:'call', name}
Program:      { body:[…], procedures:{ A:[…] } }
```

* `simulate(world, program)` expands the AST, records a **frame after every command**
  (position, facing, bag, gem state, dropped items, note) and returns
  `{frames, success, atGoal, gemsCollected, gemsTotal, error}`.
* Guards: 3 000 steps, 600 frames, recursion depth 16 — a broken program can never hang.
* Errors are kid-readable: *"Oops — the robot walked into a wall."*
* The UI replays `frames` with a delay, which is what makes debugging visible.

**World generation** (`ex-robot.js`) walks a self-avoiding random path, places the flag at
the end, sprinkles decorative walls **off** the path, drops gems **on** the path, and
rebuilds the command list with `pick` inserted at the right moments. Because the walk is
the solution, **every generated world is solvable**, and `ex.par` (optimal length) enables
an efficiency bonus.

### 6.4 MiniPy (`minipy.js`)

```
source ──► tokenize()   indentation-aware (INDENT/DEDENT), strings, comments,
      │                  multi-char operators (** // <= >= != += -= …)
      ▼
        Parser         recursive descent: module → block → statement → expression
      │                  (or/and/not/compare/arith/term/factor/power/atom + trailers)
      ▼
        AST ──► Interp   Env chain, Python truthiness, Python-like repr()
                         ├── builtins: print len range str int float round abs
                         │             min max sum list sorted input type
                         ├── modules: turtle, math
                         ├── methods: str.* (upper/lower/split/replace/…)
                         │            list.* (append/pop/sort/…)
                         └── guards: maxSteps 200 000, maxMs 2 500, maxOutput 200
```

* Errors carry `{ name, message, hint, line }`; names are real (`NameError`,
  `IndentationError`, `TypeError`, `ZeroDivisionError`, `IndexError`, `TimeoutError`)
  and `hint` is the child-friendly translation.
* No host object is reachable from child code — the global environment contains only
  builtins, the turtle and `math`.
* **Swap point:** `App.MiniPy.run(code, opts) → {ok, output, lines, error, turtle, steps}`
  is the entire contract. A Pyodide implementation returning the same shape can replace
  it without touching a single lesson.

### 6.5 Turtle

`Turtle` records `segs`, `dots` and `texts` instead of drawing directly, so the renderer
can auto-fit any drawing to the canvas and animate it progressively. Colours accept both
hex and kid names (`"purple"`).

---

## 7. Exercise contract

Every generator is a pure function `(level, rng, index, options) → exercise`:

```js
{
  id, type, variant, levelId, index, xp,
  prompt, hint,                 // HTML-safe strings shown to the child
  …variant-specific data…,      // grid, world, code, choices, …
  grade(attempt) -> { correct, message, detail }
}
```

Registration: `App.Exercises.register(type, variant, fn)`.
Assembly: `App.Exercises.buildSet(level, seed)` derives sub-seeds from a root RNG and
shuffles the presentation order.

**Renderer contract** (`App.Renderers[type].render(ex, api)`):

```js
{
  node,                  // DOM element to mount
  attempt(),             // returns the payload (may return a Promise for animated runs)
  reset(),               // clear the working area
  autoSubmit,            // true → the renderer submits by itself (MC, click targets)
  retryable,             // true → a wrong answer does not end the exercise
  checkLabel,            // custom label for the Check button ("Run & Check ▶")
  revealSolution(),      // optional scaffolding after 2 failures
  onCorrect(result)      // optional side effect (e.g. save drawing to gallery)
}
```

`api.submit(value)` returns a **Promise of the grade result**, which lets a renderer
highlight its own choice green or red without knowing the answer.

Adding a new exercise type therefore touches exactly three places: a generator, a
renderer, and one line in `curriculum.js`.

---

## 8. Progression model

```js
levelUnlocked(progress, levelId)
  = categoryUnlocked(progress, level.cat)
 && (positionInCategory === 0 || levels[previous].mastered)

categoryUnlocked(progress, catId)
  = !cat.requires || masteredInCategory(progress, cat.requires.category) >= cat.requires.mastered
```

Evaluated **on every navigation**, so a hand-typed URL cannot bypass a lock.

```
mastered = correct >= mastery.correct && correct/attempts >= mastery.accuracy
stars(round) = accuracy >= .95 ? 3 : accuracy >= .80 ? 2 : accuracy >= gate ? 1 : 0
```

`completeRun()` is the only writer of mastery state; it also unlocks the next level,
opens newly reachable worlds, awards badges and appends a session history entry.

---

## 9. Data model

```
kidcoder.client.v1
  { schema, activeProfileId, lastVisited, launches }

kidcoder.profiles.v1
  { schema, profiles: [ { id, name, avatar, age, pin, createdAt, lastActiveAt } ] }

kidcoder.progress.v1.<profileId>
  {
    schema, profileId,
    xp, coins, stars, streakDays, lastPracticeDay, combo, bestCombo,
    totalCorrect, totalAttempts, totalTimeMs,
    levels: {                       // lazy, sparse
      [levelId]: { unlocked, attempts, correct, runs, bestAccuracy, bestCombo,
                   stars, mastered, masteredAt, lastSeed, timeMs }
    },
    badges: [ { id, earnedAt } ],
    gallery: [ { id, type:'pixel'|'code', title, cells?, w?, h?, code?, createdAt } ],
    seenConcepts: [],
    history: [ { at, levelId, correct, total, xp } ],   // newest first, capped at 100
    settings: { sound, animation, largeText, reducedMotion }
  }
```

* One key per profile → deleting or exporting a profile is a single-key operation.
* `loadProgress()` back-fills missing fields from `newProgress()`, so an older save can
  never break a newer build.
* Writes are small and frequent (after every answer, round and gallery change).

---

## 10. UI architecture

* **Router**: hash-based (`#/map`, `#/category/:id`, `#/level/:id`, `#/dashboard`,
  `#/gallery`, `#/settings`, `#/profiles`). No history API, so it works from `file://`.
* **Chrome**: sticky top bar with brand, world shortcuts, XP/star chips and the active
  profile button. Hidden on the profile picker.
* **Screens** in `home.js`, **level flow** in `runner.js`, **widgets** in `render-*.js`.
* Styling is plain CSS with custom properties; a category colour (`--cat`) is injected
  per card so each world has its own identity.
* `U.el('tag.class#id', attrs, children)` is the only DOM construction primitive — it
  keeps templates declarative without a framework.

---

## 11. Performance & safety budget

| Concern | Measure |
| --- | --- |
| Payload | ~120 KB JS + ~25 KB CSS, no images, no fonts, no requests |
| First interaction | No compile step; scripts execute on parse |
| Grid sizes | ≤ 10 × 10 = 100 cells; board rebuilt only on repaint |
| Simulation | ≤ 3 000 steps, ≤ 600 recorded frames |
| Python | ≤ 200 000 interpreter steps or 2.5 s, output capped at 200 lines |
| Storage | A few KB per profile; gallery capped at 60 items, history at 100 |
| Rendering | No virtual DOM; screens are replaced wholesale (small trees) |

---

## 12. Testing strategy

| Layer | Method |
| --- | --- |
| Engines | Node harness: parse/run Python snippets, assert output and error names; simulator run against reference solutions |
| Generators | Node harness: build 12 seeds × every level, assert every reference solution passes its own `grade()` (1 700+ exercises per run) |
| UI | Headless Chromium end-to-end: create profile → play every level to the results screen, assert no console or page errors |
| Regression hooks | `data-*` attributes (`data-x/data-y`, `data-color`, `data-op`, `data-id`) and the exposed `App.Runner.state` make the DOM scriptable by tests |

---

## 13. Deployment

Static files only. Copy the folder to any host (Nginx, GitHub Pages, S3, an intranet
share) or open `index.html` directly. Recommended: serve over HTTPS so
`localStorage` is isolated per origin, plus

```nginx
Cache-Control: no-cache        # for index.html
Cache-Control: max-age=31536000, immutable   # for css/ and js/
```

---

## 14. Extension roadmap

| Change | Cost | Notes |
| --- | --- | --- |
| New exercise variant | Low | generator + renderer + one curriculum line |
| New world (e.g. Data Lab) | Low | append to `CATEGORIES` + levels |
| Service worker / PWA install | Low | app is already network-free |
| Pyodide backend for Python | Medium | re-implement `MiniPy.run()` behind the same contract |
| i18n | Medium | all strings live in `curriculum.js` and generator templates |
| Optional cloud sync | Medium | add an adapter behind `App.store` (same read/write API) |
| Teacher dashboard / CSV export | Medium | read-only view over `App.Progress.levelSummary()` |

---

## 15. Known limitations

1. MiniPy is a subset — classes, comprehensions, dicts, `try/except`, `with` and f-strings
   are not supported (they are not used by any lesson).
2. Progress lives in one browser profile; clearing site data erases it unless exported.
3. No server-side anti-cheat: a determined user can edit `localStorage`. Acceptable for
   a single-device learning toy.
4. The parent PIN field is stored but not enforced in v1.
5. Robot levels use block commands rather than a Scratch-style drag canvas, to keep every
   interaction a single tap on small screens.
