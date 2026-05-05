import type { ServiceRegistry } from "./services.ts";

export type {
  Achievements,
  Audio,
  Economy,
  Persistence,
  ServiceRegistry,
} from "./services.ts";

export type GameId = string;

export interface AchievementDef {
  readonly id: string;
  readonly title: string;
  readonly criterion: string;
}

export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  fork(): SeededRng;
  readonly state: string;
}

export interface GameDimensions {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

export interface GameContext {
  readonly container: HTMLElement;
  readonly services: ServiceRegistry;
  readonly rng: SeededRng;
  readonly dimensions: GameDimensions;
}

export interface GameManifest<TRunState = unknown> {
  readonly id: GameId;
  readonly title: string;
  readonly achievements: readonly [
    AchievementDef,
    AchievementDef,
    AchievementDef,
  ];
  readonly currencyYield: (runState: TRunState) => number;
}

export interface Game {
  init(ctx: GameContext): void | Promise<void>;
  update(dtMs: number): void;
  render(): void;
  teardown(): void | Promise<void>;
}
