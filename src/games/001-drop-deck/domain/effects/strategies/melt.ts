import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SPAWN_COL,
  placeBlockAtCells,
  clearFullRows,
} from "../../board.ts";
import type { PlacedCell } from "../../board.ts";

// ---------------------------------------------------------------------------
// floodFill — BFS from (startRow, startCol) through orthogonally-adjacent
// empty cells (null). Occupied cells (non-null) act as walls.
// Returns all reachable empty cells including the start cell.
// ---------------------------------------------------------------------------
const floodFill = (
  board: Parameters<typeof placeBlockAtCells>[0],
  startRow: number,
  startCol: number,
): PlacedCell[] => {
  // Start cell must be empty and in-bounds
  if (
    startRow < 0 ||
    startRow >= BOARD_ROWS ||
    startCol < 0 ||
    startCol >= BOARD_COLS
  ) {
    return [];
  }
  if (board[startRow]?.[startCol] !== null) {
    return [];
  }

  const visited = new Set<string>();
  const queue: PlacedCell[] = [{ row: startRow, col: startCol }];
  const result: PlacedCell[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;

    const key = `${String(current.row)},${String(current.col)}`;
    if (visited.has(key)) continue;
    visited.add(key);
    result.push(current);

    // 4-directional orthogonal spread (water doesn't flow diagonally)
    const neighbours: PlacedCell[] = [
      { row: current.row + 1, col: current.col },
      { row: current.row - 1, col: current.col },
      { row: current.row, col: current.col + 1 },
      { row: current.row, col: current.col - 1 },
    ];

    for (const nb of neighbours) {
      if (nb.row < 0 || nb.row >= BOARD_ROWS) continue;
      if (nb.col < 0 || nb.col >= BOARD_COLS) continue;
      const nbKey = `${String(nb.row)},${String(nb.col)}`;
      if (visited.has(nbKey)) continue;
      if (board[nb.row]?.[nb.col] !== null) continue; // wall
      queue.push(nb);
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// sortReachable — sorts cells for water-fill placement order:
//   1. Bottom row first (largest row index first).
//   2. Within a row: closer to dropColumn first.
//   3. Tie-break: left-bias (lower column index first).
// ---------------------------------------------------------------------------
const sortReachable = (
  cells: PlacedCell[],
  dropColumn: number,
): PlacedCell[] => {
  return [...cells].sort((a, b) => {
    if (b.row !== a.row) return b.row - a.row; // bottom first
    const da = Math.abs(a.col - dropColumn);
    const db = Math.abs(b.col - dropColumn);
    if (da !== db) return da - db; // closer to drop column first
    return a.col - b.col; // left-bias on tie
  });
};

// ---------------------------------------------------------------------------
// meltStrategy — block disintegrates on landing.
// N = block.cellCount cells water-fill into the flood-fill-reachable cavity
// starting from (row 0, drop column), spreading outward per row.
//
// Top-out conditions:
//   - drop column row 0 is occupied (flood-fill start is a wall).
//   - N exceeds the reachable region (overflow has nowhere to go).
// ---------------------------------------------------------------------------
export const meltStrategy: EffectStrategy = {
  id: "melt",
  resolve(ctx: PlaceContext): PlaceResult {
    const { state, block, column } = ctx;

    // No-op after top-out
    if (state.status === "ended") {
      return { state, toppedOut: false, reason: null };
    }

    // Step 1: flood-fill empty cells reachable from (row 0, column).
    // If the start cell is occupied the fill returns empty → top-out.
    const reachable = floodFill(state.board, 0, column);

    if (reachable.length === 0) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Step 2: sort — bottom first, outward from drop column, left-bias on tie.
    const sorted = sortReachable(reachable, column);

    // Step 3: take N cells.
    const N = block.cellCount;

    if (N > sorted.length) {
      // Overflow: not enough reachable space for the block → top-out.
      // In normal play N ≤ 9 and the board has 128 cells, so this is rare.
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    const cellsToPlace = sorted.slice(0, N);

    // Step 4: write cells to the board.
    const placed = placeBlockAtCells(
      state.board,
      cellsToPlace,
      state.nextCellId,
    );

    if (placed.toppedOut) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Step 5: clear completed rows.
    const cleared = clearFullRows(placed.board);

    const nextState = {
      ...state,
      board: cleared.board,
      activeColumn: SPAWN_COL,
      status: "running" as const,
      committedBlocks: state.committedBlocks + 1,
      nextCellId: placed.nextCellId,
      clearedRowsThisRun: state.clearedRowsThisRun + cleared.clearedCount,
      clearedRowsThisRound: state.clearedRowsThisRound + cleared.clearedCount,
    };

    return { state: nextState, toppedOut: false, reason: null };
  },
};
