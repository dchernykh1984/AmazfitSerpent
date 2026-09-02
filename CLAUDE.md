# Working on Amazfit Serpent

Snake as a Zepp OS mini app for **round** Amazfit watches. Published in the Zepp
App Store as **Snake Classic**, appId `1122445`. Round screens only: the build
targets 466 and 480, and there is no square variant on purpose.

Everything runs on the watch. No side service, no phone settings screen, no
network, and no runtime dependencies - only the `@zos/*` modules the firmware
provides.

## Commands

```bash
npm test            # vitest, including the page driven through doubles
npm run lint        # eslint
npm run format      # prettier --write
npm run format:check
npm run build       # zeus build -> the .zab store bundle
npm run preview     # QR preview on a real watch via Developer Mode
```

The Zeus CLI needs **Node 18 or 20**; on newer Node it fails to resolve its own
modules. A tool shell may not have the right Node on PATH - check `node --version`
before blaming the build.

## How the code is organised

The rule that matters: **every rule and every measurement lives in `lib/`, free of
Zepp OS imports, so a test can reach it without a watch.** `page/index.js` only
turns that into widgets and reacts to input.

| Path                    | Owns                                                      |
| ----------------------- | --------------------------------------------------------- |
| `lib/snake.js`          | movement, growth, wall and self collision, food placement |
| `lib/board.js`          | the grid inscribed in the round screen                    |
| `lib/controls.js`       | where the arrows and pause sit, and what a tap hit        |
| `lib/arrow.js`          | the arrow and pause icons, as stroke primitives           |
| `lib/round-geometry.js` | chord maths keeping content off the bezel                 |
| `lib/speed.js`          | difficulty levels and tick pacing                         |
| `lib/scores.js`         | the persisted best score, per difficulty                  |
| `lib/i18n/`             | `keys.js` (the contract), `labels.js` (11 tables)         |
| `page/index.js`         | drawing, input, the game loop                             |
| `utils/config/`         | screen size, colours, grid constants                      |

`page/index.r.layout.js` exists only because Zepp OS demands a layout module per
page; the page draws imperatively, so it exports an empty object.

## Testing

`vitest.config.mjs` aliases every `@zos/*` module to a hand-written double in
`test/doubles/`, which is what lets the tests build the page, tap it, swipe it and
assert on what it drew. When you add a Zepp API to the page, add it to the double.

The UI double records canvas draw calls in order and can answer "what is drawn in
this box" - that is how the arrows are tested without a screen.

## What CI enforces

Every pull request must pass: prettier, eslint, the unit tests, `actionlint`,
commitizen, an OSV dependency scan, and a check that `app.json` and `package.json`
agree on the version.

- **Conventional Commits**, single-line subject. Longer rationale goes in the pull
  request description, not the commit body.
- **Source and config stay ASCII.** The non-ASCII guard covers `*.js *.mjs *.json
*.md *.yml`. `lib/i18n/` is excluded, because on-watch translations legitimately
  are not ASCII - so a new user-facing string goes there, never inline.

## Zepp OS traps that have already cost time

- **No orphan `.js` anywhere.** Zeus globs `**/*.js`; a file not reachable from an
  app entry becomes an extra Rollup chunk and the build dies. Dev-only files are
  `.mjs` (`eslint.config.mjs`, `vitest.config.mjs`, `test/*.test.mjs`). Files under
  `test/doubles/` are fine as `.js` - they are outside what Zeus globs.
- **`zeus dev` and `zeus build` rewrite `.gitignore` and `app.json`.** Record
  `git hash-object .gitignore` before, and `git checkout --` whatever they touched
  after. Never make `.gitignore` read-only: Zeus then dies with EPERM.
- **A listening canvas swallows touches**, even where a button is drawn on top of
  it. So the control canvas is deleted whenever a menu opens, or Resume and Again
  are dead. Text widgets over a canvas are fine; buttons are not.
- **Canvas z-order is creation order.** The control canvas is created before the
  board cells, and the whole board is rebuilt when a game resumes, so nothing is
  left behind the canvas.
- **A canvas keeps no scene graph.** "Unpressing" a control means painting its box
  over and drawing it again; moving anything means repainting what it was on.
- **`drawPoly` is not trustworthy.** The sibling Sokoban app found it accepted
  without complaint on a real watch and then drawing nothing at all, and abandoned
  it. The sibling Hex app now ships with it working. Treat it as unproven: prefer
  `drawRect`, `drawCircle` and `drawLine`, which are known good, and verify on
  hardware before relying on it.
- **A widget handle is opaque.** It has no readable properties on a real watch,
  however freely the test double lets one be read - so keep any state you need to
  read back (a canvas height, a pressed control) in `state`, not on the widget.
- **The version in `app.json` is not authoritative.** The build workflow derives
  `version.name` and `version.code` from `package.json` at build time, because
  release-please reformats `app.json` in a way prettier rejects.

## Pull requests, review and release

Branch protection on `main`: merges are **rebase only**, linear history, and one
approving review is required. You cannot approve your own pull request, so merging
your own work needs `gh pr merge <n> --rebase --admin`. Ask before using it.

Releases go through release-please: merging to `main` maintains a release pull
request; merging that tags a release and the build workflow attaches the `.zab`.

Two things bite every time:

- Workflow runs on a **bot-authored** pull request sit in `action_required` until
  approved: `gh api -X POST repos/<owner>/<repo>/actions/runs/<id>/approve`.
- The release branch is **sticky**. If `main` moves after the release pull request
  exists, the branch is not rebased and its checks go stale. The fix is to delete
  the release branch and re-run the Release Please workflow, which rebuilds it from
  current `main`.

## Agent tooling in this repository

`.claude/settings.json` carries the shared permission allowlist (read-only and
local commands only) and one hook: after an edit, `scripts/format-edited.mjs` runs
prettier on the file that changed, so `format:check` cannot fail in CI over
something written a moment ago. Per-machine settings stay in
`.claude/settings.local.json`, which is the only part of `.claude/` that is
git-ignored.

## Skills in this repository

- `.claude/skills/review-cycle` - running a review pass and landing the fixes.
- `.claude/skills/zepp-release` - cutting a release end to end.
- `.claude/skills/zepp-simulator` - running the app on the emulator and capturing
  the screen from a background process.
- `.claude/skills/zepp-store-assets` - what the Zepp store demands of screenshots
  and icons, and how to produce them.
