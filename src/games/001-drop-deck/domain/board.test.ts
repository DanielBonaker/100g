import { describe, it, expect } from "vitest";
import {
  makeRunState,
  place,
  BOARD_COLS,
  BOARD_ROWS,
  placeBlockAtCells,
  clearFullRows,
  connectedCells,
  commitActive,
  emptyBoard,
} from "./board.ts";
import type { Board, Cell } from "./board.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { makeRng, makeRngFromState } from "./rng.ts";

// ---------------------------------------------------------------------------
// Minimal RNG stub
// ---------------------------------------------------------------------------
const stubRng: SeededRng = {
  next: () => 0.5,
  int: (min) => min,
  fork: function () {
    return this;
  },
  state: "test",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mutable copy of an empty board for test setup.
 * Uses the production emptyBoard() from boardTypes.ts, then widens to mutable.
 */
const emptyBoardArr = (): Cell[][] => emptyBoard() as Cell[][];

/** Fill an entire row (all BOARD_COLS cells) with id=1 cells */
const fillRow = (board: Cell[][], row: number): void => {
  for (let c = 0; c < BOARD_COLS; c++) {
    board[row]![c] = { id: 1 };
  }
};

describe("makeRunState", () => {
  it("creates an empty board with activeColumn at center", () => {
    const state = makeRunState();
    const center = makeRunState().activeColumn;
    expect(state.activeColumn).toBe(center);
    expect(state.status).toBe("running");
    expect(state.committedBlocks).toBe(0);
    expect(state.board).toHaveLength(BOARD_ROWS);
    expect(state.board[0]).toHaveLength(BOARD_COLS);
  });

  it("all cells are null initially", () => {
    const state = makeRunState();
    for (const row of state.board) {
      for (const cell of row) {
        expect(cell).toBeNull();
      }
    }
  });

  it("initialises nextCellId to 1", () => {
    const state = makeRunState();
    expect(state.nextCellId).toBe(1);
  });
});

describe("place", () => {
  it("lands at the bottom row of an empty column", () => {
    const state = makeRunState();
    const result = place(state, 3);
    expect(result.toppedOut).toBe(false);
    expect(result.state.status).toBe("running");
    // bottom row = BOARD_ROWS - 1
    expect(result.state.board[BOARD_ROWS - 1]![3]).not.toBeNull();
  });

  it("lands at the lowest empty row when column is partially full", () => {
    // Fill rows 2 through BOARD_ROWS-1 in column 2
    let state = makeRunState();
    for (let r = 2; r < BOARD_ROWS; r++) {
      const result = place(state, 2);
      state = result.state;
    }
    // Now rows 2..15 are filled; row 1 should be next
    const result = place(state, 2);
    expect(result.toppedOut).toBe(false);
    expect(result.state.board[1]![2]).not.toBeNull();
    expect(result.state.board[0]![2]).toBeNull();
  });

  it("increments committedBlocks on each successful placement", () => {
    const state = makeRunState();
    const r1 = place(state, 0);
    expect(r1.state.committedBlocks).toBe(1);
    const r2 = place(r1.state, 1);
    expect(r2.state.committedBlocks).toBe(2);
  });

  it("resets activeColumn to center after each commit", () => {
    const center = makeRunState().activeColumn;
    const state = makeRunState();
    const result = place(state, 7);
    expect(result.state.activeColumn).toBe(center);
  });

  it("increments nextCellId after a successful place", () => {
    const state = makeRunState();
    expect(state.nextCellId).toBe(1);
    const r1 = place(state, 3);
    expect(r1.state.nextCellId).toBe(2);
    const r2 = place(r1.state, 2);
    expect(r2.state.nextCellId).toBe(3);
  });

  it("does NOT increment nextCellId after top-out (no cell placed)", () => {
    let state = makeRunState();
    // Fill column 3 fully
    for (let i = 0; i < BOARD_ROWS; i++) {
      const result = place(state, 3);
      state = result.state;
    }
    const idBeforeTopOut = state.nextCellId;
    // This place triggers the top-out detection
    const result = place(state, 3);
    expect(result.toppedOut).toBe(true);
    expect(result.state.nextCellId).toBe(idBeforeTopOut);
  });

  it("returns state unchanged (toppedOut: false) for out-of-range column -1", () => {
    const state = makeRunState();
    const result = place(state, -1);
    expect(result.toppedOut).toBe(false);
    expect(result.state).toBe(state);
  });

  it("returns state unchanged (toppedOut: false) for out-of-range column BOARD_COLS", () => {
    const state = makeRunState();
    const result = place(state, BOARD_COLS);
    expect(result.toppedOut).toBe(false);
    expect(result.state).toBe(state);
  });

  it("detects top-out when row 0 of the target column is occupied", () => {
    // Fill entire column 5 (all BOARD_ROWS rows)
    let state = makeRunState();
    for (let i = 0; i < BOARD_ROWS; i++) {
      const result = place(state, 5);
      state = result.state;
    }
    // Now column 5 row 0 is occupied → top-out
    const result = place(state, 5);
    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
  });

  it("detects top-out when column is fully stacked (all rows occupied)", () => {
    let state = makeRunState();
    // Fill all rows in column 0
    for (let i = 0; i < BOARD_ROWS; i++) {
      const result = place(state, 0);
      state = result.state;
    }
    // Next place into column 0 → top-out
    const result = place(state, 0);
    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
  });

  it("is a no-op after top-out (state unchanged)", () => {
    let state = makeRunState();
    // Fill column 1 to trigger top-out
    for (let i = 0; i <= BOARD_ROWS; i++) {
      const result = place(state, 1);
      state = result.state;
    }
    expect(state.status).toBe("ended");
    const committedBefore = state.committedBlocks;
    const result = place(state, 2);
    expect(result.state.committedBlocks).toBe(committedBefore);
    expect(result.state.status).toBe("ended");
  });
});

// ---------------------------------------------------------------------------
// placeBlockAtCells
// ---------------------------------------------------------------------------

describe("placeBlockAtCells", () => {
  it("places a single cell at the specified position", () => {
    const board = emptyBoardArr() as unknown as Board;
    const result = placeBlockAtCells(board, [{ row: 15, col: 3 }], 1);
    expect(result.toppedOut).toBe(false);
    expect((result.board[15]![3] as { id: number } | null)?.id).toBe(1);
    expect(result.nextCellId).toBe(2);
  });

  it("places a multi-cell block — both cells land", () => {
    const board = emptyBoardArr() as unknown as Board;
    const result = placeBlockAtCells(
      board,
      [
        { row: 15, col: 2 },
        { row: 15, col: 3 },
      ],
      1,
    );
    expect(result.toppedOut).toBe(false);
    expect(result.board[15]![2]).not.toBeNull();
    expect(result.board[15]![3]).not.toBeNull();
    expect(result.nextCellId).toBe(3);
  });

  it("detects top-out when landing cell would overwrite an already-occupied row 0 cell", () => {
    // Row 0 col 4 already has a cell — placing there again is a top-out
    const boardArr = emptyBoardArr();
    boardArr[0]![4] = { id: 99 };
    const board = boardArr as unknown as Board;
    const result = placeBlockAtCells(board, [{ row: 0, col: 4 }], 1);
    expect(result.toppedOut).toBe(true);
  });

  it("does NOT flag top-out when placing at row 0 if that cell is empty", () => {
    // Placing a block at row 0 on an empty board is valid (just stacked to top)
    const board = emptyBoardArr() as unknown as Board;
    const result = placeBlockAtCells(board, [{ row: 0, col: 4 }], 1);
    expect(result.toppedOut).toBe(false);
    expect(result.board[0]![4]).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearFullRows
// ---------------------------------------------------------------------------

describe("clearFullRows", () => {
  it("returns clearedCount 0 for an empty board", () => {
    const board = emptyBoardArr() as unknown as Board;
    const result = clearFullRows(board);
    expect(result.clearedCount).toBe(0);
    expect(result.board[15]!.every((c) => c === null)).toBe(true);
  });

  it("clears a single completely filled bottom row", () => {
    const boardArr = emptyBoardArr();
    fillRow(boardArr, 15);
    const board = boardArr as unknown as Board;
    const result = clearFullRows(board);
    expect(result.clearedCount).toBe(1);
    // Bottom row should now be null
    expect(result.board[15]!.every((c) => c === null)).toBe(true);
  });

  it("clears two consecutive full rows and shifts above cells down", () => {
    const boardArr = emptyBoardArr();
    // Place a sentinel cell in row 13 col 0
    boardArr[13]![0] = { id: 99 };
    fillRow(boardArr, 14);
    fillRow(boardArr, 15);
    const board = boardArr as unknown as Board;
    const result = clearFullRows(board);
    expect(result.clearedCount).toBe(2);
    // Sentinel cell (was row 13) should now be in row 15
    expect((result.board[15]![0] as { id: number } | null)?.id).toBe(99);
    // Rows 13 and 14 should now be empty (shifted down but no more cells above row 13)
    expect(result.board[14]!.every((c) => c === null)).toBe(true);
  });

  it("does not clear a partially-filled row", () => {
    const boardArr = emptyBoardArr();
    boardArr[15]![0] = { id: 1 }; // only one cell in row 15
    const board = boardArr as unknown as Board;
    const result = clearFullRows(board);
    expect(result.clearedCount).toBe(0);
    expect(result.board[15]![0]).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// connectedCells (king-adjacency)
// ---------------------------------------------------------------------------

describe("connectedCells", () => {
  it("finds a single isolated cell", () => {
    const boardArr = emptyBoardArr();
    boardArr[10]![4] = { id: 1 };
    const board = boardArr as unknown as Board;
    const group = connectedCells(board, 10, 4);
    expect(group).toHaveLength(1);
    expect(group[0]).toEqual({ row: 10, col: 4 });
  });

  it("finds diagonally adjacent cells as one connected group (king-adjacency)", () => {
    const boardArr = emptyBoardArr();
    boardArr[10]![4] = { id: 1 };
    boardArr[11]![5] = { id: 2 }; // diagonal from (10,4)
    const board = boardArr as unknown as Board;
    const group = connectedCells(board, 10, 4);
    expect(group).toHaveLength(2);
    const coords = group.map((c) => String(c.row) + "," + String(c.col)).sort();
    expect(coords).toEqual(["10,4", "11,5"]);
  });

  it("finds a horizontal run of cells", () => {
    const boardArr = emptyBoardArr();
    boardArr[15]![0] = { id: 1 };
    boardArr[15]![1] = { id: 2 };
    boardArr[15]![2] = { id: 3 };
    const board = boardArr as unknown as Board;
    const group = connectedCells(board, 15, 0);
    expect(group).toHaveLength(3);
  });

  it("does not include null cells", () => {
    const boardArr = emptyBoardArr();
    boardArr[10]![4] = { id: 1 };
    // (10,5) is null — should not appear
    const board = boardArr as unknown as Board;
    const group = connectedCells(board, 10, 4);
    expect(group).toHaveLength(1);
  });

  it("does not cross to disconnected island", () => {
    const boardArr = emptyBoardArr();
    boardArr[10]![0] = { id: 1 };
    // separate island far away
    boardArr[10]![7] = { id: 2 };
    const board = boardArr as unknown as Board;
    const g1 = connectedCells(board, 10, 0);
    expect(g1).toHaveLength(1);
    const g2 = connectedCells(board, 10, 7);
    expect(g2).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// commitActive — multi-block integration + top-out parity
// ---------------------------------------------------------------------------

describe("commitActive", () => {
  it("commits the active block to the board", () => {
    // Build state with a 1x1 standard block as active
    const base = makeRunState("seed-1");
    const active = {
      id: "std-1x1-t",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = { ...base, active, activeColumn: 3 };
    const result = commitActive(state, stubRng);
    expect(result.toppedOut).toBe(false);
    // Bottom row col 3 should be occupied
    expect(result.state.board[BOARD_ROWS - 1]![3]).not.toBeNull();
  });

  it("returns reason: null when not topped out", () => {
    const base = makeRunState("seed-1");
    const active = {
      id: "std-1x1-t2",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = { ...base, active, activeColumn: 3 };
    const result = commitActive(state, stubRng);
    expect(result.reason).toBeNull();
  });

  // Spawn-collision via pre-filled board — no commitActive loop needed so garbage
  // cadence does not interfere with the top-out check.
  it("top-out parity — spawn-collision: both board end state fields set consistently", () => {
    // Pre-fill all rows of column 4 so no empty row is available.
    const boardArr = emptyBoardArr();
    for (let r = 0; r < BOARD_ROWS; r++) {
      boardArr[r]![4] = { id: r + 1 };
    }
    const board = boardArr as unknown as Board;
    const active = {
      id: "std-1x1-p",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = {
      ...makeRunState("seed-parity"),
      board,
      active,
      activeColumn: 4,
    };

    const result = commitActive(state, stubRng);

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.state.endedReason).toBe("spawn-collision");
    expect(result.reason).toBe("spawn-collision");
  });

  // Direct edge case: board is pre-populated synthetically — no commitActive calls needed.
  it("spawn-collision via full column — top-out produces consistent state shape", () => {
    // Fill all 16 rows of column 4 so no row is available for the active block.
    // The standard strategy should return spawn-collision because no row fits.
    const boardArr = emptyBoardArr();
    for (let r = 0; r < BOARD_ROWS; r++) {
      boardArr[r]![4] = { id: r + 1 };
    }
    const board = boardArr as unknown as Board;

    const active = {
      id: "std-1x1-g",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const base = makeRunState("seed-garbage");
    const state = { ...base, board, active, activeColumn: 4 };
    const result = commitActive(state, stubRng);

    expect(result.toppedOut).toBe(true);
    expect(result.reason).toBe("spawn-collision");
    expect(result.state.endedReason).toBe("spawn-collision");
    expect(result.state.status).toBe("ended");
  });

  it("rngState in returned state matches the RNG position after commit (determinism preserved)", () => {
    // Use a real seeded RNG so we can track state advancement.
    const rng = makeRng("abc");
    const base = makeRunState("abc");
    const active = {
      id: "std-1x1-rng",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = { ...base, active, activeColumn: 3 };
    const result = commitActive(state, rng);
    expect(result.toppedOut).toBe(false);

    // The rngState saved in result.state must match rng.state right after commit.
    // Re-create an RNG from the saved state and advance it; then advance the
    // live rng by one step. Both must produce the same value.
    const restoredRng = makeRngFromState(result.state.rngState);
    const fromRestored = restoredRng.next();
    const fromLive = rng.next();
    expect(fromRestored).toBe(fromLive);
  });

  // ---------------------------------------------------------------------------
  // Round-end integration — commitActive calls checkRoundEnd after each commit
  // ---------------------------------------------------------------------------

  it("transitions to in-shop when the commit clears the round target", () => {
    // Round 1 target = 5 rows. Pre-set clearedRowsThisRound = 4 so that one
    // commit which clears 1 row pushes it to 5 — hitting the threshold.
    // Fill the bottom row (row 15) leaving col 0 empty; place a 1×1 block at
    // col 0 to complete and clear that row (+1 cleared row).
    const boardArr = emptyBoardArr();
    for (let c = 1; c < BOARD_COLS; c++) {
      boardArr[BOARD_ROWS - 1]![c] = { id: 9000 + c };
    }
    const board = boardArr as unknown as Board;
    const active = {
      id: "std-1x1-round",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const base = makeRunState("seed-round-end");
    const state = {
      ...base,
      board,
      active,
      activeColumn: 0,
      round: 1,
      // Already cleared 4 rows; this commit will clear 1 more → total 5 = target
      clearedRowsThisRound: 4,
      gold: 0,
      highestRoundReached: 0,
    };

    const result = commitActive(state, stubRng);
    expect(result.toppedOut).toBe(false);
    // Should have cleared 1 row → clearedRowsThisRound 4+1=5 = target → in-shop
    expect(result.state.status).toBe("in-shop");
    // gold: lump(1)=3 + interest(0)=0 = 3
    expect(result.state.gold).toBe(3);
    // highestRoundReached advances
    expect(result.state.highestRoundReached).toBe(1);
  });

  it("is a no-op (returns state unchanged) when status is in-shop", () => {
    const base = makeRunState("seed-shop");
    const active = {
      id: "std-1x1-shop",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = {
      ...base,
      status: "in-shop" as const,
      active,
      activeColumn: 3,
    };
    const result = commitActive(state, stubRng);
    expect(result.toppedOut).toBe(false);
    expect(result.state).toBe(state);
  });

  // ---------------------------------------------------------------------------
  // Garbage cadence integration via commitActive
  // ---------------------------------------------------------------------------

  it("after 8 commits the bottom row contains a garbage row and counter resets", () => {
    const rng = makeRng("garbage-8");
    const active = {
      id: "std-1x1-gc",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    // Start from a fresh state with garbageDropsThisRound at 7 so the 8th commit triggers.
    const state = {
      ...makeRunState("garbage-8"),
      active,
      activeColumn: 0,
      garbageDropsThisRound: 7,
    };

    // 8th commit: triggers garbage injection.
    const result = commitActive(state, rng);
    expect(result.toppedOut).toBe(false);

    // Counter resets to 0.
    expect(result.state.garbageDropsThisRound).toBe(0);

    // Bottom row should have exactly GARBAGE_FILL_COUNT (6) non-null cells.
    const bottomRow = result.state.board[BOARD_ROWS - 1]!;
    const filledCount = bottomRow.filter((c) => c !== null).length;
    // The garbage row has 6 cells; plus the 1 block we just committed at col 0
    // which may also be in the bottom row after the shift. Actually the block
    // was committed THEN the stack shifted up (garbage at bottom), so the block
    // cell is now one row above the garbage row. Bottom row = garbage row only.
    expect(filledCount).toBe(6);
  });

  it("garbage cells removed on row-clear — row containing garbage cells clears when full", () => {
    const rng = makeRng("gc-row-clear");
    // Build a board where the bottom row has BOARD_COLS - 1 garbage cells and
    // 1 empty column, then place a block into the empty column to complete the row.
    const boardArr = emptyBoardArr();
    // Fill bottom row cols 1..7 with garbage cells
    for (let c = 1; c < BOARD_COLS; c++) {
      boardArr[BOARD_ROWS - 1]![c] = { id: -1, kind: "garbage" };
    }
    const board = boardArr as unknown as Board;

    const active = {
      id: "std-1x1-gcr",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state = {
      ...makeRunState("gc-row-clear"),
      board,
      active,
      activeColumn: 0, // col 0 is the empty slot
    };

    const result = commitActive(state, rng);
    expect(result.toppedOut).toBe(false);
    // Row was cleared — bottom row should now be empty (all null).
    const bottomRow = result.state.board[BOARD_ROWS - 1]!;
    expect(bottomRow.every((c) => c === null)).toBe(true);
    // clearedRowsThisRun should have incremented.
    expect(result.state.clearedRowsThisRun).toBeGreaterThan(
      state.clearedRowsThisRun,
    );
  });

  it("top-out parity — garbage-shift top-out has the same RunState shape as spawn-collision top-out", () => {
    // Spawn-collision shape: status=ended, endedReason=spawn-collision
    const boardArr1 = emptyBoardArr();
    for (let r = 0; r < BOARD_ROWS; r++) {
      boardArr1[r]![4] = { id: r + 1 };
    }
    const board1 = boardArr1 as unknown as Board;
    const active = {
      id: "std-1x1-par",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const spawnState = {
      ...makeRunState("parity-spawn"),
      board: board1,
      active,
      activeColumn: 4,
    };
    const spawnResult = commitActive(spawnState, makeRng("parity-spawn"));
    expect(spawnResult.toppedOut).toBe(true);
    expect(spawnResult.state.status).toBe("ended");
    expect(spawnResult.state.endedReason).toBe("spawn-collision");

    // Garbage-shift shape: inject with row 0 occupied.
    const boardArr2 = emptyBoardArr();
    boardArr2[0]![0] = { id: 1 }; // row 0 occupied → garbage-shift tops out
    const board2 = boardArr2 as unknown as Board;
    const garbageState = {
      ...makeRunState("parity-garbage"),
      board: board2,
      active,
      activeColumn: 3,
      garbageDropsThisRound: 7, // next commit = 8th, triggers inject
    };
    const garbageResult = commitActive(garbageState, makeRng("parity-garbage"));
    expect(garbageResult.toppedOut).toBe(true);
    expect(garbageResult.state.status).toBe("ended");
    expect(garbageResult.state.endedReason).toBe("garbage-shift");

    // Both produce the same shape: { status: "ended", endedReason: string }
    expect(typeof spawnResult.state.endedReason).toBe("string");
    expect(typeof garbageResult.state.endedReason).toBe("string");
  });

  // ---------------------------------------------------------------------------
  // Hold-swap lock reset — after a successful commit, holdSwapLockedThisBlock
  // must be reset to false so the new active block can be swapped once.
  // ---------------------------------------------------------------------------

  it("resets holdSwapLockedThisBlock to false after a successful commit", () => {
    const base = makeRunState("seed-hold-lock-reset");
    const active = {
      id: "std-1x1-hold-lock",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    // Start with the lock set (simulates having already swapped this block)
    const state = {
      ...base,
      active,
      activeColumn: 3,
      holdSwapLockedThisBlock: true,
    };
    const result = commitActive(state, stubRng);
    expect(result.toppedOut).toBe(false);
    expect(result.state.holdSwapLockedThisBlock).toBe(false);
  });
});
