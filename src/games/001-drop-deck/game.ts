import type { Game, GameContext, Persistence } from "../../engine/Game.ts";
import type { Disposer } from "../../services/input/types.ts";
import type { DragEvent as InputDragEvent } from "../../services/input/types.ts";
import { makeRunState, place, BOARD_COLS, BOARD_ROWS } from "./domain/board.ts";
import type { RunState } from "./domain/board.ts";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 40; // px per cell
const BOARD_PIXEL_W = BOARD_COLS * CELL_SIZE;
const BOARD_PIXEL_H = BOARD_ROWS * CELL_SIZE;

// Each full cell-width of drag maps to one column shift
const DRAG_COL_THRESHOLD = CELL_SIZE;

// ---------------------------------------------------------------------------
// Pixi types — imported lazily so happy-dom tests can still run
// ---------------------------------------------------------------------------

interface PixiApp {
  canvas: HTMLCanvasElement;
  init(opts: unknown): Promise<void>;
  stage: { addChild(child: unknown): void; removeChild(child: unknown): void };
  destroy: (options?: unknown) => void;
}

interface PixiGraphics {
  clear: () => PixiGraphics;
  rect: (x: number, y: number, w: number, h: number) => PixiGraphics;
  fill: (color: number | string) => PixiGraphics;
  stroke: (opts: { color: number | string; width: number }) => PixiGraphics;
}

// ---------------------------------------------------------------------------
// Rendering helpers — work with both Pixi Graphics and null (test fallback)
// ---------------------------------------------------------------------------

const drawBoard = (
  gfx: PixiGraphics | null,
  ctx2d: CanvasRenderingContext2D | null,
  state: RunState,
): void => {
  if (gfx !== null) {
    gfx.clear();

    // Board background
    gfx
      .rect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H)
      .fill(0x1a1a2e)
      .rect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H)
      .stroke({ color: 0x4a4a8a, width: 1 });

    // Grid lines
    for (let c = 0; c <= BOARD_COLS; c++) {
      gfx.rect(c * CELL_SIZE, 0, 1, BOARD_PIXEL_H).fill(0x2a2a4a);
    }
    for (let r = 0; r <= BOARD_ROWS; r++) {
      gfx.rect(0, r * CELL_SIZE, BOARD_PIXEL_W, 1).fill(0x2a2a4a);
    }

    // Placed cells
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if ((state.board[r]?.[c] ?? null) !== null) {
          gfx
            .rect(
              c * CELL_SIZE + 2,
              r * CELL_SIZE + 2,
              CELL_SIZE - 4,
              CELL_SIZE - 4,
            )
            .fill(0x44aaff);
        }
      }
    }

    // Active block preview (only while running)
    if (state.status === "running") {
      gfx
        .rect(
          state.activeColumn * CELL_SIZE + 2,
          2,
          CELL_SIZE - 4,
          CELL_SIZE - 4,
        )
        .fill(0xffdd44);
    }
  } else if (ctx2d !== null) {
    // Minimal 2D canvas fallback for test environments
    ctx2d.clearRect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H);
    ctx2d.fillStyle = "#1a1a2e";
    ctx2d.fillRect(0, 0, BOARD_PIXEL_W, BOARD_PIXEL_H);
  }
};

// ---------------------------------------------------------------------------
// Game factory
// ---------------------------------------------------------------------------

export const createDropDeckGame = (): Game & { __getRunState(): RunState } => {
  let runState: RunState = makeRunState();
  let canvas: HTMLCanvasElement | null = null;
  let container: HTMLElement | null = null;
  let pixiApp: PixiApp | null = null;
  let boardGfx: PixiGraphics | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  let persistence: Persistence | null = null;
  const disposers: Disposer[] = [];

  // Track drag state for column snapping
  let dragStartCol = 0;
  let dragAccumPx = 0;

  const init = async (ctx: GameContext): Promise<void> => {
    container = ctx.container;
    persistence = ctx.services.persistence;

    // Attempt to restore a prior run from persistence.
    // We cast the loaded value through `unknown` first to allow a runtime shape
    // check — the persisted data may have been written by an older version.
    const saved = await persistence.load<unknown>("drop-deck-run");
    if (
      saved !== null &&
      typeof saved === "object" &&
      "board" in saved &&
      "activeColumn" in saved &&
      "status" in saved &&
      "committedCells" in saved &&
      "nextCellId" in saved
    ) {
      runState = saved as RunState;
    } else {
      runState = makeRunState();
      if (saved !== null) {
        // Saved object exists but has wrong shape — clear it.
        void persistence.delete("drop-deck-run");
      }
    }

    // Canvas is created eagerly; the Pixi-or-fallback decision happens after attach.
    canvas = document.createElement("canvas");
    canvas.width = BOARD_PIXEL_W;
    canvas.height = BOARD_PIXEL_H;
    container.appendChild(canvas);

    // Attempt PixiJS init — may fail in test environments (happy-dom)
    try {
      const { Application, Graphics } = await import("pixi.js");
      // Single bridge cast: Application is untyped JS; PixiApp is our typed contract.
      const app = new Application() as unknown as PixiApp;
      await app.init({
        canvas,
        width: BOARD_PIXEL_W,
        height: BOARD_PIXEL_H,
        antialias: false,
        background: 0x1a1a2e,
      });
      pixiApp = app;

      const gfx = new Graphics() as unknown as PixiGraphics;
      boardGfx = gfx;
      app.stage.addChild(gfx);
    } catch {
      // Fall back to 2D canvas drawing in environments without WebGL/Canvas2D
      ctx2d = canvas.getContext("2d");
    }

    // Wire input handlers
    const tapDisposer = ctx.services.input.onTap(() => {
      if (runState.status === "ended") return;
      const prevCommitted = runState.committedCells;
      const result = place(runState, runState.activeColumn);
      runState = result.state;
      // Commit-save: debounced 50 ms. Only fires when a new cell was placed
      // (not a top-out or out-of-bounds no-op).
      if (runState.committedCells > prevCommitted && persistence !== null) {
        void persistence.save("drop-deck-run", runState, { debounceMs: 50 });
      }
      // toppedOut is reflected in runState.status — no separate event needed
    });

    const dragDisposer = ctx.services.input.onDrag((e: InputDragEvent) => {
      if (runState.status === "ended") return;
      if (e.phase === "start") {
        dragStartCol = runState.activeColumn;
        dragAccumPx = 0;
      } else if (e.phase === "move") {
        dragAccumPx = e.dx;
        const colShift = Math.round(dragAccumPx / DRAG_COL_THRESHOLD);
        const newCol = Math.max(
          0,
          Math.min(BOARD_COLS - 1, dragStartCol + colShift),
        );
        runState = { ...runState, activeColumn: newCol };
      }
    });

    disposers.push(tapDisposer, dragDisposer);
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const update = (_dtMs: number): void => {};

  const render = (): void => {
    drawBoard(boardGfx, ctx2d, runState);
  };

  const teardown = (): void => {
    for (const dispose of disposers) {
      dispose();
    }
    disposers.length = 0;

    if (pixiApp !== null) {
      pixiApp.destroy({ removeView: true });
      pixiApp = null;
      boardGfx = null;
    }

    if (canvas !== null && container !== null) {
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
      canvas = null;
    }

    container = null;
  };

  // Test-only seam — not part of the Game interface. Tests cast the return value
  // to access this; production code never calls it.
  const __getRunState = (): RunState => runState;

  return { init, update, render, teardown, __getRunState };
};
