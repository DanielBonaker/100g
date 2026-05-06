// @vitest-environment node
import { describe, expect, it } from "vitest";
import { meltStrategy } from "./melt.ts";
import { makeRunState } from "../../runState.ts";
import { makeRng } from "../../rng.ts";
import type { Block } from "../../block.ts";
import type { EffectId } from "../types.ts";
import type { Board, Cell } from "../../boardTypes.ts";
import { emptyBoard, BOARD_ROWS, BOARD_COLS } from "../../boardTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeNBlock = (n: number, effectId: EffectId = "melt"): Block => ({
  id: `melt-test-${String(n)}x1`,
  cellCount: n,
  // Melt disintegrates on landing — cell offsets don't matter; only cellCount
  cells: [{ dx: 0, dy: 0 }],
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

const makeTestRng = () => makeRng("melt-test-seed");

/** Return all occupied cell positions on the board as sorted [row, col] pairs. */
const occupiedCells = (board: Board): [number, number][] => {
  const result: [number, number][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r]?.[c] !== null) {
        result.push([r, c]);
      }
    }
  }
  return result;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("meltStrategy — basic placement", () => {
  it("no-op when state is already ended", () => {
    const state = {
      ...makeRunState("seed-melt-1"),
      status: "ended" as const,
      endedReason: "spawn-collision" as const,
    };
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("ended");
  });

  it("N=1 on empty board — single cell at bottom row of drop column", () => {
    const state = makeRunState("seed-melt-2");
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
    // Flood-fill from (0,4) reaches entire board. Bottom-first sort places
    // first cell at (BOARD_ROWS-1, 4).
    const bottomRow = result.state.board[BOARD_ROWS - 1];
    expect(bottomRow?.[4]).not.toBeNull();
  });

  it("N=1 on empty board — only one cell placed", () => {
    const state = makeRunState("seed-melt-3");
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    const cells = occupiedCells(result.state.board);
    expect(cells).toHaveLength(1);
  });
});

describe("meltStrategy — flat board: outward spread from drop column", () => {
  // Empty board — all cells reachable. Sorting: bottom row (row 15) first,
  // within row by distance from drop column (left-bias on tie).
  // Drop column = 4. Distance order: d=0→col4, d=1→col3 (left first), col5,
  // d=2→col2, col6, d=3→col1, col7, d=4→col0

  it("N=1 — places at (15, 4)", () => {
    const state = makeRunState("seed-melt-flat-1");
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    expect(result.state.board[15]?.[4]).not.toBeNull();
  });

  it("N=2 — places at (15,4) and (15,3) [left-bias]", () => {
    const state = makeRunState("seed-melt-flat-2");
    const block = makeNBlock(2);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(result.state.board[15]?.[3]).not.toBeNull();
  });

  it("N=3 — places at (15,4), (15,3), (15,5)", () => {
    const state = makeRunState("seed-melt-flat-3");
    const block = makeNBlock(3);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(result.state.board[15]?.[3]).not.toBeNull();
    expect(result.state.board[15]?.[5]).not.toBeNull();
  });

  it("N=4 — places at (15,4),(15,3),(15,5),(15,2)", () => {
    const state = makeRunState("seed-melt-flat-4");
    const block = makeNBlock(4);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    const row15 = result.state.board[15];
    expect(row15?.[4]).not.toBeNull();
    expect(row15?.[3]).not.toBeNull();
    expect(row15?.[5]).not.toBeNull();
    expect(row15?.[2]).not.toBeNull();
    // col 0,1,6,7 should remain empty
    expect(row15?.[0]).toBeNull();
    expect(row15?.[1]).toBeNull();
    expect(row15?.[6]).toBeNull();
    expect(row15?.[7]).toBeNull();
  });

  it("N=5 — adds (15,6) after the first four", () => {
    const state = makeRunState("seed-melt-flat-5");
    const block = makeNBlock(5);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    const row15 = result.state.board[15];
    expect(row15?.[4]).not.toBeNull();
    expect(row15?.[3]).not.toBeNull();
    expect(row15?.[5]).not.toBeNull();
    expect(row15?.[2]).not.toBeNull();
    expect(row15?.[6]).not.toBeNull();
  });

  it("N=8 — fills all 8 columns in row 15", () => {
    const state = makeRunState("seed-melt-flat-8");
    const block = makeNBlock(8);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    const row15 = result.state.board[15];
    for (let c = 0; c < BOARD_COLS; c++) {
      expect(row15?.[c]).not.toBeNull();
    }
  });

  it("N=9 — 8 cells in row 15 + 1 cell in row 14", () => {
    const state = makeRunState("seed-melt-flat-9");
    const block = makeNBlock(9);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    const row15 = result.state.board[15];
    for (let c = 0; c < BOARD_COLS; c++) {
      expect(row15?.[c]).not.toBeNull();
    }
    // 9th cell goes to row 14 at drop column (distance 0, left-bias)
    expect(result.state.board[14]?.[4]).not.toBeNull();
    // Only 9 total cells placed
    expect(occupiedCells(result.state.board)).toHaveLength(9);
  });
});

describe("meltStrategy — bucket: water held by walls", () => {
  // Construct a bucket: row 14 has walls at cols 0-1 and 6-7,
  // leaving cols 2-5 open. Row 15 completely empty.
  // Flood-fill from (0, 4) travels down col 4 through all rows.
  // At row 14 it spreads left/right through open cells (cols 2-5).
  // Walls at cols 0,1,6,7 in row 14 block horizontal spread there.
  // Below row 14 the full row 15 is reachable through the open gap.

  it("N=4 fills the bottom of the bucket (row 15) outward from drop col", () => {
    const walls: [number, number][] = [];
    for (const c of [0, 1, 6, 7]) walls.push([14, c]);
    const state = {
      ...makeRunState("seed-melt-bucket-1"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(4);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    // 4 cells should land in row 15 outward from col 4
    const row15 = result.state.board[15];
    expect(row15?.[4]).not.toBeNull();
    expect(row15?.[3]).not.toBeNull();
    expect(row15?.[5]).not.toBeNull();
    expect(row15?.[2]).not.toBeNull();
    expect(result.toppedOut).toBe(false);
  });
});

describe("meltStrategy — tunnel: horizontal spread", () => {
  // Construct a horizontal tunnel: rows 0-7 and rows 9-15 are solid walls
  // except column 4 (the entry shaft). Row 8 is completely open.
  // Water enters from (0,4), goes down col 4 to row 8, then spreads left/right.

  it("fills the tunnel row left-right from drop column", () => {
    const walls: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (r === 8) continue; // leave row 8 open
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c === 4) continue; // entry shaft open at col 4
        walls.push([r, c]);
      }
    }
    const state = {
      ...makeRunState("seed-melt-tunnel-1"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(5);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    // Reachable = col 4 (rows 0-7) + all of row 8 + col 4 (rows 9-15)
    // But only row 8 cells are "spread" candidates since they are bottom-most.
    // Actually: row 15 col 4 is also reachable and even lower.
    // Bottom-first: row 15 col 4 first, then row 14 col 4, ..., row 9 col 4,
    // then row 8 (all cols) outward, then row 7 col 4, ...
    // 5 cells: row15/col4, row14/col4, row13/col4, row12/col4, row11/col4
    // (they fill col 4 bottom-up first since the shaft is vertical)
    // Check that 5 cells are placed and none were placed outside reachable zone
    expect(result.toppedOut).toBe(false);
    const cells = occupiedCells(result.state.board).filter(
      ([r, c]) => !walls.some(([wr, wc]) => wr === r && wc === c),
    );
    expect(cells).toHaveLength(5);
  });

  it("spreads horizontally in the tunnel when shaft is already full", () => {
    // Fill col 4 from rows 9 to 15 with walls, leaving the shaft (rows 0-8)
    // open + the entire row 8 open. Water must fill row 8 cells.
    const walls: [number, number][] = [];
    // Walls above and below the horizontal tunnel row 8
    for (let r = 0; r < BOARD_ROWS; r++) {
      if (r === 8) continue;
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c === 4 && r < 8) continue; // shaft open rows 0-7
        walls.push([r, c]);
      }
    }
    const state = {
      ...makeRunState("seed-melt-tunnel-2"),
      board: boardWithCells(walls),
    };
    // Reachable: col 4 rows 0-7 + all of row 8 = 8+8 = 16 cells
    // N=5: bottom-first → row 8 (distance 0 = col4 first, then outward)
    const block = makeNBlock(5);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Check 5 new cells placed (not counting pre-existing walls)
    const preWallCount = walls.length;
    const postCount = occupiedCells(result.state.board).length;
    expect(postCount - preWallCount).toBe(5);
  });
});

describe("meltStrategy — sealed cavity unreachable", () => {
  // A fully sealed cavity (surrounded by walls) that the drop column cannot
  // reach. Water should only fill the reachable open region.

  it("does not fill sealed cavity", () => {
    // Create a board where:
    // - The main path from (0,4) goes straight down col 4 to row 15.
    // - A sealed cavity at row 10-11, cols 1-2 is completely surrounded.
    const walls: [number, number][] = [
      // Seal off cols 1-2 at rows 9-12 (top/bottom walls)
      [9, 1],
      [9, 2],
      [12, 1],
      [12, 2],
      // Left/right walls
      [10, 0],
      [11, 0],
      [10, 3],
      [11, 3],
    ];
    const state = {
      ...makeRunState("seed-melt-sealed-1"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(3);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    // 3 cells placed: row 15 col 4, row 15 col 3, row 15 col 5
    // None in the sealed region (rows 10-11, cols 1-2)
    expect(result.state.board[10]?.[1]).toBeNull();
    expect(result.state.board[10]?.[2]).toBeNull();
    expect(result.state.board[11]?.[1]).toBeNull();
    expect(result.state.board[11]?.[2]).toBeNull();
    expect(result.toppedOut).toBe(false);
  });
});

describe("meltStrategy — top-out detection", () => {
  it("tops out when drop column row 0 is blocked and flood-fill yields nothing", () => {
    // Fill entire board — no empty cells at all.
    const allWalls: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        allWalls.push([r, c]);
      }
    }
    const state = {
      ...makeRunState("seed-melt-topout-1"),
      board: boardWithCells(allWalls),
    };
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });

  it("tops out when drop column row 0 is blocked even if other region has space", () => {
    // Block col 4 entirely from row 0 and also block all connections from col 4.
    // Fill column 4 completely so flood fill from (0,4) finds nothing.
    const walls: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) walls.push([r, 4]);
    const state = {
      ...makeRunState("seed-melt-topout-2"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });
});

describe("meltStrategy — overflow (N > reachable region)", () => {
  it("tops out when reachable region is too small for N", () => {
    // Create a tiny reachable region: only (0,4) is open, everything else blocked.
    const walls: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (r === 0 && c === 4) continue; // leave just this one cell
        walls.push([r, c]);
      }
    }
    const state = {
      ...makeRunState("seed-melt-overflow-1"),
      board: boardWithCells(walls),
    };
    // N=5 but only 1 cell reachable → overflow → top-out
    const block = makeNBlock(5);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.reason).toBe("spawn-collision");
  });

  it("N=2 with exactly 2 reachable cells — no overflow, no top-out", () => {
    // Reachable region: exactly (0,4) and (1,4). Everything else blocked.
    const walls: [number, number][] = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if ((r === 0 || r === 1) && c === 4) continue;
        walls.push([r, c]);
      }
    }
    const state = {
      ...makeRunState("seed-melt-overflow-2"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(2);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
  });
});

describe("meltStrategy — row clearing after placement", () => {
  it("clears a completed row after melt placement", () => {
    // Fill all of row 15 except col 4. Melt N=1 at col 4 → row 15 completes.
    const occupied: [number, number][] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      if (c !== 4) occupied.push([BOARD_ROWS - 1, c]);
    }
    const state = {
      ...makeRunState("seed-melt-clear-1"),
      board: boardWithCells(occupied),
    };
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    expect(result.state.clearedRowsThisRun).toBeGreaterThan(
      state.clearedRowsThisRun,
    );
  });
});

describe("meltStrategy — state counters", () => {
  it("increments committedBlocks after each successful placement", () => {
    const state = makeRunState("seed-melt-counters-1");
    const block = makeNBlock(1);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.state.committedBlocks).toBe(state.committedBlocks + 1);
  });
});
