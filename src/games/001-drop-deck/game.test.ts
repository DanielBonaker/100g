import { describe, it, expect } from "vitest";
import type { GameContext, Persistence } from "../../engine/Game.ts";
import type { Disposer } from "../../services/input/types.ts";
import type {
  DragEvent as InputDragEvent,
  TapEvent,
} from "../../services/input/types.ts";
import { createDropDeckGame } from "./game.ts";
import { BOARD_ROWS, BOARD_COLS } from "./domain/board.ts";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "../../services/persistence/index.ts";

// ---------------------------------------------------------------------------
// Helpers — build a minimal GameContext with a controllable input service
// ---------------------------------------------------------------------------

interface FakeInput {
  fireTap(e: TapEvent): void;
  fireDrag(e: InputDragEvent): void;
  inputService: GameContext["services"]["input"];
}

const makeFakeInput = (): FakeInput => {
  const tapHandlers = new Set<(e: TapEvent) => void>();
  const dragHandlers = new Set<(e: InputDragEvent) => void>();

  return {
    fireTap: (e) => {
      for (const h of [...tapHandlers]) h(e);
    },
    fireDrag: (e) => {
      for (const h of [...dragHandlers]) h(e);
    },
    inputService: {
      onTap: (handler): Disposer => {
        tapHandlers.add(handler);
        return () => {
          tapHandlers.delete(handler);
        };
      },
      onDrag: (handler): Disposer => {
        dragHandlers.add(handler);
        return () => {
          dragHandlers.delete(handler);
        };
      },
      onKey: (): Disposer => () => undefined,
    },
  };
};

const makeCtx = (
  input: FakeInput["inputService"],
  persistence?: Persistence,
): GameContext => {
  const container = document.createElement("div");
  container.style.width = "375px";
  container.style.height = "667px";
  document.body.appendChild(container);
  return {
    container,
    services: {
      persistence: persistence ?? {
        save: (_key, _value, _opts?) => Promise.resolve(),
        load: () => Promise.resolve(null),
        delete: () => Promise.resolve(),
      },
      economy: {
        getBalance: () => 0,
        addYield: () => undefined,
        subscribe: () => () => undefined,
      },
      achievements: {
        unlock: () => undefined,
        getUnlocked: () => [],
        isUnlocked: () => false,
        subscribe: () => () => undefined,
      },
      input,
      audio: {
        enable: () => undefined,
        setMuted: () => undefined,
        play: () => undefined,
      },
    },
    rng: {
      next: () => 0.5,
      int: (min) => min,
      fork: function () {
        return this;
      },
      state: "test",
    },
    dimensions: { width: 375, height: 667, devicePixelRatio: 1 },
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createDropDeckGame — contract", () => {
  it("returns an object with init / update / render / teardown", () => {
    const game = createDropDeckGame();
    expect(typeof game.init).toBe("function");
    expect(typeof game.update).toBe("function");
    expect(typeof game.render).toBe("function");
    expect(typeof game.teardown).toBe("function");
  });
});

describe("Game lifecycle", () => {
  it("init mounts a canvas under ctx.container", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);
    const canvas = ctx.container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    await game.teardown();
  });

  it("teardown removes the canvas from ctx.container", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);
    await game.teardown();
    const canvas = ctx.container.querySelector("canvas");
    expect(canvas).toBeNull();
  });

  it("update and render are callable without throwing", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);
    expect(() => {
      game.update(16);
    }).not.toThrow();
    expect(() => {
      game.render();
    }).not.toThrow();
    await game.teardown();
  });
});

describe("Game input — drag updates activeColumn", () => {
  it("drag right by one threshold then tap lands block one column right of center", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    // DRAG_COL_THRESHOLD is 40 px (one cell width). Starting column is center.
    const startState = game.__getRunState();
    const startCol = startState.activeColumn;

    // Start drag, then move right by exactly one cell threshold → shift +1 column.
    fake.fireDrag({ startX: 0, startY: 100, dx: 0, dy: 0, phase: "start" });
    fake.fireDrag({ startX: 0, startY: 100, dx: 40, dy: 0, phase: "move" });

    const afterDrag = game.__getRunState();
    const expectedCol = Math.min(BOARD_COLS - 1, startCol + 1);
    expect(afterDrag.activeColumn).toBe(expectedCol);

    // Tap commits the block at the dragged column.
    fake.fireTap({ x: 100, y: 300 });

    const afterTap = game.__getRunState();
    // Bottom row of the expected column must now be occupied.
    expect(afterTap.board[BOARD_ROWS - 1]![expectedCol]).not.toBeNull();
    // Adjacent columns at the bottom row must still be empty.
    if (expectedCol > 0) {
      expect(afterTap.board[BOARD_ROWS - 1]![expectedCol - 1]).toBeNull();
    }

    await game.teardown();
  });
});

describe("Game input — tap commits the block", () => {
  it("tap commits a block and respawns a new one", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    // Tap → commit → new block spawns; render must not throw
    fake.fireTap({ x: 100, y: 300 });
    expect(() => {
      game.render();
    }).not.toThrow();

    await game.teardown();
  });

  it("after top-out, subsequent taps are no-ops (no throw)", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    // Fill all 16 rows in the same column by repeatedly tapping
    // (activeColumn resets to 4 each time; we don't move it so all go to col 4)
    for (let i = 0; i < 20; i++) {
      fake.fireTap({ x: 100, y: 300 });
    }

    // After top-out more taps must be no-ops
    expect(() => {
      fake.fireTap({ x: 100, y: 300 });
      game.render();
    }).not.toThrow();

    await game.teardown();
  });
});

describe("Game persistence — cross-session restore", () => {
  it("a cell placed in session A is visible in session B (simulated refresh)", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "drop-deck-test" });

    // Session A: place one cell then flush persistence immediately via load
    const fakeA = makeFakeInput();
    const ctxA = makeCtx(fakeA.inputService, persistence);
    const gameA = createDropDeckGame();
    await gameA.init(ctxA);

    // Tap to place a cell at center column (col 4 by default)
    fakeA.fireTap({ x: 100, y: 300 });

    // The save is debounced 50 ms. Load the same key to flush the pending write.
    await persistence.load("drop-deck-run");

    const stateAfterA = gameA.__getRunState();
    expect(stateAfterA.committedBlocks).toBe(1);
    await gameA.teardown();

    // Session B: create a NEW game instance backed by the same persistence
    const fakeB = makeFakeInput();
    const ctxB = makeCtx(fakeB.inputService, persistence);
    const gameB = createDropDeckGame();
    await gameB.init(ctxB);

    const stateAfterB = gameB.__getRunState();
    // The bottom row of center column (col 4) must still be occupied
    expect(stateAfterB.committedBlocks).toBe(1);
    expect(stateAfterB.board[BOARD_ROWS - 1]![4]).not.toBeNull();

    await gameB.teardown();
  });
});

describe("Game persistence — malformed saved state falls back to fresh state", () => {
  it("persisted garbage is ignored: game starts fresh and the bad entry is cleared", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "drop-deck-malformed",
    });

    // Write a deliberately malformed object directly via persistence.save
    // (bypasses the game's own save path; board is a string, not an array)
    await persistence.save("drop-deck-run", {
      board: "not-an-array",
      activeColumn: true,
      status: 99,
    });

    // Mount a fresh game — it must silently fall back to makeRunState()
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const state = game.__getRunState();
    // A fresh state always has committedBlocks = 0 and status = "running"
    expect(state.committedBlocks).toBe(0);
    expect(state.status).toBe("running");
    // Board must be a proper array (not the garbage string)
    expect(Array.isArray(state.board)).toBe(true);
    expect(state.board.length).toBe(BOARD_ROWS);

    // The malformed entry must have been deleted — next load returns null
    const stored = await persistence.load("drop-deck-run");
    expect(stored).toBeNull();

    await game.teardown();
  });
});
