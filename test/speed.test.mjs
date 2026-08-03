import { describe, it, expect } from "vitest";
import { LEVELS, DEFAULT_LEVEL, clampLevel, nextLevel, tickInterval } from "../lib/speed.js";

describe("LEVELS", () => {
  it("gets faster with each level and keeps a sane floor", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].baseMs).toBeLessThan(LEVELS[i - 1].baseMs);
      expect(LEVELS[i].minMs).toBeLessThan(LEVELS[i - 1].minMs);
    }
    for (const level of LEVELS) {
      expect(level.minMs).toBeLessThan(level.baseMs);
      expect(level.minMs).toBeGreaterThanOrEqual(80);
      expect(level.label).toBe("speed_" + level.id);
    }
  });

  it("has a usable default", () => {
    expect(LEVELS[DEFAULT_LEVEL]).toBeDefined();
  });
});

describe("clampLevel", () => {
  it("passes through a real level", () => {
    expect(clampLevel(0)).toBe(0);
    expect(clampLevel(LEVELS.length - 1)).toBe(LEVELS.length - 1);
  });

  it("falls back to the default for anything unusable", () => {
    expect(clampLevel(-1)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(LEVELS.length)).toBe(DEFAULT_LEVEL);
    expect(clampLevel("fast")).toBe(DEFAULT_LEVEL);
    expect(clampLevel(null)).toBe(DEFAULT_LEVEL);
    expect(clampLevel(undefined)).toBe(DEFAULT_LEVEL);
  });

  it("reads a level stored as a string, the way storage hands it back", () => {
    expect(clampLevel("2")).toBe(2);
  });
});

describe("nextLevel", () => {
  it("cycles through every level and back", () => {
    let level = 0;
    const seen = [level];
    for (let i = 0; i < LEVELS.length - 1; i++) {
      level = nextLevel(level);
      seen.push(level);
    }
    expect(seen).toEqual(LEVELS.map((_, index) => index));
    expect(nextLevel(LEVELS.length - 1)).toBe(0);
  });
});

describe("tickInterval", () => {
  it("starts at the level's base interval", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(tickInterval(i, 0)).toBe(LEVELS[i].baseMs);
    }
  });

  it("shortens as the score climbs", () => {
    expect(tickInterval(1, 5)).toBeLessThan(tickInterval(1, 0));
    expect(tickInterval(1, 20)).toBeLessThan(tickInterval(1, 5));
  });

  it("holds the interval between ramp steps", () => {
    expect(tickInterval(1, 1)).toBe(tickInterval(1, 0));
    expect(tickInterval(1, 4)).toBe(tickInterval(1, 0));
  });

  it("never drops below the level's floor, however long the game runs", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      expect(tickInterval(i, 10000)).toBe(LEVELS[i].minMs);
    }
  });

  it("treats a junk score as zero rather than pacing the game off a cliff", () => {
    expect(tickInterval(1, -50)).toBe(LEVELS[1].baseMs);
    expect(tickInterval(1, "abc")).toBe(LEVELS[1].baseMs);
    expect(tickInterval(1, undefined)).toBe(LEVELS[1].baseMs);
  });
});
