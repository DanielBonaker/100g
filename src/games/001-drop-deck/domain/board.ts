export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;
export const CENTER_COL = 4;

export type { Cell, Board } from "./boardTypes.ts";
import type { Cell, Board } from "./boardTypes.ts";
import type { RunState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

// ---------------------------------------------------------------------------
// Re-export RunState from runState.ts for backward compatibility.
// Callers that imported RunState from board.ts continue to work.
// ---------------------------------------------------------------------------
export type { RunState, RunStatus } from "./runState.ts";
export { makeRunState } from "./runState.ts";

export interface DropResult {
  readonly state: RunState;
  readonly toppedOut: boolean;
}

export const emptyBoard = (): Board => {
  const rows: Cell[][] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < BOARD_COLS; c++) {
      row.push(null);
    }
    rows.push(row);
  }
  return rows;
};

// ---------------------------------------------------------------------------
// place — legacy single-cell placement kept for backward compat with existing
// game.ts and tests. Multi-cell path goes through commitActive/resolveEffect.
// ---------------------------------------------------------------------------
export const place = (_state: RunState, _column: number): DropResult => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// placeBlockAtCells — low-level: given a list of [row, col] final positions,
// write them to the board and detect top-out.
// ---------------------------------------------------------------------------
export interface PlacedCell {
  readonly row: number;
  readonly col: number;
}

export const placeBlockAtCells = (
  _board: Board,
  _cells: readonly PlacedCell[],
  _nextCellId: number,
): {
  board: Board;
  toppedOut: boolean;
  nextCellId: number;
} => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// clearFullRows — scans bottom-up, removes any completely filled rows,
// shifts remaining rows down.
// ---------------------------------------------------------------------------
export const clearFullRows = (
  _board: Board,
): { board: Board; clearedCount: number } => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// connectedCells — BFS via king-adjacency (8-directional) from a seed cell.
// Returns all cells reachable from the seed (including the seed itself).
// ---------------------------------------------------------------------------
export const connectedCells = (
  _board: Board,
  _seedRow: number,
  _seedCol: number,
): readonly PlacedCell[] => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// commitActive — high-level: use the active block's effect strategy to place
// the block, then clear full rows, then handle top-out.
// ---------------------------------------------------------------------------
export const commitActive = (
  _state: RunState,
  _rng: SeededRng,
): {
  state: RunState;
  toppedOut: boolean;
  reason: "spawn-collision" | "garbage-shift" | null;
} => {
  throw new Error("not implemented");
};
