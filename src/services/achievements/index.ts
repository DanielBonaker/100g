export type { Achievements, AchievementEvent, Disposer } from "./types.ts";
export { createAchievements } from "./achievements.ts";

import type { Persistence } from "../../engine/services.ts";

export interface AchievementsOptions {
  readonly persistence: Persistence;
  readonly storageKey?: string; // default: 'achievements'
  readonly now?: () => number; // default: Date.now — for deterministic tests
}
