import { describe, it, expect } from "vitest";
import {
  createGame,
  setDirection,
  step,
  placeFood,
  occupies,
  opposite,
  isDirection,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  RUNNING,
  OVER,
  WON,
  HIT_WALL,
  HIT_SELF,
  START_LENGTH,
} from "../lib/snake.js";

// A deterministic stand-in for Math.random, cycling through fixed fractions so a
// test can pin exactly where food lands.
function fakeRandom(values) {
  let i = 0;
  return () => {
    const value = values[i % values.length];
    i += 1;
    return value;
  };
}

// Hand-build a game so a test can start from an arbitrary board position.
function gameAt(snake, options) {
  const config = options || {};
  return {
    cols: config.cols || 5,
    rows: config.rows || 5,
    snake,
    direction: config.direction === undefined ? RIGHT : config.direction,
    pending: config.pending === undefined ? config.direction : config.pending,
    food: config.food === undefined ? null : config.food,
    score: 0,
    status: RUNNING,
    reason: null,
    random: config.random || (() => 0),
  };
}

describe("createGame", () => {
  it("lays the snake across the middle row facing right", () => {
    const game = createGame(15, 15, () => 0);
    expect(game.snake.length).toBe(START_LENGTH);
    expect(game.snake[0]).toEqual({ x: 7, y: 7 });
    expect(game.snake[START_LENGTH - 1]).toEqual({ x: 7 - (START_LENGTH - 1), y: 7 });
    expect(game.direction).toBe(RIGHT);
    expect(game.pending).toBe(RIGHT);
    expect(game.score).toBe(0);
    expect(game.status).toBe(RUNNING);
  });

  it("places the first food on a free cell", () => {
    for (let seed = 0; seed < 20; seed++) {
      const game = createGame(15, 15, fakeRandom([seed / 20]));
      expect(occupies(game, game.food.x, game.food.y, false)).toBe(false);
      expect(game.food.x).toBeGreaterThanOrEqual(0);
      expect(game.food.x).toBeLessThan(game.cols);
      expect(game.food.y).toBeGreaterThanOrEqual(0);
      expect(game.food.y).toBeLessThan(game.rows);
    }
  });

  it("shortens the starting body rather than hanging it off a tiny board", () => {
    const game = createGame(2, 2, () => 0);
    for (const cell of game.snake) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
    }
    expect(game.snake.length).toBeLessThanOrEqual(START_LENGTH);
  });
});

describe("directions", () => {
  it("pairs each direction with its opposite", () => {
    expect(opposite(UP)).toBe(DOWN);
    expect(opposite(DOWN)).toBe(UP);
    expect(opposite(LEFT)).toBe(RIGHT);
    expect(opposite(RIGHT)).toBe(LEFT);
  });

  it("recognizes only the four directions", () => {
    expect(isDirection(UP)).toBe(true);
    expect(isDirection(LEFT)).toBe(true);
    expect(isDirection(4)).toBe(false);
    expect(isDirection(-1)).toBe(false);
    expect(isDirection("up")).toBe(false);
  });
});

describe("setDirection", () => {
  it("accepts a perpendicular turn", () => {
    const game = createGame(15, 15, () => 0);
    expect(setDirection(game, UP)).toBe(true);
    expect(game.pending).toBe(UP);
  });

  it("refuses a reversal, which would drive the head into the neck", () => {
    const game = createGame(15, 15, () => 0);
    expect(setDirection(game, LEFT)).toBe(false);
    expect(game.pending).toBe(RIGHT);
  });

  it("refuses the direction already being travelled", () => {
    const game = createGame(15, 15, () => 0);
    expect(setDirection(game, RIGHT)).toBe(false);
  });

  it("cannot be tricked into a reversal by two swipes inside one tick", () => {
    const game = createGame(15, 15, () => 0);
    expect(setDirection(game, UP)).toBe(true);
    // Travelling right still, so a left turn stays illegal even though the queued
    // turn is upward.
    expect(setDirection(game, LEFT)).toBe(false);
    expect(game.pending).toBe(UP);
  });

  it("ignores junk and turns after the game has ended", () => {
    const game = createGame(15, 15, () => 0);
    expect(setDirection(game, 7)).toBe(false);
    expect(setDirection(game, null)).toBe(false);
    game.status = OVER;
    expect(setDirection(game, UP)).toBe(false);
  });
});

describe("step", () => {
  it("moves the head one cell and frees the tail", () => {
    const game = createGame(15, 15, () => 0);
    const tail = game.snake[game.snake.length - 1];
    const result = step(game);
    expect(result.head).toEqual({ x: 8, y: 7 });
    expect(result.removed).toEqual(tail);
    expect(result.ate).toBe(false);
    expect(game.snake.length).toBe(START_LENGTH);
    expect(game.snake[0]).toEqual({ x: 8, y: 7 });
    expect(game.status).toBe(RUNNING);
  });

  it("applies the queued turn", () => {
    const game = createGame(15, 15, () => 0);
    setDirection(game, UP);
    step(game);
    expect(game.direction).toBe(UP);
    expect(game.snake[0]).toEqual({ x: 7, y: 6 });
  });

  it("grows and scores on food, and puts new food somewhere free", () => {
    const game = gameAt([{ x: 1, y: 1 }], { food: { x: 2, y: 1 }, direction: RIGHT });
    const result = step(game);
    expect(result.ate).toBe(true);
    expect(result.removed).toBe(null);
    expect(game.score).toBe(1);
    expect(game.snake.length).toBe(2);
    expect(occupies(game, game.food.x, game.food.y, false)).toBe(false);
    expect(result.food).toEqual(game.food);
  });

  it("ends the game at a wall and leaves the wreck in place", () => {
    const game = gameAt([{ x: 0, y: 2 }], { direction: LEFT });
    const before = game.snake.slice();
    const result = step(game);
    expect(result.status).toBe(OVER);
    expect(result.reason).toBe(HIT_WALL);
    expect(game.status).toBe(OVER);
    expect(game.reason).toBe(HIT_WALL);
    expect(game.snake).toEqual(before);
  });

  it("ends the game on the snake's own body", () => {
    const snake = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    const game = gameAt(snake, { direction: LEFT, pending: DOWN, food: { x: 4, y: 4 } });
    const result = step(game);
    expect(result.status).toBe(OVER);
    expect(result.reason).toBe(HIT_SELF);
  });

  it("lets the head take the tail cell it vacates in the same tick", () => {
    const snake = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const game = gameAt(snake, { direction: LEFT, pending: DOWN, food: { x: 4, y: 4 } });
    const result = step(game);
    expect(game.status).toBe(RUNNING);
    expect(result.head).toEqual({ x: 1, y: 2 });
    expect(result.removed).toEqual({ x: 1, y: 2 });
    expect(game.snake.length).toBe(4);
  });

  it("is a no-op once the game is over", () => {
    const game = gameAt([{ x: 0, y: 2 }], { direction: LEFT });
    step(game);
    const after = game.snake.slice();
    const result = step(game);
    expect(result.status).toBe(OVER);
    expect(result.head).toBe(null);
    expect(game.snake).toEqual(after);
  });

  it("wins rather than crashing when the snake fills the board", () => {
    const game = createGame(2, 2, () => 0);
    setDirection(game, UP);
    step(game);
    setDirection(game, LEFT);
    step(game);
    setDirection(game, DOWN);
    step(game);
    expect(game.status).toBe(WON);
    expect(game.score).toBe(2);
    expect(game.food).toBe(null);
    expect(game.snake.length).toBe(4);
  });
});

describe("placeFood", () => {
  it("never lands on the snake, whatever the random value", () => {
    const snake = [];
    for (let x = 0; x < 4; x++) {
      snake.push({ x, y: 0 });
    }
    for (let i = 0; i <= 20; i++) {
      const game = gameAt(snake, { cols: 4, rows: 4, random: () => i / 20 });
      const food = placeFood(game);
      expect(occupies(game, food.x, food.y, false)).toBe(false);
    }
  });

  it("stays on the board even if random returns exactly 1", () => {
    const game = gameAt([{ x: 0, y: 0 }], { cols: 3, rows: 3, random: () => 1 });
    const food = placeFood(game);
    expect(food.x).toBeLessThan(3);
    expect(food.y).toBeLessThan(3);
  });

  it("returns null when there is no free cell left", () => {
    const snake = [];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        snake.push({ x, y });
      }
    }
    expect(placeFood(gameAt(snake, { cols: 2, rows: 2 }))).toBe(null);
  });
});

describe("occupies", () => {
  it("reports body cells and skips the tail on request", () => {
    const game = gameAt([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(occupies(game, 2, 1, false)).toBe(true);
    expect(occupies(game, 3, 1, false)).toBe(true);
    expect(occupies(game, 3, 1, true)).toBe(false);
    expect(occupies(game, 4, 4, false)).toBe(false);
  });
});
