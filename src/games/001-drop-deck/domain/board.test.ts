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
} from "./board.ts";
import type { Board, Cell } from "./board.ts";
import type { SeededRng } from "../../../engine/Game.ts";

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

/** Build a board with all cells null */
const emptyBoardArr = (): Cell[][] => {
  const board: Cell[][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push(null);
    }
    board.push(row);
  }
  return board;
};

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
    expect(state.committedCells).toBe(0);
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

  it("increments committedCells on each successful placement", () => {
    const state = makeRunState();
    const r1 = place(state, 0);
    expect(r1.state.committedCells).toBe(1);
    const r2 = place(r1.state, 1);
    expect(r2.state.committedCells).toBe(2);
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
    const committedBefore = state.committedCells;
    const result = place(state, 2);
    expect(result.state.committedCells).toBe(committedBefore);
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

  it("top-out parity — spawn-collision: both board end state fields set consistently", () => {
    // Build a state where the active column is entirely full → spawn-collision
    let state = makeRunState("seed-parity");
    const active = {
      id: "std-1x1-p",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    state = { ...state, active, activeColumn: 4 };

    // Fill column 4 completely (16 rows)
    for (let i = 0; i < BOARD_ROWS; i++) {
      const r = commitActive(state, stubRng);
      state = r.state;
      if (i < BOARD_ROWS - 1) {
        // Respawn for next commit
        state = { ...state, active, activeColumn: 4 };
      }
    }

    // Now column 4 is full — one more commit should top out
    state = { ...state, active, activeColumn: 4 };
    const result = commitActive(state, stubRng);

    expect(result.toppedOut).toBe(true);
    expect(result.state.status).toBe("ended");
    expect(result.state.endedReason).toBe("spawn-collision");
    expect(result.reason).toBe("spawn-collision");
  });

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
});
