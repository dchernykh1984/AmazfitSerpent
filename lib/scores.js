// The persisted high score, kept pure so the storage contract is unit tested. The
// page owns the actual LocalStorage handle; this module owns the key names and
// the "is this a record" decision.

// A best score is kept per difficulty level: beating your record on Fast says
// something different from beating it on Slow.
const BEST_KEY_PREFIX = "best_";

// Where the last chosen difficulty is remembered, so the game reopens the way it
// was left.
export const LEVEL_KEY = "speedLevel";

export function bestKey(level) {
  return BEST_KEY_PREFIX + level;
}

// A stored value coerced to a usable score. Storage can hand back a string, null
// or leftover junk from an older build; none of that may crash the game or show
// up on screen, so anything unusable reads as zero.
export function normalizeScore(value) {
  const score = Math.floor(Number(value));
  if (!Number.isFinite(score) || score < 0) {
    return 0;
  }
  return score;
}

// The best score after a finished game, and whether it is a new record. A game
// that scored nothing is never a record, so an accidental launch cannot announce
// one on a fresh install.
export function updateBest(previousBest, score) {
  const best = normalizeScore(previousBest);
  const final = normalizeScore(score);
  if (final > best && final > 0) {
    return { best: final, isRecord: true };
  }
  return { best, isRecord: false };
}
