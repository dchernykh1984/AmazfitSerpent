import * as hmUI from "@zos/ui";
import { getLanguage } from "@zos/settings";
import {
  onGesture,
  offGesture,
  GESTURE_UP,
  GESTURE_DOWN,
  GESTURE_LEFT,
  GESTURE_RIGHT,
} from "@zos/interaction";
import { setPageBrightTime, resetPageBrightTime } from "@zos/display";
import { LocalStorage } from "@zos/storage";

import { boardLayout, cellRect } from "../lib/board.js";
import { centeredBox } from "../lib/round-geometry.js";
import { labelFor, languageFromZeppCode } from "../lib/i18n/index.js";
import { bestKey, LEVEL_KEY, normalizeScore, updateBest } from "../lib/scores.js";
import { clampLevel, LEVELS, nextLevel, tickInterval } from "../lib/speed.js";
import { createGame, setDirection, step, RUNNING, UP, DOWN, LEFT, RIGHT } from "../lib/snake.js";
import { SCREEN_SIZE } from "../utils/config/device.js";
import {
  BOARD_EDGE,
  BRIGHT_TIME_MS,
  CELL_INSET,
  COLOR_BACKGROUND,
  COLOR_BOARD,
  COLOR_BOARD_EDGE,
  COLOR_BUTTON,
  COLOR_BUTTON_PRESSED,
  COLOR_FOOD,
  COLOR_MUTED,
  COLOR_SNAKE,
  COLOR_SNAKE_HEAD,
  COLOR_TEXT,
  GRID_CELLS,
  SCREEN_PADDING,
} from "../utils/config/constants.js";

// The board is the inscribed square; what is left is a circular cap above it (the
// score) and below it (the pause button).
const BOARD = boardLayout(SCREEN_SIZE, GRID_CELLS);
const BOARD_BOTTOM = BOARD.y + BOARD.size;

// Menu type scale, derived from the board so it holds on any round size.
const TEXT_BIG = Math.round(BOARD.size * 0.13);
const TEXT_ROW = Math.round(BOARD.size * 0.1);
const TEXT_SMALL = Math.round(BOARD.size * 0.085);
const BUTTON_HEIGHT = Math.round(BOARD.size * 0.16);
const STACK_GAP = Math.round(BOARD.size * 0.04);
const MAX_MENU_WIDTH = Math.round(BOARD.size * 0.86);

// A widget that failed to take a setting is not worth crashing a game over, and
// a watch that has no storage should still play - just without remembering. The
// in-memory copy keeps the best score alive for the rest of the session.
const memory = {};

// The raw stored value, or undefined when there is nothing stored. Kept separate
// from readNumber because "never set" and "set to zero" mean different things to
// the difficulty level.
function readValue(storage, key) {
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to the in-memory copy.
    }
  }
  return memory[key];
}

function readNumber(storage, key) {
  return normalizeScore(readValue(storage, key));
}

function writeNumber(storage, key, value) {
  memory[key] = value;
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // The in-memory copy above still holds for this session.
    }
  }
}

// The gestures that steer, mapped to directions. Everything else the screen sends
// is ignored.
function directionForGesture(gesture) {
  if (gesture === GESTURE_UP) {
    return UP;
  }
  if (gesture === GESTURE_DOWN) {
    return DOWN;
  }
  if (gesture === GESTURE_LEFT) {
    return LEFT;
  }
  if (gesture === GESTURE_RIGHT) {
    return RIGHT;
  }
  return null;
}

Page({
  state: {
    language: "en",
    level: 1,
    best: 0,
    screen: "start",
    game: null,
    storage: null,
    timer: null,
    destroyed: false,
    // Widgets, grouped by lifetime: the frame lives as long as the page, the
    // board cells and the score as long as a game, the pause button and the menu
    // as long as a screen.
    bodies: [],
    food: null,
    score: null,
    pause: null,
    menu: [],
  },

  build() {
    try {
      this.state.language = languageFromZeppCode(getLanguage());
    } catch {
      // Some firmwares do not expose the setting; English rather than a blank
      // screen from a throw inside build().
    }

    try {
      this.state.storage = new LocalStorage();
    } catch {
      // No storage on this device: play on, remembering only for this session.
    }

    // A game outlasts the default ten-second display timeout, and a screen that
    // blacks out mid-run is a lost game. Handed back in onDestroy.
    try {
      setPageBrightTime({ brightTime: BRIGHT_TIME_MS });
    } catch {
      // Not fatal: the watch just keeps its own timeout.
    }

    this.state.level = clampLevel(readValue(this.state.storage, LEVEL_KEY));
    this.state.best = readNumber(this.state.storage, bestKey(this.state.level));

    this.drawFrame();
    onGesture({ callback: (event) => this.onGesture(event) });
    this.showStart();
  },

  onDestroy() {
    this.state.destroyed = true;
    this.stopTimer();
    try {
      offGesture();
    } catch {
      // Nothing left to unhook.
    }
    try {
      resetPageBrightTime();
    } catch {
      // The setting is dropped with the page anyway.
    }
  },

  // ---------------------------------------------------------------- input ----

  // Swipes steer while a game runs and pick the difficulty in the menus.
  // Returning true swallows the gesture: during a game that also blocks the
  // system back-swipe, so a hard right turn cannot quit the app by accident. The
  // menus deliberately let the right swipe through, which is how you leave.
  onGesture(gesture) {
    if (this.state.destroyed) {
      return false;
    }

    if (this.state.screen === "playing") {
      const direction = directionForGesture(gesture);
      if (direction !== null) {
        setDirection(this.state.game, direction);
      }
      return true;
    }

    if (gesture === GESTURE_RIGHT) {
      return false;
    }
    if (this.state.screen === "start" && (gesture === GESTURE_UP || gesture === GESTURE_DOWN)) {
      this.cycleLevel();
    }
    return true;
  },

  // ---------------------------------------------------------------- screens ----

  showStart() {
    this.stopTimer();
    this.state.screen = "start";
    this.state.game = null;
    this.clearCells();
    this.clearHud();

    const label = labelFor(this.state.language, "speed_" + LEVELS[this.state.level].id);
    this.drawMenu([
      { kind: "text", height: TEXT_BIG, color: COLOR_TEXT, text: this.text("title") },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "text",
        height: TEXT_ROW,
        color: COLOR_MUTED,
        text: this.text("best") + " " + this.state.best,
      },
      { kind: "gap", height: STACK_GAP },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("speed") },
      { kind: "button", height: BUTTON_HEIGHT, text: label, onClick: () => this.cycleLevel() },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("play"),
        onClick: () => this.startGame(),
      },
      { kind: "text", height: TEXT_SMALL, color: COLOR_MUTED, text: this.text("hint") },
    ]);
  },

  // Walk to the next difficulty and remember it, so the game reopens the way it
  // was left. Each level keeps its own best score, so that is reloaded too.
  cycleLevel() {
    this.state.level = nextLevel(this.state.level);
    writeNumber(this.state.storage, LEVEL_KEY, this.state.level);
    this.state.best = readNumber(this.state.storage, bestKey(this.state.level));
    this.showStart();
  },

  startGame() {
    this.clearMenu();
    this.state.screen = "playing";
    this.state.game = createGame(BOARD.cells, BOARD.cells);
    this.drawSnake();
    this.drawFood();
    this.drawScore();
    this.setPauseVisible(true);
    this.scheduleTick();
  },

  pauseGame() {
    if (this.state.screen !== "playing") {
      return;
    }
    this.stopTimer();
    this.state.screen = "paused";
    this.setPauseVisible(false);
    this.drawMenu([
      { kind: "text", height: TEXT_BIG, color: COLOR_TEXT, text: this.text("paused") },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("resume"),
        onClick: () => this.resumeGame(),
      },
    ]);
  },

  resumeGame() {
    if (this.state.screen !== "paused") {
      return;
    }
    this.clearMenu();
    this.state.screen = "playing";
    this.setPauseVisible(true);
    this.scheduleTick();
  },

  // The crash (or, on a full board, the perfect game) is left on screen under a
  // dimmed panel, so you can see what you ran into.
  gameOver() {
    this.stopTimer();
    this.state.screen = "over";
    const score = this.state.game.score;
    const result = updateBest(this.state.best, score);
    this.state.best = result.best;
    if (result.isRecord) {
      writeNumber(this.state.storage, bestKey(this.state.level), result.best);
    }

    this.setPauseVisible(false);
    this.drawMenu([
      { kind: "text", height: TEXT_BIG, color: COLOR_TEXT, text: this.text("game_over") },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "text",
        height: TEXT_ROW,
        color: COLOR_TEXT,
        text: this.text("score") + " " + score,
      },
      {
        kind: "text",
        height: TEXT_ROW,
        color: result.isRecord ? COLOR_FOOD : COLOR_MUTED,
        text: result.isRecord ? this.text("new_best") : this.text("best") + " " + this.state.best,
      },
      { kind: "gap", height: STACK_GAP },
      {
        kind: "button",
        height: BUTTON_HEIGHT,
        text: this.text("again"),
        onClick: () => this.showStart(),
      },
    ]);
  },

  // ---------------------------------------------------------------- loop ----

  scheduleTick() {
    this.stopTimer();
    const delay = tickInterval(this.state.level, this.state.game.score);
    this.state.timer = setTimeout(() => this.tick(), delay);
  },

  stopTimer() {
    if (this.state.timer) {
      clearTimeout(this.state.timer);
      this.state.timer = null;
    }
  },

  tick() {
    this.state.timer = null;
    if (this.state.destroyed || this.state.screen !== "playing") {
      return;
    }
    const result = step(this.state.game);
    this.applyStep(result);
    if (this.state.game.status !== RUNNING) {
      this.gameOver();
      return;
    }
    this.scheduleTick();
  },

  // Redraw only what moved. A step shifts the head into a new cell and frees the
  // tail, so at most three widgets change: the old head fades to body green, the
  // freed tail widget is recycled as the new head, and the food moves when eaten.
  // Repainting the whole board every 150ms would not keep up.
  applyStep(result) {
    if (result.head === null) {
      return;
    }
    const snake = this.state.game.snake;

    if (snake.length > 1 && this.state.bodies.length > 0) {
      this.setCell(this.state.bodies[0], snake[1], COLOR_SNAKE);
    }

    if (result.removed && this.state.bodies.length > 0) {
      const recycled = this.state.bodies.pop();
      this.setCell(recycled, snake[0], COLOR_SNAKE_HEAD);
      this.state.bodies.unshift(recycled);
    } else {
      this.state.bodies.unshift(this.createCell(snake[0], COLOR_SNAKE_HEAD));
    }

    if (result.ate) {
      this.drawFood();
      this.drawScore();
    }
  },

  // ---------------------------------------------------------------- drawing ----

  // The black screen, the board frame and the board itself. Created once and kept
  // for the life of the page: every screen is drawn on top of it.
  drawFrame() {
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: SCREEN_SIZE,
      h: SCREEN_SIZE,
      color: COLOR_BACKGROUND,
    });
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: BOARD.x - BOARD_EDGE,
      y: BOARD.y - BOARD_EDGE,
      w: BOARD.size + 2 * BOARD_EDGE,
      h: BOARD.size + 2 * BOARD_EDGE,
      radius: BOARD_EDGE * 3,
      color: COLOR_BOARD_EDGE,
    });
    hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: BOARD.x,
      y: BOARD.y,
      w: BOARD.size,
      h: BOARD.size,
      radius: BOARD_EDGE * 2,
      color: COLOR_BOARD,
    });
  },

  drawSnake() {
    this.clearCells();
    const snake = this.state.game.snake;
    for (let i = 0; i < snake.length; i++) {
      this.state.bodies.push(this.createCell(snake[i], i === 0 ? COLOR_SNAKE_HEAD : COLOR_SNAKE));
    }
  },

  // The food is one widget for the life of a game: it is moved, not recreated.
  // A won game leaves no free cell, so there is nothing left to draw.
  drawFood() {
    const food = this.state.game.food;
    if (food === null) {
      if (this.state.food) {
        hmUI.deleteWidget(this.state.food);
        this.state.food = null;
      }
      return;
    }
    const box = cellRect(BOARD, food.x, food.y, CELL_INSET);
    if (this.state.food) {
      this.state.food.setProperty(hmUI.prop.MORE, {
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        radius: Math.floor(box.w / 2),
        color: COLOR_FOOD,
      });
      return;
    }
    this.state.food = hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: Math.floor(box.w / 2),
      color: COLOR_FOOD,
    });
  },

  createCell(cell, color) {
    const box = cellRect(BOARD, cell.x, cell.y, CELL_INSET);
    return hmUI.createWidget(hmUI.widget.FILL_RECT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: BOARD_EDGE,
      color,
    });
  },

  setCell(widget, cell, color) {
    const box = cellRect(BOARD, cell.x, cell.y, CELL_INSET);
    widget.setProperty(hmUI.prop.MORE, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: BOARD_EDGE,
      color,
    });
  },

  // The score, in the circular cap above the board. Recreated rather than mutated,
  // which happens only when a point is scored - never on a plain step.
  drawScore() {
    if (this.state.score) {
      hmUI.deleteWidget(this.state.score);
      this.state.score = null;
    }
    if (!this.state.game) {
      return;
    }
    const height = Math.round(BOARD.y * 0.5);
    const box = centeredBox(
      SCREEN_SIZE,
      Math.round(BOARD.y * 0.3),
      height,
      BOARD.size,
      SCREEN_PADDING
    );
    const text = String(this.state.game.score);
    this.state.score = this.createText(box, Math.round(height * 0.8), COLOR_TEXT, text);
  },

  // The pause button, in the cap below the board. It exists only while a game is
  // actually running, so it cannot be tapped on a menu that is covering it.
  setPauseVisible(visible) {
    if (this.state.pause) {
      hmUI.deleteWidget(this.state.pause);
      this.state.pause = null;
    }
    if (!visible) {
      return;
    }
    const capHeight = SCREEN_SIZE - BOARD_BOTTOM;
    const height = Math.round(capHeight * 0.55);
    const box = centeredBox(
      SCREEN_SIZE,
      BOARD_BOTTOM + Math.round(capHeight * 0.1),
      height,
      MAX_MENU_WIDTH,
      SCREEN_PADDING
    );
    this.state.pause = this.createButton(box, this.text("pause"), () => this.pauseGame());
  },

  // A vertical stack of texts and buttons, centred on the board under a dimmed
  // panel so it stays readable over a half-drawn snake.
  drawMenu(items) {
    this.clearMenu();

    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += items[i].height;
    }
    const top = BOARD.y + Math.round((BOARD.size - height) / 2);

    this.state.menu.push(
      hmUI.createWidget(hmUI.widget.FILL_RECT, {
        x: BOARD.x,
        y: Math.max(BOARD.y, top - STACK_GAP),
        w: BOARD.size,
        h: Math.min(BOARD.size, height + 2 * STACK_GAP),
        radius: BOARD_EDGE * 4,
        color: COLOR_BACKGROUND,
        alpha: 210,
      })
    );

    let y = top;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "gap") {
        const box = centeredBox(SCREEN_SIZE, y, item.height, MAX_MENU_WIDTH, SCREEN_PADDING);
        if (item.kind === "button") {
          this.state.menu.push(this.createButton(box, item.text, item.onClick));
        } else {
          this.state.menu.push(
            this.createText(box, Math.round(item.height * 0.76), item.color, item.text)
          );
        }
      }
      y += item.height;
    }
  },

  createText(box, size, color, text) {
    return hmUI.createWidget(hmUI.widget.TEXT, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      color,
      text_size: size,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text,
    });
  },

  createButton(box, text, onClick) {
    return hmUI.createWidget(hmUI.widget.BUTTON, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      radius: Math.round(box.h / 2),
      normal_color: COLOR_BUTTON,
      press_color: COLOR_BUTTON_PRESSED,
      color: COLOR_TEXT,
      text_size: Math.round(box.h * 0.46),
      text,
      click_func: onClick,
    });
  },

  // ---------------------------------------------------------------- teardown ----

  clearCells() {
    for (let i = 0; i < this.state.bodies.length; i++) {
      hmUI.deleteWidget(this.state.bodies[i]);
    }
    this.state.bodies = [];
    if (this.state.food) {
      hmUI.deleteWidget(this.state.food);
      this.state.food = null;
    }
  },

  // Called when there is no game left to report on; drawScore removes the score
  // and, with state.game already cleared, draws nothing back.
  clearHud() {
    this.drawScore();
    this.setPauseVisible(false);
  },

  clearMenu() {
    for (let i = 0; i < this.state.menu.length; i++) {
      hmUI.deleteWidget(this.state.menu[i]);
    }
    this.state.menu = [];
  },

  text(key) {
    return labelFor(this.state.language, key);
  },
});
