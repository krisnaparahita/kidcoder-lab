# 🧩 KidCoder Lab

**Learn to code one step at a time, starting at age 6.** Kids work through four worlds in a fixed order: pixel coordinates, robot commands, logic puzzles, and finally real Python.

**Live:** [kidcoder.web.id](https://kidcoder.web.id)

[![CI](https://github.com/krisnaparahita/kidcoder-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/krisnaparahita/kidcoder-lab/actions/workflows/ci.yml)
![No build step](https://img.shields.io/badge/build-none-brightgreen)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

---

## Why it exists

Most "coding for kids" apps are games with no real progression. KidCoder Lab is built around one rule: **you can't skip the fundamentals.** Each level stays locked until the previous one is mastered. Every practice round is generated fresh from a random seed, so replaying a level means solving new problems, not remembering old answers.

## The four worlds

| World | Age | Levels | What kids learn |
| --- | --- | --- | --- |
| 🎨 **Pixel Lab** | 6+ | 6 | Find the Pixel, Paint by Coordinate, Copy the Picture, Sprite from Code, Row Codes, Pixel Artist |
| 🤖 **Robot Lab** | 6+ | 7 | Go Robot!, Turn Around, Route to the Flag, Collect the Gems, Repeat Repeat, Smart Robot (if), Robot Routines (procedures) |
| 🧠 **Logic Lab** | 7+ | 6 | Patterns, Odd One Out, Step by Step, Sort It Out, Find the Bug, Yes/No Detective |
| 🐍 **Python Lab** | 9+ | 9 | Read the Code, print, variables, `for`, `if`, `while` & `input`, lists & functions, turtle graphics, mini project |

A world opens once the kid has mastered 3 levels of the world before it. Age bands are only suggestions and never block progress.

## Features

- **Mastery gates.** A level needs both a minimum number of correct answers and a minimum accuracy. Locks are checked on every navigation, so typing a URL by hand won't skip ahead.
- **Infinite, deterministic practice.** Exercises are generated from `(level, seed)`. Robot worlds are always solvable because the generator keeps the path it walked as the solution.
- **Real Python, instantly.** MiniPy is a built-in Python-subset interpreter: indentation-aware, with real error names (`NameError`, `IndentationError`, …), kid-friendly hints, a turtle module, and step/time limits so a runaway loop can't freeze the tab.
- **Specific feedback.** "You missed 2 gems", expected vs. actual output, the error line, and the solution shown after repeated failures.
- **Several kids, one device.** Profiles with avatars, XP, stars, badges, streaks, a gallery and a parent dashboard. Each profile can be exported to and imported from a JSON file.
- **Private by design.** No accounts, no server, no analytics, no cookies, no third-party requests. Everything is stored in the browser's `localStorage`.
- **Lightweight.** About 120 KB of plain JavaScript and CSS, with no framework, no bundler and no build step. It also runs straight from `file://`.

## Quick start

```bash
git clone https://github.com/krisnaparahita/kidcoder-lab.git
cd kidcoder-lab
npm start            # serves the folder on http://localhost:3000
```

There's nothing to install. You can also just open `index.html` in a browser, or use any static server (`python3 -m http.server`).

## Tests

Requires Node.js 18 or newer for the unit tests, and Node 22 plus Chrome for the browser test. There are no dependencies to install.

```bash
npm test             # unit/smoke tests (node:test)
npm run test:e2e     # headless Chrome end-to-end test, run with the production headers and CSP
npm run verify       # everything CI runs: syntax, ES5 lint, unit, e2e
```

- **Unit:** loads the engines and curriculum in a sandbox, generates every level across 12 seeds, and checks that each robot and Python reference solution passes its own `grade()`. It also checks MiniPy's error names.
- **E2E:** serves the deployable files with the same headers as `vercel.json`, then drives headless Chrome through the profile picker, every screen, a real practice round, the lock on deep links, and all 432 sampled exercises. It fails on any page error, console error or CSP violation.

## CI/CD and workflow

`main` only changes through pull requests, and **merging is always manual**.

| Check (GitHub Actions) | What it verifies |
| --- | --- |
| `lint` | syntax, app code is plain ES5, configs are valid JSON, no third-party URLs |
| `unit (node 18/20/22)` | smoke tests on three Node versions |
| `e2e (headless chrome)` | full browser run under the production CSP |
| `commit authors` | every PR commit is authored by `krisnaparahita`, with no co-author trailers |
| `Vercel` | the preview deployment builds; the preview URL is posted on the PR |

Branch protection on `main` requires all of these checks to pass. When a PR is merged, Vercel deploys production to kidcoder.web.id.

## Project structure

```
index.html          entry point; plain <script> tags, load order matters
css/                theme tokens + screen/widget styles
js/core/            util (RNG, DOM builder), storage, audio, progress rules, router
js/engines/         pixel grid, robot simulator, MiniPy interpreter
js/data/            curriculum (single source of truth), sprites, exercise generators
js/ui/              screens, level runner, per-world renderers
test/               Node smoke tests
docs/               requirements + architecture documents
```

Layers only depend downward: UI → learning rules → engines → platform. See [`docs/architecture.md`](docs/architecture.md) for the full design and [`docs/requirements.md`](docs/requirements.md) for the functional spec.

### Adding content

- **New level:** add an entry to `LEVELS` in `js/data/curriculum.js` that points at an existing generator.
- **New exercise type:** write a generator (`App.Exercises.register(type, variant, fn)`) and a renderer (`App.Renderers[type]`), then reference it from the curriculum.

## Deployment (Vercel)

The site is deployed on Vercel as the project **`kidcoder-lab`**, with the custom domain `kidcoder.web.id`.

- Merging a PR into `main` deploys to production. Every pull request gets its own preview URL.
- [`vercel.json`](vercel.json) turns off the build and install steps (the repo root is the output), and sets security headers (strict CSP, `nosniff`, `DENY` framing, a locked-down Permissions-Policy) and cache rules (`index.html` is always revalidated, and JS/CSS is cached for 1 hour).
- [`.vercelignore`](.vercelignore) keeps docs, tests and repo metadata out of the deployment, so only `index.html`, `css/`, `js/` and `assets/` get published.

Manual deploy from the CLI:

```bash
npx vercel link --project kidcoder-lab   # once
npx vercel            # preview
npx vercel --prod     # production
```

Any other static host works too (GitHub Pages, Netlify, Nginx, S3). Serve over HTTPS so each origin gets its own `localStorage`.

## Privacy

KidCoder Lab never sends data anywhere. Progress lives only in the browser it was created in. Clearing site data erases it, so use **Settings → Export** to back up a profile.

## Known limitations

- MiniPy covers the subset the lessons teach. It has no classes, dicts, comprehensions, `try/except` or f-strings.
- Progress doesn't sync across devices; use export/import to move it.
- The parent PIN is stored but not enforced in v1.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © krisnaparahita
