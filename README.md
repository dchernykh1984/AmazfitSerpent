# Amazfit Serpent

**Snake Classic** is the classic snake game as a **Zepp OS mini app** for round
Amazfit watches. Swipe to steer, eat the pellet, grow, and try not to bite yourself
or the wall. Everything runs on the watch: no phone, no network, no account.

(The repository is named `AmazfitSerpent`; **Snake Classic** is the name the app is
registered under in the Zepp App Store.)

- **Board** - a 15x15 grid inscribed in the round screen, with the score in the cap
  above it and the pause button in the cap below.
- **Controls** - swipe up / down / left / right to turn. A reversal into your own
  neck is refused rather than fatal. Swipes are swallowed while a game runs, so a
  hard right turn cannot back you out of the app; from any menu, swipe right to
  leave.
- **Difficulty** - Slow, Normal or Fast, picked on the start screen (tap the button
  or swipe up/down). Whichever level you played last is the one that opens next
  time. The snake also creeps faster as it grows, down to a floor per level.
- **High score** - kept per difficulty in on-watch storage, so beating your record
  on Fast means something.
- **Languages** - the on-watch text is localized into the same 11 languages as the
  sibling [AmazfitRaceStats](https://github.com/dchernykh1984/AmazfitRaceStats) app:
  English, Russian, German, French, Italian, Spanish, Portuguese, Dutch, Polish,
  Czech and Kazakh. Zepp OS has no device-language code for Kazakh, so that table is
  carried ready but never auto-selected; unknown languages fall back to English.

## Devices

Round watches only, built for both round resolutions: **466** (GTR 4, Active 2
Round, Balance, Cheetah, ...) and **480** (T-Rex 3, Balance 2, ...). The layout is
derived from the screen diameter, so both sizes get the same game with correctly
sized cells. Square devices are intentionally out of scope.

## Setup

```bash
git clone https://github.com/dchernykh1984/AmazfitSerpent.git
cd AmazfitSerpent
npm install
```

## Develop

```bash
npm test          # run the unit tests (Vitest)
npm run lint      # ESLint
npm run format    # rewrite files with Prettier
npm run preview   # QR-preview on a device via the Zepp app in Developer Mode
npm run build     # produce the .zab store bundle
```

`preview` and `build` fetch the [Zeus CLI](https://docs.zepp.com/docs/guides/quick-start/)
on demand (`npx`), so it is not tracked as a dependency; the first run downloads it.
The Zeus CLI needs **Node 18 or 20** - on newer Node it fails to resolve its own
modules. The app itself ships **no runtime dependencies**: it uses only the `@zos/*`
modules the watch provides.

### Layout of the code

```
app.json                 manifest (round 466 + 480, one page module)
app.js                   app entry
lib/                     PURE, unit-tested logic (no Zepp OS imports)
  snake.js               the rule set: movement, growth, collisions, food
  board.js               the grid inscribed in the round screen
  round-geometry.js      chord maths that keeps text and buttons off the bezel
  speed.js               difficulty levels and the tick pacing
  scores.js              the persisted high score, per difficulty
  i18n/                  keys.js (the contract), labels.js (11 tables), index.js
scripts/                 sync-app-version.mjs, the app.json version writer
page/index.js            the watch screen: drawing, gestures, the game loop
page/index.r.layout.js   the layout module Zepp OS requires per page
utils/config/            device.js (screen size), constants.js (grid, colors)
assets/common.r/icon.png the app icon
test/                    Vitest unit tests
```

The split is deliberate: every rule and every measurement lives in `lib/`, where a
test can reach it without a watch, and `page/index.js` only turns that into widgets
and reacts to swipes. A step redraws just the three cells that changed, rather than
repainting the board, so the game keeps up at the fastest level.

### App identity

The app is registered in the [Zepp developer console](https://console.zepp.com/) as
**Snake Classic**, appId **`1122445`** - both live in `app.json`. Keep them as they
are: the dev preview and `zeus dev` are cloud-mediated, and an appId that is not
registered to the signed-in account makes the watch install the app but silently
refuse to launch its screen, with no error to go on.

## Pre-commit hooks (contributors)

```bash
uv tool install pre-commit   # or: pipx install pre-commit
pre-commit install
```

After that the hooks run automatically: Prettier and ESLint and a non-ASCII guard on
commit, Conventional Commits validation on the commit message, and the unit tests on
push. The non-ASCII guard skips `lib/i18n/`, which legitimately holds translated
text.

## Continuous integration and releases

Every pull request must pass the required checks: Prettier, ESLint, the unit tests,
`npm run version:check` (that `app.json` still names the version being released),
`actionlint`, commitizen (Conventional Commits), and an OSV dependency scan.

Releases are automated with `release-please`: it maintains a version-bump PR from the
Conventional Commits and, when merged, tags a GitHub Release. The release build
workflow then produces the `.zab` store bundle and attaches it. Uploading the `.zab`
to the Zepp App Store stays manual, because Zepp has no public publish API.

### Two version numbers

A Zepp app carries its version in `app.json`, not in `package.json`: `version.name` is
what a person sees in the store and on the watch, and `version.code` is an integer the
store insists must grow with every upload or it refuses the build. Neither is what
`release-please` bumps.

They are kept in step from `package.json`, which is the one `release-please` does own:

- `release-please` writes `version.name` into `app.json` in the release PR itself
  (`extra-files` in `release-please-config.json`), so the repository never claims a
  version it did not release.
- `npm run version:sync` writes both numbers, deriving the code as
  `major * 10000 + minor * 100 + patch`. The release build runs it before `zeus build`,
  so a bundle built in CI and one built on a laptop carry the same numbers. It refuses
  a version it cannot pack - a minor or patch of 100 or more would produce a code that
  sorts below one already in the store.
- `npm run version:check` fails if `app.json` and `package.json` disagree on the name,
  and runs on every pull request. The code is not checked there: `release-please`
  cannot compute it, so between the release PR and the build it is legitimately one
  release behind.

`app.json` is in `.prettierignore` for the same reason - `release-please` rewrites it
with its own JSON formatter, which spreads arrays over lines Prettier would keep
together, and the two would fight on every release PR.

## License

Released under the [MIT License](LICENSE).
