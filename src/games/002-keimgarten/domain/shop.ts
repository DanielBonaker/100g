// STUB — implementation pending (tests first)
import type { RunState, OwnedCreature } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

export type Size = 1 | 2 | 3 | 4 | 5;

export interface RollResult {
  readonly state: RunState;
  readonly drawn: OwnedCreature;
}

export const priceFor = (_size: Size): number => {
  throw new Error("not implemented");
};

export const sizeCount = (_size: Size): number => {
  throw new Error("not implemented");
};

export const roll = (
  _state: RunState,
  _size: Size,
  _rng: SeededRng,
): RollResult => {
  throw new Error("not implemented");
};
