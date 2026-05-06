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

  it("N=8 — fills all 8 columns in row 15, triggering a row clear", () => {
    // N=8 on an empty board exactly fills row 15 (8 columns). clearFullRows
    // fires and removes that row — so the board is empty after placement.
    // Verify via the clearedRowsThisRun counter rather than board state.
    const state = makeRunState("seed-melt-flat-8");
    const block = makeNBlock(8);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    expect(result.toppedOut).toBe(false);
    expect(result.state.clearedRowsThisRun).toBe(state.clearedRowsThisRun + 1);
    // After the clear the board should be empty
    expect(occupiedCells(result.state.board)).toHaveLength(0);
  });

  it("N=9 — row 15 fills and clears; remaining 1 cell falls to bottom", () => {
    // N=9: cells 1-8 go to row 15 (fills it → clears it), cell 9 goes to
    // row 14 col 4. After the row-15 clear everything shifts down one, so
    // that cell lands at row 15 col 4. Board has 1 occupied cell.
    const state = makeRunState("seed-melt-flat-9");
    const block = makeNBlock(9);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });
    expect(result.toppedOut).toBe(false);
    expect(result.state.clearedRowsThisRun).toBe(state.clearedRowsThisRun + 1);
    // After the clear, the lone cell at row-14 has shifted to row 15
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(occupiedCells(result.state.board)).toHaveLength(1);
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
  // Tunnel scenario: a horizontal open corridor with walls on 3 sides.
  // Board rows 10-15 open except for partial walls creating the corridor shape.
  // The entry shaft is col 4 going from row 0 to row 9 (open).
  // Row 9 has walls at cols 0-3 and 5-7 (only col 4 open) acting as a "floor"
  // that directs water into the horizontal corridor at rows 10-15 col 3-5.
  // We keep it simple: walls only block horizontal spread, no full rows.

  it("fills the tunnel row left-right from drop column", () => {
    // Layout: simple corridor at row 10, cols 2-6 open, rest of row 10 is walls.
    // Row 11-15 have walls at cols 1 and 7 so water can spread to cols 2-6 only.
    // Flood fill from (0, 4) goes down col 4, reaches row 10, spreads left/right.
    // No rows are completely filled so no clear fires.
    const walls: [number, number][] = [];
    // walls bordering the corridor (partial fills — never a full row)
    walls.push([10, 0], [10, 1], [10, 7]); // row 10: block cols 0,1,7
    walls.push([11, 0], [11, 1], [11, 7]); // similar borders for row 11
    // Reachable = col 4 rows 0-9 + cols 2-6 row 10 + cols 2-6 row 11 + ... row 15
    // Bottom-first: rows 15 then 14 ... then 10. Within each row outward from col4.
    // N=3: (15,4), (15,3), (15,5)
    const state = {
      ...makeRunState("seed-melt-tunnel-1"),
      board: boardWithCells(walls),
    };
    const block = makeNBlock(3);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // 3 cells placed in row 15 (no walls there): col 4, col 3, col 5
    expect(result.state.board[15]?.[4]).not.toBeNull();
    expect(result.state.board[15]?.[3]).not.toBeNull();
    expect(result.state.board[15]?.[5]).not.toBeNull();
  });

  it("water is blocked by side walls and cannot escape the corridor", () => {
    // Construct walls on left and right of a vertical shaft (col 4 only open).
    // Rows 5-7: wall at cols 0-3 and 5-7 (only col 4 open).
    // This means water from (0,4) can only reach col 4 in those rows.
    // Below row 7 (rows 8-15) no walls → full board width reachable.
    const walls: [number, number][] = [];
    for (let r = 5; r <= 7; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c !== 4) walls.push([r, c]);
      }
    }
    // rows 5-7 have 7 cells each as walls (cols 0-3 + 5-7), not full rows
    const state = {
      ...makeRunState("seed-melt-tunnel-2"),
      board: boardWithCells(walls),
    };
    // N=3 at col 4: all reachable cells are there; 3 cells go to (15,4),(15,3),(15,5)
    const block = makeNBlock(3);
    const rng = makeTestRng();
    const result = meltStrategy.resolve({ state, block, column: 4, rng });

    expect(result.toppedOut).toBe(false);
    // Cell must be at row 15 col 4 (deepest reachable)
    expect(result.state.board[15]?.[4]).not.toBeNull();
    // Walls in the restricted rows should NOT have water placed in them
    for (let r = 5; r <= 7; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c !== 4) {
          // Wall cells remain walls (not overwritten by water)
          expect(result.state.board[r]?.[c]).not.toBeNull();
        }
      }
    }
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
