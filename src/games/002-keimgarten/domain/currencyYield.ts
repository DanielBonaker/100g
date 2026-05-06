import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import type { RunState } from "./runState.ts";

const MAX_YIELD = 50;

export const compute = (state: RunState): number => {
  const uniqueCount = state.uniqueOwnedIds.length;
  let highestTier = 0;
  for (const id of state.uniqueOwnedIds) {
    const creature = BESTIARY[id];
    if (creature !== undefined && creature.tier > highestTier) {
      highestTier = creature.tier;
    }
  }
  const raw = Math.floor(uniqueCount / 10) + highestTier * 2;
  return Math.min(MAX_YIELD, Math.max(0, raw));
};
