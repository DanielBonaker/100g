import type { SeededRng } from "../../../engine/Game.ts";
import type { Block } from "./block.ts";
import type { RunState } from "./runState.ts";

export interface DeckOptions {
  readonly minSize?: number;
  readonly maxSize?: number;
}

export const buildStarterDeck = (_rng: SeededRng): readonly Block[] => {
  throw new Error("not implemented");
};

export const shuffle = <T>(
  _items: readonly T[],
  _rng: SeededRng,
): readonly T[] => {
  throw new Error("not implemented");
};

export const draw = (
  _state: RunState,
  _rng: SeededRng,
): { state: RunState; drew: Block | null } => {
  throw new Error("not implemented");
};

export const enforceMinMax = (
  _deck: readonly Block[],
  _min: number,
  _max: number,
): readonly Block[] => {
  throw new Error("not implemented");
};
