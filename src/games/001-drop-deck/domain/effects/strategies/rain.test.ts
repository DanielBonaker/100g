// @vitest-environment node
import { describe, expect, it } from "vitest";
import { rainStrategy } from "./rain.ts";
import { makeRunState } from "../../runState.ts";
import { makeRng } from "../../rng.ts";
import type { Block } from "../../block.ts";
import type { EffectId } from "../types.ts";
import type { Board, Cell } from "../../boardTypes.ts";
import { emptyBoard, BOARD_ROWS, BOARD_COLS } from "../../boardTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const make1x1Block = (effectId: EffectId = "rain"): Block => ({
  id: "rain-test-1x1",
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId,
});

/** 1×3 horizontal: cells at (dx=0,dy=0), (dx=1,dy=0), (dx=2,dy=0) */
const make3x1HorizontalBlock = (effectId: EffectId = "rain"): Block => ({
  id: "rain-test-3x1h",
  cellCount: 3,
  cells: [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 2, dy: 0 },
  ],
  effectId,
});

/** 1×3 vertical: cells at (dx=0,dy=0), (dx=0,dy=1), (dx=0,dy=2) */
const make1x3VerticalBlock = (effectId: EffectId = "rain"): Block => ({
  id: "rain-test-1x3v",
  cellCount: 3,
  cells: [
    { dx: 0, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: 2 },
  ],
  effectId,
});

/**
 * L-shape: (dx=0,dy=0), (dx=0,dy=1), (dx=1,dy=1)
 * Column 0 (relative) has 2 cells (dy=0,dy=1), column 1 has 1 cell (dy=1).
 */
const makeLShapeBlock = (effectId: EffectId = "rain"): Block => ({
  id: "rain-test-lshape",
  cellCount: 3,
  cells: [
    { dx: 0, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ],
  effectId,
});

/** 2×1 horizontal: cells at (dx=0,dy=0), (dx=1,dy=0) */
const make2x1HorizontalBlock = (effectId: EffectId = "rain"): Block => ({
  id: "rain-test-2x1h",
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

const makeTestRng = () => makeRng("rain-test-seed");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rainStrategy", () => {
  it("1-cell block: Standard regression — lands at bottom row of its column", () => {
    // 1×1 rain block at column 4 on empty board. Should land at row 15.
    const state = makeRunState("seed-rain-1");
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
    expect(result.state.committedBlocks).toBe(1);
    // Cell lands at row 15, col 4
    expect(result.state.board[BOARD_ROWS - 1]?.[4]).not.toBeNull();
  });

  it("horizontal 3-cell block: each cell falls to its own column floor", () => {
    // 3×1 horizontal at column 3, empty board.
    // Cells target columns 3, 4, 5 — all land at row 15 independently.
    const state = makeRunState("seed-rain-2");
    const block = make3x1HorizontalBlock();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 3, rng });

    expect(result.toppedOut).toBe(false);
    const bottomRow = result.state.board[BOARD_ROWS - 1];
    expect(bottomRow?.[3]).not.toBeNull();
    expect(bottomRow?.[4]).not.toBeNull();
    expect(bottomRow?.[5]).not.toBeNull();
  });

  it("vertical 3-cell block: all cells in same column, stack from floor upward", () => {
    // 1×3 vertical at column 4, empty board.
    // All 3 cells target column 4.
    // dy=2 lands at row 15, dy=1 at row 14, dy=0 at row 13.
    const state = makeRunState("seed-rain-3");
    const block = make1x3VerticalBlock();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Stack: rows 13, 14, 15 in col 4 all occupied
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(result.state.board[14]?.[4]).not.toBeNull();
    expect(result.state.board[13]?.[4]).not.toBeNull();
    // Row 12, col 4 must be empty (only 3 cells)
    expect(result.state.board[12]?.[4]).toBeNull();
  });

  it("L-shape: multi-cell-per-column stacking is correct", () => {
    // L-shape at column 4: column 4 gets cells (dy=0,dy=1); column 5 gets cell (dy=1).
    // Column 4: 2 cells → land at rows 15, 14.
    // Column 5: 1 cell → lands at row 15.
    const state = makeRunState("seed-rain-4");
    const block = makeLShapeBlock();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Column 4: rows 15 and 14 occupied
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(result.state.board[14]?.[4]).not.toBeNull();
    expect(result.state.board[13]?.[4]).toBeNull(); // row 13 untouched
    // Column 5: row 15 occupied only
    expect(result.state.board[15]?.[5]).not.toBeNull();
    expect(result.state.board[14]?.[5]).toBeNull();
  });

  it("uneven columns: cells land at different rows when columns have different heights", () => {
    // Pre-populate column 4 with one cell at row 15.
    // Drop 2×1 horizontal at column 4: cells target columns 4 and 5.
    // Column 4: already has row 15 filled → next empty is row 14.
    // Column 5: empty → lands at row 15.
    const state = {
      ...makeRunState("seed-rain-5"),
      board: boardWithCells([[15, 4]]),
    };
    const block = make2x1HorizontalBlock();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Column 4: new cell at row 14 (above existing row 15)
    expect(result.state.board[14]?.[4]).not.toBeNull();
    // Column 5: cell at row 15
    expect(result.state.board[15]?.[5]).not.toBeNull();
  });

  it("top-out: column completely full triggers spawn-collision", () => {
    // Fill col 4 all 16 rows. Drop 1×1 rain at col 4 → no empty row → top-out.
    const occupied: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      occupied.push([r, 4]);
    }
    const state = {
      ...makeRunState("seed-rain-6"),
      board: boardWithCells(occupied),
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });

  it("no-op when state is already ended", () => {
    const state = {
      ...makeRunState("seed-rain-7"),
      status: "ended" as const,
      endedReason: "spawn-collision" as const,
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("ended");
  });

  it("clears full rows after placement (cascade)", () => {
    // Fill row 15, cols 1-7 (7 cells). Drop 1×1 rain at col 0 → col 0 lands at row 15 → row full → cleared.
    const occupied: [number, number][] = [];
    for (let c = 1; c < BOARD_COLS; c++) {
      occupied.push([BOARD_ROWS - 1, c]);
    }
    const state = {
      ...makeRunState("seed-rain-8"),
      board: boardWithCells(occupied),
    };
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 0, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.clearedRowsThisRun).toBeGreaterThan(
      state.clearedRowsThisRun,
    );
  });

  it("committedBlocks increments on each successful rain drop", () => {
    const state = makeRunState("seed-rain-9");
    const block = make1x1Block();
    const rng = makeTestRng();
    const result = rainStrategy.resolve({ state, block, column: 4, rng });

    expect(result.state.committedBlocks).toBe(state.committedBlocks + 1);
  });
});
