/**
 * Shared test helpers for Engine unit and integration tests.
 * NOT a test file itself — vitest will not pick this up as a suite.
 */
import type { Game, GameManifest, ServiceRegistry } from "./Game.ts";
import type { EngineOptions, RendererAdapter } from "./Engine.ts";

export const stubServices = (): ServiceRegistry => ({
  persistence: {
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

export const makeManifest = (id: string): GameManifest => ({
  id,
  title: id,
  achievements: [
    { id: "a1", title: "A1", criterion: "c1" },
    { id: "a2", title: "A2", criterion: "c2" },
    { id: "a3", title: "A3", criterion: "c3" },
  ],
  currencyYield: () => 0,
});

export const makeNoopGame = (): {
  game: Game;
  initCalls: number;
  updateTicks: number[];
  renderCalls: number;
  teardownCalls: number;
} => {
  let initCalls = 0;
  let renderCalls = 0;
  let teardownCalls = 0;
  const updateTicks: number[] = [];

  const game: Game = {
    init: () => {
      initCalls++;
    },
    update: (dtMs) => {
      updateTicks.push(dtMs);
    },
    render: () => {
      renderCalls++;
    },
    teardown: () => {
      teardownCalls++;
    },
  };
  return {
    game,
    get initCalls() {
      return initCalls;
    },
    get updateTicks() {
      return updateTicks;
    },
    get renderCalls() {
      return renderCalls;
    },
    get teardownCalls() {
      return teardownCalls;
    },
  };
};

/** A fake renderer adapter that records attach/detach calls. */
export const makeFakeRenderer = (): RendererAdapter & {
  attachCalls: number;
  detachCalls: number;
  lastHost: HTMLElement | null;
} => {
  let attachCalls = 0;
  let detachCalls = 0;
  let lastHost: HTMLElement | null = null;

  return {
    attach: (host) => {
      attachCalls++;
      lastHost = host;
      return Promise.resolve();
    },
    detach: () => {
      detachCalls++;
      return Promise.resolve();
    },
    get attachCalls() {
      return attachCalls;
    },
    get detachCalls() {
      return detachCalls;
    },
    get lastHost() {
      return lastHost;
    },
  };
};

/**
 * Build a controllable time source + scheduler for deterministic tick tests.
 * Calling `tick(ms)` advances virtual time and fires the scheduled callback once.
 */
export const makeVirtualScheduler = (): {
  now: () => number;
  schedule: (cb: FrameRequestCallback) => number;
  cancelSchedule: (id: number) => void;
  tick: (ms: number) => void;
} => {
  let virtualNow = 0;
  let pending: ((ts: number) => void) | null = null;
  let nextId = 1;

  return {
    now: () => virtualNow,
    schedule: (cb) => {
      pending = cb;
      return nextId++;
    },
    cancelSchedule: () => {
      pending = null;
    },
    tick: (ms) => {
      virtualNow += ms;
      const cb = pending;
      pending = null;
      cb?.(virtualNow);
    },
  };
};

/** Shared base options for unit tests — no real PixiJS, deterministic time. */
export const makeBaseOpts = (
  renderer = makeFakeRenderer(),
  scheduler = makeVirtualScheduler(),
): EngineOptions => ({
  renderer,
  services: stubServices(),
  now: scheduler.now,
  schedule: scheduler.schedule,
  cancelSchedule: scheduler.cancelSchedule,
});
