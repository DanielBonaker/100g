import type { Input } from "../services/input/index.ts";
import type { SaveOptions } from "../services/persistence/types.ts";

export type { SaveOptions };

export interface Persistence {
  save(key: string, value: unknown, opts?: SaveOptions): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
}

export interface Economy {
  getBalance(): number;
  addYield(gameId: string, amount: number): void;
}

export interface Achievements {
  unlock(gameId: string, achievementId: string): void;
  isUnlocked(gameId: string, achievementId: string): boolean;
}

export interface Audio {
  enable(): void;
  setMuted(muted: boolean): void;
  play(soundId: string): void;
}

export interface ServiceRegistry {
  readonly persistence: Persistence;
  readonly economy: Economy;
  readonly achievements: Achievements;
  readonly input: Input;
  readonly audio: Audio;
}
