// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import type { GameContext, Persistence } from "../../engine/Game.ts";
import type { Disposer, TapEvent } from "../../services/input/types.ts";
import { createHelloWorldGame } from "./game.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeInput {
  fireTap(e: TapEvent): void;
  inputService: GameContext["services"]["input"];
}

const makeFakeInput = (): FakeInput => {
  const tapHandlers = new Set<(e: TapEvent) => void>();
  return {
    fireTap: (e) => {
      for (const h of [...tapHandlers]) h(e);
    },
    inputService: {
      onTap: (handler): Disposer => {
        tapHandlers.add(handler);
        return () => {
          tapHandlers.delete(handler);
        };
      },
      onDrag: (): Disposer => () => undefined,
      onKey: (): Disposer => () => undefined,
    },
  };
};

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

const makeCtx = (
  input: FakeInput["inputService"],
  overrides: {
    achievements?: GameContext["services"]["achievements"];
    economy?: GameContext["services"]["economy"];
    persistence?: Persistence;
  } = {},
): GameContext => {
  const container = document.createElement("div");
  container.style.width = "375px";
  container.style.height = "667px";
  document.body.appendChild(container);
  return {
    container,
    services: {
      persistence: overrides.persistence ?? {
        save: () => Promise.resolve(),
        load: () => Promise.resolve(null),
        delete: () => Promise.resolve(),
      },
      economy: overrides.economy ?? {
        getBalance: () => 0,
        addYield: () => undefined,
        spend: () => false,
        subscribe: () => () => undefined,
      },
      achievements: overrides.achievements ?? {
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

/** Fire a tap at the center of the container (always hits the sprite). */
const tapCenter = (fake: FakeInput): void => {
  fake.fireTap({ x: 187, y: 333 });
};

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — contract", () => {
  it("returns an object with init / update / render / teardown", () => {
    const game = createHelloWorldGame();
    expect(typeof game.init).toBe("function");
    expect(typeof game.update).toBe("function");
    expect(typeof game.render).toBe("function");
    expect(typeof game.teardown).toBe("function");
  });

  it("exposes __getRunState test seam", () => {
    const game = createHelloWorldGame();
    expect(typeof game.__getRunState).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — lifecycle", () => {
  it("init mounts a sprite into ctx.container", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createHelloWorldGame();
    await game.init(ctx);
    expect(ctx.container.children.length).toBeGreaterThan(0);
    await game.teardown();
  });

  it("teardown removes the sprite from ctx.container", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createHelloWorldGame();
    await game.init(ctx);
    await game.teardown();
    expect(ctx.container.children.length).toBe(0);
  });

  it("update and render are callable without throwing", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createHelloWorldGame();
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
// Tap counter
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — tap counter", () => {
  it("starts at totalTaps=0 sessionTaps=0", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createHelloWorldGame();
    await game.init(ctx);
    const state = game.__getRunState();
    expect(state.totalTaps).toBe(0);
    expect(state.sessionTaps).toBe(0);
    await game.teardown();
  });

  it("each tap on the sprite increments totalTaps and sessionTaps by 1", async () => {
    const fake = makeFakeInput();
    const ctx = makeCtx(fake.inputService);
    const game = createHelloWorldGame();
    await game.init(ctx);
    tapCenter(fake);
    tapCenter(fake);
    tapCenter(fake);
    const state = game.__getRunState();
    expect(state.totalTaps).toBe(3);
    expect(state.sessionTaps).toBe(3);
    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Achievement thresholds
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — achievements", () => {
  it("unlocks hw-tap-5 when totalTaps reaches 5", async () => {
    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const ctx = makeCtx(fake.inputService, { achievements });
    const game = createHelloWorldGame();
    await game.init(ctx);
    for (let i = 0; i < 5; i++) tapCenter(fake);
    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "000-hello-world",
      "hw-tap-5",
    );
    await game.teardown();
  });

  it("unlocks hw-tap-25 when totalTaps reaches 25", async () => {
    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const ctx = makeCtx(fake.inputService, { achievements });
    const game = createHelloWorldGame();
    await game.init(ctx);
    for (let i = 0; i < 25; i++) tapCenter(fake);
    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "000-hello-world",
      "hw-tap-25",
    );
    await game.teardown();
  });

  it("unlocks hw-tap-100 when sessionTaps reaches 100", async () => {
    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const ctx = makeCtx(fake.inputService, { achievements });
    const game = createHelloWorldGame();
    await game.init(ctx);
    for (let i = 0; i < 100; i++) tapCenter(fake);
    expect(achievements.unlockSpy).toHaveBeenCalledWith(
      "000-hello-world",
      "hw-tap-100",
    );
    await game.teardown();
  });

  it("hw-tap-100 tracks sessionTaps, not totalTaps", async () => {
    // Start with totalTaps=90 restored from persistence, but sessionTaps=0.
    // 100 new taps in this session should unlock hw-tap-100 at tap #100 of
    // the session (totalTaps=190), not at tap #10 of the session.
    const fake = makeFakeInput();
    const achievements = makeSpyAchievements();
    const persistence: Persistence = {
      save: () => Promise.resolve(),
      load: <T>(_key: string) => Promise.resolve(90 as unknown as T | null),
      delete: () => Promise.resolve(),
    };
    const ctx = makeCtx(fake.inputService, { achievements, persistence });
    const game = createHelloWorldGame();
    await game.init(ctx);

    // 9 taps — session=9, total=99 — hw-tap-100 must NOT fire yet
    for (let i = 0; i < 9; i++) tapCenter(fake);
    const callsAfter9 = achievements.unlockSpy.mock.calls.filter(
      (args) => args[1] === "hw-tap-100",
    ).length;
    expect(callsAfter9).toBe(0);

    // 91 more taps — session=100, total=190 — hw-tap-100 fires now
    for (let i = 0; i < 91; i++) tapCenter(fake);
    const callsAfter100 = achievements.unlockSpy.mock.calls.filter(
      (args) => args[1] === "hw-tap-100",
    ).length;
    expect(callsAfter100).toBe(1);

    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — economy", () => {
  it("each tap calls addYield('000-hello-world', 1)", async () => {
    const fake = makeFakeInput();
    const economy = makeSpyEconomy();
    const ctx = makeCtx(fake.inputService, { economy });
    const game = createHelloWorldGame();
    await game.init(ctx);
    tapCenter(fake);
    tapCenter(fake);
    expect(economy.addYieldSpy).toHaveBeenCalledTimes(2);
    expect(economy.addYieldSpy).toHaveBeenCalledWith("000-hello-world", 1);
    await game.teardown();
  });
});

// ---------------------------------------------------------------------------
// Cross-session restore
// ---------------------------------------------------------------------------

describe("createHelloWorldGame — cross-session restore", () => {
  it("restores totalTaps from persistence on init", async () => {
    const savedTaps = 42;
    const fake = makeFakeInput();
    const persistence: Persistence = {
      save: () => Promise.resolve(),
      load: <T>(_key: string) =>
        Promise.resolve(savedTaps as unknown as T | null),
      delete: () => Promise.resolve(),
    };
    const ctx = makeCtx(fake.inputService, { persistence });
    const game = createHelloWorldGame();
    await game.init(ctx);
    expect(game.__getRunState().totalTaps).toBe(savedTaps);
    await game.teardown();
  });

  it("sessionTaps always starts at 0 even if totalTaps is restored", async () => {
    const fake = makeFakeInput();
    const persistence: Persistence = {
      save: () => Promise.resolve(),
      load: <T>(_key: string) => Promise.resolve(99 as unknown as T | null),
      delete: () => Promise.resolve(),
    };
    const ctx = makeCtx(fake.inputService, { persistence });
    const game = createHelloWorldGame();
    await game.init(ctx);
    expect(game.__getRunState().sessionTaps).toBe(0);
    await game.teardown();
  });

  it("saves totalTaps to persistence on tap", async () => {
    const fake = makeFakeInput();
    const saveSpy = vi.fn().mockResolvedValue(undefined);
    const persistence: Persistence = {
      save: saveSpy,
      load: () => Promise.resolve(null),
      delete: () => Promise.resolve(),
    };
    const ctx = makeCtx(fake.inputService, { persistence });
    const game = createHelloWorldGame();
    await game.init(ctx);
    tapCenter(fake);
    // Allow debounce to settle (persistence save may be debounced)
    await new Promise((r) => setTimeout(r, 100));
    expect(saveSpy).toHaveBeenCalledWith("hw-total-taps", 1, expect.anything());
    await game.teardown();
  });
});
