import type { Game, GameManifest, ServiceRegistry } from "./Game.ts";

// ---------------------------------------------------------------------------
// Public surface — ≤ 5 methods (register, start, stop = 3)
// ---------------------------------------------------------------------------

export interface Engine {
  register(manifest: GameManifest, factory: () => Game): void;
  start(gameId: string): Promise<void>;
  stop(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Renderer abstraction — keeps PixiJS out of unit tests
// ---------------------------------------------------------------------------

export interface RendererAdapter {
  attach(
    host: HTMLElement,
    dims: { width: number; height: number },
  ): Promise<void>;
  detach(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Engine options
// ---------------------------------------------------------------------------

export interface EngineOptions {
  readonly renderer?: RendererAdapter;
  readonly services: ServiceRegistry;
  readonly now?: () => number;
  readonly schedule?: (cb: FrameRequestCallback) => number;
  readonly cancelSchedule?: (id: number) => void;
  readonly fixedTickMs?: number;
}

// ---------------------------------------------------------------------------
// Default (PixiJS-backed) renderer — lazy-loaded so unit tests never touch it
// ---------------------------------------------------------------------------

async function createPixiRenderer(): Promise<RendererAdapter> {
  const { Application } = await import("pixi.js");

  let app: InstanceType<typeof Application> | null = null;

  return {
    attach: async (host, dims) => {
      app = new Application();
      await app.init({
        width: dims.width,
        height: dims.height,
        antialias: false,
      });
      host.appendChild(app.canvas);
    },
    detach: () => {
      if (app) {
        app.destroy(true);
        app = null;
      }
      return Promise.resolve();
    },
  };
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const DEFAULT_FIXED_TICK_MS = 1000 / 60;
const MAX_SUBSTEPS = 5;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEngine(rootEl: HTMLElement, opts: EngineOptions): Engine {
  const {
    services,
    now = () => performance.now(),
    schedule = (cb) => requestAnimationFrame(cb),
    cancelSchedule = (id) => {
      cancelAnimationFrame(id);
    },
    fixedTickMs = DEFAULT_FIXED_TICK_MS,
  } = opts;

  // Registry: gameId → { manifest, factory }
  const registry = new Map<
    string,
    { manifest: GameManifest; factory: () => Game }
  >();

  // Runtime state
  let activeGame: Game | null = null;
  let activeGameId: string | null = null;
  let rafId: number | null = null;
  let accumulator = 0;
  let lastTime = 0;
  let running = false;

  // Lazy-resolved renderer
  let resolvedRenderer: RendererAdapter | null = null;

  async function getRenderer(): Promise<RendererAdapter> {
    if (opts.renderer !== undefined) {
      return opts.renderer;
    }
    resolvedRenderer ??= await createPixiRenderer();
    return resolvedRenderer;
  }

  function tick(timestamp: number): void {
    if (!running) return;

    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    accumulator += elapsed;

    // Clamp: drop excess to avoid spiral of death
    const maxAccumulated = fixedTickMs * MAX_SUBSTEPS;
    if (accumulator > maxAccumulated) {
      accumulator = maxAccumulated;
    }

    while (accumulator >= fixedTickMs) {
      activeGame?.update(fixedTickMs);
      accumulator -= fixedTickMs;
    }

    activeGame?.render();

    rafId = schedule(tick);
  }

  // -- Engine interface implementation --

  function register(manifest: GameManifest, factory: () => Game): void {
    if (registry.has(manifest.id)) {
      throw new Error(`Engine: game id "${manifest.id}" is already registered`);
    }
    registry.set(manifest.id, { manifest, factory });
  }

  async function start(gameId: string): Promise<void> {
    if (running) {
      throw new Error(
        `Engine: cannot start "${gameId}" — engine is already running "${activeGameId ?? "unknown"}"`,
      );
    }

    const entry = registry.get(gameId);
    if (entry === undefined) {
      throw new Error(`Engine: no game registered with id "${gameId}"`);
    }

    const renderer = await getRenderer();
    await renderer.attach(rootEl, {
      width: rootEl.clientWidth || 375,
      height: rootEl.clientHeight || 667,
    });

    const game = entry.factory();

    const dimensions = {
      width: rootEl.clientWidth || 375,
      height: rootEl.clientHeight || 667,
      devicePixelRatio: window.devicePixelRatio,
    };

    await game.init({
      container: rootEl,
      services,
      rng: {
        next: () => Math.random(),
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        fork: function () {
          return this;
        },
        state: "unseeded",
      },
      dimensions,
    });

    activeGame = game;
    activeGameId = gameId;
    running = true;
    lastTime = now();
    accumulator = 0;
    rafId = schedule(tick);
  }

  async function stop(): Promise<void> {
    if (!running) {
      return;
    }

    running = false;

    if (rafId !== null) {
      cancelSchedule(rafId);
      rafId = null;
    }

    if (activeGame !== null) {
      await activeGame.teardown();
      activeGame = null;
      activeGameId = null;
    }

    const renderer = await getRenderer();
    await renderer.detach();
  }

  return { register, start, stop };
}
