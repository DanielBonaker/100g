import { describe, it, expect } from "vitest";
import { buildStarterDeck, shuffle, draw, enforceMinMax } from "./deck.ts";
import { makeRunState } from "./runState.ts";
import { makeRng } from "./rng.ts";
import { BESTIARY } from "../../../shared/franchise/index.ts";

// Use the production RNG so bugs in the RNG implementation surface in these tests.
const makeTestRng = (seed: number) => makeRng(seed);

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

  it("all blocks are Small tier (tier 1-3)", () => {
    const rng = makeTestRng(1234);
    const deck = buildStarterDeck(rng);
    for (const block of deck) {
      expect(block.bestiaryId).toBeDefined();
      const entry = BESTIARY[block.bestiaryId!];
      expect(entry).toBeDefined();
      expect(entry!.tier).toBeGreaterThanOrEqual(1);
      expect(entry!.tier).toBeLessThanOrEqual(3);
    }
  });

  it("every block has a bestiaryId referencing a valid bestiary entry", () => {
    const rng = makeTestRng(1234);
    const deck = buildStarterDeck(rng);
    for (const block of deck) {
      expect(block.bestiaryId).toBeDefined();
      const entry = BESTIARY[block.bestiaryId!];
      expect(entry).toBeDefined();
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
    const result = enforceMinMax(deck, 20);
    expect(result.length).toBe(deck.length);
  });

  it("truncates the deck when above maxSize", () => {
    const rng = makeTestRng(1);
    const deck = buildStarterDeck(rng); // 8 blocks
    const result = enforceMinMax(deck, 6);
    expect(result.length).toBe(6);
  });

  it("does not modify when at exactly maxSize", () => {
    const rng = makeTestRng(1);
    const deck = buildStarterDeck(rng).slice(0, 5);
    const result = enforceMinMax(deck, 5);
    expect(result.length).toBe(5);
  });
});
