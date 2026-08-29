import { describe, it, expect } from "vitest";
import { arrowMetrics, arrowStrokes, pauseStrokes } from "../lib/arrow.js";
import { controlLayout, UP, DOWN, LEFT, RIGHT } from "../lib/controls.js";
import { boardLayout } from "../lib/board.js";
import { GRID_CELLS, SCREEN_PADDING } from "../utils/config/constants.js";

const SCREENS = [466, 480];
const COLOR = 0x123456;

const layoutFor = (screen) => controlLayout(screen, boardLayout(screen, GRID_CELLS));
const arrowBoxes = (l) => [l.up, l.down, l.left, l.right];

const points = (strokes) =>
  strokes.flatMap((s) => [
    [s.x1, s.y1],
    [s.x2, s.y2],
  ]);

describe("arrowMetrics", () => {
  it("gives one size that fits every arrow, so the four read as a set", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      const size = arrowMetrics(arrowBoxes(layout));
      expect(size.reach).toBeGreaterThan(0);
      expect(size.width).toBeGreaterThanOrEqual(2);
      for (const box of arrowBoxes(layout)) {
        // The chevron plus half a stroke on each side has to fit the box.
        expect(size.reach * 2 + size.width, `screen ${screen}`).toBeLessThanOrEqual(
          Math.min(box.w, box.h) + 1
        );
      }
    }
  });

  it("is decided by the tightest box, not the roomiest", () => {
    const roomy = { x: 0, y: 0, w: 200, h: 200 };
    const tight = { x: 0, y: 0, w: 40, h: 40 };
    expect(arrowMetrics([roomy, tight]).reach).toBe(arrowMetrics([tight]).reach);
    expect(arrowMetrics([roomy, tight]).reach).toBeLessThan(arrowMetrics([roomy]).reach);
  });

  it("gives up rather than drawing nonsense in a box with no room", () => {
    expect(arrowMetrics([{ x: 0, y: 0, w: 0, h: 0 }])).toEqual({ reach: 0, width: 0 });
    expect(arrowMetrics([])).toEqual({ reach: 0, width: 0 });
  });
});

describe("arrowStrokes", () => {
  it("draws a chevron as two lines meeting at the tip, never a polygon", () => {
    // drawPoly is accepted on a real watch and then draws nothing at all, so
    // every icon here has to be made of lines.
    const box = { x: 100, y: 100, w: 60, h: 60 };
    const strokes = arrowStrokes(UP, box, COLOR);
    expect(strokes.length).toBe(2);
    for (const s of strokes) {
      expect(s.op).toBe("line");
      expect(s.color).toBe(COLOR);
      expect(s.width).toBeGreaterThanOrEqual(2);
    }
    // Both lines share the tip.
    expect([strokes[0].x2, strokes[0].y2]).toEqual([strokes[1].x1, strokes[1].y1]);
  });

  it("points each arrow the way it steers", () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const tipOf = (direction) => {
      const [first] = arrowStrokes(direction, box, COLOR);
      return [first.x2, first.y2];
    };
    const [ux, uy] = tipOf(UP);
    const [dx, dy] = tipOf(DOWN);
    const [lx, ly] = tipOf(LEFT);
    const [rx, ry] = tipOf(RIGHT);
    expect(uy).toBeLessThan(50);
    expect(dy).toBeGreaterThan(50);
    expect(lx).toBeLessThan(50);
    expect(rx).toBeGreaterThan(50);
    expect(ux).toBe(dx);
    expect(ly).toBe(ry);
  });

  it("keeps every stroke inside its own box", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      const size = arrowMetrics(arrowBoxes(layout));
      const cases = [
        [UP, layout.up],
        [DOWN, layout.down],
        [LEFT, layout.left],
        [RIGHT, layout.right],
      ];
      for (const [direction, box] of cases) {
        for (const [x, y] of points(arrowStrokes(direction, box, COLOR, size))) {
          expect(x, `screen ${screen}`).toBeGreaterThanOrEqual(box.x);
          expect(x).toBeLessThanOrEqual(box.x + box.w);
          expect(y).toBeGreaterThanOrEqual(box.y);
          expect(y).toBeLessThanOrEqual(box.y + box.h);
        }
      }
    }
  });

  it("keeps the drawn icons clear of the bezel, whatever the hit boxes do", () => {
    for (const screen of SCREENS) {
      const layout = layoutFor(screen);
      const size = arrowMetrics(arrowBoxes(layout));
      const radius = screen / 2;
      const cases = [
        [UP, layout.up],
        [DOWN, layout.down],
        [LEFT, layout.left],
        [RIGHT, layout.right],
      ];
      for (const [direction, box] of cases) {
        for (const [x, y] of points(arrowStrokes(direction, box, COLOR, size))) {
          const distance = Math.hypot(x - radius, y - radius) + size.width / 2;
          expect(distance, `screen ${screen} ${direction}`).toBeLessThanOrEqual(
            radius - SCREEN_PADDING
          );
        }
      }
    }
  });

  it("draws nothing rather than something wrong when there is no room", () => {
    expect(arrowStrokes(UP, { x: 0, y: 0, w: 0, h: 0 }, COLOR)).toEqual([]);
    expect(arrowStrokes("sideways", { x: 0, y: 0, w: 60, h: 60 }, COLOR)).toEqual([]);
  });
});

describe("pauseStrokes", () => {
  it("draws the two upright bars, at the same weight as the arrows", () => {
    const layout = layoutFor(466);
    const size = arrowMetrics(arrowBoxes(layout));
    const strokes = pauseStrokes(layout.pause, COLOR, size);
    expect(strokes.length).toBe(2);
    for (const s of strokes) {
      expect(s.width).toBe(size.width);
      expect(s.x1).toBe(s.x2);
      expect(s.y1).toBeLessThan(s.y2);
    }
    expect(strokes[0].x1).toBeLessThan(strokes[1].x1);
  });

  it("centres the bars on the control and keeps them inside it", () => {
    const layout = layoutFor(466);
    const size = arrowMetrics(arrowBoxes(layout));
    const box = layout.pause;
    const strokes = pauseStrokes(box, COLOR, size);
    const middle = (strokes[0].x1 + strokes[1].x1) / 2;
    expect(Math.abs(middle - (box.x + box.w / 2))).toBeLessThanOrEqual(1);
    for (const [x, y] of points(strokes)) {
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.w);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.h);
    }
  });

  it("draws nothing in a box with no room", () => {
    expect(pauseStrokes({ x: 0, y: 0, w: 0, h: 0 }, COLOR)).toEqual([]);
  });
});
