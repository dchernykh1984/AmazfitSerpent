import { describe, it, expect } from "vitest";
import { bestKey, LEVEL_KEY, normalizeScore, updateBest } from "../lib/scores.js";

describe("storage keys", () => {
  it("gives each difficulty its own best score", () => {
    expect(bestKey(0)).not.toBe(bestKey(1));
    expect(bestKey(1)).toBe(bestKey(1));
    expect(bestKey(2)).toContain("2");
  });

  it("keeps the chosen difficulty under its own key", () => {
    expect(LEVEL_KEY).not.toBe(bestKey(0));
  });
});

describe("normalizeScore", () => {
  it("passes a real score through", () => {
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(42)).toBe(42);
  });

  it("reads a score stored as a string", () => {
    expect(normalizeScore("17")).toBe(17);
  });

  it("reads anything unusable as zero", () => {
    expect(normalizeScore(null)).toBe(0);
    expect(normalizeScore(undefined)).toBe(0);
    expect(normalizeScore("")).toBe(0);
    expect(normalizeScore("junk")).toBe(0);
    expect(normalizeScore(-8)).toBe(0);
    expect(normalizeScore(Infinity)).toBe(0);
    expect(normalizeScore({})).toBe(0);
  });

  it("drops a fractional score to a whole one", () => {
    expect(normalizeScore(9.9)).toBe(9);
  });
});

describe("updateBest", () => {
  it("records a higher score", () => {
    expect(updateBest(10, 12)).toEqual({ best: 12, isRecord: true });
  });

  it("keeps the old best when the game fell short or tied it", () => {
    expect(updateBest(10, 10)).toEqual({ best: 10, isRecord: false });
    expect(updateBest(10, 3)).toEqual({ best: 10, isRecord: false });
  });

  it("does not celebrate a scoreless game on a fresh install", () => {
    expect(updateBest(0, 0)).toEqual({ best: 0, isRecord: false });
  });

  it("recovers from junk in storage", () => {
    expect(updateBest("bogus", 5)).toEqual({ best: 5, isRecord: true });
    expect(updateBest(null, 0)).toEqual({ best: 0, isRecord: false });
    expect(updateBest(7, "bogus")).toEqual({ best: 7, isRecord: false });
  });
});
