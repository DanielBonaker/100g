import type { RunState, OwnedCreature } from "./runState.ts";

// 0.4 s × 60 ticks/s = 24 ticks for hop duration
const HOP_TICKS = 24;

export type GardenAction =
  | {
      type: "own";
      creatureId: number;
      position: { x: number; y: number };
    }
  | {
      type: "tap-creature";
      instanceId: number;
      creatureId: number;
      tick: number;
    };

export const applyAction = (
  state: RunState,
  action: GardenAction,
): RunState => {
  if (action.type === "own") {
    const newCreature: OwnedCreature = {
      instanceId: state.nextInstanceId,
      creatureId: action.creatureId,
      position: {
        x: Math.round(action.position.x),
        y: Math.round(action.position.y),
      },
      state: "idle",
      stateUntil: state.tick + 30,
      facing: 1,
      // Deterministic seed derived from instanceId and creatureId
      seed:
        (state.nextInstanceId * 6971 + action.creatureId * 1009) & 0xffffffff,
      walkTargetX: Math.round(action.position.x),
      walkTargetY: Math.round(action.position.y),
    };

    // Maintain uniqueOwnedIds: add creatureId if not already present (sorted)
    const alreadyOwned = state.uniqueOwnedIds.includes(action.creatureId);
    const uniqueOwnedIds: readonly number[] = alreadyOwned
      ? state.uniqueOwnedIds
      : [...state.uniqueOwnedIds, action.creatureId].sort((a, b) => a - b);

    return {
      ...state,
      owned: [...state.owned, newCreature],
      nextInstanceId: state.nextInstanceId + 1,
      uniqueOwnedIds,
    };
  }

  // tap-creature: increment affection counter (by creatureId) and force hop on targeted instance
  const prevCount = state.totalTapsByCreatureId[action.creatureId] ?? 0;
  const newOwned = state.owned.map((c) => {
    if (c.instanceId !== action.instanceId) return c;
    return {
      ...c,
      state: "hop" as const,
      stateUntil: action.tick + HOP_TICKS,
    };
  });

  return {
    ...state,
    owned: newOwned,
    totalTapsByCreatureId: {
      ...state.totalTapsByCreatureId,
      [action.creatureId]: prevCount + 1,
    },
  };
};
