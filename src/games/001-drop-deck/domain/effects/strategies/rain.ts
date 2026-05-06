import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";

export const rainStrategy: EffectStrategy = {
  id: "rain",
  resolve(_ctx: PlaceContext): PlaceResult {
    throw new Error("rain strategy: not implemented (issue #21)");
  },
};
