# KidCoder Lab — Requirements Document

| Field | Value |
| --- | --- |
| Product | KidCoder Lab — a gradual, category-based coding & thinking platform |
| Version | 1.0 (initial release) |
| Audience | Children from 6 years old, plus parents/teachers who supervise |
| Platform | Any modern browser (desktop, tablet, mobile). No install, no server. |
| Status | Implemented — this document describes the delivered behaviour |

---

## 1. Purpose

KidCoder Lab teaches **computational thinking in a fixed order**: first how a picture is
described with numbers (pixel coordinates), then how a robot is driven with ordered
commands, then how to reason analytically (patterns, decomposition, classification),
and finally how to write **real Python**.

The core promise to a parent: *your child cannot skip the fundamentals*. Every level is
locked until the previous one is mastered, and every practice round is generated fresh,
so repetition never means memorising the same answers.

### 1.1 Problem statement

| Existing problem | KidCoder Lab answer |
| --- | --- |
| Kids apps teach "coding" as entertainment with no progression | A 28-level curriculum with explicit prerequisites and mastery gates |
| Children jump to a text language without understanding sequencing | Three pre-code worlds (pixels → robot → logic) must be mastered first |
| Practice sets are fixed, so kids memorise answers | Every exercise is generated from a seed; "Practise again" reshuffles |
| Progress is lost between sessions / devices | Profiles persisted in browser cache, exportable to a file |
| Heavy runtimes (Pyodide/WebAssembly) make first load slow | A small built-in Python-subset engine starts instantly and works offline |

### 1.2 Non-goals (explicitly out of scope for v1)

* No accounts, no login, no server-side sync, no analytics.
* No advertising and no third-party trackers.
* No live teacher, chat or social features.
* No full CPython compatibility (see FR-PY-5).

---

## 2. Personas

| Persona | Age | Need | Key requirement |
| --- | --- | --- | --- |
| **Nia, the beginner** | 6 | Understand that a picture is made of addressed squares | Big touch targets, one idea per level, instant feedback |
| **Ben, the builder** | 8 | Make things move and feel in control | Robot simulation with step-by-step debugging |
| **Ada, the pre-teen** | 11 | Write "real" code like grown-ups | Python editor, turtle graphics, own projects |
| **Mum/Dad** | — | See progress, protect data, no surprises | Dashboard, per-child profiles, local-only storage, export |
| **Teacher** | — | Use it offline in a classroom with several kids | Multiple profiles on one device, no network needed |

---

## 3. Glossary

| Term | Meaning |
| --- | --- |
| **World / Category** | One of four learning areas: Pixel Lab, Robot Lab, Logic Lab, Python Lab |
| **Level** | A single lesson inside a world with a concept card, a practice set and a mastery gate |
| **Exercise** | One generated task inside a level |
| **Set / Round** | A shuffled batch of exercises played in one practice run |
| **Mastery** | The gate that unlocks the next level (minimum correct answers *and* minimum accuracy) |
| **Seed** | A reproducible random value; the same seed always produces the same exercise |
| **Attempt** | One answer submitted to the grader |
| **Combo** | Consecutive correct answers across the whole profile |

---

## 4. Functional requirements

### 4.1 Profiles & persistence — FR-P

| ID | Requirement |
| --- | --- |
| FR-P-1 | The app must support **multiple profiles on one device**, each with name, avatar, age and optional PIN field. |
| FR-P-2 | Profiles and all progress must be stored **in the browser cache (localStorage)**, keyed per profile. No network call may be required to save or load. |
| FR-P-3 | On launch, the app returns to the **last active profile** automatically. |
| FR-P-4 | A profile can be **created, renamed, re-avatared, switched, deleted** and have its progress **reset** independently. |
| FR-P-5 | A profile must be **exportable** to a JSON file and **importable** again (as a copy if the profile already exists). |
| FR-P-6 | If browser storage is unavailable (private mode), the app must still run in memory and warn the user that progress will not be saved. |
| FR-P-7 | Corrupted or older save data must be repaired by back-filling defaults rather than crashing. |
| FR-P-8 | Deleting a profile must remove its progress record too. |

### 4.2 Curriculum & progression — FR-C

| ID | Requirement |
| --- | --- |
| FR-C-1 | Content is organised in **four worlds**, opened in order: Pixel Lab → Robot Lab → Logic Lab → Python Lab. |
| FR-C-2 | Within a world, level *n+1* is **locked until level n is mastered**. Levels cannot be skipped, jumped or deep-linked past the gate. |
| FR-C-3 | A world opens when the previous world has **at least 3 mastered levels** (configurable per world in one place). |
| FR-C-4 | Each level has a **mastery gate** = minimum number of correct answers *and* minimum accuracy (see §6). |
| FR-C-5 | Each level begins with a **concept card**: 2–4 teaching bullets plus one key idea. Practice is only offered after the concept is shown. |
| FR-C-6 | Every level defines a **fixed number of exercises per round** and a **practice-set size**. |
| FR-C-7 | Any mastered level must remain **replayable** ("Practise again") with a **new seed**, producing different exercises. |
| FR-C-8 | The app must always be able to recommend **the next sensible level** ("Continue"). |
| FR-C-9 | Age bands are advisory (6+, 7+, 9+); they inform but never block progression. |

### 4.3 Exercise generation — FR-E

| ID | Requirement |
| --- | --- |
| FR-E-1 | Exercises are **generated at runtime**, never hard-coded, from `(level, seed)`. |
| FR-E-2 | Generation must be **deterministic**: the same seed always yields the same exercise, so grading needs no stored answer key. |
| FR-E-3 | A new seed must produce a **materially different** exercise (different shape, colours, numbers, world layout, orientation). |
| FR-E-4 | Each exercise exposes a **pure `grade(attempt)` function** returning `{correct, message, detail}`. |
| FR-E-5 | Feedback must be **specific**, not just right/wrong: number of wrong pixels, "you missed 2 gems", expected vs actual output, error name and line. |
| FR-E-6 | Robot worlds must be **guaranteed solvable** — the generator keeps the path it walked as the reference solution. |
| FR-E-7 | Difficulty must scale **within** a level through generator options (path length, grid size, obstacles, gems, loop tools). |

### 4.4 Pixel Lab — FR-PX

| ID | Requirement |
| --- | --- |
| FR-PX-1 | Coordinates are presented **1-indexed** as `(column, row)` with origin top-left, with a visible ruler on both axes. |
| FR-PX-2 | Level px1 must teach **both directions**: given a coordinate → click the pixel; given a marked pixel → choose the coordinate. |
| FR-PX-3 | px2 must require **executing an instruction list** ("paint (4, 2) red") top to bottom. |
| FR-PX-4 | px4 must let the child **rebuild a sprite purely from a coordinate list** (`pixel(col, row, "colour")`) — no reference picture is shown. |
| FR-PX-5 | px5 must introduce **run-length row codes** ("row 3: 2 red, 3 blue") and require unpacking them into the picture. |
| FR-PX-6 | px6 is an **open drawing** level; drawings that pass the check are saved to the gallery, and the generated coordinate code is shown. |
| FR-PX-7 | A palette with named colours plus an eraser must be available for every painting task. |

### 4.5 Robot Lab — FR-RB

| ID | Requirement |
| --- | --- |
| FR-RB-1 | Programs are built from **command blocks**: Move, Turn left/right, Pick, Put, Repeat, If, Run routine. |
| FR-RB-2 | Blocks must be addable and removable by **tap/click only** (no drag-and-drop requirement) so the app works on touch screens. |
| FR-RB-3 | The first levels must be **"arrange the blocks"**: a shuffled pool containing exactly the blocks needed. |
| FR-RB-4 | Every program must be **simulated before scoring**, with an animated step-by-step replay and a step log. |
| FR-RB-5 | Simulation must detect and explain failures: wall crash, pick with no gem, put with nothing, missing gems, never reaching the flag, too many steps. |
| FR-RB-6 | Later levels unlock **Repeat**, **If (condition)** and **named routines**, and the palette must only show tools that the level allows. |
| FR-RB-7 | The world must show walls, the goal flag, gems, dropped items and the robot's facing direction. |
| FR-RB-8 | The robot may carry **several** gems; `Put` drops one. |

### 4.6 Logic Lab — FR-LG

| ID | Requirement |
| --- | --- |
| FR-LG-1 | Pattern exercises must cover arithmetic, geometric, repeating-shape and growing patterns, with 4 options. |
| FR-LG-2 | "Odd one out" must force the child to state a rule that four items satisfy. |
| FR-LG-3 | Decomposition ("Step by step") must use real procedures and require ordering without drag-and-drop. |
| FR-LG-4 | Classification must be **rule-based and testable** (wheels / no wheels, even / odd …). |
| FR-LG-5 | "Find the bug" must corrupt a plan in one of two ways (a step from another plan, or a step in the wrong position). |
| FR-LG-6 | "Yes/No detective" must model **binary search**: live split counts per question, suspects removed as questions are asked. |

### 4.7 Python Lab — FR-PY

| ID | Requirement |
| --- | --- |
| FR-PY-1 | Level py1 is **reading only**: predict the output of a snippet from 4 options. |
| FR-PY-2 | From py2 the child **writes code** in an editor with a line gutter, Tab-indent, snippet buttons and a Run button. |
| FR-PY-3 | Written code is graded by **executing it against hidden tests** (expected stdout, optional simulated `input()`), not by string matching. |
| FR-PY-4 | Errors must be reported with the **real Python error name**, a kid-friendly explanation and the **line number**. |
| FR-PY-5 | The supported subset is: `print`, variables, `+ - * / // % **`, strings and lists with indexing/slicing, `if/elif/else`, `for … in range/list`, `while`, `break/continue`, `def`/`return`, `len/range/sum/min/max/str/int/round/abs/sorted`, common string and list methods, `import turtle` / `from turtle import *`, and `math`. Anything else must fail with a clear, non-scary message. |
| FR-PY-6 | Turtle drawing must render to a canvas and be gradeable (minimum segments, closed shape). |
| FR-PY-7 | The final level is a **mini project** with a brief, a starter and a success rule. |
| FR-PY-8 | Execution must be **sandboxed**: no DOM, network, filesystem or `eval` of host code; a step and time budget must stop runaway loops. |

### 4.8 Feedback, retry and scaffolding — FR-F

| ID | Requirement |
| --- | --- |
| FR-F-1 | Every exercise offers a **hint** written for the child. |
| FR-F-2 | Construction exercises (paint, robot, code, ordering) are **retryable**: a wrong answer never ends the exercise. |
| FR-F-3 | Multiple-choice exercises are single-shot but must **reveal the correct option** afterwards. |
| FR-F-4 | A wrong answer is counted **at most once per exercise**, so experimenting is not punished repeatedly. |
| FR-F-5 | After two failed attempts, a **"Show me the answer"** option appears where a worked answer exists. |
| FR-F-6 | Wrong-pixel feedback must **mark the offending cells** on the grid. |

### 4.9 Gamification — FR-G

| ID | Requirement |
| --- | --- |
| FR-G-1 | Correct answers award **XP**; total XP is shown in the top bar. |
| FR-G-2 | Each completed round earns **1–3 stars** from accuracy. |
| FR-G-3 | Mastering a level grants a bonus, a **mastery star** and unlocks the next level with an explicit "unlocked" message. |
| FR-G-4 | **Badges** are awarded automatically from progress rules (first steps, per-world mastery, combo, streak, gallery, volume). |
| FR-G-5 | A **combo** counter rewards consecutive correct answers. |
| FR-G-6 | Sound effects must exist for tap, correct, wrong, step, win, unlock and badge, and must be **switchable off**. |

### 4.10 Dashboard, gallery and settings — FR-D

| ID | Requirement |
| --- | --- |
| FR-D-1 | A dashboard must show XP, stars, mastered/total levels, accuracy, time played, practice days, per-world bars, all badges (locked ones greyed) and recent sessions. |
| FR-G-2… | *(see FR-G)* |
| FR-D-2 | A gallery must list saved pixel drawings and saved Python projects, allow viewing project code and deleting items. |
| FR-D-3 | Settings must allow renaming/avatar change, switching profile, and toggles for sound, animations, larger text and reduced motion. |
| FR-D-4 | Settings must expose export/import, storage usage, reset progress and delete profile behind confirmation dialogs. |

### 4.11 Accessibility & comfort — FR-A

| ID | Requirement |
| --- | --- |
| FR-A-1 | All interactive targets must be large enough for small hands (≥ 44 px on grids, ≥ 46 px swatches). |
| FR-A-2 | The app must be fully usable with **mouse, touch and keyboard** (every action is a real button). |
| FR-A-3 | Grids must expose an accessible label per cell ("column 3, row 2"). |
| FR-A-4 | Options: larger text, reduced motion, animations off, sound off. |
| FR-A-5 | Layout must be responsive from 320 px upwards and usable in landscape and portrait. |
| FR-A-6 | Colour is never the only signal (icons and text accompany colour). |

### 4.12 Safety & privacy — FR-S

| ID | Requirement |
| --- | --- |
| FR-S-1 | No data leaves the device. No cookies, no analytics, no external requests at runtime. |
| FR-S-2 | No third-party runtime, font or image is loaded — the app is fully offline-capable. |
| FR-S-3 | Child code cannot access the DOM, `fetch`, storage or `eval` of host JavaScript. |
| FR-S-4 | Destructive actions (delete profile, reset progress) require confirmation. |

---

## 5. Curriculum specification (delivered content)

| World | Levels | Core ideas |
| --- | --- | --- |
| 🎨 Pixel Lab (6+) | px1 Find the Pixel · px2 Paint by Coordinate · px3 Copy the Picture · px4 Sprite from Code · px5 Row Codes · px6 Pixel Artist | grid, (column,row) address, following instructions, copying, picture-as-data, compression, free creation |
| 🤖 Robot Lab (6+) | rb1 Go Robot · rb2 Turn Around · rb3 Route to the Flag · rb4 Collect the Gems · rb5 Repeat · rb6 Smart Robot · rb7 Robot Routines | sequence, state (facing), planning, world-changing actions, loops, conditions, functions |
| 🧩 Logic Lab (7+) | lg1 Patterns · lg2 Odd One Out · lg3 Step by Step · lg4 Sort It Out · lg5 Find the Bug · lg6 Yes/No Detective | rules, decomposition, classification, debugging, binary search |
| 🐍 Python Lab (9+) | py1 Read the Code · py2 Print & Text · py3 Variables & Maths · py4 Loops with for · py5 Decisions with if · py6 While & Input · py7 Lists & Functions · py8 Turtle Artist · py9 Mini Project | syntax, strings, variables, iteration, branching, exit conditions, data structures, drawing, projects |

Total: **28 levels**.

---

## 6. Mastery rule

A level is mastered when **both** conditions hold for the accumulated statistics of that level:

```
correctAnswers >= level.mastery.correct      # volume
correctAnswers / attempts >= level.mastery.accuracy   # quality
```

Stars for a round: `3` at ≥ 95 % accuracy, `2` at ≥ 80 %, `1` at ≥ the level's gate.
A level stays replayable after mastery; only the best star count is kept.

---

## 7. Acceptance criteria (release gate)

1. A brand-new visitor can create a profile and reach the first exercise in **under 3 taps**.
2. With localStorage cleared and the network disabled, the app still loads, plays and saves.
3. All 28 levels can be started, played to the results screen and replayed with different exercises.
4. No level can be opened before its prerequisite is mastered (direct URL is rejected with a message).
5. Two consecutive runs of the same level produce **different** exercise content; the same seed produces **identical** content.
6. Every generated robot world is solvable by its own reference solution.
7. Every Python task's reference solution passes its own tests.
8. Infinite loops and syntax errors in child code produce a friendly message, never a frozen tab.
9. Two profiles on the same device never share or overwrite each other's progress.
10. No console errors and no failed network requests during a full play-through.

---

## 8. Open questions / future work

* Should a parent PIN gate the settings screen? (Field exists, not enforced in v1.)
* Do we need a service worker for true offline install? (App is already network-free; SW is a small add.)
* Do we want teacher dashboards with many profiles and CSV export?
* Should we swap the built-in Python engine for Pyodide behind the same `run()` contract?
