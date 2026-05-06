// Router — hash-based navigation shell for 100g.
// NOT YET IMPLEMENTED — stub so tests can be written first (TDD RED phase).

import type { Engine } from "../engine/Engine.ts";
import type { GameManifest } from "../engine/Game.ts";
import type { Economy } from "../services/economy/index.ts";
import type { Achievements } from "../services/achievements/index.ts";

// ---------------------------------------------------------------------------
// Public surface — ≤ 5 methods
// ---------------------------------------------------------------------------

export interface Route {
  readonly path: string;
}

export interface RouterOptions {
  readonly engine: Engine;
  readonly economy: Economy;
  readonly achievements: Achievements;
  readonly registeredGames: readonly { manifest: GameManifest }[];
  readonly window?: Pick<
    Window,
    "addEventListener" | "removeEventListener" | "location"
  >;
}

export interface Router {
  navigate(path: string): void;
  currentPath(): string;
  destroy(): void;
}

export function createRouter(
  _rootEl: HTMLElement,
  _opts: RouterOptions,
): Router {
  throw new Error("Router: not implemented");
}
