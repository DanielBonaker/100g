import type { EffectPreview, PreviewContext } from "./types.ts";

export const standardPreview: EffectPreview = {
  id: "standard",
  render(_ctx: PreviewContext): void {
    throw new Error("not implemented");
  },
};
