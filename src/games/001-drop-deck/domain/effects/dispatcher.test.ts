import { describe, it, expect } from "vitest";
import { resolveEffect } from "./dispatcher.ts";
import { makeRunState } from "../runState.ts";
import type { SeededRng } from "../../../../engine/Game.ts";
import type { PlaceContext } from "./types.ts";

const makeTestRng = (): SeededRng => ({
  next: () => 0.5,
  int: (min) => min,
  fork: function () {
    return this;
  },
  state: "test",
});

const make1x1Block = (effectId: PlaceContext["block"]["effectId"]) => ({
  id: `${effectId}-1x1`,
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId,
});

describe("resolveEffect — standard strategy", () => {
  it("dispatches standard effectId to standard strategy (lands at bottom)", () => {
    const state = makeRunState("seed-1");
    const block = make1x1Block("standard");
    const ctx: PlaceContext = { state, block, column: 3, rng: makeTestRng() };
    const result = resolveEffect(ctx);
    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
  });

  it("standard strategy detects top-out when column row 0 occupied", () => {
    let state = makeRunState("seed-2");
    const block = make1x1Block("standard");
    const rng = makeTestRng();
    // Fill column 3 completely
    for (let i = 0; i < 16; i++) {
      const ctx: PlaceContext = { state, block, column: 3, rng };
      const r = resolveEffect(ctx);
      state = r.state;
    }
    const ctx: PlaceContext = { state, block, column: 3, rng };
    const result = resolveEffect(ctx);
    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });

  it("standard strategy places multi-cell block at lowest valid row", () => {
    const state = makeRunState("seed-3");
    // 2-wide block: cells at (dx=0,dy=0) and (dx=1,dy=0)
    const block = {
      id: "std-2x1",
      cellCount: 2,
      cells: [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
      ],
      effectId: "standard" as const,
    };
    const ctx: PlaceContext = { state, block, column: 2, rng: makeTestRng() };
    const result = resolveEffect(ctx);
    expect(result.toppedOut).toBe(false);
    // Both cells should be in the bottom row
    const bottomRow = result.state.board[15];
    expect(bottomRow?.[2]).not.toBeNull();
    expect(bottomRow?.[3]).not.toBeNull();
  });
});

describe("resolveEffect — stub strategies throw not implemented", () => {
  it("ghost strategy places block at deepest valid row (no longer a stub)", () => {
    const state = makeRunState("seed-1");
    const block = make1x1Block("ghost");
    const ctx: PlaceContext = { state, block, column: 3, rng: makeTestRng() };
    const result = resolveEffect(ctx);
    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
  });

  it("melt strategy throws not implemented", () => {
    const state = makeRunState("seed-1");
    const block = make1x1Block("melt");
    const ctx: PlaceContext = { state, block, column: 3, rng: makeTestRng() };
    expect(() => resolveEffect(ctx)).toThrow("melt strategy: not implemented");
  });

  it("impact strategy throws not implemented", () => {
    const state = makeRunState("seed-1");
    const block = make1x1Block("impact");
    const ctx: PlaceContext = { state, block, column: 3, rng: makeTestRng() };
    expect(() => resolveEffect(ctx)).toThrow(
      "impact strategy: not implemented",
    );
  });

  it("rain strategy throws not implemented", () => {
    const state = makeRunState("seed-1");
    const block = make1x1Block("rain");
    const ctx: PlaceContext = { state, block, column: 3, rng: makeTestRng() };
    expect(() => resolveEffect(ctx)).toThrow("rain strategy: not implemented");
  });
});
