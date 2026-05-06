export { BOARD_COLS, BOARD_ROWS, SPAWN_COL, emptyBoard } from "./boardTypes.ts";
import { BOARD_COLS, BOARD_ROWS, SPAWN_COL } from "./boardTypes.ts";

export type { Cell, Board } from "./boardTypes.ts";
import type { Cell, Board } from "./boardTypes.ts";
import type { RunState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { resolveEffect } from "./effects/dispatcher.ts";
import { draw } from "./deck.ts";
import { checkRoundEnd } from "./round.ts";
import { tick as garbageTick } from "./garbage.ts";

// ---------------------------------------------------------------------------
// Re-export RunState from runState.ts for backward compatibility.
// Callers that imported RunState from board.ts continue to work.
// ---------------------------------------------------------------------------
export type { RunState, RunStatus } from "./runState.ts";
export { makeRunState } from "./runState.ts";
export { checkRoundEnd, exitShop } from "./round.ts";

export interface DropResult {
  readonly state: RunState;
  readonly toppedOut: boolean;
}

// ---------------------------------------------------------------------------
// place — legacy single-cell placement (backward compat for game.ts + tests).
// Delegates to the standard effect strategy via commitActive with a synthetic
// 1×1 block at the requested column.
// ---------------------------------------------------------------------------
export const place = (state: RunState, column: number): DropResult => {
  // No-op after top-out
  if (state.status === "ended") {
    return { state, toppedOut: false };
  }

  // Guard: out-of-range column — treat as no-op (not a top-out)
  if (column < 0 || column >= BOARD_COLS) {
    return { state, toppedOut: false };
  }

  // Top-out: row 0 of the target column is already occupied
  const topRow = state.board[0];
  if (topRow !== undefined && topRow[column] !== null) {
    return {
      state: { ...state, status: "ended", endedReason: "spawn-collision" },
      toppedOut: true,
    };
  }

  // Find lowest empty row in the target column
  let targetRow = -1;
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (state.board[r]?.[column] === null) {
      targetRow = r;
      break;
    }
  }

  if (targetRow === -1) {
    return {
      state: { ...state, status: "ended", endedReason: "spawn-collision" },
      toppedOut: true,
    };
  }

  // Place the cell
  const cellId = state.nextCellId;
  const newBoard = state.board.map((row, r) =>
    r === targetRow
      ? row.map((cell, c) =>
          c === column ? ({ id: cellId } satisfies Cell) : cell,
        )
      : row,
  ) as Board;

  // Clear full rows after placement
  const cleared = clearFullRows(newBoard);

  return {
    state: {
      ...state,
      board: cleared.board,
      activeColumn: SPAWN_COL,
      status: "running",
      committedBlocks: state.committedBlocks + 1,
      nextCellId: cellId + 1,
      clearedRowsThisRun: state.clearedRowsThisRun + cleared.clearedCount,
    },
    toppedOut: false,
  };
};

// ---------------------------------------------------------------------------
// placeBlockAtCells — low-level: given a list of [row, col] final positions,
// write them to the board. Detects top-out if any cell lands at row 0.
// ---------------------------------------------------------------------------
export interface PlacedCell {
  readonly row: number;
  readonly col: number;
}

export const placeBlockAtCells = (
  board: Board,
  cells: readonly PlacedCell[],
  startingCellId: number,
): {
  board: Board;
  toppedOut: boolean;
  nextCellId: number;
} => {
  // Top-out when any cell lands at or above row 0 AND row 0 in that column
  // is already occupied before this placement. This handles cases where a
  // previously-placed piece already occupies row 0.
  const toppedOut = cells.some(
    (c) => c.row === 0 && board[0]?.[c.col] !== null,
  );

  // Build a mutable copy, then write the cells
  let currentId = startingCellId;
  const rows: Cell[][] = board.map((row) => [...row]);

  for (const { row, col } of cells) {
    if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
      const boardRow = rows[row];
      if (boardRow !== undefined) {
        boardRow[col] = { id: currentId };
        currentId++;
      }
    }
  }

  return {
    board: rows,
    toppedOut,
    nextCellId: currentId,
  };
};

// ---------------------------------------------------------------------------
// clearFullRows — scans bottom-up, removes any completely filled rows,
// shifts remaining rows down. Returns cleared row count.
// ---------------------------------------------------------------------------
export const clearFullRows = (
  board: Board,
): { board: Board; clearedCount: number } => {
  const rows: Cell[][] = board.map((row) => [...row]);
  let clearedCount = 0;

  // Scan bottom-up, removing full rows
  let r = BOARD_ROWS - 1;
  while (r >= 0) {
    if (rows[r]?.every((cell) => cell !== null)) {
      // Remove this row and add an empty row at the top
      rows.splice(r, 1);
      const emptyRow: Cell[] = [];
      for (let c = 0; c < BOARD_COLS; c++) emptyRow.push(null);
      rows.unshift(emptyRow);
      clearedCount++;
      // Don't decrement r — the row at position r is now the former row r-1
    } else {
      r--;
    }
  }

  return { board: rows, clearedCount };
};

// ---------------------------------------------------------------------------
// connectedCells — BFS via king-adjacency (8-directional) from a seed cell.
// Returns all occupied cells reachable from (seedRow, seedCol) including
// the seed itself.
// ---------------------------------------------------------------------------
export const connectedCells = (
  board: Board,
  seedRow: number,
  seedCol: number,
): readonly PlacedCell[] => {
  // Seed must be an occupied cell
  if (
    board[seedRow]?.[seedCol] === null ||
    board[seedRow]?.[seedCol] === undefined
  ) {
    return [];
  }

  const visited = new Set<string>();
  const queue: PlacedCell[] = [{ row: seedRow, col: seedCol }];
  const result: PlacedCell[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const key = String(current.row) + "," + String(current.col);
    if (visited.has(key)) continue;
    visited.add(key);
    result.push(current);

    // Visit all 8 king-adjacent neighbours
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = current.row + dr;
        const nc = current.col + dc;
        if (nr < 0 || nr >= BOARD_ROWS || nc < 0 || nc >= BOARD_COLS) continue;
        const nKey = String(nr) + "," + String(nc);
        if (visited.has(nKey)) continue;
        const cell = board[nr]?.[nc];
        if (cell !== null && cell !== undefined) {
          queue.push({ row: nr, col: nc });
        }
      }
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// commitActive — high-level: use the active block's effect strategy to place
// the block, then clear full rows, then draw the next block.
// ---------------------------------------------------------------------------
export const commitActive = (
  state: RunState,
  rng: SeededRng,
): {
  state: RunState;
  toppedOut: boolean;
  reason: "spawn-collision" | "garbage-shift" | null;
} => {
  // No-op after top-out or while in the shop
  if (state.status === "ended" || state.status === "in-shop") {
    return { state, toppedOut: false, reason: null };
  }

  // No active block — no-op
  if (state.active === null) {
    return { state, toppedOut: false, reason: null };
  }

  // Delegate to the effect strategy
  const result = resolveEffect({
    state,
    block: state.active,
    column: state.activeColumn,
    rng,
  });

  if (result.toppedOut) {
    return {
      state: result.state,
      toppedOut: true,
      reason: result.reason,
    };
  }

  // Tick the garbage counter; may inject a garbage row and cause top-out.
  const garbage = garbageTick(result.state, rng);
  if (garbage.toppedOut) {
    return {
      state: garbage.state,
      toppedOut: true,
      reason: "garbage-shift",
    };
  }

  // Draw the next block from the queue
  const drawn = draw(garbage.state, rng);
  // Persist rng.state AFTER all RNG operations (shuffle/draw) so cross-session
  // restore replays from the correct position rather than replaying from start.
  // Also reset holdSwapLockedThisBlock so the newly active block can be swapped.
  const afterDraw: RunState = {
    ...drawn.state,
    active: drawn.drew,
    activeColumn: SPAWN_COL,
    rngState: rng.state,
    holdSwapLockedThisBlock: false,
  };

  // Check whether this commit cleared enough rows to end the round.
  const roundCheck = checkRoundEnd(afterDraw);

  return { state: roundCheck.state, toppedOut: false, reason: null };
};
