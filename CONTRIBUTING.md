# Contributing to KidCoder Lab

Thanks for helping kids learn to code!

## Ground rules

- **No build step, no dependencies.** The app is plain ES5-style JavaScript loaded with classic `<script>` tags. Please keep it that way, so it keeps running from `file://` and on old school tablets.
- **No network calls at runtime.** No CDNs, analytics, fonts or trackers. The Content-Security-Policy in `vercel.json` blocks them anyway.
- **Respect the layers.** UI (`js/ui`) → learning rules (`progress`, `curriculum`, `registry`) → engines (`js/engines`) → platform (`util`, `storage`, `audio`). Engines never touch the DOM, and renderers never grade.
- **Kid-first UX.** One idea per screen, large tap targets, tap-only interactions, and friendly error messages.

## Workflow

1. Fork and create a branch: `git checkout -b feat/my-change`
2. Run the app locally: `npm start` (or open `index.html`)
3. Run the checks: `npm run verify` (the same checks CI runs)
4. Open a pull request into `main`. CI must pass, and Vercel posts a preview URL you can try on a phone or tablet. A maintainer merges manually.

## Adding exercises

- Generators are pure functions `(level, rng, index, options) → exercise` and must expose `grade(attempt)`.
- Use the provided `rng` only (never `Math.random`), so a seed always reproduces the same exercise.
- Give Python and robot exercises a `solution`. The test suite checks that every reference solution passes its own grader.

## Commit style

Short, imperative subject lines (`Add while-loop countdown variant`). Explain the *why* in the body when it isn't obvious.
