import type { Persistence } from "../../engine/services.ts";
import type { Achievements, AchievementsOptions } from "./index.ts";

export const createAchievements = async (
  _opts: AchievementsOptions,
): Promise<Achievements> => {
  await Promise.resolve();
  throw new Error("not implemented");
};

// Satisfy unused import
type _P = Persistence;
