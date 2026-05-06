import type { RunState } from "./runState.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";

export const ACHIEVEMENT_IDS = [
  "first-fusion",
  "first-archon",
  "vollkommen",
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export type AchievementTrigger =
  | { readonly type: "fusion-completed" }
  | { readonly type: "creature-added"; readonly creatureId: number };

/**
 * Pure: given the current RunState and a trigger event, compute the updated
 * achievementsUnlocked array. Result is deduped and sorted in ACHIEVEMENT_IDS
 * order. Idempotent — re-triggering an already-unlocked achievement is a no-op.
 */
export const evaluate = (
  prev: RunState,
  trigger: AchievementTrigger,
): readonly string[] => {
  const set = new Set<string>(prev.achievementsUnlocked);

  if (trigger.type === "fusion-completed") {
    if (!set.has("first-fusion")) {
      set.add("first-fusion");
    }
  }

  if (trigger.type === "creature-added") {
    const creature = BESTIARY[trigger.creatureId];
    if (creature !== undefined) {
      if (creature.tier === 8 && !set.has("first-archon")) {
        set.add("first-archon");
      }
      if (creature.tier === 9 && !set.has("vollkommen")) {
        set.add("vollkommen");
      }
    }
  }

  return ACHIEVEMENT_IDS.filter((id) => set.has(id));
};
