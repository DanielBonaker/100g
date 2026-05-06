import type { EffectPreview } from "./types.ts";

// All five effect previews are scaffolded as no-ops in this slice. Real rendering ships per-effect in #18-#21 alongside their strategy implementations.

export const standardPreview: EffectPreview = {
  id: "standard",
  render(_ctx) {
    return undefined;
  },
};
