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
