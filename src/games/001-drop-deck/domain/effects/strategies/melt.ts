import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";

export const meltStrategy: EffectStrategy = {
  id: "melt",
  resolve(_ctx: PlaceContext): PlaceResult {
    throw new Error("melt strategy: not implemented (issue #19)");
  },
};
