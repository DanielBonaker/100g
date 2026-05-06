import type { EffectStrategy, PlaceContext, PlaceResult } from "../types.ts";

export const ghostStrategy: EffectStrategy = {
  id: "ghost",
  resolve(_ctx: PlaceContext): PlaceResult {
    throw new Error("ghost strategy: not implemented (issue #18)");
  },
};
