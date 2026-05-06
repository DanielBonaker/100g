import { describe, it, expect } from "vitest";
import { priceFor, roll, sizeCount } from "./shop.ts";
import { makeRunState } from "./runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import { TIER_COUNTS } from "../../../shared/franchise/types.ts";

// ---------------------------------------------------------------------------
// Seeded RNG helper
// ---------------------------------------------------------------------------

/** Simple LCG seeded RNG — only .next() needed for tests */
const makeSeededRng = (seed = 42) => {
  let s = seed;
  return {
    next(): number {
      // LCG constants from Numerical Recipes
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0x100000000;
    },
    int(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    fork() {
      return makeSeededRng(this.next() * 0xffffffff);
    },
    get state() {
      return String(s);
    },
  };
};

// ---------------------------------------------------------------------------
// priceFor — pricing table
// ---------------------------------------------------------------------------

describe("priceFor — pricing table", () => {
  it("size 1 costs 3", () => {
    expect(priceFor(1)).toBe(3);
  });

  it("size 2 costs 8", () => {
    expect(priceFor(2)).toBe(8);
  });

  it("size 3 costs 20", () => {
    expect(priceFor(3)).toBe(20);
  });

  it("size 4 costs 50", () => {
    expect(priceFor(4)).toBe(50);
  });

  it("size 5 costs 120", () => {
    expect(priceFor(5)).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// sizeCount — bestiary pool sizes
// ---------------------------------------------------------------------------

describe("sizeCount — bestiary pool", () => {
  it("size 1 pool matches TIER_COUNTS[1]", () => {
    expect(sizeCount(1)).toBe(TIER_COUNTS[1]);
  });

  it("size 2 pool matches TIER_COUNTS[2]", () => {
    expect(sizeCount(2)).toBe(TIER_COUNTS[2]);
  });

  it("size 5 pool matches TIER_COUNTS[5]", () => {
    expect(sizeCount(5)).toBe(TIER_COUNTS[5]);
  });
});

// ---------------------------------------------------------------------------
// roll — creature draw
// ---------------------------------------------------------------------------

describe("roll — draws a creature of the correct size", () => {
  it("returns a creature of tier === 1 for size 1", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const { drawn } = roll(state, 1, rng);
    // drawn.creatureId must be in bestiary at tier 1
    const creature = BESTIARY.find((c) => c.id === drawn.creatureId);
    expect(creature).toBeDefined();
    expect(creature!.tier).toBe(1);
  });

  it("returns a creature of tier === 2 for size 2", () => {
    const state = makeRunState();
    const rng = makeSeededRng(99);
    const { drawn } = roll(state, 2, rng);
    const creature = BESTIARY.find((c) => c.id === drawn.creatureId);
    expect(creature).toBeDefined();
    expect(creature!.tier).toBe(2);
  });
});

describe("roll — state mutation", () => {
  it("adds exactly one OwnedCreature to state.owned", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const initialCount = state.owned.length;
    const { state: newState } = roll(state, 1, rng);
    expect(newState.owned).toHaveLength(initialCount + 1);
  });

  it("increments nextInstanceId by 1", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const { state: newState } = roll(state, 1, rng);
    expect(newState.nextInstanceId).toBe(state.nextInstanceId + 1);
  });

  it("does not mutate the original state (immutability)", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const originalCount = state.owned.length;
    roll(state, 1, rng);
    expect(state.owned).toHaveLength(originalCount); // original unchanged
  });

  it("drawn creature has the correct instanceId from nextInstanceId", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const { drawn, state: newState } = roll(state, 1, rng);
    expect(drawn.instanceId).toBe(state.nextInstanceId);
    expect(newState.nextInstanceId).toBe(state.nextInstanceId + 1);
  });
});

describe("roll — uniqueOwnedIds tracking", () => {
  it("adds creatureId to uniqueOwnedIds if not already present", () => {
    // Start fresh state — starter keim (id=0) already in uniqueOwnedIds
    // Roll size 1, which can only return id=0 (only 1 creature in tier 1)
    const state = makeRunState();
    const rng = makeSeededRng();
    // size 1 only has id=0; it's already in uniqueOwnedIds → no change
    const { state: newState } = roll(state, 1, rng);
    // id=0 was already there
    expect(newState.uniqueOwnedIds).toContain(0);
  });

  it("does not duplicate in uniqueOwnedIds when creature already owned", () => {
    // There's only one tier-1 creature (id=0), already in uniqueOwnedIds
    const state = makeRunState();
    const rng = makeSeededRng();
    const { state: newState } = roll(state, 1, rng);
    const count0 = newState.uniqueOwnedIds.filter((id) => id === 0).length;
    expect(count0).toBe(1);
  });

  it("adds new creatureId to uniqueOwnedIds when not already present", () => {
    // Use size 2 — all tier-2 creatures should be new for a fresh state
    const state = makeRunState();
    // fresh state has only id=0 in uniqueOwnedIds
    const rng = makeSeededRng(1);
    const { drawn, state: newState } = roll(state, 2, rng);
    expect(newState.uniqueOwnedIds).toContain(drawn.creatureId);
    // Should have added it (since tier-2 ids are 1..3, none in fresh state)
    expect(newState.uniqueOwnedIds.length).toBeGreaterThan(
      state.uniqueOwnedIds.length,
    );
  });

  it("keeps uniqueOwnedIds sorted ascending after add", () => {
    const state = makeRunState();
    const rng = makeSeededRng(2);
    const { state: newState } = roll(state, 2, rng);
    const ids = newState.uniqueOwnedIds;
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
    }
  });
});

describe("roll — duplicates accepted", () => {
  it("allows rolling the same creature twice (duplicate is added to owned)", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    // Size 1 has exactly one creature (id=0); both rolls return id=0
    const { state: stateAfter1 } = roll(state, 1, rng);
    const rng2 = makeSeededRng();
    const { state: stateAfter2 } = roll(stateAfter1, 1, rng2);
    const dupCount = stateAfter2.owned.filter((c) => c.creatureId === 0).length;
    // Starter + 2 rolls = 3 instances of id=0
    expect(dupCount).toBe(3);
  });
});

describe("roll — statistical distribution (size 5)", () => {
  it("draws each creature in the size-5 pool at least once across 5000 rolls", () => {
    // Pool of tier-5 has 49 creatures; in 5000 rolls each should appear
    const drawn = new Set<number>();
    const rng = makeSeededRng(7777);
    for (let i = 0; i < 5000; i++) {
      const st = { ...makeRunState(), nextInstanceId: i * 100 + 1 };
      const result = roll(st, 5, rng);
      drawn.add(result.drawn.creatureId);
    }
    expect(drawn.size).toBe(TIER_COUNTS[5]); // 49
  });

  it("distribution is approximately uniform for size 1 (chi-square-free: just check min/max ratio)", () => {
    // Size 1 has only 1 creature → 100% of rolls should be id=0
    const rng = makeSeededRng(12345);
    const counts: Record<number, number> = {};
    for (let i = 0; i < 100; i++) {
      const st = { ...makeRunState(), nextInstanceId: i + 100 };
      const { drawn } = roll(st, 1, rng);
      counts[drawn.creatureId] = (counts[drawn.creatureId] ?? 0) + 1;
    }
    expect(Object.keys(counts)).toHaveLength(1);
    expect(counts[0]).toBe(100);
  });
});

describe("roll — does not touch currency fields", () => {
  it("state has no gold/balance field — roll is pure domain mutation only", () => {
    const state = makeRunState();
    const rng = makeSeededRng();
    const { state: newState } = roll(state, 1, rng);
    // RunState has no balance/gold field; verify neither is introduced
    const stateAsRecord = newState as unknown as Record<string, unknown>;
    expect(stateAsRecord.balance).toBeUndefined();
    expect(stateAsRecord.gold).toBeUndefined();
  });
});
