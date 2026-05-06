import type { RunState, OwnedCreature } from "./runState.ts";
import { computeUnlockedTiers } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { BESTIARY } from "../../../shared/franchise/bestiary.ts";

export type FusionTarget = 6 | 7 | 8 | 9;

export interface FuseResult {
  readonly success: boolean;
  readonly state: RunState;
  readonly output: OwnedCreature | null;
  /** Human-readable refusal reason for testing; null on success. */
  readonly reason: string | null;
}

const REFUSAL = (reason: string, state: RunState): FuseResult => ({
  success: false,
  state,
  output: null,
  reason,
});

/**
 * Pure fusion function. Validates all invariants, then consumes both input
 * instances and produces a random creature of targetSize.
 *
 * No Pixi or DOM imports. No side-effects.
 */
export const fuse = (
  state: RunState,
  instanceA: number,
  instanceB: number,
  targetSize: FusionTarget,
  rng: SeededRng,
): FuseResult => {
  // 1. Validate distinct instances.
  if (instanceA === instanceB) return REFUSAL("same-instance", state);

  // 2. Validate target tier is unlocked.
  if (!state.unlockedFusionTiers.includes(targetSize))
    return REFUSAL("target-locked", state);

  // 3. Validate inputs are owned.
  const a = state.owned.find((c) => c.instanceId === instanceA);
  const b = state.owned.find((c) => c.instanceId === instanceB);
  if (a === undefined) return REFUSAL("input-a-not-owned", state);
  if (b === undefined) return REFUSAL("input-b-not-owned", state);

  // 4. Get tiers via BESTIARY.
  const tierA = BESTIARY[a.creatureId]?.tier;
  const tierB = BESTIARY[b.creatureId]?.tier;
  if (tierA === undefined || tierB === undefined)
    return REFUSAL("invalid-creature", state);

  // 5. Sum validation.
  if (tierA + tierB !== targetSize) return REFUSAL("sum-mismatch", state);

  // 6. Roll a random creature of targetSize.
  const candidates = BESTIARY.filter((c) => c.tier === targetSize);
  if (candidates.length === 0) return REFUSAL("no-candidates", state);
  const idx = Math.floor(rng.next() * candidates.length);
  const picked = candidates[idx];
  if (picked === undefined) return REFUSAL("no-candidates", state);

  // 7. Build new owned creature.
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

  // 8. Remove input creatures, add output.
  const newOwned = [
    ...state.owned.filter(
      (c) => c.instanceId !== instanceA && c.instanceId !== instanceB,
    ),
    newCreature,
  ];

  // 9. Update uniqueOwnedIds and unlockedFusionTiers.
  const ownedIds = state.uniqueOwnedIds.includes(picked.id)
    ? state.uniqueOwnedIds
    : [...state.uniqueOwnedIds, picked.id].sort((a, b) => a - b);
  const newUnlockedTiers = computeUnlockedTiers(
    state.unlockedFusionTiers,
    targetSize,
  );

  return {
    success: true,
    state: {
      ...state,
      owned: newOwned,
      nextInstanceId: state.nextInstanceId + 1,
      uniqueOwnedIds: ownedIds,
      unlockedFusionTiers: newUnlockedTiers,
    },
    output: newCreature,
    reason: null,
  };
};
