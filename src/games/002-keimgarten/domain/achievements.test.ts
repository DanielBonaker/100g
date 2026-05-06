import { describe, it, expect } from "vitest";
import { evaluate, ACHIEVEMENT_IDS } from "./achievements.ts";
import { makeRunState } from "./runState.ts";
import type { RunState } from "./runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseState = (): RunState => ({
  ...makeRunState(),
  achievementsUnlocked: [],
});

// ---------------------------------------------------------------------------
// fusion-completed trigger
// ---------------------------------------------------------------------------

describe("evaluate — fusion-completed trigger", () => {
  it("adds first-fusion when not yet unlocked", () => {
    const state = baseState();
    const result = evaluate(state, { type: "fusion-completed" });
    expect(result).toContain("first-fusion");
  });

  it("is idempotent: calling twice with fusion-completed does not duplicate", () => {
    const state = baseState();
    const once = evaluate(state, { type: "fusion-completed" });
    const stateAfter: RunState = { ...state, achievementsUnlocked: once };
    const twice = evaluate(stateAfter, { type: "fusion-completed" });
    const count = twice.filter((id) => id === "first-fusion").length;
    expect(count).toBe(1);
  });

  it("does NOT add first-fusion when it is already present", () => {
    const state: RunState = {
      ...baseState(),
      achievementsUnlocked: ["first-fusion"],
    };
    const result = evaluate(state, { type: "fusion-completed" });
    const count = result.filter((id) => id === "first-fusion").length;
    expect(count).toBe(1);
  });

  it("does NOT add first-archon or vollkommen on fusion-completed alone", () => {
    const state = baseState();
    const result = evaluate(state, { type: "fusion-completed" });
    expect(result).not.toContain("first-archon");
    expect(result).not.toContain("vollkommen");
  });
});

// ---------------------------------------------------------------------------
// creature-added trigger — size 8
// ---------------------------------------------------------------------------

describe("evaluate — creature-added trigger, tier 8", () => {
  const size8 = BESTIARY.find((c) => c.tier === 8)!;

  it("adds first-archon when a tier-8 creature is added", () => {
    const state = baseState();
    const result = evaluate(state, {
      type: "creature-added",
      creatureId: size8.id,
    });
    expect(result).toContain("first-archon");
  });

  it("is idempotent for first-archon", () => {
    const state: RunState = {
      ...baseState(),
      achievementsUnlocked: ["first-archon"],
    };
    const result = evaluate(state, {
      type: "creature-added",
      creatureId: size8.id,
    });
    const count = result.filter((id) => id === "first-archon").length;
    expect(count).toBe(1);
  });

  it("does NOT add vollkommen on tier-8 creature-added", () => {
    const state = baseState();
    const result = evaluate(state, {
      type: "creature-added",
      creatureId: size8.id,
    });
    expect(result).not.toContain("vollkommen");
  });
});

// ---------------------------------------------------------------------------
// creature-added trigger — size 9 (Vollkommen, creatureId=166)
// ---------------------------------------------------------------------------

describe("evaluate — creature-added trigger, tier 9", () => {
  it("adds vollkommen when tier-9 creature (id=166) is added", () => {
    const state = baseState();
    const result = evaluate(state, {
      type: "creature-added",
      creatureId: 166,
    });
    expect(result).toContain("vollkommen");
  });

  it("is idempotent for vollkommen", () => {
    const state: RunState = {
      ...baseState(),
      achievementsUnlocked: ["vollkommen"],
    };
    const result = evaluate(state, { type: "creature-added", creatureId: 166 });
    const count = result.filter((id) => id === "vollkommen").length;
    expect(count).toBe(1);
  });

  it("does NOT add first-archon on tier-9 creature-added alone", () => {
    const state = baseState();
    const result = evaluate(state, { type: "creature-added", creatureId: 166 });
    expect(result).not.toContain("first-archon");
  });
});

// ---------------------------------------------------------------------------
// creature-added trigger — tiers 1–7 (no archon/vollkommen)
// ---------------------------------------------------------------------------

describe("evaluate — creature-added trigger, tiers 1-7", () => {
  it.each([1, 2, 3, 4, 5, 6, 7])(
    "tier %i creature-added does not add first-archon or vollkommen",
    (tier) => {
      const creature = BESTIARY.find((c) => c.tier === tier)!;
      const state = baseState();
      const result = evaluate(state, {
        type: "creature-added",
        creatureId: creature.id,
      });
      expect(result).not.toContain("first-archon");
      expect(result).not.toContain("vollkommen");
    },
  );
});

// ---------------------------------------------------------------------------
// Result ordering: sorted by ACHIEVEMENT_IDS order
// ---------------------------------------------------------------------------

describe("evaluate — result ordering", () => {
  it("result is sorted in ACHIEVEMENT_IDS order", () => {
    // Achieve all three from scratch
    const size8 = BESTIARY.find((c) => c.tier === 8)!;
    let state = baseState();

    // Add first-archon trigger
    state = {
      ...state,
      achievementsUnlocked: evaluate(state, {
        type: "creature-added",
        creatureId: size8.id,
      }),
    };
    // Add vollkommen trigger
    state = {
      ...state,
      achievementsUnlocked: evaluate(state, {
        type: "creature-added",
        creatureId: 166,
      }),
    };
    // Add first-fusion trigger
    const result = evaluate(state, { type: "fusion-completed" });

    const expectedOrder = ACHIEVEMENT_IDS.filter((id) => result.includes(id));
    expect(result).toEqual(expectedOrder);
  });
});
