import { describe, it, expect } from "vitest";
import { boardLayout, cellRect } from "../lib/board.js";

const ROUND_SIZES = [466, 480];

describe("boardLayout", () => {
  it("splits the board into equal whole-pixel cells", () => {
    for (const size of ROUND_SIZES) {
      const board = boardLayout(size, 15);
      expect(board.cells).toBe(15);
      expect(board.size).toBe(board.cell * 15);
      expect(Number.isInteger(board.cell)).toBe(true);
    }
  });

  it("centres the board", () => {
    for (const size of ROUND_SIZES) {
      const board = boardLayout(size, 15);
      expect(Math.abs(board.x + board.size - (size - board.x))).toBeLessThanOrEqual(1);
      expect(board.x).toBe(board.y);
    }
  });

  it("keeps every corner inside the round screen", () => {
    for (const size of ROUND_SIZES) {
      const board = boardLayout(size, 15);
      const radius = size / 2;
      const corners = [
        [board.x, board.y],
        [board.x + board.size, board.y],
        [board.x, board.y + board.size],
        [board.x + board.size, board.y + board.size],
      ];
      for (const [x, y] of corners) {
        const dx = x - radius;
        const dy = y - radius;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(radius);
      }
    }
  });

  it("leaves a cap above and below for the score and the pause button", () => {
    for (const size of ROUND_SIZES) {
      const board = boardLayout(size, 15);
      expect(board.y).toBeGreaterThan(40);
      expect(size - (board.y + board.size)).toBeGreaterThan(40);
    }
  });

  it("survives a silly cell count", () => {
    expect(boardLayout(466, 0).cells).toBe(1);
    expect(boardLayout(466, -5).cells).toBe(1);
    expect(boardLayout(466, 1000).cell).toBeGreaterThanOrEqual(1);
  });
});

describe("cellRect", () => {
  it("tiles the board without gaps between cell origins", () => {
    const board = boardLayout(466, 15);
    const first = cellRect(board, 0, 0, 0);
    const second = cellRect(board, 1, 0, 0);
    expect(first.x).toBe(board.x);
    expect(first.y).toBe(board.y);
    expect(second.x - first.x).toBe(board.cell);
    expect(first.w).toBe(board.cell);
  });

  it("insets a cell on every side", () => {
    const board = boardLayout(466, 15);
    const box = cellRect(board, 3, 4, 2);
    expect(box.x).toBe(board.x + 3 * board.cell + 2);
    expect(box.y).toBe(board.y + 4 * board.cell + 2);
    expect(box.w).toBe(board.cell - 4);
    expect(box.h).toBe(board.cell - 4);
  });

  it("keeps every cell inside the board", () => {
    const board = boardLayout(466, 15);
    for (let row = 0; row < board.cells; row++) {
      for (let column = 0; column < board.cells; column++) {
        const box = cellRect(board, column, row, 1);
        expect(box.x).toBeGreaterThanOrEqual(board.x);
        expect(box.y).toBeGreaterThanOrEqual(board.y);
        expect(box.x + box.w).toBeLessThanOrEqual(board.x + board.size);
        expect(box.y + box.h).toBeLessThanOrEqual(board.y + board.size);
      }
    }
  });

  it("never lets an oversized inset collapse a cell", () => {
    const board = boardLayout(466, 15);
    const box = cellRect(board, 0, 0, 999);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
  });
});
