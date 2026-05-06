import { describe, it, expect, vi } from "vitest";
import type { GameContext, Persistence } from "../../engine/Game.ts";
import type { Disposer } from "../../services/input/types.ts";
import type {
  DragEvent as InputDragEvent,
  TapEvent,
} from "../../services/input/types.ts";
import { createDropDeckGame } from "./game.ts";
import {
  BOARD_ROWS,
  BOARD_COLS,
  emptyBoard,
  makeRunState,
} from "./domain/board.ts";
import type { RunState } from "./domain/runState.ts";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "../../services/persistence/index.ts";
import { MAX_DECK_SIZE, MIN_DECK_SIZE, REMOVE_COST } from "./domain/shop.ts";

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
        spend: () => false,
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

// ---------------------------------------------------------------------------
// Helpers for achievement / economy spy tests
// ---------------------------------------------------------------------------

type SpyAchievements = GameContext["services"]["achievements"] & {
  unlockSpy: ReturnType<typeof vi.fn>;
};

type SpyEconomy = GameContext["services"]["economy"] & {
  addYieldSpy: ReturnType<typeof vi.fn>;
};

const makeSpyAchievements = (): SpyAchievements => {
  const unlockSpy = vi.fn();
  return {
    unlockSpy,
    unlock: unlockSpy,
    getUnlocked: () => [],
    isUnlocked: () => false,
    subscribe: () => () => undefined,
  };
};

const makeSpyEconomy = (): SpyEconomy => {
  const addYieldSpy = vi.fn();
  return {
    addYieldSpy,
    getBalance: () => 0,
    addYield: addYieldSpy,
    spend: () => false,
    subscribe: () => () => undefined,
  };
};

const makeCtxWithSpies = (
  input: FakeInput["inputService"],
  achievements: SpyAchievements,
  economy: SpyEconomy,
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
      economy,
      achievements,
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

// A minimal 1×1 standard test-fixture block (not from the catalog — this is
// a test helper ensuring the row-clear tap is deterministic regardless of
// which catalog shapes the starter deck draws).
const TEST_1X1_BLOCK = {
  id: "test-1x1-standard",
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId: "standard",
} as const;

/**
 * Build a valid RunState with 7 of 8 columns filled in the bottom row
 * (columns 0-3 and 5-7) so that one tap at column 4 (spawn) will clear
 * the row and push clearedRowsThisRun over the threshold.
 *
 * The active block is pinned to a 1×1 test fixture so the tap is
 * deterministic regardless of which catalog shapes the starter deck draws.
 */
const makeStateWithAlmostFullBottomRow = (
  clearedRowsThisRun: number,
  highestRoundReached = 0,
  round = 1,
): RunState => {
  const base = makeRunState("seed-test");
  const board = emptyBoard().map((row, r) => {
    if (r === BOARD_ROWS - 1) {
      return row.map((_cell, c) => (c === 4 ? null : { id: 1000 + c }));
    }
    return row;
  }) as RunState["board"];

  return {
    ...base,
    board,
    activeColumn: 4,
    active: TEST_1X1_BLOCK,
    clearedRowsThisRun,
    highestRoundReached,
    round,
    achievementsUnlockedThisRun: [],
  };
};

// ---------------------------------------------------------------------------
// Achievement trigger tests
// ---------------------------------------------------------------------------

describe("Game achievements — dd-rows-100 trigger", () => {
  it("unlocks dd-rows-100 when clearedRowsThisRun reaches 100 in one run", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "ach-rows-test" });

    // Persist state with 99 rows cleared and board one-tap-from-full-row
    const preState = makeStateWithAlmostFullBottomRow(99);
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const economy = makeSpyEconomy();
    const ctx = makeCtxWithSpies(
      fake.inputService,
      achievements,
      economy,
      persistence,
    );

    const game = createDropDeckGame();
    await game.init(ctx);

    // Tap to fill col 4 in the bottom row, clearing the row → 99+1=100
    fake.fireTap({ x: 100, y: 300 });

    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "001-drop-deck",
      "dd-rows-100",
    );

    await game.teardown();
  });

  it("does NOT unlock dd-rows-100 again in the same run after the first unlock", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "ach-rows-dedup" });

    const preState = makeStateWithAlmostFullBottomRow(99);
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const economy = makeSpyEconomy();
    const ctx = makeCtxWithSpies(
      fake.inputService,
      achievements,
      economy,
      persistence,
    );

    const game = createDropDeckGame();
    await game.init(ctx);

    // First tap → clears row → fires achievement (count = 1)
    fake.fireTap({ x: 100, y: 300 });

    const countAfterFirst = achievements.unlockSpy.mock.calls.filter(
      (args) => args[1] === "dd-rows-100",
    ).length;
    expect(countAfterFirst).toBe(1);

    // Several more taps — no re-fire for rows-100
    for (let i = 0; i < 5; i++) {
      fake.fireTap({ x: 100, y: 300 });
    }

    const countAfterMore = achievements.unlockSpy.mock.calls.filter(
      (args) => args[1] === "dd-rows-100",
    ).length;
    expect(countAfterMore).toBe(1);

    await game.teardown();
  });
});

describe("Game achievements — dd-round-10 trigger", () => {
  it("unlocks dd-round-10 when highestRoundReached reaches 10", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "ach-round-test" });

    const preState: RunState = {
      ...makeRunState("seed-test"),
      highestRoundReached: 10,
      activeColumn: 4,
      achievementsUnlockedThisRun: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const economy = makeSpyEconomy();
    const ctx = makeCtxWithSpies(
      fake.inputService,
      achievements,
      economy,
      persistence,
    );

    const game = createDropDeckGame();
    await game.init(ctx);

    // Any tap — game checks state and fires achievement for round-10
    fake.fireTap({ x: 100, y: 300 });

    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "001-drop-deck",
      "dd-round-10",
    );

    await game.teardown();
  });
});

describe("Game achievements — dd-deck-20 trigger", () => {
  it("unlocks dd-deck-20 when deck reaches size 20", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "ach-deck-test" });

    const bigDeck: RunState["deck"] = Array.from({ length: 20 }, (_, i) => ({
      id: `std-1x1-${String(i)}`,
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    }));

    const preState: RunState = {
      ...makeRunState("seed-test"),
      deck: bigDeck,
      activeColumn: 4,
      achievementsUnlockedThisRun: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const economy = makeSpyEconomy();
    const ctx = makeCtxWithSpies(
      fake.inputService,
      achievements,
      economy,
      persistence,
    );

    const game = createDropDeckGame();
    await game.init(ctx);

    // Any tap — game checks deck size and fires achievement
    fake.fireTap({ x: 100, y: 300 });

    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "001-drop-deck",
      "dd-deck-20",
    );

    await game.teardown();
  });
});

describe("Game input — tap is no-op in-shop", () => {
  it("tap during in-shop status does not commit or save", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "in-shop-noop-test",
    });

    // Persist a state already in in-shop status
    const preState: RunState = {
      ...makeRunState("seed-shop"),
      status: "in-shop",
      round: 1,
      clearedRowsThisRound: 5,
      gold: 3,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const beforeTap = game.__getRunState();
    // Multiple taps must not change state
    fake.fireTap({ x: 100, y: 300 });
    fake.fireTap({ x: 100, y: 300 });

    const afterTap = game.__getRunState();
    // committedBlocks must not have changed
    expect(afterTap.committedBlocks).toBe(beforeTap.committedBlocks);
    // status must still be in-shop
    expect(afterTap.status).toBe("in-shop");

    await game.teardown();
  });
});

describe("Game economy — currency yield at run-end", () => {
  it("calls addYield with correct formula on top-out: 50 rows, round 6 → 15", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "eco-formula-test" });

    // Fill all rows of column 4 → first tap triggers spawn-collision → top-out
    const base = makeRunState("seed-formula");
    const board = emptyBoard().map((row) => {
      return row.map((cell, c) => (c === 4 ? { id: 3000 } : cell));
    }) as RunState["board"];

    const preState: RunState = {
      ...base,
      board,
      activeColumn: 4,
      clearedRowsThisRun: 50,
      round: 6,
      achievementsUnlockedThisRun: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const economy = makeSpyEconomy();
    const ctx = makeCtxWithSpies(
      fake.inputService,
      achievements,
      economy,
      persistence,
    );

    const game = createDropDeckGame();
    await game.init(ctx);

    // Tap with col 4 row 0 already occupied → spawn-collision → top-out
    // yield = min(50/5, 200) + min(6-1, 100) = 10 + 5 = 15
    fake.fireTap({ x: 100, y: 300 });

    expect(economy.addYieldSpy).toHaveBeenCalledWith("001-drop-deck", 15);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Shop UI DOM tests
// ---------------------------------------------------------------------------

describe("Shop UI — tier buttons render on in-shop status", () => {
  it("mounts a [data-role=shop] overlay when status is in-shop", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-render" });

    const preState: RunState = {
      ...makeRunState("shop-ui-seed"),
      status: "in-shop",
      gold: 20,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']");
    expect(shopEl).not.toBeNull();

    await game.teardown();
  });

  it("shop overlay has buttons for Small, Medium, and Large tiers", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-buttons" });

    const preState: RunState = {
      ...makeRunState("shop-ui-btns"),
      status: "in-shop",
      gold: 20,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const smallBtn = shopEl.querySelector("[data-booster='small']");
    const mediumBtn = shopEl.querySelector("[data-booster='medium']");
    const largeBtn = shopEl.querySelector("[data-booster='large']");

    expect(smallBtn).not.toBeNull();
    expect(mediumBtn).not.toBeNull();
    expect(largeBtn).not.toBeNull();

    await game.teardown();
  });

  it("does NOT mount shop overlay when status is running", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    // Default status is running
    expect(game.__getRunState().status).toBe("running");
    const shopEl = ctx.container.querySelector("[data-role='shop']");
    expect(shopEl).toBeNull();

    await game.teardown();
  });
});

describe("Shop UI — tapping a tier button with sufficient gold populates shopOffer", () => {
  it("clicking the small booster button sets shopOffer on the state", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-purchase" });

    const preState: RunState = {
      ...makeRunState("shop-ui-buy"),
      status: "in-shop",
      gold: 10,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const smallBtn = shopEl.querySelector<HTMLElement>(
      "[data-booster='small']",
    )!;
    smallBtn.click();

    const afterClick = game.__getRunState();
    expect(afterClick.shopOffer).not.toBeNull();
    expect(afterClick.shopOffer?.tier).toBe("small");
    expect(afterClick.gold).toBe(8); // 10 - 2

    await game.teardown();
  });
});

describe("Shop UI — pick screen shows 3 block options after purchase", () => {
  it("after purchasing small booster, pick buttons appear in the shop overlay", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-picks" });

    const preState: RunState = {
      ...makeRunState("shop-ui-picks-seed"),
      status: "in-shop",
      gold: 10,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const smallBtn = shopEl.querySelector<HTMLElement>(
      "[data-booster='small']",
    )!;
    smallBtn.click();

    // After purchase, pick buttons should appear
    const pickBtns = shopEl.querySelectorAll("[data-pick]");
    expect(pickBtns.length).toBe(3);

    await game.teardown();
  });

  it("tapping a pick button adds block to deck and clears shopOffer", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-pick-click",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-pick-click-seed"),
      status: "in-shop",
      gold: 10,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const deckBefore = game.__getRunState().deck.length;

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const smallBtn = shopEl.querySelector<HTMLElement>(
      "[data-booster='small']",
    )!;
    smallBtn.click();

    const pickBtn = shopEl.querySelector<HTMLElement>("[data-pick]")!;
    pickBtn.click();

    const afterPick = game.__getRunState();
    expect(afterPick.shopOffer).toBeNull();
    expect(afterPick.deck.length).toBe(deckBefore + 1);

    await game.teardown();
  });
});

describe("Shop UI — Exit Shop button calls exitShop", () => {
  it("tapping Exit Shop transitions status back to running", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-exit" });

    const preState: RunState = {
      ...makeRunState("shop-exit-seed"),
      status: "in-shop",
      gold: 0,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    expect(game.__getRunState().status).toBe("in-shop");

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const exitBtn = shopEl.querySelector<HTMLElement>(
      "[data-action='exit-shop']",
    )!;
    exitBtn.click();

    expect(game.__getRunState().status).toBe("running");

    await game.teardown();
  });
});

describe("Shop UI — max deck size guard", () => {
  it("purchase button click is no-op when deck is at max size", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-max-deck" });

    const fullDeck: RunState["deck"] = Array.from(
      { length: MAX_DECK_SIZE },
      (_, i) => ({
        id: `test-deck-full-${String(i)}`,
        cellCount: 1,
        cells: [{ dx: 0, dy: 0 }],
        effectId: "standard" as const,
      }),
    );

    const preState: RunState = {
      ...makeRunState("shop-ui-max-deck-seed"),
      status: "in-shop",
      gold: 100,
      deck: fullDeck,
      drawQueue: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const smallBtn = shopEl.querySelector<HTMLElement>(
      "[data-booster='small']",
    )!;
    smallBtn.click();

    // No offer set because deck is full
    expect(game.__getRunState().shopOffer).toBeNull();

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Shop UI — Remove slot
// ---------------------------------------------------------------------------

const makeShopBlock = (n: number): RunState["deck"][number] => ({
  id: `1-test-ui-block-${String(n)}-standard`,
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId: "standard" as const,
});

describe("Shop UI — Remove button visible in main shop screen", () => {
  it("renders a purchase-remove button when in-shop", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-remove-btn",
    });

    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const preState: RunState = {
      ...makeRunState("shop-ui-remove-seed"),
      status: "in-shop",
      gold: 20,
      deck,
      drawQueue: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const removeBtn = shopEl.querySelector("[data-action='purchase-remove']");
    expect(removeBtn).not.toBeNull();

    await game.teardown();
  });

  it("Remove button is disabled when gold < REMOVE_COST", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-remove-disabled-gold",
    });

    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const preState: RunState = {
      ...makeRunState("shop-ui-remove-low-gold"),
      status: "in-shop",
      gold: REMOVE_COST - 1,
      deck,
      drawQueue: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const removeBtn = shopEl.querySelector<HTMLButtonElement>(
      "[data-action='purchase-remove']",
    )!;
    expect(removeBtn.disabled).toBe(true);

    await game.teardown();
  });

  it("Remove button is disabled when deck size <= MIN_DECK_SIZE", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-remove-min-deck",
    });

    const deck = Array.from({ length: MIN_DECK_SIZE }, (_, i) =>
      makeShopBlock(i),
    );
    const preState: RunState = {
      ...makeRunState("shop-ui-remove-min-deck-seed"),
      status: "in-shop",
      gold: 20,
      deck,
      drawQueue: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const removeBtn = shopEl.querySelector<HTMLButtonElement>(
      "[data-action='purchase-remove']",
    )!;
    expect(removeBtn.disabled).toBe(true);

    await game.teardown();
  });

  it("clicking Remove button with sufficient gold/deck shows remove-pick screen", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-remove-click",
    });

    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const preState: RunState = {
      ...makeRunState("shop-ui-remove-click-seed"),
      status: "in-shop",
      gold: 20,
      deck,
      drawQueue: [],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const removeBtn = shopEl.querySelector<HTMLButtonElement>(
      "[data-action='purchase-remove']",
    )!;
    removeBtn.click();

    // After clicking, remove pick buttons should appear
    const pickBtns = shopEl.querySelectorAll("[data-remove-pick]");
    expect(pickBtns.length).toBeGreaterThan(0);
    expect(pickBtns.length).toBeLessThanOrEqual(3);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Shop UI — Skip button
// ---------------------------------------------------------------------------

describe("Shop UI — Skip button", () => {
  it("renders a skip-shop button in the main shop screen", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "shop-ui-skip-btn" });

    const preState: RunState = {
      ...makeRunState("shop-ui-skip-seed"),
      status: "in-shop",
      gold: 0,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const skipBtn = shopEl.querySelector("[data-action='skip-shop']");
    expect(skipBtn).not.toBeNull();

    await game.teardown();
  });

  it("clicking Skip transitions status to running", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-skip-click",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-skip-click-seed"),
      status: "in-shop",
      gold: 0,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const skipBtn = shopEl.querySelector<HTMLElement>(
      "[data-action='skip-shop']",
    )!;
    skipBtn.click();

    expect(game.__getRunState().status).toBe("running");

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Shop UI — Passive offer screen
// ---------------------------------------------------------------------------

describe("Shop UI — Passive offer screen", () => {
  it("renders accept/decline buttons when passiveOffer is set", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-passive-offer",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-passive-seed"),
      status: "in-shop",
      gold: 20,
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const acceptBtn = shopEl.querySelector("[data-action='accept-passive']");
    const declineBtn = shopEl.querySelector("[data-action='decline-passive']");
    expect(acceptBtn).not.toBeNull();
    expect(declineBtn).not.toBeNull();

    await game.teardown();
  });

  it("accept button is disabled when gold < cost", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-passive-disabled",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-passive-disabled-seed"),
      status: "in-shop",
      gold: 2,
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const acceptBtn = shopEl.querySelector<HTMLButtonElement>(
      "[data-action='accept-passive']",
    )!;
    expect(acceptBtn.disabled).toBe(true);

    await game.teardown();
  });

  it("clicking accept adds passive and clears passiveOffer", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-passive-accept",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-passive-accept-seed"),
      status: "in-shop",
      gold: 20,
      passives: [],
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const acceptBtn = shopEl.querySelector<HTMLElement>(
      "[data-action='accept-passive']",
    )!;
    acceptBtn.click();

    const after = game.__getRunState();
    expect(after.passiveOffer).toBeNull();
    expect(after.passives).toContain("skippers-bonus");
    expect(after.gold).toBe(15); // 20 - 5

    await game.teardown();
  });

  it("clicking decline clears passiveOffer", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "shop-ui-passive-decline",
    });

    const preState: RunState = {
      ...makeRunState("shop-ui-passive-decline-seed"),
      status: "in-shop",
      gold: 20,
      passiveOffer: { passive: "row-rebate", cost: 5 },
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const shopEl = ctx.container.querySelector("[data-role='shop']")!;
    const declineBtn = shopEl.querySelector<HTMLElement>(
      "[data-action='decline-passive']",
    )!;
    declineBtn.click();

    expect(game.__getRunState().passiveOffer).toBeNull();

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Hold button UI
// ---------------------------------------------------------------------------

describe("Hold button UI", () => {
  it("renders a hold button ([data-action='hold-swap']) when status is running", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn = ctx.container.querySelector("[data-action='hold-swap']");
    expect(holdBtn).not.toBeNull();

    await game.teardown();
  });

  it("hold button has at least 44px width and height (mobile hit target)", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn = ctx.container.querySelector<HTMLElement>(
      "[data-action='hold-swap']",
    )!;
    const minWidth = parseInt(holdBtn.style.minWidth, 10);
    const minHeight = parseInt(holdBtn.style.minHeight, 10);
    expect(minWidth).toBeGreaterThanOrEqual(44);
    expect(minHeight).toBeGreaterThanOrEqual(44);

    await game.teardown();
  });

  it("tapping hold button swaps active block into hold", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    const before = game.__getRunState();
    expect(before.active).not.toBeNull();
    expect(before.hold).toBeNull();

    const holdBtn = ctx.container.querySelector<HTMLElement>(
      "[data-action='hold-swap']",
    )!;
    holdBtn.click();

    const after = game.__getRunState();
    // Active was stowed into hold
    expect(after.hold).not.toBeNull();
    // Lock is set after the swap
    expect(after.holdSwapLockedThisBlock).toBe(true);

    await game.teardown();
  });

  it("hold button shows the held block display name after a swap", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn = ctx.container.querySelector<HTMLElement>(
      "[data-action='hold-swap']",
    )!;

    // Before swap: button should show placeholder text
    const textBefore = holdBtn.textContent;
    // After swap: text should reflect the held block
    holdBtn.click();

    const after = game.__getRunState();
    const heldBlock = after.hold;
    expect(heldBlock).not.toBeNull();

    // Render to pick up state
    game.render();

    const holdBtn2 = ctx.container.querySelector<HTMLElement>(
      "[data-action='hold-swap']",
    )!;
    const textAfter = holdBtn2.textContent;
    // Text must change (now showing held block info vs empty placeholder)
    expect(textAfter).not.toBe(textBefore);

    await game.teardown();
  });

  it("hold button appears visually disabled when holdSwapLockedThisBlock is true", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "hold-locked-test" });

    const preState: RunState = {
      ...makeRunState("hold-locked-seed"),
      holdSwapLockedThisBlock: true,
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-action='hold-swap']",
    )!;
    expect(holdBtn.disabled).toBe(true);

    await game.teardown();
  });

  it("second click on hold button after swap is a no-op (locked)", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn = ctx.container.querySelector<HTMLElement>(
      "[data-action='hold-swap']",
    )!;

    // First click: stow
    holdBtn.click();
    const afterFirst = game.__getRunState();
    expect(afterFirst.holdSwapLockedThisBlock).toBe(true);
    const holdAfterFirst = afterFirst.hold;

    // Second click: locked — no change
    holdBtn.click();
    const afterSecond = game.__getRunState();
    expect(afterSecond.hold).toStrictEqual(holdAfterFirst);

    await game.teardown();
  });

  it("renders a second hold button ([data-action='hold-swap-2']) when spare-pocket is active", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "hold-spare-pocket-test",
    });

    const preState: RunState = {
      ...makeRunState("hold-spare-pocket-seed"),
      passives: ["spare-pocket"],
    };
    await persistence.save("drop-deck-run", preState);

    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService, persistence);
    const game = createDropDeckGame();
    await game.init(ctx);

    const holdBtn2 = ctx.container.querySelector("[data-action='hold-swap-2']");
    expect(holdBtn2).not.toBeNull();

    await game.teardown();
  });
});
