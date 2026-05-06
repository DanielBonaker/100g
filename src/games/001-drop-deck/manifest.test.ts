import { describe, it, expect } from "vitest";
import { manifest } from "./manifest.ts";
import { makeRunState } from "./domain/board.ts";
import type { RunState } from "./domain/runState.ts";

describe("Drop Deck manifest", () => {
  it("has the correct id", () => {
    expect(manifest.id).toBe("001-drop-deck");
  });

  it("has the correct title", () => {
    expect(manifest.title).toBe("Drop Deck");
  });

  it("has exactly 3 achievements", () => {
    expect(manifest.achievements).toHaveLength(3);
  });

  it("all achievement ids are non-empty strings", () => {
    for (const ach of manifest.achievements) {
      expect(typeof ach.id).toBe("string");
      expect(ach.id.length).toBeGreaterThan(0);
    }
  });

  it("has the correct achievement ids per spec", () => {
    const ids = manifest.achievements.map((a) => a.id);
    expect(ids).toContain("dd-rows-100");
    expect(ids).toContain("dd-round-10");
    expect(ids).toContain("dd-deck-20");
  });

  it("does not contain old placeholder achievement ids", () => {
    const ids = manifest.achievements.map((a) => a.id);
    expect(ids).not.toContain("dd-first-drop");
    expect(ids).not.toContain("dd-five-drops");
    expect(ids).not.toContain("dd-survive-100");
  });
});

describe("Drop Deck manifest — currencyYield formula", () => {
  const makeState = (overrides: Partial<RunState>): RunState => ({
    ...makeRunState(),
    ...overrides,
  });

  it("returns 0 for 0 rows, round 1", () => {
    const state = makeState({ clearedRowsThisRun: 0, round: 1 });
    expect(manifest.currencyYield(state)).toBe(0);
  });

  it("returns 10 for 50 rows, round 1 (50/5=10, round-1=0)", () => {
    const state = makeState({ clearedRowsThisRun: 50, round: 1 });
    expect(manifest.currencyYield(state)).toBe(10);
  });

  it("caps row contribution at 200 (1000 rows still gives 200)", () => {
    const state = makeState({ clearedRowsThisRun: 1000, round: 1 });
    expect(manifest.currencyYield(state)).toBe(200);
  });

  it("caps round contribution at 100 (round 101 still gives 100)", () => {
    const state = makeState({ clearedRowsThisRun: 0, round: 102 });
    expect(manifest.currencyYield(state)).toBe(100);
  });

  it("1000 rows, round 100 → min(200,200) + min(99,100) = 299", () => {
    const state = makeState({ clearedRowsThisRun: 1000, round: 100 });
    expect(manifest.currencyYield(state)).toBe(299);
  });

  it("5000 rows, round 1000 → 200 + 100 = 300, capped at 300", () => {
    const state = makeState({ clearedRowsThisRun: 5000, round: 1001 });
    expect(manifest.currencyYield(state)).toBe(300);
  });

  it("returns a non-negative number for any state", () => {
    const state = makeRunState();
    expect(manifest.currencyYield(state)).toBeGreaterThanOrEqual(0);
  });
});
