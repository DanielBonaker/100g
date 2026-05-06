import type { Block } from "./block.ts";
import type { RunState } from "./runState.ts";
import type { BoosterTier } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

export type { BoosterTier };

export const MAX_DECK_SIZE = 20;
export const PICKS_PER_BOOSTER = 3;

// ---------------------------------------------------------------------------
// STUB — RED phase. All functions throw so tests fail as expected.
// Replace with real implementation in GREEN commit.
// ---------------------------------------------------------------------------

export const generateBoosterOffer = (
  _tier: BoosterTier,
  _rng: SeededRng,
): readonly Block[] => {
  throw new Error("NOT IMPLEMENTED");
};

export const purchaseBooster = (
  state: RunState,
  _tier: BoosterTier,
  _rng: SeededRng,
): RunState => {
  void state;
  throw new Error("NOT IMPLEMENTED");
};

export const pickFromBooster = (state: RunState, _block: Block): RunState => {
  void state;
  throw new Error("NOT IMPLEMENTED");
};
