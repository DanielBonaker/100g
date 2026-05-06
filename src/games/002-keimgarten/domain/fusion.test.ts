import { describe, it, expect } from "vitest";
import { fuse } from "./fusion.ts";
import { makeRunState } from "./runState.ts";
import type { RunState } from "./runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import { TIER_COUNTS } from "../../../shared/franchise/types.ts";

// ---------------------------------------------------------------------------
// Seeded RNG helper
// ---------------------------------------------------------------------------

const makeSeededRng = (seed = 42) => {
  let s = seed;
  return {
    next(): number {
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
// Helpers to build test states
// ---------------------------------------------------------------------------

/** Build a RunState that has tier-5-unlocked fusion (i.e., unlockedFusionTiers=[6]).
 *  Adds one creature of size `tierA` and one of size `tierB`. */
const makeStateWithPair = (
  tierA: number,
  tierB: number,
  unlockedFusionTiers: readonly number[] = [6],
): { state: RunState; instanceA: number; instanceB: number } => {
  const base = makeRunState();

  // Find a creatureId for each tier
  const creatureA = BESTIARY.find((c) => c.tier === tierA);
  const creatureB = BESTIARY.find((c) => c.tier === tierB);
  if (creatureA === undefined || creatureB === undefined) {
    throw new Error(
      `No creature for tier ${String(tierA)} or ${String(tierB)}`,
    );
  }

  const instanceA = base.nextInstanceId;
  const creatureObjA = {
    instanceId: instanceA,
    creatureId: creatureA.id,
    position: { x: 10, y: 10 },
    state: "idle" as const,
    stateUntil: 30,
    facing: 1 as const,
    seed: 111,
    walkTargetX: 10,
    walkTargetY: 10,
  };

  const instanceB = base.nextInstanceId + 1;
  const creatureObjB = {
    instanceId: instanceB,
    creatureId: creatureB.id,
    position: { x: 20, y: 20 },
    state: "idle" as const,
    stateUntil: 30,
    facing: 1 as const,
    seed: 222,
    walkTargetX: 20,
    walkTargetY: 20,
  };

  const state: RunState = {
    ...base,
    owned: [...base.owned, creatureObjA, creatureObjB],
    nextInstanceId: base.nextInstanceId + 2,
    unlockedFusionTiers,
  };

  return { state, instanceA, instanceB };
};

// ---------------------------------------------------------------------------
// Refusal: target tier locked
// ---------------------------------------------------------------------------

describe("fuse — target tier locked", () => {
  it("refuses fusion when size 6 is not in unlockedFusionTiers", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, []);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("target-locked");
  });

  it("refuses fusion to size 7 when only size 6 is unlocked", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(3, 4, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 7, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("target-locked");
  });

  it("allows fusion to size 6 when unlockedFusionTiers includes 6", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tier-unlock semantics: "ever owned" unlocks the next tier
// ---------------------------------------------------------------------------

describe("fuse — tier unlock chain", () => {
  it("after a successful size-6 fusion, unlockedFusionTiers includes 7", () => {
    // The fusion output is a size-6 creature, which unlocks tier 7
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(true);
    expect(result.state.unlockedFusionTiers).toContain(7);
  });
});

// ---------------------------------------------------------------------------
// Refusal: same-instance
// ---------------------------------------------------------------------------

describe("fuse — same-instance refused", () => {
  it("refuses when instanceA === instanceB", () => {
    const { state, instanceA } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceA, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("same-instance");
  });
});

// ---------------------------------------------------------------------------
// Refusal: unowned input
// ---------------------------------------------------------------------------

describe("fuse — unowned input refused", () => {
  it("refuses when instanceA is not in owned", () => {
    const { state, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, 9999, instanceB, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("input-a-not-owned");
  });

  it("refuses when instanceB is not in owned", () => {
    const { state, instanceA } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, 9999, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("input-b-not-owned");
  });
});

// ---------------------------------------------------------------------------
// Refusal: sum mismatch
// ---------------------------------------------------------------------------

describe("fuse — sum validation", () => {
  it("refuses when size A + size B !== targetSize (e.g. 2+2=4 for target 6)", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(2, 2, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("sum-mismatch");
  });

  it("refuses 1+4=5 for target 6", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 4, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("sum-mismatch");
  });
});

// ---------------------------------------------------------------------------
// Valid fusions: 1+5, 2+4, 3+3
// ---------------------------------------------------------------------------

describe("fuse — valid size-6 fusions", () => {
  it("1+5=6: succeeds, inputs removed, output added", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);

    expect(result.success).toBe(true);
    expect(result.output).not.toBeNull();

    // Both inputs removed
    const ownedIds = result.state.owned.map((c) => c.instanceId);
    expect(ownedIds).not.toContain(instanceA);
    expect(ownedIds).not.toContain(instanceB);

    // Output added
    expect(result.output!.instanceId).toBe(
      result.state.owned.at(-1)!.instanceId,
    );

    // Output is tier 6
    const shape = BESTIARY.find((c) => c.id === result.output!.creatureId);
    expect(shape!.tier).toBe(6);
  });

  it("2+4=6: succeeds", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(2, 4, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(true);
    const shape = BESTIARY.find((c) => c.id === result.output!.creatureId);
    expect(shape!.tier).toBe(6);
  });

  it("3+3=6: succeeds (two different instances of size-3)", () => {
    // Need two different size-3 creatures (different instanceIds)
    const base = makeRunState();
    const size3Creatures = BESTIARY.filter((c) => c.tier === 3);
    const creatureA = size3Creatures[0]!;
    const creatureB = size3Creatures[1] ?? creatureA; // may reuse same creatureId but different instance

    const instanceA = base.nextInstanceId;
    const instanceB = base.nextInstanceId + 1;

    const state: RunState = {
      ...base,
      owned: [
        ...base.owned,
        {
          instanceId: instanceA,
          creatureId: creatureA.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 30,
          facing: 1 as const,
          seed: 100,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: instanceB,
          creatureId: creatureB.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 30,
          facing: 1 as const,
          seed: 200,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: base.nextInstanceId + 2,
      unlockedFusionTiers: [6],
    };

    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(true);
    const shape = BESTIARY.find((c) => c.id === result.output!.creatureId);
    expect(shape!.tier).toBe(6);
  });

  it("nextInstanceId is incremented by 1 on success", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.state.nextInstanceId).toBe(state.nextInstanceId + 1);
  });
});

// ---------------------------------------------------------------------------
// Statistical test: uniform draw across 42 size-6 creatures
// ---------------------------------------------------------------------------

describe("fuse — statistical distribution (size 6)", () => {
  it("draws all 42 size-6 creatures at least once across 5000 fusions", () => {
    const drawn = new Set<number>();
    const rng = makeSeededRng(9999);

    for (let i = 0; i < 5000; i++) {
      // Build a state with 1+5 pair each iteration
      const base: RunState = {
        ...makeRunState(),
        nextInstanceId: i * 10 + 100,
        unlockedFusionTiers: [6],
      };

      const size1Creature = BESTIARY.find((c) => c.tier === 1)!;
      const size5Creature = BESTIARY.find((c) => c.tier === 5)!;

      const instanceA = base.nextInstanceId;
      const instanceB = base.nextInstanceId + 1;

      const state: RunState = {
        ...base,
        owned: [
          ...base.owned,
          {
            instanceId: instanceA,
            creatureId: size1Creature.id,
            position: { x: 5, y: 5 },
            state: "idle" as const,
            stateUntil: 0,
            facing: 1 as const,
            seed: i,
            walkTargetX: 5,
            walkTargetY: 5,
          },
          {
            instanceId: instanceB,
            creatureId: size5Creature.id,
            position: { x: 15, y: 15 },
            state: "idle" as const,
            stateUntil: 0,
            facing: 1 as const,
            seed: i + 1,
            walkTargetX: 15,
            walkTargetY: 15,
          },
        ],
        nextInstanceId: base.nextInstanceId + 2,
      };

      const result = fuse(state, instanceA, instanceB, 6, rng);
      if (result.success && result.output !== null) {
        drawn.add(result.output.creatureId);
      }
    }

    expect(drawn.size).toBe(TIER_COUNTS[6]); // 42
  });
});

// ---------------------------------------------------------------------------
// Atomic refusals: no partial mutation
// ---------------------------------------------------------------------------

describe("fuse — atomic refusals (no partial mutation)", () => {
  it("failed fuse returns the original state object unchanged", () => {
    const { state, instanceA } = makeStateWithPair(1, 5, []);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceA, 6, rng); // same-instance
    // Should return exact same state reference (or equal)
    expect(result.state).toBe(state);
    expect(result.state.owned).toHaveLength(state.owned.length);
  });

  it("locked-tier refusal does not modify owned list", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, []);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.state.owned).toHaveLength(state.owned.length);
  });

  it("sum-mismatch refusal does not modify owned list", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(2, 2, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.state.owned).toHaveLength(state.owned.length);
  });
});

// ---------------------------------------------------------------------------
// unlockedFusionTiers: correct chain
// ---------------------------------------------------------------------------

describe("fuse — unlockedFusionTiers chain", () => {
  it("size 6 owned (output) → tier 7 added to unlockedFusionTiers", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const { state: newState } = fuse(state, instanceA, instanceB, 6, rng);
    expect(newState.unlockedFusionTiers).toContain(7);
  });

  it("state has 6 unlocked before fusion; after fusion output is size-6 → has 7 too", () => {
    const { state, instanceA, instanceB } = makeStateWithPair(1, 5, [6]);
    const rng = makeSeededRng();
    const result = fuse(state, instanceA, instanceB, 6, rng);
    expect(result.success).toBe(true);
    expect(result.state.unlockedFusionTiers).toContain(6);
    expect(result.state.unlockedFusionTiers).toContain(7);
  });
});

// ---------------------------------------------------------------------------
// fusionCost: cost lookup
// ---------------------------------------------------------------------------

import { fusionCost, FUSION_COST } from "./fusion.ts";

describe("fusionCost — cost lookup", () => {
  it("fusionCost(6) returns 0", () => {
    expect(fusionCost(6)).toBe(0);
  });

  it("fusionCost(7) returns 100", () => {
    expect(fusionCost(7)).toBe(100);
  });

  it("fusionCost(8) returns 500", () => {
    expect(fusionCost(8)).toBe(500);
  });

  it("fusionCost(9) returns 2000", () => {
    expect(fusionCost(9)).toBe(2000);
  });

  it("FUSION_COST record has correct entries for all four sizes", () => {
    expect(FUSION_COST[6]).toBe(0);
    expect(FUSION_COST[7]).toBe(100);
    expect(FUSION_COST[8]).toBe(500);
    expect(FUSION_COST[9]).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Vollkommen guarantee: size-9 fusion always returns creature id 166
// ---------------------------------------------------------------------------

describe("fuse — Vollkommen guarantee (size 9 always returns id 166)", () => {
  it("100 size-9 fusions (4+5 or 3+6 etc.) all return creatureId 166", () => {
    const rng = makeSeededRng(777);
    for (let i = 0; i < 100; i++) {
      const { state, instanceA, instanceB } = makeStateWithPair(4, 5, [9]);
      const result = fuse(state, instanceA, instanceB, 9, rng);
      expect(result.success).toBe(true);
      expect(result.output?.creatureId).toBe(166);
    }
  });

  it("size-9 fusion output tier is 9", () => {
    const rng = makeSeededRng(42);
    const { state, instanceA, instanceB } = makeStateWithPair(4, 5, [9]);
    const result = fuse(state, instanceA, instanceB, 9, rng);
    expect(result.success).toBe(true);
    const shape = BESTIARY.find((c) => c.id === result.output!.creatureId);
    expect(shape!.tier).toBe(9);
  });
});
