// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ghostStrategy } from "./ghost.ts";
import { makeRunState } from "../../runState.ts";
import { makeRng } from "../../rng.ts";
import type { Block } from "../../block.ts";
import type { EffectId } from "../types.ts";
import type { Board, Cell } from "../../boardTypes.ts";
import { emptyBoard, BOARD_ROWS, BOARD_COLS } from "../../boardTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const make1x1Block = (effectId: EffectId = "ghost"): Block => ({
  id: "ghost-test-1x1",
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId,
});

const make2x1Horizontal = (effectId: EffectId = "ghost"): Block => ({
  id: "ghost-test-2x1h",
  cellCount: 2,
  cells: [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
  ],
  effectId,
});

/** Build a board with occupied cells at the specified (row, col) positions. */
const boardWithCells = (occupied: readonly [number, number][]): Board => {
  const rows: Cell[][] = (emptyBoard() as Cell[][]).map((row) => [...row]);
  let id = 1;
  for (const [r, c] of occupied) {
    const row = rows[r];
    if (row !== undefined) {
      row[c] = { id: id++ };
    }
  }
  return rows;
};

const makeTestRng = () => makeRng("ghost-test-seed");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ghostStrategy", () => {
  it("lands at bottom row when no overhangs — identical to Standard regression", () => {
    // Empty board: a 1×1 ghost block dropped at column 3 should reach row 15
    const state = makeRunState("seed-ghost-1");
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 3, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
    // Cell should be in the bottom row (row 15 = BOARD_ROWS - 1)
    const bottomRow = result.state.board[BOARD_ROWS - 1];
    expect(bottomRow?.[3]).not.toBeNull();
  });

  it("passes through a single overhang to land below it", () => {
    // Row 5, col 4 is occupied. Ghost drops 1×1 at col 4.
    // Standard would stop at row 4 (above the obstruction).
    // Ghost skips through the obstruction and finds the deepest row
    // where (R, 4) is empty — which is row 15 (board bottom).
    const state = {
      ...makeRunState("seed-ghost-2"),
      board: boardWithCells([[5, 4]]),
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Block should land at row 15 (deepest empty cell in col 4)
    const bottomRow = result.state.board[BOARD_ROWS - 1];
    expect(bottomRow?.[4]).not.toBeNull();
  });

  it("cannot reach floor when columns disagree — stops above the obstruction", () => {
    // 2×1 horizontal block: cells at (dx=0, col 2) and (dx=1, col 3).
    // Column 2 is full from row 8 down; column 3 is clear.
    // The block cannot pass through the obstruction in col 2, so it finds
    // the deepest R where BOTH cols are empty: R = 7.
    const occupied: [number, number][] = [];
    for (let r = 8; r < BOARD_ROWS; r++) {
      occupied.push([r, 2]);
    }
    const state = {
      ...makeRunState("seed-ghost-3"),
      board: boardWithCells(occupied),
    };
    const block = make2x1Horizontal();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 2, rng });

    expect(result.toppedOut).toBe(false);
    // Row 7 is the deepest row where col 2 is empty (rows 8–15 are occupied)
    const row7 = result.state.board[7];
    expect(row7?.[2]).not.toBeNull();
    expect(row7?.[3]).not.toBeNull();
  });

  it("reaches floor when both columns are clear all the way", () => {
    // 2×1 horizontal block, cols 5 and 6 are completely empty.
    // Block should land at row 15.
    const state = makeRunState("seed-ghost-4");
    const block = make2x1Horizontal();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 5, rng });

    expect(result.toppedOut).toBe(false);
    const bottomRow = result.state.board[BOARD_ROWS - 1];
    expect(bottomRow?.[5]).not.toBeNull();
    expect(bottomRow?.[6]).not.toBeNull();
  });

  it("detects top-out when no valid row exists (entire column filled)", () => {
    // Fill all 16 rows in col 3 → no R satisfies fits → top-out.
    const occupied: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      occupied.push([r, 3]);
    }
    const state = {
      ...makeRunState("seed-ghost-5"),
      board: boardWithCells(occupied),
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 3, rng });

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });

  it("no-op when state is already ended", () => {
    const state = {
      ...makeRunState("seed-ghost-6"),
      status: "ended" as const,
      endedReason: "spawn-collision" as const,
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 3, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("ended");
  });

  it("clears full rows after placement (cascade)", () => {
    // Fill an entire row (row 15) except col 0. Place 1×1 ghost at col 0.
    // After placement the row should clear.
    const occupied: [number, number][] = [];
    for (let c = 1; c < BOARD_COLS; c++) {
      occupied.push([BOARD_ROWS - 1, c]);
    }
    const state = {
      ...makeRunState("seed-ghost-7"),
      board: boardWithCells(occupied),
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = ghostStrategy.resolve({ state, block, column: 0, rng });

    expect(result.toppedOut).toBe(false);
    // After clearing, the clearedRowsThisRun counter should have increased
    expect(result.state.clearedRowsThisRun).toBeGreaterThan(
      state.clearedRowsThisRun,
    );
  });
});
