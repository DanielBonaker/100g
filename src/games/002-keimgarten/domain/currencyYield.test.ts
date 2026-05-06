import { describe, it, expect } from "vitest";
import { compute } from "./currencyYield.ts";
import type { RunState } from "./runState.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal RunState for yield tests — only fields compute() cares about. */
const makeState = (uniqueOwnedIds: readonly number[]): RunState => {
  const partial: unknown = {
    schemaVersion: 1,
    owned: [],
    tick: 0,
    nextInstanceId: 1,
    rngState: "test",
    totalTapsByCreatureId: {},
    uniqueOwnedIds,
    lastYieldPaid: 0,
  };
  return partial as RunState;
};

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

describe("compute — currency yield formula", () => {
  it("returns 0 when uniqueOwnedIds is empty (no creatures ever owned)", () => {
    const state = makeState([]);
    expect(compute(state)).toBe(0);
  });

  it("returns 2 for just the starter Keim (id=0, tier=1): floor(1/10)+1*2=2", () => {
    // uniqueCount=1 → floor(1/10)=0, highestTier=1 → 1*2=2, raw=2
    const state = makeState([0]);
    expect(compute(state)).toBe(2);
  });

  it("returns 0 for an id that doesn't exist in bestiary (no tier contribution)", () => {
    // id=9999 not in bestiary → tier contribution=0, count=1 → floor(1/10)+0=0
    const state = makeState([9999]);
    expect(compute(state)).toBe(0);
  });

  it("returns 3 for 10 unique ids where highest tier is 1 (hypothetical: only tier-1 is id=0, padded with unknown ids)", () => {
    // uniqueCount=10: floor(10/10)=1. highestTier=1 (only id 0 maps to tier 1, rest unknown → tier 0).
    // raw = 1 + 1*2 = 3
    const state = makeState([
      0, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009,
    ]);
    expect(compute(state)).toBe(3);
  });

  it("returns 34 for all 167 real bestiary ids (highest tier=9): floor(167/10)+9*2=16+18=34", () => {
    const allIds = Array.from({ length: 167 }, (_, i) => i);
    const state = makeState(allIds);
    expect(compute(state)).toBe(34);
  });

  it("caps yield at 50 for hypothetical inflated state (500 unknown ids + tier-9 id=166)", () => {
    // count=501, highestTier=9 → floor(501/10)+9*2=50+18=68 → capped at 50
    const bigIds = Array.from({ length: 500 }, (_, i) => i + 10000);
    const state = makeState([166, ...bigIds]);
    expect(compute(state)).toBe(50);
  });

  it("never returns a negative value", () => {
    expect(compute(makeState([]))).toBeGreaterThanOrEqual(0);
    expect(compute(makeState([9999, 8888]))).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic — same input always returns same output", () => {
    const state = makeState([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 166]);
    expect(compute(state)).toBe(compute(state));
  });

  it("is monotonic in uniqueOwnedCount (adding more unique ids never decreases yield)", () => {
    const base = makeState([0]);
    const extended = makeState([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(compute(extended)).toBeGreaterThanOrEqual(compute(base));
  });

  it("is monotonic in highestTierReached (higher tier id never decreases yield)", () => {
    const lowTier = makeState([0]); // tier 1
    const highTier = makeState([0, 166]); // adds tier 9
    expect(compute(highTier)).toBeGreaterThanOrEqual(compute(lowTier));
  });
});
