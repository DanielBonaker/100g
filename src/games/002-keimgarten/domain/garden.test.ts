import { describe, it, expect } from "vitest";
import { applyAction } from "./garden.ts";
import { makeRunState } from "./runState.ts";

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
