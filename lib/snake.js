// The whole game rule set, as plain data and functions with no Zepp OS
// dependency, so every rule is exercised by the unit tests rather than by
// squinting at a watch. The page owns pixels and input; this module owns truth.
//
// A game is a mutable plain object (the snake moves 5-10 times a second, so
// rebuilding the body array on every tick would be wasted work). `step` returns a
// small summary of what changed - the new head cell, the tail cell that was
// vacated, whether food was eaten - which is exactly what the page needs to
// redraw incrementally instead of repainting the whole board.

// Directions, as indexes into VECTORS. The order is clockwise, so the opposite of
// a direction is `(direction + 2) % 4`.
export const UP = 0;
export const RIGHT = 1;
export const DOWN = 2;
export const LEFT = 3;

const VECTORS = [
  { dx: 0, dy: -1 }, // UP
  { dx: 1, dy: 0 }, // RIGHT
  { dx: 0, dy: 1 }, // DOWN
  { dx: -1, dy: 0 }, // LEFT
];

// Game states. WON is reachable only by filling every cell of the board; it is
// treated as a win rather than a crash so a perfect game ends gracefully.
export const RUNNING = "running";
export const OVER = "over";
export const WON = "won";

// Why a game ended, so the page can say something more useful than "over".
export const HIT_WALL = "wall";
export const HIT_SELF = "self";

// How long the snake is at the start. Clamped on tiny boards so the body always
// fits in its starting row.
export const START_LENGTH = 3;

export function opposite(direction) {
  return (direction + 2) % 4;
}

export function isDirection(direction) {
  return Number.isInteger(direction) && direction >= 0 && direction < VECTORS.length;
}

// Whether any part of the snake sits on the given cell. The tail is skipped when
// `ignoreTail` is set: on a move that does not grow the snake, the tail cell is
// vacated in the same tick, so the head may legally take it.
export function occupies(game, x, y, ignoreTail) {
  const last = game.snake.length - 1;
  for (let i = 0; i < game.snake.length; i++) {
    if (ignoreTail && i === last) {
      continue;
    }
    if (game.snake[i].x === x && game.snake[i].y === y) {
      return true;
    }
  }
  return false;
}

// A uniformly random free cell, or null when the snake fills the board. Picking
// from the list of free cells (rather than retrying random cells) keeps the cost
// bounded and stays fair when the board is nearly full.
export function placeFood(game) {
  const taken = {};
  for (let i = 0; i < game.snake.length; i++) {
    taken[game.snake[i].y * game.cols + game.snake[i].x] = true;
  }
  const free = [];
  const total = game.cols * game.rows;
  for (let index = 0; index < total; index++) {
    if (!taken[index]) {
      free.push(index);
    }
  }
  if (free.length === 0) {
    return null;
  }
  const pick = free[Math.min(free.length - 1, Math.floor(game.random() * free.length))];
  return { x: pick % game.cols, y: Math.floor(pick / game.cols) };
}

// A fresh game: the snake lies horizontally across the middle row facing right,
// with the first food already placed. `random` is injectable so the tests can run
// a deterministic game; on the watch it is Math.random.
export function createGame(cols, rows, random) {
  const width = Math.max(2, Math.floor(cols));
  const height = Math.max(2, Math.floor(rows));
  const row = Math.floor(height / 2);
  const headColumn = Math.floor(width / 2);
  const length = Math.max(1, Math.min(START_LENGTH, headColumn + 1));

  const snake = [];
  for (let i = 0; i < length; i++) {
    snake.push({ x: headColumn - i, y: row });
  }

  const game = {
    cols: width,
    rows: height,
    snake,
    direction: RIGHT,
    pending: RIGHT,
    food: null,
    score: 0,
    status: RUNNING,
    reason: null,
    random: typeof random === "function" ? random : Math.random,
  };
  game.food = placeFood(game);
  return game;
}

// Queue a turn for the next step. A reversal is refused, because the head would
// run straight into the neck and end the game on a stray swipe. The check is
// against the direction the last step actually used, not the queued one, so two
// quick swipes inside a single tick cannot combine into a reversal. Returns
// whether the turn was accepted.
export function setDirection(game, direction) {
  if (game.status !== RUNNING || !isDirection(direction)) {
    return false;
  }
  if (direction === game.direction || direction === opposite(game.direction)) {
    return false;
  }
  game.pending = direction;
  return true;
}

// Advance the game one tick and report what changed:
//   { status, head, removed, ate, food, reason }
// `head` is the cell the head moved into, `removed` the tail cell it vacated
// (null when the snake grew), `food` the newly placed food (null unless eaten).
// On a crash the snake is left exactly as it was, so the page can leave the
// wreck on screen underneath the game-over text.
export function step(game) {
  if (game.status !== RUNNING) {
    return { status: game.status, head: null, removed: null, ate: false, food: null, reason: null };
  }

  game.direction = game.pending;
  const vector = VECTORS[game.direction];
  const head = game.snake[0];
  const next = { x: head.x + vector.dx, y: head.y + vector.dy };

  if (next.x < 0 || next.y < 0 || next.x >= game.cols || next.y >= game.rows) {
    game.status = OVER;
    game.reason = HIT_WALL;
    return { status: OVER, head: null, removed: null, ate: false, food: null, reason: HIT_WALL };
  }

  const ate = game.food !== null && next.x === game.food.x && next.y === game.food.y;
  if (occupies(game, next.x, next.y, !ate)) {
    game.status = OVER;
    game.reason = HIT_SELF;
    return { status: OVER, head: null, removed: null, ate: false, food: null, reason: HIT_SELF };
  }

  game.snake.unshift(next);
  let removed = null;
  let food = null;
  if (ate) {
    game.score += 1;
    game.food = placeFood(game);
    food = game.food;
    if (game.food === null) {
      // Every cell is snake: there is nowhere left to put food, which is the
      // perfect game rather than a failure.
      game.status = WON;
    }
  } else {
    removed = game.snake.pop();
  }

  return { status: game.status, head: next, removed, ate, food, reason: game.reason };
}
