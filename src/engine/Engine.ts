import type { Game, GameManifest, SeededRng, ServiceRegistry } from "./Game.ts";

// ---------------------------------------------------------------------------
// Public surface — ≤ 5 methods (register, start, stop = 3)
// ---------------------------------------------------------------------------

export interface Engine {
  register<T>(manifest: GameManifest<T>, factory: () => Game): void;
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
// Unseeded RNG — conformant stub used until the seeded service ships
// ---------------------------------------------------------------------------

function makeUnseededRng(): SeededRng {
  return {
    next: () => Math.random(),
    int: (min, max) => {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return Math.floor(lo + Math.random() * (hi - lo + 1));
    },
    fork: () => makeUnseededRng(),
    state: "unseeded",
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

  // GameManifest<never> is the widest receiver: any GameManifest<T> is assignable
  // because currencyYield's parameter position is contravariant.
  const registry = new Map<
    string,
    { manifest: GameManifest<never>; factory: () => Game }
  >();

  // Runtime state
  let activeGame: Game | null = null;
  let activeGameId: string | null = null;
  let frameId: number | null = null;
  let accumulator = 0;
  let lastTime = 0;
  let running = false;
  let rendererAttached = false;

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

    frameId = schedule(tick);
  }

  // -- Engine interface implementation --

  function register<T>(manifest: GameManifest<T>, factory: () => Game): void {
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

    const width = rootEl.clientWidth || 375;
    const height = rootEl.clientHeight || 667;

    const renderer = await getRenderer();
    await renderer.attach(rootEl, { width, height });
    rendererAttached = true;

    const game = entry.factory();

    const dimensions = {
      width,
      height,
      devicePixelRatio: window.devicePixelRatio,
    };

    await game.init({
      container: rootEl,
      services,
      rng: makeUnseededRng(),
      dimensions,
    });

    activeGame = game;
    activeGameId = gameId;
    running = true;
    lastTime = now();
    accumulator = 0;
    frameId = schedule(tick);
  }

  async function stop(): Promise<void> {
    if (!running) {
      return;
    }

    running = false;

    if (frameId !== null) {
      cancelSchedule(frameId);
      frameId = null;
    }

    if (activeGame !== null) {
      await activeGame.teardown();
      activeGame = null;
      activeGameId = null;
    }

    if (rendererAttached) {
      const renderer = await getRenderer();
      await renderer.detach();
      rendererAttached = false;
    }
  }

  return { register, start, stop };
}
