// Stub — real implementation omitted. All functions throw (RED).
import type { RunState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";

export const GARBAGE_THRESHOLD_BASE = 8;
export const GARBAGE_THRESHOLD_SLOW = 7;
export const GARBAGE_FILL_COUNT = 6;

export const thresholdFor = (_state: RunState): number => {
  throw new Error("thresholdFor not yet implemented");
};

export const tick = (
  _state: RunState,
  _rng: SeededRng,
): { state: RunState; toppedOut: boolean } => {
  throw new Error("tick not yet implemented");
};

export const inject = (
  _state: RunState,
  _rng: SeededRng,
): { state: RunState; toppedOut: boolean } => {
  throw new Error("inject not yet implemented");
};

export const reset = (_state: RunState): RunState => {
  throw new Error("reset not yet implemented");
};
