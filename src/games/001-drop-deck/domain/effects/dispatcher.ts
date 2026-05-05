import type {
  PlaceContext,
  PlaceResult,
  EffectId,
  EffectStrategy,
} from "./types.ts";
import { standardStrategy } from "./strategies/standard.ts";
import { ghostStrategy } from "./strategies/ghost.ts";
import { meltStrategy } from "./strategies/melt.ts";
import { impactStrategy } from "./strategies/impact.ts";
import { rainStrategy } from "./strategies/rain.ts";

const REGISTRY: Record<EffectId, EffectStrategy> = {
  standard: standardStrategy,
  ghost: ghostStrategy,
  melt: meltStrategy,
  impact: impactStrategy,
  rain: rainStrategy,
};

export const resolveEffect = (_ctx: PlaceContext): PlaceResult => {
  throw new Error("not implemented");
};

export { REGISTRY };
