import type { RunState, OwnedCreature } from "./runState.ts";
import { computeUnlockedTiers } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import { evaluate } from "./achievements.ts";

export type Size = 1 | 2 | 3 | 4 | 5;

const SHOP_PRICE: Record<Size, number> = {
  1: 3,
  2: 8,
  3: 20,
  4: 50,
  5: 120,
};

export const priceFor = (size: Size): number => SHOP_PRICE[size];

export interface RollResult {
  readonly state: RunState;
  readonly drawn: OwnedCreature;
}

/**
 * Pure: draw a random creature of the given size from the bestiary and add it
 * to RunState.owned. Does NOT touch currency — the caller deducts via the
 * economy service after a successful spend.
 */
export const roll = (
  state: RunState,
  size: Size,
  rng: SeededRng,
): RollResult => {
  const candidates = BESTIARY.filter((c) => c.tier === size);
  if (candidates.length === 0) {
    throw new Error(`No creatures of size ${size.toString()} in bestiary`);
  }

  const idx = Math.floor(rng.next() * candidates.length);
  const picked = candidates[idx];
  if (picked === undefined) {
    throw new Error(
      `roll: index ${idx.toString()} out of range for size ${size.toString()}`,
    );
  }

  const newCreature: OwnedCreature = {
    instanceId: state.nextInstanceId,
    creatureId: picked.id,
    position: { x: 24, y: 28 },
    state: "idle",
    stateUntil: state.tick + 30,
    facing: 1,
    seed: state.nextInstanceId * 7919,
    walkTargetX: 24,
    walkTargetY: 28,
  };

  const alreadyOwned = state.uniqueOwnedIds.includes(picked.id);
  const uniqueOwnedIds: readonly number[] = alreadyOwned
    ? state.uniqueOwnedIds
    : [...state.uniqueOwnedIds, picked.id].sort((a, b) => a - b);

  // Maintain unlockedFusionTiers: owning a tier-N creature unlocks tier N+1
  const unlockedFusionTiers = computeUnlockedTiers(
    state.unlockedFusionTiers,
    picked.tier,
  );

  const stateAfterRoll: RunState = {
    ...state,
    owned: [...state.owned, newCreature],
    nextInstanceId: state.nextInstanceId + 1,
    uniqueOwnedIds,
    unlockedFusionTiers,
  };

  return {
    state: {
      ...stateAfterRoll,
      achievementsUnlocked: evaluate(stateAfterRoll, {
        type: "creature-added",
        creatureId: picked.id,
      }),
    },
    drawn: newCreature,
  };
};

/** Returns the count of creatures of the given size in the bestiary. */
export const sizeCount = (size: Size): number =>
  BESTIARY.filter((c) => c.tier === size).length;
