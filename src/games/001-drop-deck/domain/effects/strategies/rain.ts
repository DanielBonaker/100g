import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";
import type { BlockCellOffset } from "../../block.ts";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SPAWN_COL,
  placeBlockAtCells,
  clearFullRows,
} from "../../board.ts";

export const rainStrategy: EffectStrategy = {
  id: "rain",
  resolve(ctx: PlaceContext): PlaceResult {
    const { state, block, column } = ctx;

    // No-op after top-out or while in the shop
    if (state.status === "ended" || state.status === "in-shop") {
      return { state, toppedOut: false, reason: null };
    }

    // Group block cells by their target column (column + dx).
    const targetColumns = new Map<number, BlockCellOffset[]>();
    for (const cell of block.cells) {
      const c = column + cell.dx;
      const existing = targetColumns.get(c);
      if (existing !== undefined) {
        existing.push(cell);
      } else {
        targetColumns.set(c, [cell]);
      }
    }

    const placedCells: { row: number; col: number }[] = [];
    let toppedOut = false;

    for (const [c, cellsInColumn] of targetColumns) {
      // Out-of-bounds column → top-out
      if (c < 0 || c >= BOARD_COLS) {
        toppedOut = true;
        break;
      }

      // Sort cells in this column by dy descending: the cell with the largest
      // dy (lowest in the source block) lands at the column floor first, then
      // successive cells stack upward.
      cellsInColumn.sort((a, b) => b.dy - a.dy);

      // Find the lowest empty row in this column.
      let nextRow = -1;
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        if (state.board[r]?.[c] === null) {
          nextRow = r;
          break;
        }
      }

      if (nextRow === -1) {
        // Column fully occupied → top-out
        toppedOut = true;
        break;
      }

      for (const _cell of cellsInColumn) {
        if (nextRow < 0) {
          // Stacking ran off the top of the board → top-out
          toppedOut = true;
          break;
        }
        placedCells.push({ row: nextRow, col: c });
        nextRow -= 1; // next cell stacks one row above
      }

      if (toppedOut) break;
    }

    if (toppedOut) {
      return {
        state: { ...state, status: "ended", endedReason: "spawn-collision" },
        toppedOut: true,
        reason: "spawn-collision",
      };
    }

    // Write all placed cells to the board.
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

    // Clear completed rows after placement.
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
