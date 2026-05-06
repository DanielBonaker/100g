import { describe, it, expect } from "vitest";
import {
  makeRunState,
  isRunState,
  normalizeRunState,
  computeUnlockedTiers,
  SCHEMA_VERSION,
  STARTER_INSTANCE_ID,
} from "./runState.ts";
import type { RunState } from "./runState.ts";
import { applyAction } from "./garden.ts";

describe("makeRunState", () => {
  it("returns a valid RunState with schemaVersion=1", () => {
    const s = makeRunState();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.schemaVersion).toBe(1);
  });

  it("contains starter Keim (creatureId=0, instanceId=1)", () => {
    const s = makeRunState();
    expect(s.owned).toHaveLength(1);
    const keim = s.owned[0];
    expect(keim).toBeDefined();
    expect(keim!.creatureId).toBe(0);
    expect(keim!.instanceId).toBe(STARTER_INSTANCE_ID);
  });

  it("starter Keim starts with idle state", () => {
    const s = makeRunState();
    expect(s.owned[0]!.state).toBe("idle");
  });

  it("starts at tick 0 with nextInstanceId=2", () => {
    const s = makeRunState();
    expect(s.tick).toBe(0);
    expect(s.nextInstanceId).toBe(2);
  });

  it("accepts a custom rngSeed", () => {
    const s = makeRunState("my-seed");
    expect(s.rngState).toBe("my-seed");
  });

  it("uses default seed when no rngSeed provided", () => {
    const s = makeRunState();
    expect(typeof s.rngState).toBe("string");
    expect(s.rngState.length).toBeGreaterThan(0);
  });

  it("starter Keim position is in the play area (y=8..63)", () => {
    const s = makeRunState();
    const pos = s.owned[0]!.position;
    expect(pos.y).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeLessThanOrEqual(63);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(47);
  });
});

describe("isRunState", () => {
  it("returns true for a valid RunState", () => {
    const s = makeRunState();
    expect(isRunState(s)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRunState(null)).toBe(false);
  });

  it("returns false for missing schemaVersion", () => {
    const s = makeRunState();
    const { schemaVersion: _sv, ...rest } = s;
    expect(isRunState(rest)).toBe(false);
  });

  it("returns false for wrong schemaVersion type", () => {
    expect(isRunState({ ...makeRunState(), schemaVersion: "1" })).toBe(false);
  });

  it("returns false when owned contains a creature missing instanceId", () => {
    const s = makeRunState();
    const bad = {
      ...s,
      owned: [{ ...s.owned[0], instanceId: undefined }],
    };
    expect(isRunState(bad)).toBe(false);
  });

  it("returns false for invalid facing value", () => {
    const s = makeRunState();
    const bad = {
      ...s,
      owned: [{ ...s.owned[0], facing: 0 }],
    };
    expect(isRunState(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uniqueOwnedIds field
// ---------------------------------------------------------------------------

describe("makeRunState — uniqueOwnedIds", () => {
  it("initializes uniqueOwnedIds to [0] (starter Keim)", () => {
    const s = makeRunState();
    expect(s.uniqueOwnedIds).toEqual([0]);
  });

  it("initializes lastYieldPaid to 0", () => {
    const s = makeRunState();
    expect(s.lastYieldPaid).toBe(0);
  });
});

describe("isRunState — uniqueOwnedIds and lastYieldPaid", () => {
  it("returns true when uniqueOwnedIds is a number array", () => {
    const s = makeRunState();
    expect(isRunState(s)).toBe(true);
  });

  it("returns false when uniqueOwnedIds is not an array", () => {
    const s = makeRunState();
    expect(isRunState({ ...s, uniqueOwnedIds: "bad" })).toBe(false);
  });

  it("returns false when lastYieldPaid is not a number", () => {
    const s = makeRunState();
    expect(isRunState({ ...s, lastYieldPaid: "nope" })).toBe(false);
  });
});

describe("normalizeRunState — uniqueOwnedIds backfill", () => {
  it("backfills uniqueOwnedIds from owned when field is absent", () => {
    const s = makeRunState();
    const raw: unknown = {
      ...s,
      uniqueOwnedIds: undefined,
      lastYieldPaid: undefined,
    };
    const normalized = normalizeRunState(raw);
    // owned has creatureId=0 → uniqueOwnedIds should be [0]
    expect(normalized.uniqueOwnedIds).toEqual([0]);
    expect(normalized.lastYieldPaid).toBe(0);
  });

  it("preserves existing uniqueOwnedIds when present", () => {
    const s = makeRunState();
    const raw: unknown = { ...s, uniqueOwnedIds: [0, 1, 5] };
    const normalized = normalizeRunState(raw);
    expect(normalized.uniqueOwnedIds).toEqual([0, 1, 5]);
  });
});

// ---------------------------------------------------------------------------
// unlockedFusionTiers field
// ---------------------------------------------------------------------------

describe("makeRunState — unlockedFusionTiers", () => {
  it("initializes unlockedFusionTiers to []", () => {
    const s = makeRunState();
    expect(s.unlockedFusionTiers).toEqual([]);
  });
});

describe("isRunState — unlockedFusionTiers", () => {
  it("returns true when unlockedFusionTiers is absent (optional)", () => {
    const s = makeRunState();
    // remove field
    const { unlockedFusionTiers: _uf, ...rest } = s as RunState & {
      unlockedFusionTiers?: unknown;
    };
    // absent is fine — normalizeRunState will fill it in
    expect(isRunState(rest as unknown)).toBe(true);
  });

  it("returns false when unlockedFusionTiers is not an array", () => {
    const s = makeRunState();
    expect(isRunState({ ...s, unlockedFusionTiers: "bad" })).toBe(false);
  });

  it("returns false when unlockedFusionTiers contains a non-number", () => {
    const s = makeRunState();
    expect(isRunState({ ...s, unlockedFusionTiers: ["six"] })).toBe(false);
  });
});

describe("normalizeRunState — unlockedFusionTiers backfill", () => {
  it("defaults missing unlockedFusionTiers to []", () => {
    const s = makeRunState();
    const raw: unknown = { ...s, unlockedFusionTiers: undefined };
    const normalized = normalizeRunState(raw);
    expect(normalized.unlockedFusionTiers).toEqual([]);
  });

  it("preserves existing unlockedFusionTiers when present", () => {
    const s = makeRunState();
    const raw: unknown = { ...s, unlockedFusionTiers: [6, 7] };
    const normalized = normalizeRunState(raw);
    expect(normalized.unlockedFusionTiers).toEqual([6, 7]);
  });
});

// ---------------------------------------------------------------------------
// computeUnlockedTiers helper
// ---------------------------------------------------------------------------

describe("computeUnlockedTiers", () => {
  it("owning tier 5 adds 6 to the list", () => {
    expect(computeUnlockedTiers([], 5)).toEqual([6]);
  });

  it("owning tier 6 adds 7 to the list", () => {
    expect(computeUnlockedTiers([6], 6)).toEqual([6, 7]);
  });

  it("owning tier 7 adds 8 to the list", () => {
    expect(computeUnlockedTiers([6, 7], 7)).toEqual([6, 7, 8]);
  });

  it("owning tier 8 adds 9 to the list", () => {
    expect(computeUnlockedTiers([6, 7, 8], 8)).toEqual([6, 7, 8, 9]);
  });

  it("owning tier 1..4 does not change the list (no fusion unlock)", () => {
    for (let t = 1; t <= 4; t++) {
      expect(computeUnlockedTiers([], t)).toEqual([]);
    }
  });

  it("owning tier 9 does not add tier 10 (cap at 9)", () => {
    expect(computeUnlockedTiers([6, 7, 8, 9], 9)).toEqual([6, 7, 8, 9]);
  });

  it("already-unlocked tier is not duplicated", () => {
    expect(computeUnlockedTiers([6], 5)).toEqual([6]); // 6 already present
  });

  it("result is sorted ascending", () => {
    // Simulate out-of-order: if somehow current=[7] and we unlock 6
    const result = computeUnlockedTiers([7], 5);
    expect(result).toEqual([6, 7]);
  });
});

describe("applyAction('own') — uniqueOwnedIds update", () => {
  it("adds new creatureId to uniqueOwnedIds", () => {
    const s = makeRunState();
    const next = applyAction(s, {
      type: "own",
      creatureId: 3,
      position: { x: 10, y: 10 },
    });
    expect(next.uniqueOwnedIds).toContain(3);
  });

  it("does not duplicate an existing creatureId in uniqueOwnedIds", () => {
    const s = makeRunState();
    // Own creature 0 again (already in uniqueOwnedIds from start)
    const next = applyAction(s, {
      type: "own",
      creatureId: 0,
      position: { x: 5, y: 5 },
    });
    const count = next.uniqueOwnedIds.filter((id) => id === 0).length;
    expect(count).toBe(1);
  });

  it("uniqueOwnedIds grows monotonically across multiple owns", () => {
    let s = makeRunState();
    s = applyAction(s, {
      type: "own",
      creatureId: 1,
      position: { x: 5, y: 5 },
    });
    s = applyAction(s, {
      type: "own",
      creatureId: 2,
      position: { x: 5, y: 5 },
    });
    s = applyAction(s, {
      type: "own",
      creatureId: 1,
      position: { x: 5, y: 5 },
    }); // duplicate
    expect(s.uniqueOwnedIds).toContain(0);
    expect(s.uniqueOwnedIds).toContain(1);
    expect(s.uniqueOwnedIds).toContain(2);
    // Set semantics: no duplicates
    const set = new Set(s.uniqueOwnedIds);
    expect(set.size).toBe(s.uniqueOwnedIds.length);
  });
});
