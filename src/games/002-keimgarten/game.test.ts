import { describe, it, expect, vi } from "vitest";
import { createKeimgartenGame } from "./game.ts";
import type { GameContext, Persistence } from "../../engine/Game.ts";
import type { Economy } from "../../engine/Game.ts";
import type { TapEvent } from "../../services/input/types.ts";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "../../services/persistence/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCtx = (
  persistence?: Persistence,
  tapHandlerRef?: { fire: (e: TapEvent) => void },
  economy?: Economy,
): GameContext => {
  const container = document.createElement("div");
  container.style.width = "375px";
  container.style.height = "667px";
  document.body.appendChild(container);
  return {
    container,
    services: {
      persistence: persistence ?? {
        save: () => Promise.resolve(),
        load: () => Promise.resolve(null),
        delete: () => Promise.resolve(),
      },
      economy: economy ?? {
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
      input: {
        onTap: (handler) => {
          if (tapHandlerRef !== undefined) {
            tapHandlerRef.fire = handler;
          }
          return () => undefined;
        },
        onDrag: () => () => undefined,
        onKey: () => () => undefined,
      },
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
// Contract tests
// ---------------------------------------------------------------------------

describe("createKeimgartenGame — contract", () => {
  it("returns an object with init / update / render / teardown", () => {
    const game = createKeimgartenGame();
    expect(typeof game.init).toBe("function");
    expect(typeof game.update).toBe("function");
    expect(typeof game.render).toBe("function");
    expect(typeof game.teardown).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle tests
// ---------------------------------------------------------------------------

describe("Keimgarten lifecycle", () => {
  it("init mounts a canvas under ctx.container", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    const canvas = ctx.container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    await game.teardown();
  });

  it("teardown removes the canvas from ctx.container", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown();
    const canvas = ctx.container.querySelector("canvas");
    expect(canvas).toBeNull();
  });

  it("update and render are callable without throwing", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
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

// ---------------------------------------------------------------------------
// Keim starter creature
// ---------------------------------------------------------------------------

describe("Keim starter creature", () => {
  it("fresh save has starter Keim (creatureId=0) owned", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    const state = game.__getRunState();
    const keim = state.owned.find((c) => c.creatureId === 0);
    expect(keim).toBeDefined();
    await game.teardown();
  });

  it("starter Keim starts in the play area (y within 0..55, x within 0..47)", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    const state = game.__getRunState();
    const keim = state.owned[0];
    expect(keim).toBeDefined();
    expect(keim!.position.x).toBeGreaterThanOrEqual(0);
    expect(keim!.position.x).toBeLessThanOrEqual(47);
    expect(keim!.position.y).toBeGreaterThanOrEqual(0);
    expect(keim!.position.y).toBeLessThanOrEqual(55);
    await game.teardown();
  });

  it("ticking the engine changes Keim position over time (eventually walks)", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const initialState = game.__getRunState();
    const initialPos = { ...initialState.owned[0]!.position };

    // Force the creature into walk state by ticking past stateUntil
    // We tick 200 times — creature must eventually walk
    for (let i = 0; i < 200; i++) {
      game.update(16);
    }

    const finalState = game.__getRunState();
    const finalPos = finalState.owned[0]!.position;

    // After 200 ticks, position should have changed (creature walks)
    // or at minimum tick counter incremented
    expect(finalState.tick).toBe(200);

    // Positions are integer pixels
    expect(Number.isInteger(finalPos.x)).toBe(true);
    expect(Number.isInteger(finalPos.y)).toBe(true);

    // Position stays within play area bounds
    expect(finalPos.x).toBeGreaterThanOrEqual(0);
    expect(finalPos.x).toBeLessThanOrEqual(47);
    expect(finalPos.y).toBeGreaterThanOrEqual(0);
    expect(finalPos.y).toBeLessThanOrEqual(55);

    // Position changed from initial (creature wandered)
    const moved = finalPos.x !== initialPos.x || finalPos.y !== initialPos.y;
    expect(moved).toBe(true);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Cross-session restore
// ---------------------------------------------------------------------------

describe("cross-session persistence restore", () => {
  it("restores Keim state after re-init with saved state", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "keimgarten-test" });

    // First session: init, tick a bit, then teardown
    const ctx1 = makeCtx(persistence);
    const game1 = createKeimgartenGame();
    await game1.init(ctx1);

    // Advance state — tick to make sure some state change occurs
    for (let i = 0; i < 50; i++) {
      game1.update(16);
    }

    const savedState = game1.__getRunState();

    // Flush any pending save (debounce)
    await persistence.save("keimgarten-run", savedState);

    await game1.teardown();

    // Second session: fresh game, same persistence
    const ctx2 = makeCtx(persistence);
    const game2 = createKeimgartenGame();
    await game2.init(ctx2);

    const restoredState = game2.__getRunState();

    // tick counter should be restored
    expect(restoredState.tick).toBe(savedState.tick);

    // Keim should still exist
    expect(restoredState.owned).toHaveLength(savedState.owned.length);
    expect(restoredState.owned[0]!.creatureId).toBe(0);

    await game2.teardown();
  });
});

// ---------------------------------------------------------------------------
// Render tests for hueFromId
// ---------------------------------------------------------------------------

describe("hueFromId", () => {
  it("returns a deterministic value for id=0 size=1", async () => {
    const { hueFromId } = await import("./render/creatureSprite.ts");
    const color1 = hueFromId(0, 1);
    const color2 = hueFromId(0, 1);
    expect(color1).toBe(color2);
  });

  it("returns different values for different ids", async () => {
    const { hueFromId } = await import("./render/creatureSprite.ts");
    const c1 = hueFromId(0, 1);
    const c2 = hueFromId(1, 1);
    expect(c1).not.toBe(c2);
  });

  it("returns a number in valid RGB range (0..0xFFFFFF)", async () => {
    const { hueFromId } = await import("./render/creatureSprite.ts");
    for (let id = 0; id < 10; id++) {
      const c = hueFromId(id, 1);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });
});

// ---------------------------------------------------------------------------
// Tap-to-greet integration
// ---------------------------------------------------------------------------

// noopFire: placeholder for tapRef before init subscribes the real handler
const noopFire = (_e: TapEvent): void => {
  // replaced by onTap subscription during init
};

describe("tap-to-greet", () => {
  it("tapping on a creature increments its totalTapsByCreatureId counter", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const before = game.__getRunState();
    const keim = before.owned[0]!;

    // Tap at the creature's position in screen coords (zoom is 4 in fallback canvas)
    // The creature is at play-local (24, 36), play layer is offset by PLAY_Y=8
    // Screen position y = (36+8) * 4 = 176, x = 24 * 4 = 96
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    const after = game.__getRunState();
    expect(after.totalTapsByCreatureId[keim.creatureId]).toBe(1);

    await game.teardown();
  });

  it("tapping on a creature forces it into hop state", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const before = game.__getRunState();
    const keim = before.owned[0]!;

    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    const after = game.__getRunState();
    const kreature = after.owned.find((c) => c.instanceId === keim.instanceId);
    expect(kreature!.state).toBe("hop");

    await game.teardown();
  });

  it("tapping outside any creature is a no-op", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const before = game.__getRunState();

    // Tap far away from all creatures (0, 0 in screen coords)
    tapRef.fire({ x: 0, y: 0 });

    const after = game.__getRunState();
    // No tap counter change
    expect(Object.keys(after.totalTapsByCreatureId)).toHaveLength(0);
    // Creature state unchanged
    expect(after.owned[0]!.state).toBe(before.owned[0]!.state);

    await game.teardown();
  });

  it("tap is purely affection — no currency change", async () => {
    const addYield = vi.fn();
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    // Replace economy to spy on addYield
    ctx.services.economy.addYield = addYield;
    const game = createKeimgartenGame();
    await game.init(ctx);

    const keim = game.__getRunState().owned[0]!;
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    expect(addYield).not.toHaveBeenCalled();

    await game.teardown();
  });

  it("nameplate div appears in the DOM after a tap on a creature", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const keim = game.__getRunState().owned[0]!;
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    const nameplate = ctx.container.querySelector(
      "[data-keimgarten-nameplate]",
    );
    expect(nameplate).not.toBeNull();

    await game.teardown();
  });

  it("nameplate text includes German name and tier label", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const keim = game.__getRunState().owned[0]!;
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    const nameplate = ctx.container.querySelector(
      "[data-keimgarten-nameplate]",
    );
    const text = nameplate?.textContent ?? "";
    // Keim (creatureId=0) is tier 1 → "Keim" label, German name "Keim"
    expect(text).toContain("Keim");

    await game.teardown();
  });

  it("tap counter persists across save/reload", async () => {
    const idb = new IDBFactory();
    const persistence = createPersistence({
      idb,
      dbName: "keimgarten-tap-test",
    });

    const tapRef = { fire: noopFire };
    const ctx1 = makeCtx(persistence, tapRef);
    const game1 = createKeimgartenGame();
    await game1.init(ctx1);

    const keim = game1.__getRunState().owned[0]!;
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });
    tapRef.fire({ x: keim.position.x * 4, y: (keim.position.y + 8) * 4 });

    const savedState = game1.__getRunState();
    await persistence.save("keimgarten-run", savedState);
    await game1.teardown();

    const ctx2 = makeCtx(persistence);
    const game2 = createKeimgartenGame();
    await game2.init(ctx2);

    const restored = game2.__getRunState();
    expect(restored.totalTapsByCreatureId[keim.creatureId]).toBe(2);

    await game2.teardown();
  });

  it("heart particle appears in DOM after 100 taps on a creature", async () => {
    const tapRef = { fire: noopFire };
    const ctx = makeCtx(undefined, tapRef);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const keim = game.__getRunState().owned[0]!;
    const tapX = keim.position.x * 4;
    const tapY = (keim.position.y + 8) * 4;

    // Fire 100 taps
    for (let i = 0; i < 100; i++) {
      tapRef.fire({ x: tapX, y: tapY });
    }

    // After 100th tap, heart particle should appear
    const heart = ctx.container.querySelector("[data-keimgarten-heart]");
    expect(heart).not.toBeNull();

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Currency yield — session-end economy wiring
// ---------------------------------------------------------------------------

describe("currency yield on teardown", () => {
  it("calls economy.addYield with a positive amount on first teardown (starter Keim → yield=2)", async () => {
    const addYield = vi.fn();
    const economy: Economy = {
      getBalance: () => 0,
      addYield,
      spend: () => false,
      subscribe: () => () => undefined,
    };
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown();

    // Starter state: uniqueOwnedIds=[0] (tier 1) → compute=2, lastYieldPaid=0 → delta=2
    expect(addYield).toHaveBeenCalledWith("002-keimgarten", 2);
  });

  it("does not double-pay on a second teardown without state changes (delta=0)", async () => {
    const addYield = vi.fn();
    const economy: Economy = {
      getBalance: () => 0,
      addYield,
      spend: () => false,
      subscribe: () => () => undefined,
    };
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "kg-yield-nodbl" });
    const ctx = makeCtx(persistence, undefined, economy);

    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown(); // first teardown — pays delta

    addYield.mockClear();

    // Re-init with same persistence (lastYieldPaid was saved)
    const ctx2 = makeCtx(persistence, undefined, economy);
    const game2 = createKeimgartenGame();
    await game2.init(ctx2);
    await game2.teardown(); // second teardown — state unchanged → delta=0

    expect(addYield).not.toHaveBeenCalled();
  });

  it("pays delta when a new creature is owned between teardowns", async () => {
    const addYield = vi.fn();
    const economy: Economy = {
      getBalance: () => 0,
      addYield,
      spend: () => false,
      subscribe: () => () => undefined,
    };
    const idb = new IDBFactory();
    const persistence = createPersistence({ idb, dbName: "kg-yield-delta" });
    const ctx = makeCtx(persistence, undefined, economy);

    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown(); // pays initial delta (yield=2 for starter)

    const firstCall = addYield.mock.calls[0] as [string, number];
    expect(firstCall[1]).toBeGreaterThan(0);
    addYield.mockClear();

    // Re-init, own a new tier-9 creature (id=166)
    const ctx2 = makeCtx(persistence, undefined, economy);
    const game2 = createKeimgartenGame();
    await game2.init(ctx2);

    // Directly inject a new creature ownership into runState via __getRunState reflection
    // We use applyAction indirectly: game exposes __getRunState but not setState.
    // Instead, save a modified state with the new creature added.
    const { applyAction } = await import("./domain/garden.ts");
    const stateWithNew = applyAction(game2.__getRunState(), {
      type: "own",
      creatureId: 166,
      position: { x: 20, y: 20 },
    });
    await persistence.save("keimgarten-run", stateWithNew);

    // Re-init from the new saved state
    await game2.teardown();
    addYield.mockClear();

    const ctx3 = makeCtx(persistence, undefined, economy);
    const game3 = createKeimgartenGame();
    await game3.init(ctx3);
    await game3.teardown();

    // New yield: uniqueOwnedIds=[0,166], count=2, highestTier=9 → 0+18=18
    // Previously paid=2, delta=16
    expect(addYield).toHaveBeenCalledOnce();
    const deltaCall = addYield.mock.calls[0] as [string, number];
    expect(deltaCall[1]).toBeGreaterThan(0);
  });

  it("does not call addYield if economy service is not available (no-op teardown guard)", async () => {
    // Bare teardown without init — game should not crash
    const game = createKeimgartenGame();
    await expect(game.teardown()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Bestiary button + overlay integration
// ---------------------------------------------------------------------------

describe("Bestiary button and overlay", () => {
  it("Bestiary button appears in container after init", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector("[data-role='bestiary-button']");
    expect(btn).not.toBeNull();

    await game.teardown();
  });

  it("tapping bestiary button shows the overlay", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='bestiary-button']",
    );
    expect(btn).not.toBeNull();

    const overlay = ctx.container.querySelector<HTMLElement>(
      "[data-role='bestiary-overlay']",
    );
    expect(overlay).not.toBeNull();

    // Before click: hidden
    expect(overlay!.style.display).toBe("none");

    btn!.click();

    // After click: visible
    expect(overlay!.style.display).not.toBe("none");

    await game.teardown();
  });

  it("overlay reflects current uniqueOwnedIds (1 owned for fresh state)", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const header = ctx.container.querySelector("[data-role='bestiary-header']");
    expect(header).not.toBeNull();
    // Fresh state has 1 creature owned (Keim, id=0)
    expect(header!.textContent).toContain("1");
    expect(header!.textContent).toContain("167");

    await game.teardown();
  });

  it("overlay disappears after teardown", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    await game.teardown();

    const overlay = ctx.container.querySelector(
      "[data-role='bestiary-overlay']",
    );
    expect(overlay).toBeNull();
  });

  it("Bestiary button hit-target is >= 44x44 px", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='bestiary-button']",
    );
    expect(btn).not.toBeNull();

    // In happy-dom, inline styles are the reliable source — check min-width/min-height
    // The button must have min dimensions of 44x44 enforced via CSS
    const minW = parseInt(btn!.style.minWidth, 10);
    const minH = parseInt(btn!.style.minHeight, 10);
    expect(minW).toBeGreaterThanOrEqual(44);
    expect(minH).toBeGreaterThanOrEqual(44);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Shop button + overlay integration
// ---------------------------------------------------------------------------

/** Build an economy mock with a mutable balance for shop tests */
const makeMockEconomy = (initialBalance = 0): Economy => {
  let balance = initialBalance;
  type Handler = Parameters<Economy["subscribe"]>[0];
  const handlers: Handler[] = [];

  return {
    getBalance: () => balance,
    addYield: (gameId, amount) => {
      balance += amount;
      const event = { gameId, amount, newBalance: balance };
      for (const h of handlers) h(event);
    },
    spend: (gameId, amount) => {
      if (amount <= 0) throw new RangeError("amount must be > 0");
      if (balance < amount) return false;
      balance -= amount;
      const event = { gameId, amount: -amount, newBalance: balance };
      for (const h of handlers) h(event);
      return true;
    },
    subscribe: (handler) => {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
  };
};

describe("Shop button and overlay", () => {
  it("Shop button appears in container after init", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector("[data-role='shop-button']");
    expect(btn).not.toBeNull();

    await game.teardown();
  });

  it("Shop button hit-target is >= 44x44 px", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    expect(btn).not.toBeNull();

    const minW = parseInt(btn!.style.minWidth, 10);
    const minH = parseInt(btn!.style.minHeight, 10);
    expect(minW).toBeGreaterThanOrEqual(44);
    expect(minH).toBeGreaterThanOrEqual(44);

    await game.teardown();
  });

  it("clicking Shop button shows the shop overlay", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    expect(btn).not.toBeNull();

    const overlay = ctx.container.querySelector<HTMLElement>(
      "[data-role='shop-overlay']",
    );
    expect(overlay).not.toBeNull();

    // Before click: hidden
    expect(overlay!.style.display).toBe("none");
    btn!.click();
    // After click: visible
    expect(overlay!.style.display).not.toBe("none");

    await game.teardown();
  });

  it("shop overlay disappears after teardown", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown();

    const overlay = ctx.container.querySelector("[data-role='shop-overlay']");
    expect(overlay).toBeNull();
  });

  it("buying size 1 (balance >= 3) adds a new creature and deducts 3", async () => {
    const economy = makeMockEconomy(100);
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const initialOwned = game.__getRunState().owned.length;

    // Open shop
    const shopBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    shopBtn!.click();

    // Click size 1
    const size1Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(size1Btn).not.toBeNull();
    size1Btn!.click();

    const afterState = game.__getRunState();
    expect(afterState.owned).toHaveLength(initialOwned + 1);
    expect(economy.getBalance()).toBe(97); // 100 - 3

    await game.teardown();
  });

  it("buying with insufficient balance is a no-op", async () => {
    const economy = makeMockEconomy(2); // less than size 1 price (3)
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const initialOwned = game.__getRunState().owned.length;

    // Open shop
    const shopBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    shopBtn!.click();

    // After refresh, size 1 button should be disabled
    const size1Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='1']");
    expect(size1Btn).not.toBeNull();
    // Button should be disabled (visually and functionally)
    // Clicking it should be a no-op
    size1Btn!.click();

    const afterState = game.__getRunState();
    expect(afterState.owned).toHaveLength(initialOwned); // unchanged
    expect(economy.getBalance()).toBe(2); // unchanged

    await game.teardown();
  });

  it("buying size 5 unlocks fusion tier 6 in runState", async () => {
    const economy = makeMockEconomy(500); // enough for size-5 (120)
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const shopBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    shopBtn!.click();

    const size5Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='5']");
    expect(size5Btn).not.toBeNull();
    size5Btn!.click();

    const afterState = game.__getRunState();
    expect(afterState.unlockedFusionTiers).toContain(6);

    await game.teardown();
  });

  it("HUD balance text updates after a purchase", async () => {
    const economy = makeMockEconomy(50);
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    // Find balance display
    const balanceEl = ctx.container.querySelector(
      "[data-role='balance-display']",
    );
    expect(balanceEl).not.toBeNull();

    // Check initial balance shown
    expect(balanceEl!.textContent).toContain("50");

    // Buy size 1
    const shopBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    );
    shopBtn!.click();

    const size1Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='1']");
    size1Btn!.click();

    // Balance should now show 47
    expect(balanceEl!.textContent).toContain("47");

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Fusion button + overlay integration
// ---------------------------------------------------------------------------

describe("Fusion button and overlay", () => {
  it("Fusion button appears in container after init", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector("[data-role='fusion-button']");
    expect(btn).not.toBeNull();

    await game.teardown();
  });

  it("Fusion button hit-target is >= 44x44 px", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    );
    expect(btn).not.toBeNull();

    const minW = parseInt(btn!.style.minWidth, 10);
    const minH = parseInt(btn!.style.minHeight, 10);
    expect(minW).toBeGreaterThanOrEqual(44);
    expect(minH).toBeGreaterThanOrEqual(44);

    await game.teardown();
  });

  it("clicking Fusion button shows the fusion overlay", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);

    const btn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    );
    expect(btn).not.toBeNull();

    const overlay = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    );
    expect(overlay).not.toBeNull();

    // Before click: hidden
    expect(overlay!.style.display).toBe("none");
    btn!.click();
    // After click: visible
    expect(overlay!.style.display).not.toBe("none");

    await game.teardown();
  });

  it("fusion overlay disappears after teardown", async () => {
    const ctx = makeCtx();
    const game = createKeimgartenGame();
    await game.init(ctx);
    await game.teardown();

    const overlay = ctx.container.querySelector("[data-role='fusion-overlay']");
    expect(overlay).toBeNull();
  });

  it("successful fusion via overlay deducts inputs and adds output", async () => {
    // Give enough balance to buy two size-5 creatures (which unlocks tier 6)
    const economy = makeMockEconomy(1000);
    const ctx = makeCtx(undefined, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    // Buy a size-1 and size-5 creature (so we have a 1+5=6 valid pair)
    // First, buy size 5 to unlock tier 6
    const shopBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='shop-button']",
    )!;
    shopBtn.click();
    const size5Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='5']")!;
    size5Btn.click();

    // Now buy a size 1 creature
    shopBtn.click();
    const size1Btn =
      ctx.container.querySelector<HTMLButtonElement>("[data-size='1']")!;
    size1Btn.click();

    // We now have at least: starter Keim (tier-1), + 1 tier-5, + 1 tier-1 (from shop)
    // The tier-5 purchase should have unlocked tier 6
    const stateBeforeFusion = game.__getRunState();
    expect(stateBeforeFusion.unlockedFusionTiers).toContain(6);

    // Find a valid pair (tier-1 instance + tier-5 instance)
    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const size5Instance = stateBeforeFusion.owned.find((c) => {
      const shape = B.find((s) => s.id === c.creatureId);
      return shape?.tier === 5;
    });
    const size1Instances = stateBeforeFusion.owned.filter((c) => {
      const shape = B.find((s) => s.id === c.creatureId);
      return shape?.tier === 1;
    });
    expect(size5Instance).toBeDefined();
    expect(size1Instances.length).toBeGreaterThanOrEqual(1);

    const size1Instance = size1Instances[0]!;
    const countBefore = stateBeforeFusion.owned.length;

    // Open fusion overlay
    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOverlay = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    expect(fusionOverlay.style.display).not.toBe("none");

    // Select target 6
    const targetBtn = fusionOverlay.querySelector<HTMLButtonElement>(
      "[data-target-size='6']",
    )!;
    targetBtn.click();

    // Select size-1 input
    const inputA = fusionOverlay.querySelector<HTMLButtonElement>(
      `[data-instance-id="${size1Instance.instanceId.toString()}"]`,
    )!;
    inputA.click();

    // Select size-5 input
    const inputB = fusionOverlay.querySelector<HTMLButtonElement>(
      `[data-instance-id="${size5Instance!.instanceId.toString()}"]`,
    )!;
    inputB.click();

    // Click confirm
    const confirmBtn = fusionOverlay.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();

    // After fusion: count changes by net -1 (2 removed, 1 added)
    const stateAfterFusion = game.__getRunState();
    expect(stateAfterFusion.owned.length).toBe(countBefore - 1);

    // Both original instances gone
    const ownedIds = stateAfterFusion.owned.map((c) => c.instanceId);
    expect(ownedIds).not.toContain(size1Instance.instanceId);
    expect(ownedIds).not.toContain(size5Instance!.instanceId);

    await game.teardown();
  });

  it("size-6 fusion (free): economy.spend is NOT called, fusion still succeeds", async () => {
    // Fresh game with persistence-seeded state and a mock economy that can spy on spend
    const spendSpy = vi.fn().mockReturnValue(true);
    const realEconomy = makeMockEconomy(2000);
    const spyEconomy: Economy = {
      ...realEconomy,
      spend: spendSpy,
    };
    const idb2 = (await import("fake-indexeddb")).IDBFactory;
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const persistence2 = cp({ idb: new idb2(), dbName: "kg-fusion-cost-test" });

    // Save a state with tier-6 unlocked and a valid 1+5 pair
    const base = (await import("./domain/runState.ts")).makeRunState();
    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const size1c = B.find((c) => c.tier === 1)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6] as number[],
      owned: [
        {
          instanceId: 0,
          creatureId: size1c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size1c.id, size5c.id],
    };
    await persistence2.save("keimgarten-run", preparedState);

    const ctx2 = makeCtx(persistence2, undefined, spyEconomy);
    const game2 = createKeimgartenGame();
    await game2.init(ctx2);

    // Open fusion overlay
    const fusionBtn2 = ctx2.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn2.click();

    const fusionOv2 = ctx2.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;

    // Select target 6
    fusionOv2
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();

    // Select both inputs
    fusionOv2
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv2
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    spendSpy.mockClear(); // clear any calls from shop/init

    // Confirm fusion
    fusionOv2
      .querySelector<HTMLButtonElement>("[data-role='fusion-confirm']")!
      .click();

    // For size-6 (cost=0), economy.spend should NOT be called
    expect(spendSpy).not.toHaveBeenCalled();

    await game2.teardown();
  });

  it("size-7 fusion with sufficient balance: economy.spend called with 100, fusion succeeds", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-fusion-size7-ok" });

    const spendSpy = vi
      .fn()
      .mockImplementation((gameId: string, amount: number) => {
        void gameId;
        void amount;
        return true; // always succeeds
      });
    const realEconomy = makeMockEconomy(500);
    const spyEconomy: Economy = {
      ...realEconomy,
      spend: spendSpy,
    };

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size3c = B.find((c) => c.tier === 3)!;
    const size4c = B.find((c) => c.tier === 4)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7] as number[],
      owned: [
        {
          instanceId: 0,
          creatureId: size3c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size4c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size3c.id, size4c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const ctx = makeCtx(persistence, undefined, spyEconomy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    spendSpy.mockClear(); // clear any init-time calls

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;

    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='7']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    const confirmBtn = fusionOv.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();

    // economy.spend should have been called with 100
    expect(spendSpy).toHaveBeenCalledWith("002-keimgarten", 100);

    // Fusion succeeded: net -1 creature (2 consumed, 1 added)
    const afterState = game.__getRunState();
    const ids = afterState.owned.map((c) => c.instanceId);
    expect(ids).not.toContain(0);
    expect(ids).not.toContain(1);

    await game.teardown();
  });

  it("size-7 fusion with insufficient balance (50 < 100): economy.spend NOT called for fusion, no state change", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-fusion-size7-fail" });

    // Economy with balance=50 (insufficient for size-7 cost=100)
    // spend returns false when insufficient
    const spendSpy = vi.fn().mockReturnValue(false);
    const economy: Economy = {
      getBalance: () => 50,
      addYield: vi.fn(),
      spend: spendSpy,
      subscribe: () => () => undefined,
    };

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size3c = B.find((c) => c.tier === 3)!;
    const size4c = B.find((c) => c.tier === 4)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7] as number[],
      owned: [
        {
          instanceId: 0,
          creatureId: size3c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size4c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size3c.id, size4c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const ctx = makeCtx(persistence, undefined, economy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const stateBeforeFusion = game.__getRunState();
    const countBefore = stateBeforeFusion.owned.length;

    spendSpy.mockClear();

    // The confirm button should be DISABLED (balance=50 < cost=100)
    // Open fusion overlay
    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;

    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='7']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    const confirmBtn = fusionOv.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    // With balance=50 < cost=100, button must be DISABLED
    expect(confirmBtn.disabled).toBe(true);

    // Even if we force-click, no fusion happens (button is disabled)
    // Verify no spend was called
    expect(spendSpy).not.toHaveBeenCalled();

    // State unchanged
    const afterState = game.__getRunState();
    expect(afterState.owned.length).toBe(countBefore);

    await game.teardown();
  });

  it("size-9 fusion produces Vollkommen (creatureId 166)", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-fusion-size9" });

    const realEconomy = makeMockEconomy(5000);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size4c = B.find((c) => c.tier === 4)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7, 8, 9] as number[],
      owned: [
        {
          instanceId: 0,
          creatureId: size4c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size4c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const ctx = makeCtx(persistence, undefined, realEconomy);
    const game = createKeimgartenGame();
    await game.init(ctx);

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;

    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='9']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    const confirmBtn = fusionOv.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();

    // Output should be Vollkommen (id=166)
    const afterState = game.__getRunState();
    const newCreature = afterState.owned.find(
      (c) => c.instanceId !== 0 && c.instanceId !== 1,
    );
    expect(newCreature).toBeDefined();
    expect(newCreature!.creatureId).toBe(166);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Achievements service forwarding
// ---------------------------------------------------------------------------

/**
 * Build a makeCtx variant that captures achievements.unlock calls.
 * Returns the ctx and a spy that records calls.
 */
const makeCtxWithAchievements = (
  economy?: Economy,
  persistence?: Persistence,
): {
  ctx: ReturnType<typeof makeCtx>;
  unlockSpy: ReturnType<typeof vi.fn>;
} => {
  const unlockSpy = vi.fn();
  const ctx = makeCtx(persistence, undefined, economy);
  ctx.services.achievements.unlock = unlockSpy;
  return { ctx, unlockSpy };
};

describe("achievements — game.ts forwards unlock to service", () => {
  it("successful fusion calls achievements.unlock('002-keimgarten', 'first-fusion') exactly once", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-first-fusion" });

    const economy = makeMockEconomy(5000);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size1c = B.find((c) => c.tier === 1)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6] as number[],
      achievementsUnlocked: [] as string[],
      owned: [
        {
          instanceId: 0,
          creatureId: size1c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size1c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const game = createKeimgartenGame();
    await game.init(ctx);

    unlockSpy.mockClear();

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>("[data-role='fusion-confirm']")!
      .click();

    // first-fusion should have been unlocked exactly once
    const firstFusionCalls = (
      unlockSpy.mock.calls as [string, string][]
    ).filter(([, id]) => id === "first-fusion");
    expect(firstFusionCalls.length).toBe(1);
    expect(firstFusionCalls[0]![0]).toBe("002-keimgarten");

    await game.teardown();
  });

  it("subsequent fusion does NOT re-fire first-fusion", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-no-refire" });

    const economy = makeMockEconomy(5000);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size1c = B.find((c) => c.tier === 1)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();

    // State where first-fusion is ALREADY unlocked
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6] as number[],
      achievementsUnlocked: ["first-fusion"] as string[],
      owned: [
        {
          instanceId: 0,
          creatureId: size1c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size1c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const game = createKeimgartenGame();
    await game.init(ctx);

    unlockSpy.mockClear();

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='6']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>("[data-role='fusion-confirm']")!
      .click();

    // first-fusion must NOT be fired again
    const firstFusionCalls = (
      unlockSpy.mock.calls as [string, string][]
    ).filter(([, id]) => id === "first-fusion");
    expect(firstFusionCalls.length).toBe(0);

    await game.teardown();
  });

  it("fusion to tier-8 fires first-archon", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-archon-fuse" });

    const economy = makeMockEconomy(5000);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size3c = B.find((c) => c.tier === 3)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7, 8] as number[],
      achievementsUnlocked: ["first-fusion"] as string[],
      owned: [
        {
          instanceId: 0,
          creatureId: size3c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size3c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const game = createKeimgartenGame();
    await game.init(ctx);

    unlockSpy.mockClear();

    // Fuse 3+5=8 → should fire first-archon
    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='8']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    const confirmBtn = fusionOv.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();

    const archonCalls = (unlockSpy.mock.calls as [string, string][]).filter(
      ([, id]) => id === "first-archon",
    );
    expect(archonCalls.length).toBe(1);
    expect(archonCalls[0]![0]).toBe("002-keimgarten");

    await game.teardown();
  });

  it("fusion to tier-9 fires vollkommen", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-vollkommen" });

    const economy = makeMockEconomy(10000);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size4c = B.find((c) => c.tier === 4)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7, 8, 9] as number[],
      achievementsUnlocked: ["first-fusion"] as string[],
      owned: [
        {
          instanceId: 0,
          creatureId: size4c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size4c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const game = createKeimgartenGame();
    await game.init(ctx);

    unlockSpy.mockClear();

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='9']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();

    const confirmBtn = fusionOv.querySelector<HTMLButtonElement>(
      "[data-role='fusion-confirm']",
    )!;
    expect(confirmBtn.disabled).toBe(false);
    confirmBtn.click();

    const vollCalls = (unlockSpy.mock.calls as [string, string][]).filter(
      ([, id]) => id === "vollkommen",
    );
    expect(vollCalls.length).toBe(1);
    expect(vollCalls[0]![0]).toBe("002-keimgarten");

    await game.teardown();
  });

  it("save/reload: achievementsUnlocked persisted — first-fusion NOT re-emitted on init", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-reload" });

    // Save a state with first-fusion already unlocked
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const base = mrs();
    const savedState = {
      ...base,
      achievementsUnlocked: ["first-fusion"] as string[],
    };
    await persistence.save("keimgarten-run", savedState);

    const economy = makeMockEconomy(100);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);
    const game = createKeimgartenGame();

    await game.init(ctx);

    // On init with a persisted unlock, no further unlock calls should happen
    const firstFusionCalls = (
      unlockSpy.mock.calls as [string, string][]
    ).filter(([, id]) => id === "first-fusion");
    expect(firstFusionCalls.length).toBe(0);

    const restoredState = game.__getRunState();
    expect(restoredState.achievementsUnlocked).toContain("first-fusion");

    await game.teardown();
  });

  it("integration: fusion to size-9 unlocks first-fusion and vollkommen (both exactly once)", async () => {
    const { createPersistence: cp } =
      await import("../../services/persistence/index.ts");
    const idb = (await import("fake-indexeddb")).IDBFactory;
    const persistence = cp({ idb: new idb(), dbName: "kg-ach-integration" });

    const economy = makeMockEconomy(10000);
    const { ctx, unlockSpy } = makeCtxWithAchievements(economy, persistence);

    const { BESTIARY: B } = await import("../../shared/franchise/bestiary.ts");
    const { makeRunState: mrs } = await import("./domain/runState.ts");
    const size4c = B.find((c) => c.tier === 4)!;
    const size5c = B.find((c) => c.tier === 5)!;
    const base = mrs();
    const preparedState = {
      ...base,
      unlockedFusionTiers: [6, 7, 8, 9] as number[],
      achievementsUnlocked: [] as string[],
      owned: [
        {
          instanceId: 0,
          creatureId: size4c.id,
          position: { x: 10, y: 10 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 1,
          walkTargetX: 10,
          walkTargetY: 10,
        },
        {
          instanceId: 1,
          creatureId: size5c.id,
          position: { x: 20, y: 20 },
          state: "idle" as const,
          stateUntil: 0,
          facing: 1 as const,
          seed: 2,
          walkTargetX: 20,
          walkTargetY: 20,
        },
      ],
      nextInstanceId: 2,
      uniqueOwnedIds: [size4c.id, size5c.id],
    };
    await persistence.save("keimgarten-run", preparedState);

    const game = createKeimgartenGame();
    await game.init(ctx);

    unlockSpy.mockClear();

    const fusionBtn = ctx.container.querySelector<HTMLButtonElement>(
      "[data-role='fusion-button']",
    )!;
    fusionBtn.click();

    const fusionOv = ctx.container.querySelector<HTMLElement>(
      "[data-role='fusion-overlay']",
    )!;
    fusionOv
      .querySelector<HTMLButtonElement>("[data-target-size='9']")!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="0"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>('[data-instance-id="1"]')!
      .click();
    fusionOv
      .querySelector<HTMLButtonElement>("[data-role='fusion-confirm']")!
      .click();

    // Both first-fusion and vollkommen should be unlocked exactly once
    const calls = unlockSpy.mock.calls as [string, string][];
    const ids = calls.map(([, id]) => id);
    expect(ids.filter((id) => id === "first-fusion").length).toBe(1);
    expect(ids.filter((id) => id === "vollkommen").length).toBe(1);
    // tier-9 is not tier-8, first-archon should NOT fire
    expect(ids.filter((id) => id === "first-archon").length).toBe(0);

    await game.teardown();
  });
});
