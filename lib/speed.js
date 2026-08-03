// Difficulty levels and the tick pacing. Pure, so the speed curve is unit tested
// rather than guessed at from how the watch feels.

// Each level is a starting tick interval in milliseconds and the floor it may
// accelerate to. `label` is the i18n key the settings button shows.
export const LEVELS = [
  { id: "slow", label: "speed_slow", baseMs: 340, minMs: 220 },
  { id: "normal", label: "speed_normal", baseMs: 240, minMs: 150 },
  { id: "fast", label: "speed_fast", baseMs: 160, minMs: 100 },
];

export const DEFAULT_LEVEL = 1;

// How much of the tick interval each step of the ramp shaves off, and how many
// points earn one step. The snake creeping faster as it grows is what turns a
// long game into a tense one.
const RAMP_EVERY_POINTS = 5;
const RAMP_STEP_MS = 10;

// Clamp a stored or user-supplied level into the range of LEVELS; anything
// unusable falls back to the default rather than leaving the game without pacing.
// Nothing-at-all is checked before the numeric coercion, because Number(null) and
// Number("") are both 0 - a fresh install would otherwise silently start on the
// first level instead of the default one.
export function clampLevel(level) {
  if (level === null || level === undefined || level === "") {
    return DEFAULT_LEVEL;
  }
  const index = Math.floor(Number(level));
  if (!Number.isFinite(index) || index < 0 || index >= LEVELS.length) {
    return DEFAULT_LEVEL;
  }
  return index;
}

// The next level in the cycle, so one button can walk through all of them.
export function nextLevel(level) {
  return (clampLevel(level) + 1) % LEVELS.length;
}

// The milliseconds to wait before the next step, at this level and score. The
// interval shortens by RAMP_STEP_MS for every RAMP_EVERY_POINTS scored and never
// drops below the level's floor, so the game stays playable however long it runs.
export function tickInterval(level, score) {
  const config = LEVELS[clampLevel(level)];
  const points = Number.isFinite(Number(score)) ? Math.max(0, Math.floor(Number(score))) : 0;
  const ramped = config.baseMs - Math.floor(points / RAMP_EVERY_POINTS) * RAMP_STEP_MS;
  return Math.max(config.minMs, ramped);
}
