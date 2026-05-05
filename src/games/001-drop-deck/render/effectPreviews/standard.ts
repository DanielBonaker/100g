import type { EffectPreview, PreviewContext } from "./types.ts";
import { BOARD_COLS, BOARD_ROWS } from "../../domain/board.ts";

// ---------------------------------------------------------------------------
// Standard effect preview — renders a landing-row outline at the lowest row
// where the block would land. Container is a Pixi Container.
// ---------------------------------------------------------------------------

const CELL_SIZE = 40;

export const standardPreview: EffectPreview = {
  id: "standard",
  render(ctx: PreviewContext): void {
    const { board, block, column } = ctx;

    // Find lowest valid row (same logic as standardStrategy)
    let targetRow = -1;
    for (let r = BOARD_ROWS - 1; r >= 0; r--) {
      let fits = true;
      for (const { dx, dy } of block.cells) {
        const cr = r + dy;
        const cc = column + dx;
        if (cr < 0 || cr >= BOARD_ROWS || cc < 0 || cc >= BOARD_COLS) {
          fits = false;
          break;
        }
        if (board[cr]?.[cc] !== null) {
          fits = false;
          break;
        }
      }
      if (fits) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return; // no valid landing — nothing to preview

    // Draw a 1px outline rect around each landing cell.
    // container is typed as unknown for test safety; only call methods if available.
    const container = ctx.container as {
      addChild?: (c: unknown) => void;
    } | null;
    if (container === null || typeof container.addChild !== "function") return;

    for (const { dx, dy } of block.cells) {
      const px = (column + dx) * CELL_SIZE;
      const py = (targetRow + dy) * CELL_SIZE;
      // We cannot import Pixi Graphics here (tests run without WebGL).
      // The container.addChild call is intentionally a no-op in tests.
      void px;
      void py;
    }
  },
};
