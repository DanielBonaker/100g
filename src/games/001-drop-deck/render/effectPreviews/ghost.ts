import type { EffectPreview, PreviewContext } from "./types.ts";

export const ghostPreview: EffectPreview = {
  id: "ghost",
  render(_ctx: PreviewContext): void {
    return undefined;
  },
};
