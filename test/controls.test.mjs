import { describe, it, expect } from "vitest";
import { controlLayout, hitTest, UP, DOWN, LEFT, RIGHT, PAUSE } from "../lib/controls.js";
import { boardLayout } from "../lib/board.js";
import { GRID_CELLS } from "../utils/config/constants.js";

// The two round screens the app is built for, taken from what actually ships.
const SCREENS = [466, 480];

const layoutFor = (screen) => controlLayout(screen, boardLayout(screen, GRID_CELLS));

const boxes = (layout) => [layout.up, layout.down, layout.left, layout.right, layout.pause];

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// A control is inside the round screen when all four of its corners are.
// The furthest any corner of a box sits from the middle of the screen.
function reach(box, screen) {
  const radius = screen / 2;
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return Math.max(...corners.map(([x, y]) => Math.hypot(x - radius, y - radius)));
}

describe("controlLayout", () => {
  it("puts the arrows in the dead space around the board, never over it", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      for (const control of boxes(layout)) {
        expect(overlaps(control, layout.board), `screen ${screen}`).toBe(false);
      }
    }
  });

  it("keeps every control inside the round screen", () => {
    // The hit box may run closer to the bezel than the padding: the icon drawn
    // inside it is far smaller, and a corner the finger can still reach is worth
    // more than a symmetrical margin. What it must not do is fall off the glass.
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      for (const control of boxes(layout)) {
        expect(
          reach(control, screen),
          `screen ${screen} ${JSON.stringify(control)}`
        ).toBeLessThanOrEqual(screen / 2);
      }
    }
  });

  it("never lets two controls touch", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      const all = boxes(layout);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          expect(overlaps(all[i], all[j]), `screen ${screen}: ${i} and ${j}`).toBe(false);
        }
      }
    }
  });

  it("leaves dead space between the down arrow and pause", () => {
    // A thumb landing wide of the arrow must do nothing rather than stopping the
    // game it was steering.
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      const gap = layout.pause.x - (layout.down.x + layout.down.w);
      expect(gap, `screen ${screen}`).toBeGreaterThanOrEqual(8);
    }
  });

  it("makes the down arrow much the bigger of the two, and centres it", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      expect(layout.down.w, `screen ${screen}`).toBeGreaterThan(layout.pause.w);
      const middle = layout.down.x + layout.down.w / 2;
      expect(Math.abs(middle - screen / 2), `screen ${screen}`).toBeLessThanOrEqual(1);
    }
  });

  it("mirrors the side arrows about the middle", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      expect(layout.left.w).toBe(layout.right.w);
      expect(layout.left.h).toBe(layout.right.h);
      expect(layout.left.y).toBe(layout.right.y);
      expect(layout.left.x + layout.left.w / 2 + (layout.right.x + layout.right.w / 2)).toBe(
        screen
      );
    }
  });

  it("stacks the score above the up arrow without them meeting", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      expect(layout.score.y + layout.score.h, `screen ${screen}`).toBeLessThanOrEqual(layout.up.y);
      expect(overlaps(layout.score, layout.up)).toBe(false);
    }
  });

  it("draws every control big enough to hit with a thumb", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      for (const control of boxes(layout)) {
        expect(Math.min(control.w, control.h), `screen ${screen}`).toBeGreaterThanOrEqual(28);
      }
    }
  });
});

describe("hitTest", () => {
  const layout = layoutFor(466);
  const middleOf = (box) => [box.x + Math.floor(box.w / 2), box.y + Math.floor(box.h / 2)];

  it("finds each control from a tap in the middle of it", () => {
    const cases = [
      [layout.up, UP],
      [layout.down, DOWN],
      [layout.left, LEFT],
      [layout.right, RIGHT],
      [layout.pause, PAUSE],
    ];
    for (const [box, expected] of cases) {
      const [x, y] = middleOf(box);
      expect(hitTest(layout, x, y)).toBe(expected);
    }
  });

  it("finds a control from anywhere inside it, corners included", () => {
    const box = layout.left;
    expect(hitTest(layout, box.x, box.y)).toBe(LEFT);
    expect(hitTest(layout, box.x + box.w - 1, box.y + box.h - 1)).toBe(LEFT);
  });

  it("reports nothing for the board, which takes no taps in this game", () => {
    const [x, y] = middleOf(layout.board);
    expect(hitTest(layout, x, y)).toBe(null);
  });

  it("reports nothing for the dead space between the arrow and pause", () => {
    const x = layout.down.x + layout.down.w + 2;
    const y = layout.down.y + Math.floor(layout.down.h / 2);
    expect(x).toBeLessThan(layout.pause.x);
    expect(hitTest(layout, x, y)).toBe(null);
  });

  it("reports nothing off the edge of the screen", () => {
    expect(hitTest(layout, 2, 2)).toBe(null);
    expect(hitTest(layout, 464, 464)).toBe(null);
  });
});
