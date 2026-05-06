import { describe, expect, it, vi } from "vitest";

import type {
  AchievementDef,
  Game,
  GameContext,
  GameManifest,
  SeededRng,
  ServiceRegistry,
} from "./Game.ts";

const noopRng: SeededRng = {
  next: () => 0.5,
  int: (min, _max) => min,
  fork: () => noopRng,
  state: "noop",
};

const stubServices = (): ServiceRegistry => ({
  persistence: {
    save: () => Promise.resolve(),
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
  input: {
    onTap: () => () => undefined,
    onDrag: () => () => undefined,
    onKey: () => () => undefined,
  },
  audio: {
    enable: () => undefined,
    setMuted: () => undefined,
    play: () => undefined,
  },
});

const buildContext = (container: HTMLElement): GameContext => ({
  container,
  services: stubServices(),
  rng: noopRng,
  dimensions: { width: 375, height: 667, devicePixelRatio: 1 },
});

interface NoopRunState {
  readonly score: number;
}

const noopManifest: GameManifest<NoopRunState> = {
  id: "000-noop",
  title: "Noop",
  achievements: [
    { id: "first", title: "First", criterion: "Run init once" },
    { id: "second", title: "Second", criterion: "Run update once" },
    { id: "third", title: "Third", criterion: "Run teardown once" },
  ],
  currencyYield: (state) => Math.max(0, state.score),
};

const buildNoopGame = (): {
  game: Game;
  initCalls: number;
  updateTicks: number[];
  renderCalls: number;
  teardownCalls: number;
} => {
  const counters = {
    initCalls: 0,
    updateTicks: [] as number[],
    renderCalls: 0,
    teardownCalls: 0,
  };
  const game: Game = {
    init: () => {
      counters.initCalls += 1;
    },
    update: (dtMs) => {
      counters.updateTicks.push(dtMs);
    },
    render: () => {
      counters.renderCalls += 1;
    },
    teardown: () => {
      counters.teardownCalls += 1;
    },
  };
  return {
    game,
    get initCalls() {
      return counters.initCalls;
    },
    get updateTicks() {
      return counters.updateTicks;
    },
    get renderCalls() {
      return counters.renderCalls;
    },
    get teardownCalls() {
      return counters.teardownCalls;
    },
  };
};

describe("GameManifest", () => {
  it("exposes id, title, exactly three achievements, and a currencyYield function", () => {
    expect(noopManifest.id).toBe("000-noop");
    expect(noopManifest.title).toBe("Noop");
    expect(noopManifest.achievements).toHaveLength(3);
    expect(typeof noopManifest.currencyYield).toBe("function");
  });

  it("currencyYield is deterministic and never negative", () => {
    expect(noopManifest.currencyYield({ score: 0 })).toBe(0);
    expect(noopManifest.currencyYield({ score: 100 })).toBe(100);
    expect(noopManifest.currencyYield({ score: -50 })).toBe(0);
    // Determinism: same input → same output across calls.
    expect(noopManifest.currencyYield({ score: 42 })).toBe(
      noopManifest.currencyYield({ score: 42 }),
    );
  });

  it("achievement definitions carry id, title, criterion", () => {
    const a: AchievementDef = noopManifest.achievements[0];
    expect(a.id).toBeDefined();
    expect(a.title).toBeDefined();
    expect(a.criterion).toBeDefined();
  });
});

describe("Game lifecycle contract", () => {
  it("a no-op Game completes init → update → render → teardown without throwing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const harness = buildNoopGame();
    const ctx = buildContext(container);

    await harness.game.init(ctx);
    expect(harness.initCalls).toBe(1);

    harness.game.update(16);
    harness.game.update(16);
    harness.game.update(16);
    expect(harness.updateTicks).toEqual([16, 16, 16]);

    harness.game.render();
    expect(harness.renderCalls).toBe(1);

    await harness.game.teardown();
    expect(harness.teardownCalls).toBe(1);

    container.remove();
  });

  it("supports async init and async teardown without observable difference", async () => {
    const container = document.createElement("div");

    let initStarted = false;
    let initFinished = false;
    let teardownStarted = false;
    let teardownFinished = false;

    const game: Game = {
      init: async () => {
        initStarted = true;
        await Promise.resolve();
        initFinished = true;
      },
      update: () => undefined,
      render: () => undefined,
      teardown: async () => {
        teardownStarted = true;
        await Promise.resolve();
        teardownFinished = true;
      },
    };

    await game.init(buildContext(container));
    expect(initStarted).toBe(true);
    expect(initFinished).toBe(true);

    await game.teardown();
    expect(teardownStarted).toBe(true);
    expect(teardownFinished).toBe(true);
  });

  it("can be torn down and re-init'd without the contract preventing it", async () => {
    const container = document.createElement("div");
    const harness = buildNoopGame();
    const ctx = buildContext(container);

    await harness.game.init(ctx);
    await harness.game.teardown();
    await harness.game.init(ctx);
    await harness.game.teardown();

    expect(harness.initCalls).toBe(2);
    expect(harness.teardownCalls).toBe(2);
  });
});

describe("GameContext", () => {
  it("exposes container, services, rng, and dimensions", () => {
    const container = document.createElement("div");
    const ctx = buildContext(container);
    expect(ctx.container).toBe(container);
    expect(ctx.services.input).toBeDefined();
    expect(ctx.services.persistence).toBeDefined();
    expect(ctx.services.economy).toBeDefined();
    expect(ctx.services.achievements).toBeDefined();
    expect(ctx.services.audio).toBeDefined();
    expect(ctx.rng.next()).toBeGreaterThanOrEqual(0);
    expect(ctx.rng.next()).toBeLessThan(1);
    expect(ctx.dimensions.width).toBe(375);
    expect(ctx.dimensions.height).toBe(667);
  });

  it("services from a real input instance plug into the registry", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const { createInput } = await import("../services/input/index.ts");
    const input = createInput(container);
    const tap = vi.fn();
    const dispose = input.onTap(tap);

    const services = stubServices();
    const ctx: GameContext = {
      container,
      services: { ...services, input },
      rng: noopRng,
      dimensions: { width: 100, height: 100, devicePixelRatio: 1 },
    };

    expect(ctx.services.input).toBe(input);
    dispose();
    container.remove();
  });
});

describe("SeededRng", () => {
  it("next() returns numbers in [0, 1)", () => {
    const r: SeededRng = noopRng;
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("fork() returns a SeededRng (independent stream contract — implementation detail)", () => {
    const a = noopRng.fork();
    expect(typeof a.next).toBe("function");
    expect(typeof a.state).toBe("string");
  });
});
