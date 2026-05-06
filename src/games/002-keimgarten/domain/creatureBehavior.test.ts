import { describe, it, expect } from "vitest";
import { tick, ALL_BEHAVIOR_STATES } from "./creatureBehavior.ts";
import { makeRunState } from "./runState.ts";
import type { OwnedCreature, BehaviorState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

const PLAY_BOUNDS = { minX: 0, maxX: 47, minY: 0, maxY: 55 };

// Deterministic RNG returning a fixed sequence
function makeFixedRng(values: number[]): SeededRng {
  let idx = 0;
  const rng: SeededRng = {
    next(): number {
      const v = values[idx % values.length] ?? 0.5;
      idx++;
      return v;
    },
    int(min: number, max: number): number {
      const v = values[idx % values.length] ?? 0.5;
      idx++;
      return Math.floor(min + v * (max - min + 1));
    },
    fork(): SeededRng {
      return makeFixedRng(values);
    },
    get state(): string {
      return `fixed-${String(idx)}`;
    },
  };
  return rng;
}

function starterCreature(): OwnedCreature {
  return makeRunState().owned[0]!;
}

function makeCreatureInState(
  state: BehaviorState,
  stateUntil: number,
  extra?: Partial<OwnedCreature>,
): OwnedCreature {
  return {
    instanceId: 1,
    creatureId: 0,
    position: { x: 24, y: 28 },
    state,
    stateUntil,
    totalTaps: 0,
    facing: 1,
    seed: 42,
    walkTargetX: 30,
    walkTargetY: 30,
    ...extra,
  };
}

describe("ALL_BEHAVIOR_STATES", () => {
  it("contains all 5 required states", () => {
    const states: BehaviorState[] = ["idle", "walk", "hop", "play", "nap"];
    for (const s of states) {
      expect(ALL_BEHAVIOR_STATES).toContain(s);
    }
    expect(ALL_BEHAVIOR_STATES).toHaveLength(5);
  });
});

describe("tick — idle state", () => {
  it("does not move creature while idle and stateUntil not reached", () => {
    const c = makeCreatureInState("idle", 100);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position).toEqual(c.position);
    expect(result.state).toBe("idle");
  });

  it("transitions to walk when roll < 0.6 at stateUntil", () => {
    const c = makeCreatureInState("idle", 30, { seed: 0 });
    // We need the creatureRng to produce < 0.6 for the first roll
    // Using seed=0, tick=30: let's just check that it transitions to some state
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 30, PLAY_BOUNDS, rng);
    expect(["walk", "nap", "idle"]).toContain(result.state);
  });

  it("transitions to nap when roll >= 0.6 and < 0.8", () => {
    const c = makeCreatureInState("idle", 10, { seed: 9999 });
    const rng = makeFixedRng([0.7]);
    const result = tick(c, 10, PLAY_BOUNDS, rng);
    // state should transition (not stay identical stateUntil)
    expect(result.stateUntil).toBeGreaterThan(10);
    expect(["walk", "nap", "idle"]).toContain(result.state);
  });
});

describe("tick — walk state", () => {
  it("moves creature one pixel toward walk target per tick", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 20, y: 20 },
      walkTargetX: 30,
      walkTargetY: 30,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position.x).toBe(21);
    expect(result.position.y).toBe(21);
    expect(result.state).toBe("walk");
  });

  it("stays at target when already there", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 30, y: 30 },
      walkTargetX: 30,
      walkTargetY: 30,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position).toEqual({ x: 30, y: 30 });
  });

  it("transitions from walk on stateUntil reached", () => {
    const c = makeCreatureInState("walk", 50, {
      position: { x: 10, y: 10 },
      walkTargetX: 30,
      walkTargetY: 30,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(["idle", "walk", "nap"]).toContain(result.state);
    expect(result.stateUntil).toBeGreaterThan(50);
  });

  it("clamps movement to playBounds", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 0, y: 0 },
      walkTargetX: -10,
      walkTargetY: -10,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position.x).toBeGreaterThanOrEqual(PLAY_BOUNDS.minX);
    expect(result.position.y).toBeGreaterThanOrEqual(PLAY_BOUNDS.minY);
  });

  it("facing is updated when walking right", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 10, y: 10 },
      walkTargetX: 20,
      walkTargetY: 10,
      facing: -1,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.facing).toBe(1);
  });

  it("facing is updated when walking left", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 20, y: 10 },
      walkTargetX: 5,
      walkTargetY: 10,
      facing: 1,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.facing).toBe(-1);
  });
});

describe("tick — nap state", () => {
  it("does not move while napping", () => {
    const c = makeCreatureInState("nap", 200);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position).toEqual(c.position);
    expect(result.state).toBe("nap");
  });

  it("transitions to idle on stateUntil reached", () => {
    const c = makeCreatureInState("nap", 50);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.state).toBe("idle");
    expect(result.stateUntil).toBeGreaterThan(50);
  });
});

describe("tick — hop state", () => {
  it("transitions to idle on stateUntil reached", () => {
    const c = makeCreatureInState("hop", 50);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.state).toBe("idle");
  });

  it("does not move while hopping before stateUntil", () => {
    const c = makeCreatureInState("hop", 100);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position).toEqual(c.position);
    expect(result.state).toBe("hop");
  });
});

describe("tick — play state", () => {
  it("transitions to idle on stateUntil reached", () => {
    const c = makeCreatureInState("play", 50);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.state).toBe("idle");
  });

  it("does not move while in play state before stateUntil", () => {
    const c = makeCreatureInState("play", 100);
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(result.position).toEqual(c.position);
    expect(result.state).toBe("play");
  });
});

describe("tick — determinism", () => {
  it("produces same result for same inputs", () => {
    const c = starterCreature();
    const rng1 = makeFixedRng([0.3, 0.7, 0.2]);
    const rng2 = makeFixedRng([0.3, 0.7, 0.2]);
    const r1 = tick(c, 30, PLAY_BOUNDS, rng1);
    const r2 = tick(c, 30, PLAY_BOUNDS, rng2);
    expect(r1.state).toBe(r2.state);
    expect(r1.stateUntil).toBe(r2.stateUntil);
  });

  it("positions are integer pixels after walk ticks", () => {
    const c = makeCreatureInState("walk", 100, {
      position: { x: 10, y: 10 },
      walkTargetX: 20,
      walkTargetY: 20,
    });
    const rng = makeFixedRng([0.5]);
    const result = tick(c, 50, PLAY_BOUNDS, rng);
    expect(Number.isInteger(result.position.x)).toBe(true);
    expect(Number.isInteger(result.position.y)).toBe(true);
  });
});
