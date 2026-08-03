// Every string the watch screen can show, as a key. This is the contract each
// language table must satisfy: the locale-completeness unit test fails if a table
// is missing a key or carries one that is not here.
export const UI_KEYS = [
  "title",
  "score",
  "best",
  "play",
  "pause",
  "resume",
  "again",
  "paused",
  "game_over",
  "new_best",
  "speed",
  "speed_slow",
  "speed_normal",
  "speed_fast",
  "hint",
];

// The on-watch character budgets. Everything is drawn on a round screen with no
// auto-shrinking, so a label that overruns its box is simply clipped. `hint` is
// a full sentence under the menu and gets a wider allowance than the words that
// sit on buttons and in the score cap.
export const MAX_LABEL = 12;
export const MAX_HINT = 20;
export const LONG_KEYS = ["hint"];

export function budgetFor(key) {
  return LONG_KEYS.indexOf(key) === -1 ? MAX_LABEL : MAX_HINT;
}
