// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Game, SeededRng } from "./Game.ts";
import type { EngineOptions, RendererAdapter } from "./Engine.ts";
import { createEngine } from "./Engine.ts";
import {
  makeBaseOpts,
  makeFakeRenderer,
  makeManifest,
  makeNoopGame,
  makeVirtualScheduler,
  stubServices,
} from "./Engine.testHelpers.ts";

// ---------------------------------------------------------------------------
// Tests: register
// ---------------------------------------------------------------------------

describe("Engine.register", () => {
  it("accepts a manifest + factory without throwing", () => {
    const host = document.createElement("div");
    const engine = createEngine(host, makeBaseOpts());
    expect(() => {
      engine.register(makeManifest("000-a"), () => makeNoopGame().game);
    }).not.toThrow();
  });

  it("throws on duplicate game id", () => {
    const host = document.createElement("div");
    const engine = createEngine(host, makeBaseOpts());
    engine.register(makeManifest("000-dup"), () => makeNoopGame().game);
    expect(() => {
      engine.register(makeManifest("000-dup"), () => makeNoopGame().game);
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: start / stop — happy paths
// ---------------------------------------------------------------------------

describe("Engine.start / stop", () => {
  let host: HTMLElement;
  let renderer: ReturnType<typeof makeFakeRenderer>;
  let scheduler: ReturnType<typeof makeVirtualScheduler>;
  let opts: EngineOptions;

  beforeEach(() => {
    host = document.createElement("div");
    renderer = makeFakeRenderer();
    scheduler = makeVirtualScheduler();
    opts = makeBaseOpts(renderer, scheduler);
  });

  afterEach(() => {
    host.remove();
  });

  it("start resolves after game init completes", async () => {
    const harness = makeNoopGame();
    const engine = createEngine(host, opts);
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");

    expect(harness.initCalls).toBe(1);
  });

  it("renderer.attach is called on start with the host element", async () => {
    const harness = makeNoopGame();
    const engine = createEngine(host, opts);
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");

    expect(renderer.attachCalls).toBe(1);
    expect(renderer.lastHost).toBe(host);
  });

  it("stop resolves after game teardown completes", async () => {
    const harness = makeNoopGame();
    const engine = createEngine(host, opts);
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");
    await engine.stop();

    expect(harness.teardownCalls).toBe(1);
  });

  it("renderer.detach is called on stop", async () => {
    const harness = makeNoopGame();
    const engine = createEngine(host, opts);
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");
    await engine.stop();

    expect(renderer.detachCalls).toBe(1);
  });

  it("stop when nothing is running resolves cleanly (idempotent)", async () => {
    const engine = createEngine(host, opts);
    await expect(engine.stop()).resolves.toBeUndefined();
  });

  it("stop when nothing is running does not call renderer.detach", async () => {
    const engine = createEngine(host, opts);
    await engine.stop();
    expect(renderer.detachCalls).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: guard rails
// ---------------------------------------------------------------------------

describe("Engine guard rails", () => {
  it("double-start rejects without stop in between", async () => {
    const host = document.createElement("div");
    const renderer = makeFakeRenderer();
    const scheduler = makeVirtualScheduler();
    const engine = createEngine(host, makeBaseOpts(renderer, scheduler));
    engine.register(makeManifest("000-a"), () => makeNoopGame().game);

    await engine.start("000-a");
    await expect(engine.start("000-a")).rejects.toThrow();
  });

  it("start with unregistered id rejects", async () => {
    const host = document.createElement("div");
    const engine = createEngine(host, makeBaseOpts());
    await expect(engine.start("999-missing")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: fixed-tick loop
// ---------------------------------------------------------------------------

describe("Engine fixed-tick loop", () => {
  it("calls update with stable dtMs and render once per scheduled frame", async () => {
    const host = document.createElement("div");
    const harness = makeNoopGame();
    const renderer = makeFakeRenderer();
    const scheduler = makeVirtualScheduler();
    const TICK = 1000 / 60;

    const engine = createEngine(host, {
      renderer,
      services: stubServices(),
      now: scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancelSchedule,
      fixedTickMs: TICK,
    });
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");

    // Advance exactly one fixed tick worth of time → expect 1 update + 1 render
    scheduler.tick(TICK);
    expect(harness.updateTicks).toHaveLength(1);
    const firstTick = harness.updateTicks[0];
    expect(firstTick).toBeDefined();
    expect(firstTick).toBeCloseTo(TICK, 5);
    expect(harness.renderCalls).toBe(1);

    // Advance another tick
    scheduler.tick(TICK);
    expect(harness.updateTicks).toHaveLength(2);
    const secondTick = harness.updateTicks[1];
    expect(secondTick).toBeDefined();
    expect(secondTick).toBeCloseTo(TICK, 5);
    expect(harness.renderCalls).toBe(2);

    await engine.stop();
  });

  it("clamps accumulated time to at most maxSubsteps ticks (drop-on-overload)", async () => {
    const host = document.createElement("div");
    const harness = makeNoopGame();
    const renderer = makeFakeRenderer();
    const scheduler = makeVirtualScheduler();
    const TICK = 1000 / 60;
    const MAX_SUBSTEPS = 5;

    const engine = createEngine(host, {
      renderer,
      services: stubServices(),
      now: scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancelSchedule,
      fixedTickMs: TICK,
    });
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");

    // Advance 20× TICK in one frame → should not process more than MAX_SUBSTEPS ticks
    scheduler.tick(TICK * 20);
    expect(harness.updateTicks.length).toBeLessThanOrEqual(MAX_SUBSTEPS);
    expect(harness.renderCalls).toBe(1); // still renders once

    await engine.stop();
  });

  it("does not call update or render after stop", async () => {
    const host = document.createElement("div");
    const harness = makeNoopGame();
    const renderer = makeFakeRenderer();
    const scheduler = makeVirtualScheduler();
    const TICK = 1000 / 60;

    const engine = createEngine(host, {
      renderer,
      services: stubServices(),
      now: scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancelSchedule,
      fixedTickMs: TICK,
    });
    engine.register(makeManifest("000-a"), () => harness.game);

    await engine.start("000-a");
    await engine.stop();

    const snapshotUpdates = harness.updateTicks.length;
    const snapshotRenders = harness.renderCalls;

    // Ticking the scheduler after stop should be a no-op
    scheduler.tick(TICK * 5);
    expect(harness.updateTicks).toHaveLength(snapshotUpdates);
    expect(harness.renderCalls).toBe(snapshotRenders);
  });
});

// ---------------------------------------------------------------------------
// Tests: surface area check
// ---------------------------------------------------------------------------

describe("Engine surface area", () => {
  it("exposes exactly register, start, and stop — no more", () => {
    const host = document.createElement("div");
    const engine = createEngine(host, makeBaseOpts());
    const methods = Object.keys(engine);
    expect(methods.sort()).toEqual(["register", "start", "stop"].sort());
  });
});

// ---------------------------------------------------------------------------
// Tests: async game lifecycle integration via Engine
// ---------------------------------------------------------------------------

describe("Engine with async game lifecycle", () => {
  it("awaits async init before resolving start", async () => {
    const host = document.createElement("div");
    const scheduler = makeVirtualScheduler();
    const engine = createEngine(
      host,
      makeBaseOpts(makeFakeRenderer(), scheduler),
    );

    let initResolved = false;
    const asyncGame: Game = {
      init: async () => {
        await Promise.resolve();
        initResolved = true;
      },
      update: () => undefined,
      render: () => undefined,
      teardown: () => undefined,
    };

    engine.register(makeManifest("000-async"), () => asyncGame);
    await engine.start("000-async");

    expect(initResolved).toBe(true);
    await engine.stop();
  });

  it("awaits async teardown before resolving stop", async () => {
    const host = document.createElement("div");
    const scheduler = makeVirtualScheduler();
    const engine = createEngine(
      host,
      makeBaseOpts(makeFakeRenderer(), scheduler),
    );

    let teardownResolved = false;
    const asyncGame: Game = {
      init: () => undefined,
      update: () => undefined,
      render: () => undefined,
      teardown: async () => {
        await Promise.resolve();
        teardownResolved = true;
      },
    };

    engine.register(makeManifest("000-async2"), () => asyncGame);
    await engine.start("000-async2");
    await engine.stop();

    expect(teardownResolved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: can start a different game after stop
// ---------------------------------------------------------------------------

describe("Engine can restart with a different game", () => {
  it("starts a second game cleanly after stopping the first", async () => {
    const host = document.createElement("div");
    const scheduler = makeVirtualScheduler();
    const renderer = makeFakeRenderer();
    const engine = createEngine(host, makeBaseOpts(renderer, scheduler));

    const harnessA = makeNoopGame();
    const harnessB = makeNoopGame();

    engine.register(makeManifest("000-a"), () => harnessA.game);
    engine.register(makeManifest("000-b"), () => harnessB.game);

    await engine.start("000-a");
    expect(harnessA.initCalls).toBe(1);

    await engine.stop();
    expect(harnessA.teardownCalls).toBe(1);

    await engine.start("000-b");
    expect(harnessB.initCalls).toBe(1);

    await engine.stop();
  });
});

// ---------------------------------------------------------------------------
// Tests: RendererAdapter
// ---------------------------------------------------------------------------

describe("RendererAdapter", () => {
  it("attach receives host element and dimensions when provided", async () => {
    let capturedHost: HTMLElement | null = null;
    const attachSpy = vi.fn(
      (host: HTMLElement, _dims: { width: number; height: number }) => {
        capturedHost = host;
        return Promise.resolve();
      },
    );
    const renderer: RendererAdapter = {
      attach: (host, dims) => attachSpy(host, dims),
      detach: () => Promise.resolve(),
    };
    const host = document.createElement("div");
    const scheduler = makeVirtualScheduler();
    const engine = createEngine(host, {
      renderer,
      services: stubServices(),
      now: scheduler.now,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancelSchedule,
    });

    engine.register(makeManifest("000-r"), () => makeNoopGame().game);
    await engine.start("000-r");
    await engine.stop();

    expect(attachSpy).toHaveBeenCalledOnce();
    expect(capturedHost).toBe(host);
  });
});

// ---------------------------------------------------------------------------
// Tests: unseeded RNG independence
// ---------------------------------------------------------------------------

describe("makeUnseededRng (via Engine.start context)", () => {
  it("fork() returns a distinct object that also conforms to SeededRng", async () => {
    const host = document.createElement("div");
    const scheduler = makeVirtualScheduler();
    let capturedRng: SeededRng | null = null;

    const game: Game = {
      init: (ctx) => {
        capturedRng = ctx.rng;
      },
      update: () => undefined,
      render: () => undefined,
      teardown: () => undefined,
    };

    const engine = createEngine(
      host,
      makeBaseOpts(makeFakeRenderer(), scheduler),
    );
    engine.register(makeManifest("000-rng"), () => game);
    await engine.start("000-rng");
    await engine.stop();

    expect(capturedRng).not.toBeNull();
    const rng = capturedRng!;

    const forked = rng.fork();

    // fork() must return a distinct object
    expect(forked).not.toBe(rng);

    // both must conform to SeededRng: next, int, fork, state
    expect(typeof rng.next).toBe("function");
    expect(typeof rng.int).toBe("function");
    expect(typeof rng.fork).toBe("function");
    expect(rng.state).toBe("unseeded");

    expect(typeof forked.next).toBe("function");
    expect(typeof forked.int).toBe("function");
    expect(typeof forked.fork).toBe("function");
    expect(forked.state).toBe("unseeded");

    // next() must return a number in [0, 1)
    const val = rng.next();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);

    const forkedVal = forked.next();
    expect(forkedVal).toBeGreaterThanOrEqual(0);
    expect(forkedVal).toBeLessThan(1);
  });
});
