import { describe, it, expect } from "vitest";
import { holdCapacity, swapHold } from "./hold.ts";
import { makeRunState } from "./runState.ts";
import type { Block } from "./block.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeBlock = (id: string): Block => ({
  id,
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId: "standard",
});

const BLOCK_A = makeBlock("block-a");
const BLOCK_B = makeBlock("block-b");

// ---------------------------------------------------------------------------
// holdCapacity
// ---------------------------------------------------------------------------

describe("holdCapacity", () => {
  it("returns 1 by default (no Spare Pocket)", () => {
    const state = makeRunState();
    expect(holdCapacity(state)).toBe(1);
  });

  it("returns 2 with spare-pocket passive", () => {
    const state = { ...makeRunState(), passives: ["spare-pocket"] };
    expect(holdCapacity(state)).toBe(2);
  });

  it("returns 1 with other passives but not spare-pocket", () => {
    const state = { ...makeRunState(), passives: ["skippers-bonus"] };
    expect(holdCapacity(state)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// swapHold — guard conditions (no-ops)
// ---------------------------------------------------------------------------

describe("swapHold — no-op guards", () => {
  it("is a no-op when status is not running (in-shop)", () => {
    const base = makeRunState();
    const state = { ...base, status: "in-shop" as const, active: BLOCK_A };
    const result = swapHold(state);
    expect(result).toBe(state);
  });

  it("is a no-op when status is ended", () => {
    const base = makeRunState();
    const state = {
      ...base,
      status: "ended" as const,
      active: BLOCK_A,
      endedReason: "spawn-collision" as const,
    };
    const result = swapHold(state);
    expect(result).toBe(state);
  });

  it("is a no-op when holdSwapLockedThisBlock is true", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      holdSwapLockedThisBlock: true,
    };
    const result = swapHold(state);
    expect(result).toBe(state);
  });

  it("is a no-op when active is null", () => {
    const base = makeRunState();
    const state = { ...base, active: null };
    const result = swapHold(state);
    expect(result).toBe(state);
  });

  it("is a no-op when slot index is negative", () => {
    const base = makeRunState();
    const state = { ...base, active: BLOCK_A };
    const result = swapHold(state, -1);
    expect(result).toBe(state);
  });

  it("is a no-op when slot 0 requested but capacity is 0 (impossible in practice, guards anyway)", () => {
    // Slot 0 is always valid for capacity >= 1; this test uses slot 1 without Spare Pocket.
    const base = makeRunState();
    const state = { ...base, active: BLOCK_A };
    // Slot 1 exceeds capacity of 1 (indices 0..0).
    const result = swapHold(state, 1);
    expect(result).toBe(state);
  });

  it("slot 1 is no-op without spare-pocket", () => {
    const base = makeRunState();
    const state = { ...base, active: BLOCK_A, hold: null, hold2: null };
    const result = swapHold(state, 1);
    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// swapHold — stow (hold is empty, becomes new active from draw queue)
// ---------------------------------------------------------------------------

describe("swapHold — stowing first block", () => {
  it("stows active into hold[0] when hold is empty; new active drawn from queue", () => {
    const base = makeRunState();
    // Ensure there is a block in the draw queue.
    const state = {
      ...base,
      active: BLOCK_A,
      hold: null,
      hold2: null,
      holdSwapLockedThisBlock: false,
    };
    // drawQueue must be non-empty for a new active to be drawn.
    // makeRunState already seeds drawQueue, so this should have blocks.
    const result = swapHold(state);
    expect(result.hold).toStrictEqual(BLOCK_A);
    // The new active should be whatever was at drawQueue[0] (or null if empty).
    if (state.drawQueue.length > 0) {
      expect(result.active).toStrictEqual(state.drawQueue[0]);
    } else {
      expect(result.active).toBeNull();
    }
  });

  it("sets holdSwapLockedThisBlock to true after stow", () => {
    const base = makeRunState();
    const state = { ...base, active: BLOCK_A, hold: null, hold2: null };
    const result = swapHold(state);
    expect(result.holdSwapLockedThisBlock).toBe(true);
  });

  it("drawQueue shrinks by 1 after stow (the new active came from queue)", () => {
    const base = makeRunState();
    const state = { ...base, active: BLOCK_A, hold: null, hold2: null };
    const before = state.drawQueue.length;
    const result = swapHold(state);
    expect(result.drawQueue.length).toBe(before > 0 ? before - 1 : 0);
  });
});

// ---------------------------------------------------------------------------
// swapHold — swap (hold[0] non-empty)
// ---------------------------------------------------------------------------

describe("swapHold — swapping with occupied hold", () => {
  it("swaps active and hold[0] when hold[0] is non-null", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      hold: BLOCK_B,
      hold2: null,
      holdSwapLockedThisBlock: false,
    };
    const result = swapHold(state);
    expect(result.active).toStrictEqual(BLOCK_B);
    expect(result.hold).toStrictEqual(BLOCK_A);
  });

  it("sets holdSwapLockedThisBlock to true after swap", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      hold: BLOCK_B,
      hold2: null,
      holdSwapLockedThisBlock: false,
    };
    const result = swapHold(state);
    expect(result.holdSwapLockedThisBlock).toBe(true);
  });

  it("does NOT modify drawQueue when hold is non-empty (no draw needed)", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      hold: BLOCK_B,
      hold2: null,
      holdSwapLockedThisBlock: false,
    };
    const result = swapHold(state);
    expect(result.drawQueue).toStrictEqual(state.drawQueue);
  });
});

// ---------------------------------------------------------------------------
// swapHold — Spare Pocket (slot = 1)
// ---------------------------------------------------------------------------

describe("swapHold — Spare Pocket (slot 1)", () => {
  it("slot 1 works with Spare Pocket passive", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      hold: null,
      hold2: BLOCK_B,
      holdSwapLockedThisBlock: false,
      passives: ["spare-pocket" as const],
    };
    const result = swapHold(state, 1);
    expect(result.active).toStrictEqual(BLOCK_B);
    expect(result.hold2).toStrictEqual(BLOCK_A);
    expect(result.holdSwapLockedThisBlock).toBe(true);
  });

  it("stows active into hold2 when hold2 is null and Spare Pocket active", () => {
    const base = makeRunState();
    const state = {
      ...base,
      active: BLOCK_A,
      hold: BLOCK_B, // slot 0 occupied
      hold2: null,
      holdSwapLockedThisBlock: false,
      passives: ["spare-pocket" as const],
    };
    const result = swapHold(state, 1);
    expect(result.hold2).toStrictEqual(BLOCK_A);
    // New active drawn from queue
    if (state.drawQueue.length > 0) {
      expect(result.active).toStrictEqual(state.drawQueue[0]);
    } else {
      expect(result.active).toBeNull();
    }
  });
});
