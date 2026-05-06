import type { EffectId } from "../../domain/effects/types.ts";
import type { Board } from "../../domain/board.ts";
import type { Block } from "../../domain/block.ts";

export interface PreviewContext {
  readonly board: Board;
  readonly block: Block;
  readonly column: number;
  readonly container: unknown; // Pixi Container — typed as unknown so tests run without Pixi
}

export interface EffectPreview {
  readonly id: EffectId;
  render(ctx: PreviewContext): void;
}
