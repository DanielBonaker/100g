import type { RunState, OwnedCreature } from "./runState.ts";

export interface GardenAction {
  type: "own";
  creatureId: number;
  position: { x: number; y: number };
}

export const applyAction = (
  state: RunState,
  action: GardenAction,
): RunState => {
  const newCreature: OwnedCreature = {
    instanceId: state.nextInstanceId,
    creatureId: action.creatureId,
    position: {
      x: Math.round(action.position.x),
      y: Math.round(action.position.y),
    },
    state: "idle",
    stateUntil: state.tick + 30,
    totalTaps: 0,
    facing: 1,
    // Deterministic seed derived from instanceId and creatureId
    seed: (state.nextInstanceId * 6971 + action.creatureId * 1009) & 0xffffffff,
    walkTargetX: Math.round(action.position.x),
    walkTargetY: Math.round(action.position.y),
  };
  return {
    ...state,
    owned: [...state.owned, newCreature],
    nextInstanceId: state.nextInstanceId + 1,
  };
};
