import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SPAWN_COL,
  placeBlockAtCells,
  clearFullRows,
} from "../../board.ts";

export const ghostStrategy: EffectStrategy = {
  id: "ghost",
  resolve(ctx: PlaceContext): PlaceResult {
    const { state, block, column } = ctx;

    // No-op after top-out
    if (state.status === "ended") {
      return { state, toppedOut: false, reason: null };
    }

    // Find the DEEPEST row R such that all (R + dy, column + dx) are empty.
    // Unlike Standard (which stops at the first occupied cell scanning down),
    // Ghost scans every candidate row independently and picks the maximum R
    // where ALL cells of the block fit. This lets the block pass through
    // occupied cells above and settle at the lowest available gap.
    let targetRow = -1;

    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      let fits = true;
      for (const { dx, dy } of block.cells) {
        const cellRow = r + dy;
        const cellCol = column + dx;
        if (
          cellRow < 0 ||
          cellRow >= BOARD_ROWS ||
          cellCol < 0 ||
          cellCol >= BOARD_COLS
        ) {
          fits = false;
          break;
        }
        if (state.board[cellRow]?.[cellCol] !== null) {
          fits = false;
          break;
        }
      }
      if (fits) {
        // This is the deepest valid row found so far — stop scanning.
        targetRow = r;
        break;
      }
    }

    // No valid row found → top-out (spawn-collision)
    if (targetRow === -1) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Build the final cell positions
    const finalCells = block.cells.map(({ dx, dy }) => ({
      row: targetRow + dy,
      col: column + dx,
    }));

    // Place the cells on the board
    const placed = placeBlockAtCells(state.board, finalCells, state.nextCellId);

    if (placed.toppedOut) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Clear completed rows
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
