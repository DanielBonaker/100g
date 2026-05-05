import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";

export const standardStrategy: EffectStrategy = {
  id: "standard",
  resolve(_ctx: PlaceContext): PlaceResult {
    throw new Error("not implemented");
  },
};
