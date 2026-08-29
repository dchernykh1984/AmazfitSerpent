import { describe, it, expect, afterEach, vi } from "vitest";
import { LABELS } from "../lib/i18n/labels.js";
import { LEVEL_KEY } from "../lib/scores.js";
import { boardLayout } from "../lib/board.js";
import { controlLayout } from "../lib/controls.js";
import { UP, DOWN, LEFT, RIGHT } from "../lib/snake.js";
import { COLOR_ARROW, COLOR_ARROW_PRESSED, GRID_CELLS } from "../utils/config/constants.js";

const EN = LABELS.en;
const SCREEN = 466;
const CONTROLS = controlLayout(SCREEN, boardLayout(SCREEN, GRID_CELLS));

let ui;
let interaction;
let storage;

// Build the page the way Zepp OS would: the module hands its definition to the
// global Page(), and the runtime then calls build() on it.
async function loadPage(options) {
  const config = options || {};
  vi.resetModules();
  ui = await import("./doubles/zos-ui.js");
  interaction = await import("./doubles/zos-interaction.js");
  storage = await import("./doubles/zos-storage.js");
  storage.seed(config.stored || {});

  let page = null;
  globalThis.Page = (definition) => {
    page = definition;
  };
  await import("../page/index.js");
  page.build();
  return page;
}

const widgetsOfType = (type) => ui.screen.widgets.filter((w) => w.type === type);
const canvas = () => widgetsOfType(ui.widget.CANVAS)[0];

function button(text) {
  const found = widgetsOfType(ui.widget.BUTTON).filter((w) => w.properties.text === text);
  expect(found.length, "expected exactly one button labelled " + text).toBe(1);
  return found[0];
}

const hasButton = (text) => widgetsOfType(ui.widget.BUTTON).some((w) => w.properties.text === text);

const middleOf = (box) => [box.x + Math.floor(box.w / 2), box.y + Math.floor(box.h / 2)];

function tapControl(name) {
  const point = middleOf(CONTROLS[name]);
  canvas().tapAt(point[0], point[1]);
}

// The colour the icon in a control is currently drawn in.
function iconColor(name) {
  const lines = canvas().iconIn(CONTROLS[name]);
  expect(lines.length, "nothing drawn in " + name).toBeGreaterThan(0);
  return lines[0].color;
}

async function startGame(options) {
  const page = await loadPage(options);
  button(EN.play).tap();
  return page;
}

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.Page;
});

describe("the control canvas", () => {
  it("is not up while the menu is, or the buttons under it would be dead", async () => {
    // A listening canvas swallows the touch even where a button is drawn on top
    // of it, so a menu and the canvas must never be on screen together.
    await loadPage();
    expect(canvas()).toBeUndefined();
  });

  it("draws all five controls once a game starts", async () => {
    await startGame();
    expect(canvas()).toBeTruthy();
    for (const name of ["up", "down", "left", "right", "pause"]) {
      expect(canvas().iconIn(CONTROLS[name]).length, name).toBeGreaterThan(0);
    }
  });

  it("draws the arrows from lines, never a polygon", async () => {
    // drawPoly is accepted on a real watch and then draws nothing at all.
    await startGame();
    for (const command of canvas().commands) {
      expect(["rect", "line"]).toContain(command.op);
    }
  });

  it("goes away when the game is paused and comes back on resume", async () => {
    await startGame();
    const first = canvas();
    tapControl("pause");
    expect(first.deleted).toBe(true);
    expect(canvas()).toBeUndefined();
    expect(hasButton(EN.resume)).toBe(true);

    button(EN.resume).tap();
    expect(canvas()).toBeTruthy();
    for (const name of ["up", "down", "left", "right", "pause"]) {
      expect(canvas().iconIn(CONTROLS[name]).length, name).toBeGreaterThan(0);
    }
  });

  it("goes away when the game is over", async () => {
    const page = await startGame();
    // Drive the snake into the wall it is already facing.
    for (let i = 0; i < GRID_CELLS + 2 && page.state.screen === "playing"; i++) {
      page.tick();
    }
    expect(page.state.screen).toBe("over");
    expect(canvas()).toBeUndefined();
    expect(hasButton(EN.again)).toBe(true);
  });
});

describe("steering with the arrows", () => {
  it("turns the snake the way the arrow points", async () => {
    const page = await startGame();
    tapControl("up");
    expect(page.state.game.pending).toBe(UP);

    page.tick();
    tapControl("right");
    expect(page.state.game.pending).toBe(RIGHT);

    page.tick();
    tapControl("down");
    expect(page.state.game.pending).toBe(DOWN);

    page.tick();
    tapControl("left");
    expect(page.state.game.pending).toBe(LEFT);
  });

  it("refuses a turn back into the snake's own neck", async () => {
    const page = await startGame();
    // The snake opens heading right, so left is a reversal.
    tapControl("left");
    expect(page.state.game.pending).toBe(RIGHT);
    expect(page.state.screen).toBe("playing");
  });

  it("lights the arrow while it is held and puts it back on release", async () => {
    await startGame();
    const point = middleOf(CONTROLS.up);
    expect(iconColor("up")).toBe(COLOR_ARROW);

    canvas().fire(ui.event.CLICK_DOWN, { x: point[0], y: point[1] });
    expect(iconColor("up")).toBe(COLOR_ARROW_PRESSED);

    canvas().fire(ui.event.CLICK_UP, { x: point[0], y: point[1] });
    expect(iconColor("up")).toBe(COLOR_ARROW);
  });

  it("cancels a press that is released somewhere else", async () => {
    const page = await startGame();
    const down = middleOf(CONTROLS.up);
    const up = middleOf(CONTROLS.board);

    canvas().fire(ui.event.CLICK_DOWN, { x: down[0], y: down[1] });
    canvas().fire(ui.event.CLICK_UP, { x: up[0], y: up[1] });

    expect(page.state.game.pending).toBe(RIGHT);
    expect(iconColor("up")).toBe(COLOR_ARROW);
  });

  it("ignores a tap on the board and on the dead space beside the arrow", async () => {
    const page = await startGame();
    const board = middleOf(CONTROLS.board);
    canvas().tapAt(board[0], board[1]);
    expect(page.state.game.pending).toBe(RIGHT);
    expect(page.state.screen).toBe("playing");

    const gapX = CONTROLS.down.x + CONTROLS.down.w + 2;
    const gapY = CONTROLS.down.y + Math.floor(CONTROLS.down.h / 2);
    canvas().tapAt(gapX, gapY);
    expect(page.state.game.pending).toBe(RIGHT);
    expect(page.state.screen).toBe("playing");
  });
});

describe("the pause control", () => {
  it("stops the game and offers to resume", async () => {
    const page = await startGame();
    tapControl("pause");
    expect(page.state.screen).toBe("paused");
    expect(page.state.timer).toBe(null);
    expect(hasButton(EN.resume)).toBe(true);
  });

  it("puts the whole board back above the canvas on resume", async () => {
    // The canvas is remade when the game resumes, and widgets older than it sit
    // underneath. Every cell is rebuilt by drawSnake; the food has to be too, or
    // one pellet is left behind the canvas.
    const page = await startGame();
    const foodBefore = page.state.food;
    tapControl("pause");
    button(EN.resume).tap();

    expect(page.state.food).not.toBe(foodBefore);
    expect(foodBefore.deleted).toBe(true);
    const order = ui.screen.widgets;
    const canvasAt = order.indexOf(canvas());
    expect(order.indexOf(page.state.food)).toBeGreaterThan(canvasAt);
    for (const cell of page.state.bodies) {
      expect(order.indexOf(cell)).toBeGreaterThan(canvasAt);
    }
  });

  it("leaves the snake exactly where it was", async () => {
    const page = await startGame();
    page.tick();
    const before = page.state.game.snake.map((cell) => ({ x: cell.x, y: cell.y }));
    tapControl("pause");
    button(EN.resume).tap();
    expect(page.state.game.snake).toEqual(before);
    expect(page.state.screen).toBe("playing");
  });
});

describe("swiping still works", () => {
  it("steers by swipe as well as by arrow", async () => {
    const page = await startGame();
    expect(interaction.swipe(interaction.GESTURE_UP)).toBe(true);
    expect(page.state.game.pending).toBe(UP);
  });

  it("swallows the back-swipe while playing and lets it through on a menu", async () => {
    await loadPage();
    // On the menu the right swipe is how you leave the app.
    expect(interaction.swipe(interaction.GESTURE_RIGHT)).toBe(false);

    button(EN.play).tap();
    expect(interaction.swipe(interaction.GESTURE_RIGHT)).toBe(true);
  });
});

describe("the start screen", () => {
  it("tells the player about both ways to steer", async () => {
    await loadPage();
    const texts = widgetsOfType(ui.widget.TEXT).map((w) => w.properties.text);
    expect(texts).toContain(EN.hint);
    expect(EN.hint.toLowerCase()).toContain("arrow");
  });

  it("still cycles the speed and remembers it", async () => {
    await loadPage();
    button(EN.speed_normal).tap();
    expect(hasButton(EN.speed_fast)).toBe(true);
    expect(storage.stored()[LEVEL_KEY]).toBe(2);
  });
});
