import { describe, it, expect } from "vitest";
import { makeRunState, place, BOARD_COLS, BOARD_ROWS } from "./board.ts";

describe("makeRunState", () => {
  it("creates an empty board with activeColumn at center", () => {
    const state = makeRunState();
    expect(state.activeColumn).toBe(4);
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

  it("resets activeColumn to center (4) after each commit", () => {
    const state = makeRunState();
    const result = place(state, 7);
    expect(result.state.activeColumn).toBe(4);
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
