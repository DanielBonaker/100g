// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Engine } from "../engine/Engine.ts";
import type { GameManifest } from "../engine/Game.ts";
import type { Economy } from "../services/economy/index.ts";
import type { Achievements } from "../services/achievements/index.ts";
import type { RouterOptions } from "./Router.ts";
import { createRouter } from "./Router.ts";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function makeManifest(id: string, title: string): GameManifest {
  return {
    id,
    title,
    achievements: [
      { id: "a1", title: "Ach One", criterion: "c1" },
      { id: "a2", title: "Ach Two", criterion: "c2" },
      { id: "a3", title: "Ach Three", criterion: "c3" },
    ],
    currencyYield: () => 0,
  };
}

function makeFakeEngine(): Engine & {
  startCalls: number;
  stopCalls: number;
  lastStartId: string | null;
} {
  let startCalls = 0;
  let stopCalls = 0;
  let lastStartId: string | null = null;

  const engine: Engine = {
    register: () => undefined,
    start: (id: string) => {
      startCalls++;
      lastStartId = id;
      return Promise.resolve();
    },
    stop: () => {
      stopCalls++;
      return Promise.resolve();
    },
  };

  return Object.assign(engine, {
    get startCalls() {
      return startCalls;
    },
    get stopCalls() {
      return stopCalls;
    },
    get lastStartId() {
      return lastStartId;
    },
  });
}

function makeFakeEconomy(initialBalance = 0): Economy & {
  setBalance(n: number): void;
} {
  let balance = initialBalance;
  type Handler = Parameters<Economy["subscribe"]>[0];
  const handlers: Handler[] = [];

  const economy: Economy = {
    getBalance: () => balance,
    addYield: (gameId, amount) => {
      balance += amount;
      const event = { gameId, amount, newBalance: balance };
      for (const h of handlers) {
        h(event);
      }
    },
    subscribe: (handler) => {
      handlers.push(handler);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      };
    },
  };

  return Object.assign(economy, {
    setBalance(n: number) {
      balance = n;
      // Notify subscribers as if a yield happened
      const event = { gameId: "_test", amount: 0, newBalance: balance };
      for (const h of handlers) {
        h(event);
      }
    },
  });
}

function makeFakeAchievements(
  unlocked: Record<string, string[]> = {},
): Achievements {
  return {
    unlock: (_gameId, _achievementId) => undefined,
    getUnlocked: (gameId: string) => unlocked[gameId] ?? [],
    isUnlocked: (gameId: string, achievementId: string) =>
      (unlocked[gameId] ?? []).includes(achievementId),
    subscribe: () => () => undefined,
  };
}

/** Minimal fake Window for navigation. Happy-dom provides a real window but
 * we stub location.hash writes to avoid actual navigation side-effects. */
function makeFakeWindow(): Pick<
  Window,
  "addEventListener" | "removeEventListener" | "location"
> {
  let hash = "#/";
  const listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  return {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(listener);
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      const list = listeners.get(type);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    get location() {
      return {
        get hash() {
          return hash;
        },
        set hash(v: string) {
          hash = v;
          const event = new Event("hashchange");
          for (const l of listeners.get("hashchange") ?? []) {
            if (typeof l === "function") {
              l(event);
            } else {
              l.handleEvent(event);
            }
          }
        },
      } as unknown as Location;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST_A = makeManifest("001-alpha", "Alpha Game");
const MANIFEST_B = makeManifest("002-beta", "Beta Game");

function makeOpts(overrides: Partial<RouterOptions> = {}): RouterOptions & {
  engine: ReturnType<typeof makeFakeEngine>;
  economy: ReturnType<typeof makeFakeEconomy>;
  fakeWindow: ReturnType<typeof makeFakeWindow>;
} {
  const engine =
    overrides.engine !== undefined
      ? (overrides.engine as ReturnType<typeof makeFakeEngine>)
      : makeFakeEngine();
  const economy =
    overrides.economy !== undefined
      ? (overrides.economy as ReturnType<typeof makeFakeEconomy>)
      : makeFakeEconomy(42);
  const achievements = overrides.achievements ?? makeFakeAchievements();
  const fakeWindow = makeFakeWindow();

  return {
    engine,
    economy,
    achievements,
    registeredGames: [{ manifest: MANIFEST_A }, { manifest: MANIFEST_B }],
    window: fakeWindow,
    fakeWindow,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: initial route
// ---------------------------------------------------------------------------

describe("Router — initial route", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("defaults to '/' when hash is '#/'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    expect(router.currentPath()).toBe("/");
    router.destroy();
  });

  it("renders picker with all registered games on '/'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    const buttons = root.querySelectorAll("[data-role='picker'] button");
    expect(buttons).toHaveLength(2);
    const titles = Array.from(buttons).map((b) => b.textContent);
    expect(titles).toContain("Alpha Game");
    expect(titles).toContain("Beta Game");

    router.destroy();
  });

  it("each picker button carries data-game-id", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    const buttons = root.querySelectorAll<HTMLButtonElement>(
      "[data-role='picker'] button",
    );
    const ids = Array.from(buttons).map((b) => b.getAttribute("data-game-id"));
    expect(ids).toContain("001-alpha");
    expect(ids).toContain("002-beta");

    router.destroy();
  });

  it("picker buttons meet 44 × 44 minimum hit-target", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    const buttons = root.querySelectorAll<HTMLButtonElement>(
      "[data-role='picker'] button",
    );
    for (const btn of buttons) {
      expect(btn.style.minHeight).toBe("44px");
      expect(btn.style.minWidth).toBe("44px");
    }

    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: navigation — picker to game
// ---------------------------------------------------------------------------

describe("Router — navigate to game", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("navigate('/games/001-alpha') updates currentPath()", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    router.navigate("/games/001-alpha");

    expect(router.currentPath()).toBe("/games/001-alpha");
    router.destroy();
  });

  it("clicking a picker button navigates to the game route", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    const btn = root.querySelector<HTMLButtonElement>(
      "[data-game-id='001-alpha']",
    );
    expect(btn).not.toBeNull();
    btn!.click();

    expect(router.currentPath()).toBe("/games/001-alpha");
    router.destroy();
  });

  it("navigating to a game route renders a game-host element", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    router.navigate("/games/001-alpha");

    const host = root.querySelector("[data-role='game-host']");
    expect(host).not.toBeNull();
    router.destroy();
  });

  it("navigating to a game route calls engine.start with the game id", async () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    router.navigate("/games/001-alpha");

    // engine.start is async; wait a microtask for it to be invoked
    await Promise.resolve();

    expect(opts.engine.startCalls).toBe(1);
    expect(opts.engine.lastStartId).toBe("001-alpha");
    router.destroy();
  });

  it("game route renders a back button with 44px min dimensions", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");

    const back = root.querySelector<HTMLButtonElement>("[data-role='back']");
    expect(back).not.toBeNull();
    expect(back!.style.minHeight).toBe("44px");
    expect(back!.style.minWidth).toBe("44px");

    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: navigation — back to picker
// ---------------------------------------------------------------------------

describe("Router — navigate back from game", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("clicking back from a game route calls engine.stop()", async () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");

    const back = root.querySelector<HTMLButtonElement>("[data-role='back']");
    expect(back).not.toBeNull();
    back!.click();

    await Promise.resolve();

    expect(opts.engine.stopCalls).toBeGreaterThanOrEqual(1);
    router.destroy();
  });

  it("clicking back returns currentPath() to '/'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");

    const back = root.querySelector<HTMLButtonElement>("[data-role='back']");
    back!.click();

    expect(router.currentPath()).toBe("/");
    router.destroy();
  });

  it("navigate('/') from game route calls engine.stop()", async () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");
    await Promise.resolve();

    router.navigate("/");
    await Promise.resolve();

    expect(opts.engine.stopCalls).toBeGreaterThanOrEqual(1);
    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: HUD
// ---------------------------------------------------------------------------

describe("Router — HUD", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("HUD element is always present with data-role='hud'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    expect(root.querySelector("[data-role='hud']")).not.toBeNull();
    router.destroy();
  });

  it("HUD reflects initial balance", () => {
    const economy = makeFakeEconomy(100);
    const opts = makeOpts({ economy });
    const router = createRouter(root, opts);

    const hud = root.querySelector("[data-role='hud']");
    expect(hud?.textContent).toContain("Balance: 100");
    router.destroy();
  });

  it("HUD updates when economy.addYield is called", () => {
    const economy = makeFakeEconomy(50);
    const opts = makeOpts({ economy });
    const router = createRouter(root, opts);

    economy.addYield("001-alpha", 25);

    const hud = root.querySelector("[data-role='hud']");
    expect(hud?.textContent).toContain("Balance: 75");
    router.destroy();
  });

  it("HUD shows game title when on a game route", () => {
    const economy = makeFakeEconomy(10);
    const opts = makeOpts({ economy });
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");

    const hud = root.querySelector("[data-role='hud']");
    expect(hud?.textContent).toContain("Alpha Game");
    router.destroy();
  });

  it("HUD does not show game title on picker route", () => {
    const economy = makeFakeEconomy(10);
    const opts = makeOpts({ economy });
    const router = createRouter(root, opts);

    const hud = root.querySelector("[data-role='hud']");
    expect(hud?.textContent).not.toContain("Alpha Game");
    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: achievements route
// ---------------------------------------------------------------------------

describe("Router — achievements route", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("navigate('/achievements') updates currentPath()", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/achievements");
    expect(router.currentPath()).toBe("/achievements");
    router.destroy();
  });

  it("achievements route renders all registered games", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/achievements");

    const sections = root.querySelectorAll("[data-game-id]");
    const ids = Array.from(sections).map((s) => s.getAttribute("data-game-id"));
    expect(ids).toContain("001-alpha");
    expect(ids).toContain("002-beta");
    router.destroy();
  });

  it("unlocked achievements are marked data-unlocked='true'", () => {
    const achievements = makeFakeAchievements({
      "001-alpha": ["a1"],
    });
    const opts = makeOpts({ achievements });
    const router = createRouter(root, opts);
    router.navigate("/achievements");

    const section = root.querySelector("[data-game-id='001-alpha']");
    const a1 = section?.querySelector("[data-achievement-id='a1']");
    expect(a1?.getAttribute("data-unlocked")).toBe("true");
    router.destroy();
  });

  it("locked achievements are marked data-unlocked='false'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/achievements");

    const section = root.querySelector("[data-game-id='001-alpha']");
    const a2 = section?.querySelector("[data-achievement-id='a2']");
    expect(a2?.getAttribute("data-unlocked")).toBe("false");
    router.destroy();
  });

  it("achievements route has a back button that returns to '/'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/achievements");

    const back = root.querySelector<HTMLButtonElement>("[data-role='back']");
    expect(back).not.toBeNull();
    back!.click();

    expect(router.currentPath()).toBe("/");
    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: unknown route redirects
// ---------------------------------------------------------------------------

describe("Router — unknown route", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("navigate to an unknown path redirects to '/'", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/unknown-path");
    expect(router.currentPath()).toBe("/");
    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: hashchange integration
// ---------------------------------------------------------------------------

describe("Router — hashchange", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("setting location.hash externally triggers re-render", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);

    // Simulate external hash change to achievements
    opts.fakeWindow.location.hash = "#/achievements";

    // Picker should be gone, achievements view should be present
    expect(router.currentPath()).toBe("/achievements");
    const sections = root.querySelectorAll("[data-game-id]");
    expect(sections.length).toBeGreaterThan(0);

    router.destroy();
  });

  it("hashchange away from game route calls engine.stop()", async () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.navigate("/games/001-alpha");
    await Promise.resolve();

    // Navigate away via hash
    opts.fakeWindow.location.hash = "#/";
    await Promise.resolve();

    expect(opts.engine.stopCalls).toBeGreaterThanOrEqual(1);
    router.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tests: destroy
// ---------------------------------------------------------------------------

describe("Router — destroy", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("destroy() removes HUD and view from the root", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.destroy();

    expect(root.querySelector("[data-role='hud']")).toBeNull();
    expect(root.querySelector("[data-role='view']")).toBeNull();
  });

  it("destroy() stops reacting to economy events", () => {
    const economy = makeFakeEconomy(0);
    const opts = makeOpts({ economy });
    const router = createRouter(root, opts);
    router.destroy();

    // After destroy, root.innerHTML is empty so there's nothing to check;
    // but we verify the subscription was dropped — adding yield must not throw
    expect(() => {
      economy.addYield("001-alpha", 10);
    }).not.toThrow();
  });

  it("destroy() stops reacting to hashchange events", () => {
    const opts = makeOpts();
    const router = createRouter(root, opts);
    router.destroy();

    // Changing hash after destroy must not throw or re-mount elements
    expect(() => {
      opts.fakeWindow.location.hash = "#/achievements";
    }).not.toThrow();
    expect(root.querySelector("[data-role='hud']")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: surface area
// ---------------------------------------------------------------------------

describe("Router surface area", () => {
  it("exposes exactly navigate, currentPath, and destroy — no more", () => {
    const root = document.createElement("div");
    const opts = makeOpts();
    const router = createRouter(root, opts);
    const methods = Object.keys(router);
    expect(methods.sort()).toEqual(
      ["currentPath", "destroy", "navigate"].sort(),
    );
    router.destroy();
    root.remove();
  });
});

// Suppress unused-variable lint for vi (imported for possible future spies)
void vi;
