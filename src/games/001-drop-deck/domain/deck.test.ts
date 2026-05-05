import { describe, it, expect } from "vitest";
import { buildStarterDeck, shuffle, draw, enforceMinMax } from "./deck.ts";
import { makeRunState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

// ---------------------------------------------------------------------------
// Minimal seeded RNG for tests — deterministic mulberry32-style
// ---------------------------------------------------------------------------

const makeTestRng = (seed: number): SeededRng => {
  let s = seed;
  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) =>
      Math.floor(next() * (max - min + 1)) + min,
    fork: function () {
      return makeTestRng((s + 1) | 0);
    },
    get state() {
      return String(s);
    },
  };
};

describe("buildStarterDeck", () => {
  it("returns 8 blocks", () => {
    const rng = makeTestRng(1234);
    const deck = buildStarterDeck(rng);
    expect(deck).toHaveLength(8);
  });

  it("all blocks in the starter deck are standard effect", () => {
    const rng = makeTestRng(1234);
    const deck = buildStarterDeck(rng);
    for (const block of deck) {
      expect(block.effectId).toBe("standard");
    }
  });

  it("all blocks have at least one cell", () => {
    const rng = makeTestRng(1234);
    const deck = buildStarterDeck(rng);
    for (const block of deck) {
      expect(block.cells.length).toBeGreaterThan(0);
      expect(block.cellCount).toBe(block.cells.length);
    }
  });
});

describe("shuffle", () => {
  it("returns the same number of items", () => {
    const rng = makeTestRng(99);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(items, rng);
    expect(result).toHaveLength(items.length);
  });

  it("contains the same items (is a permutation)", () => {
    const rng = makeTestRng(42);
    const items = [1, 2, 3, 4, 5];
    const result = shuffle(items, rng);
    expect([...result].sort()).toEqual([...items].sort());
  });

  it("is deterministic: same seed → same order", () => {
    const items = ["a", "b", "c", "d", "e", "f"];
    const r1 = shuffle(items, makeTestRng(7));
    const r2 = shuffle(items, makeTestRng(7));
    expect(r1).toEqual(r2);
  });

  it("different seeds produce different orderings (with high probability)", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const r1 = shuffle(items, makeTestRng(1));
    const r2 = shuffle(items, makeTestRng(99999));
    // At least one of them should differ from the original order
    const changed =
      r1.join(",") !== items.join(",") || r2.join(",") !== items.join(",");
    expect(changed).toBe(true);
  });
});

describe("draw", () => {
  it("draws from drawQueue when non-empty", () => {
    const baseState = makeRunState("seed-42");
    const rng = makeTestRng(1);
    // Use the first block from drawQueue (all initial blocks start there)
    const blockA = baseState.drawQueue[0];
    if (!blockA) throw new Error("no block in drawQueue");
    const state = { ...baseState, drawQueue: [blockA] };
    const result = draw(state, rng);
    expect(result.drew).toBe(blockA);
    expect(result.state.drawQueue).toHaveLength(0);
  });

  it("reshuffles deck into drawQueue when drawQueue is empty", () => {
    const rng = makeTestRng(1);
    const baseState = makeRunState("seed-1");
    // Move drawQueue blocks to deck so draw() must reshuffle
    const state = { ...baseState, drawQueue: [], deck: baseState.drawQueue };
    const result = draw(state, rng);
    expect(result.drew).not.toBeNull();
  });

  it("returns null when both deck and drawQueue are empty", () => {
    const rng = makeTestRng(1);
    const state = { ...makeRunState("seed-1"), drawQueue: [], deck: [] };
    const result = draw(state, rng);
    expect(result.drew).toBeNull();
  });
});

describe("enforceMinMax", () => {
  it("returns the deck unchanged when within bounds", () => {
    const rng = makeTestRng(1);
    const deck = buildStarterDeck(rng); // 8 blocks
    const result = enforceMinMax(deck, 5, 20);
    expect(result.length).toBe(deck.length);
  });

  it("truncates the deck when above maxSize", () => {
    const rng = makeTestRng(1);
    const deck = buildStarterDeck(rng); // 8 blocks
    const result = enforceMinMax(deck, 5, 6);
    expect(result.length).toBe(6);
  });

  it("does not modify when at exactly minSize", () => {
    const rng = makeTestRng(1);
    const deck = buildStarterDeck(rng).slice(0, 5);
    const result = enforceMinMax(deck, 5, 20);
    expect(result.length).toBe(5);
  });
});
