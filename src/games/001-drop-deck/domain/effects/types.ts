import type { RunState } from "../runState.ts";
import type { Block, EffectId } from "../block.ts";
import type { SeededRng } from "../../../../engine/Game.ts";

export type { EffectId } from "../block.ts";

export interface PlaceContext {
  readonly state: RunState;
  readonly block: Block;
  readonly column: number;
  readonly rng: SeededRng;
}

export interface PlaceResult {
  readonly state: RunState;
  readonly toppedOut: boolean;
  readonly reason: "spawn-collision" | "garbage-shift" | null;
}

export interface EffectStrategy {
  readonly id: EffectId;
  resolve(ctx: PlaceContext): PlaceResult;
}
