import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";

export const impactStrategy: EffectStrategy = {
  id: "impact",
  resolve(_ctx: PlaceContext): PlaceResult {
    throw new Error("impact strategy: not implemented (issue #20)");
  },
};
