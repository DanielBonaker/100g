import { describe, it, expect } from "vitest";
import { makeRunState, isRunState } from "./runState.ts";
import { BOARD_ROWS, BOARD_COLS } from "./board.ts";

describe("makeRunState", () => {
  it("returns a state with status running", () => {
    const state = makeRunState();
    expect(state.status).toBe("running");
  });

  it("returns a state with an empty board of correct dimensions", () => {
    const state = makeRunState();
    expect(state.board).toHaveLength(BOARD_ROWS);
    expect(state.board[0]).toHaveLength(BOARD_COLS);
  });

  it("all board cells are null initially", () => {
    const state = makeRunState();
    for (const row of state.board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it("committedBlocks starts at 0", () => {
    const state = makeRunState();
    expect(state.committedBlocks).toBe(0);
  });

  it("nextCellId starts at 1", () => {
    const state = makeRunState();
    expect(state.nextCellId).toBe(1);
  });

  it("includes all placeholder fields for future slices", () => {
    const state = makeRunState();
    expect(typeof state.rngState).toBe("string");
    expect(Array.isArray(state.deck)).toBe(true);
    expect(Array.isArray(state.drawQueue)).toBe(true);
    // active can be null
    expect(state.hold).toBeNull();
    expect(state.holdSwapLockedThisBlock).toBe(false);
    expect(state.clearedRowsThisRun).toBe(0);
    expect(state.clearedRowsThisRound).toBe(0);
    expect(state.highestRoundReached).toBe(0);
    expect(state.round).toBe(1);
    expect(state.gold).toBe(0);
    expect(state.garbageDropsThisRound).toBe(0);
    expect(Array.isArray(state.achievementsUnlockedThisRun)).toBe(true);
    expect(state.endedReason).toBeNull();
  });

  it("accepts a seed string and serializes it into rngState", () => {
    const state = makeRunState("seed-abc");
    expect(typeof state.rngState).toBe("string");
    expect(state.rngState.length).toBeGreaterThan(0);
  });

  it("same seed produces same initial deck sequence (deterministic)", () => {
    const s1 = makeRunState("seed-xyz");
    const s2 = makeRunState("seed-xyz");
    expect(s1.deck.length).toBe(s2.deck.length);
    for (let i = 0; i < s1.deck.length; i++) {
      expect(s1.deck[i]?.effectId).toBe(s2.deck[i]?.effectId);
    }
  });
});

describe("isRunState", () => {
  it("returns true for a valid state from makeRunState", () => {
    const state = makeRunState();
    expect(isRunState(state)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRunState(null)).toBe(false);
  });

  it("returns false for a plain object missing required fields", () => {
    expect(isRunState({ board: "nope" })).toBe(false);
  });

  it("returns false for an old-shape state missing new fields", () => {
    // Simulates a RunState from before this slice (missing rngState etc.)
    const oldShape = {
      board: ((): null[][] => {
        const b: null[][] = [];
        for (let r = 0; r < BOARD_ROWS; r++) {
          const row: null[] = [];
          for (let c = 0; c < BOARD_COLS; c++) row.push(null);
          b.push(row);
        }
        return b;
      })(),
      activeColumn: 4,
      status: "running",
      committedBlocks: 0,
      nextCellId: 1,
      // deliberately missing: rngState, deck, drawQueue, active, hold, etc.
    };
    expect(isRunState(oldShape)).toBe(false);
  });

  it("returns false for a state with wrong board dimensions", () => {
    const state = makeRunState();
    const bad = { ...state, board: [[null]] };
    expect(isRunState(bad)).toBe(false);
  });

  it("returns false for a state with invalid status", () => {
    const state = makeRunState();
    const bad = { ...state, status: "paused" };
    expect(isRunState(bad)).toBe(false);
  });
});
