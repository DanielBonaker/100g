import type { Input } from "../services/input/index.ts";
import type { SaveOptions } from "../services/persistence/types.ts";
import type {
  AchievementEvent,
  Disposer as AchievementsDisposer,
} from "../services/achievements/types.ts";
import type {
  EconomyEvent,
  Disposer as EconomyDisposer,
} from "../services/economy/types.ts";

export type { SaveOptions };
export type {
  AchievementEvent,
  AchievementsDisposer,
  EconomyEvent,
  EconomyDisposer,
};

export interface Persistence {
  save(key: string, value: unknown, opts?: SaveOptions): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}

export interface Economy {
  getBalance(): number;
  addYield(gameId: string, amount: number): void;
  /** Deducts `amount` from the balance. Returns true if spent, false if insufficient funds. */
  spend(gameId: string, amount: number): boolean;
  subscribe(handler: (event: EconomyEvent) => void): EconomyDisposer;
}

export interface Achievements {
  unlock(gameId: string, achievementId: string): void;
  getUnlocked(gameId: string): readonly string[];
  isUnlocked(gameId: string, achievementId: string): boolean;
  subscribe(handler: (event: AchievementEvent) => void): AchievementsDisposer;
}

export interface Audio {
  enable(): void | Promise<void>;
  setMuted(muted: boolean): void;
  play(soundId: string): void;
  isMuted(): boolean;
}

export interface ServiceRegistry {
  readonly persistence: Persistence;
  readonly economy: Economy;
  readonly achievements: Achievements;
  readonly input: Input;
  readonly audio: Audio;
}
