import { describe, it, expect } from "vitest";
import { applyAction } from "./garden.ts";
import { makeRunState } from "./runState.ts";
import type { RunState } from "./runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";

describe("applyAction — own", () => {
  it("adds a creature to RunState.owned", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 1,
      position: { x: 10, y: 20 },
    });
    expect(next.owned).toHaveLength(2);
  });

  it("increments nextInstanceId", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 1,
      position: { x: 10, y: 20 },
    });
    expect(next.nextInstanceId).toBe(state.nextInstanceId + 1);
  });

  it("assigns the correct creatureId to the new creature", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 5,
      position: { x: 15, y: 25 },
    });
    const newCreature = next.owned[next.owned.length - 1];
    expect(newCreature).toBeDefined();
    expect(newCreature!.creatureId).toBe(5);
  });

  it("assigns the correct position", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 2,
      position: { x: 12, y: 22 },
    });
    const newCreature = next.owned[next.owned.length - 1];
    expect(newCreature!.position).toEqual({ x: 12, y: 22 });
  });

  it("new creature starts in idle state", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 3,
      position: { x: 5, y: 10 },
    });
    const newCreature = next.owned[next.owned.length - 1];
    expect(newCreature!.state).toBe("idle");
  });

  it("assigns a unique instanceId to the new creature", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 0,
      position: { x: 24, y: 28 },
    });
    const newCreature = next.owned[next.owned.length - 1];
    expect(newCreature!.instanceId).toBe(state.nextInstanceId);
    // instanceId is different from the starter Keim
    expect(newCreature!.instanceId).not.toBe(state.owned[0]!.instanceId);
  });

  it("does not mutate the original state", () => {
    const state = makeRunState();
    const originalLength = state.owned.length;
    applyAction(state, {
      type: "own",
      creatureId: 1,
      position: { x: 10, y: 10 },
    });
    expect(state.owned).toHaveLength(originalLength);
  });

  it("positions are rounded to integer pixels", () => {
    const state = makeRunState();
    const next = applyAction(state, {
      type: "own",
      creatureId: 0,
      position: { x: 10.7, y: 20.3 },
    });
    const newCreature = next.owned[next.owned.length - 1];
    expect(Number.isInteger(newCreature!.position.x)).toBe(true);
    expect(Number.isInteger(newCreature!.position.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tap-creature action
// ---------------------------------------------------------------------------

describe("applyAction — tap-creature", () => {
  // Helper: build a state with two creatures of the same creatureId
  const makeStateWithTwo = (): RunState => {
    let s = makeRunState(); // starter Keim instanceId=1, creatureId=0
    s = applyAction(s, {
      type: "own",
      creatureId: 0,
      position: { x: 20, y: 30 },
    }); // instanceId=2, creatureId=0
    return s;
  };

  it("increments totalTapsByCreatureId for the tapped creatureId", () => {
    const state = makeRunState();
    const creatureId = state.owned[0]!.creatureId; // 0
    const instanceId = state.owned[0]!.instanceId; // 1
    const next = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: state.tick,
    });
    expect(next.totalTapsByCreatureId[creatureId]).toBe(1);
  });

  it("accumulates taps across multiple taps", () => {
    let state = makeRunState();
    const { instanceId, creatureId } = state.owned[0]!;
    state = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: state.tick,
    });
    state = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: state.tick,
    });
    expect(state.totalTapsByCreatureId[creatureId]).toBe(2);
  });

  it("forces the tapped creature into hop state", () => {
    const state = makeRunState();
    const { instanceId, creatureId } = state.owned[0]!;
    const next = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: state.tick,
    });
    const creature = next.owned.find((c) => c.instanceId === instanceId);
    expect(creature!.state).toBe("hop");
  });

  it("hop stateUntil is ~24 ticks in the future", () => {
    const state = makeRunState();
    const { instanceId, creatureId } = state.owned[0]!;
    const next = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: 10,
    });
    const creature = next.owned.find((c) => c.instanceId === instanceId);
    // 24 ticks = 0.4s at 60fps
    expect(creature!.stateUntil).toBe(10 + 24);
  });

  it("two instances of the same creatureId share the affection counter", () => {
    const state = makeStateWithTwo();
    const first = state.owned[0]!; // instanceId=1, creatureId=0
    const second = state.owned[1]!; // instanceId=2, creatureId=0

    // Tap first instance
    const after1 = applyAction(state, {
      type: "tap-creature",
      instanceId: first.instanceId,
      creatureId: first.creatureId,
      tick: 0,
    });
    // Tap second instance (same creatureId)
    const after2 = applyAction(after1, {
      type: "tap-creature",
      instanceId: second.instanceId,
      creatureId: second.creatureId,
      tick: 0,
    });

    expect(after2.totalTapsByCreatureId[first.creatureId]).toBe(2);
  });

  it("only the tapped instance enters hop; others remain in their state", () => {
    const state = makeStateWithTwo();
    const first = state.owned[0]!;
    const second = state.owned[1]!;

    const next = applyAction(state, {
      type: "tap-creature",
      instanceId: first.instanceId,
      creatureId: first.creatureId,
      tick: 0,
    });

    const firstAfter = next.owned.find(
      (c) => c.instanceId === first.instanceId,
    );
    const secondAfter = next.owned.find(
      (c) => c.instanceId === second.instanceId,
    );

    expect(firstAfter!.state).toBe("hop");
    // second creature was idle, should remain idle
    expect(secondAfter!.state).toBe(second.state);
  });

  it("tap with unknown instanceId is a no-op for creature states", () => {
    const state = makeRunState();
    const { creatureId } = state.owned[0]!;
    const next = applyAction(state, {
      type: "tap-creature",
      instanceId: 9999,
      creatureId,
      tick: 0,
    });
    // Counter still increments (creatureId is valid)
    expect(next.totalTapsByCreatureId[creatureId]).toBe(1);
    // No creature state changed
    for (let i = 0; i < next.owned.length; i++) {
      expect(next.owned[i]!.state).toBe(state.owned[i]!.state);
    }
  });

  it("does not change currency (purely affection)", () => {
    // RunState has no currency field — verify no extra field appears
    const state = makeRunState();
    const { instanceId, creatureId } = state.owned[0]!;
    const next = applyAction(state, {
      type: "tap-creature",
      instanceId,
      creatureId,
      tick: 0,
    });
    // The only new field should be totalTapsByCreatureId updated
    expect("currency" in next).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyAction('own') — unlockedFusionTiers update
// ---------------------------------------------------------------------------

describe("applyAction('own') — unlockedFusionTiers", () => {
  it("owning a size-5 creature unlocks fusion tier 6", () => {
    const state = makeRunState();
    const size5 = BESTIARY.find((c) => c.tier === 5)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size5.id,
      position: { x: 10, y: 10 },
    });
    expect(next.unlockedFusionTiers).toContain(6);
  });

  it("owning a size-6 creature unlocks fusion tier 7", () => {
    const state = makeRunState();
    const size6 = BESTIARY.find((c) => c.tier === 6)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size6.id,
      position: { x: 10, y: 10 },
    });
    expect(next.unlockedFusionTiers).toContain(7);
  });

  it("owning a size-7 creature unlocks fusion tier 8", () => {
    const state = makeRunState();
    const size7 = BESTIARY.find((c) => c.tier === 7)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size7.id,
      position: { x: 10, y: 10 },
    });
    expect(next.unlockedFusionTiers).toContain(8);
  });

  it("owning a size-8 creature unlocks fusion tier 9", () => {
    const state = makeRunState();
    const size8 = BESTIARY.find((c) => c.tier === 8)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size8.id,
      position: { x: 10, y: 10 },
    });
    expect(next.unlockedFusionTiers).toContain(9);
  });

  it("owning a size-1 creature does NOT change unlockedFusionTiers", () => {
    const state = makeRunState(); // starter Keim is size-1
    const size1 = BESTIARY.find((c) => c.tier === 1)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size1.id,
      position: { x: 10, y: 10 },
    });
    expect(next.unlockedFusionTiers).toEqual([]);
  });

  it("unlock persists even if you already had 6 unlocked", () => {
    // Start with [6] already; owning a size-5 again should not duplicate
    const base = makeRunState();
    const state: RunState = { ...base, unlockedFusionTiers: [6] };
    const size5 = BESTIARY.find((c) => c.tier === 5)!;
    const next = applyAction(state, {
      type: "own",
      creatureId: size5.id,
      position: { x: 10, y: 10 },
    });
    const count6 = next.unlockedFusionTiers.filter((t) => t === 6).length;
    expect(count6).toBe(1);
  });
});
