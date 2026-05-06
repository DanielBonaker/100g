import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SPAWN_COL,
  placeBlockAtCells,
  clearFullRows,
} from "../../board.ts";
import type { Board } from "../../boardTypes.ts";

export const impactStrategy: EffectStrategy = {
  id: "impact",
  resolve(ctx: PlaceContext): PlaceResult {
    const { state, block, column } = ctx;

    // No-op after top-out
    if (state.status === "ended") {
      return { state, toppedOut: false, reason: null };
    }

    // Determine the lowest row R such that all (R + dy, column + dx) are empty.
    // Same gravity-stop semantics as Standard.
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

    // Compute placed cell positions
    const placedCells = block.cells.map(({ dx, dy }) => ({
      row: targetRow + dy,
      col: column + dx,
    }));

    // Place the block on the board (Standard placement)
    const placed = placeBlockAtCells(
      state.board,
      placedCells,
      state.nextCellId,
    );

    if (placed.toppedOut) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Compute bounding box of placed cells
    const minRow = Math.min(...placedCells.map((c) => c.row));
    const maxRow = Math.max(...placedCells.map((c) => c.row));
    const minCol = Math.min(...placedCells.map((c) => c.col));
    const maxCol = Math.max(...placedCells.map((c) => c.col));

    // Expand bounding box by 1 in each direction, clamped to board bounds
    const auraMinRow = Math.max(0, minRow - 1);
    const auraMaxRow = Math.min(BOARD_ROWS - 1, maxRow + 1);
    const auraMinCol = Math.max(0, minCol - 1);
    const auraMaxCol = Math.min(BOARD_COLS - 1, maxCol + 1);

    // Clear every cell inside the aura rectangle
    const auraBoard = placed.board.map((row, r) =>
      row.map((cell, c) =>
        r >= auraMinRow && r <= auraMaxRow && c >= auraMinCol && c <= auraMaxCol
          ? null
          : cell,
      ),
    ) as Board;

    // Row-clear cascade (aura may have created full rows in unusual board configs)
    const cleared = clearFullRows(auraBoard);

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
