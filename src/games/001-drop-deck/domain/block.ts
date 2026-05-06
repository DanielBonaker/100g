export type EffectId = "standard" | "ghost" | "melt" | "impact" | "rain";

export interface BlockCellOffset {
  readonly dx: number;
  readonly dy: number;
}

export interface Block {
  readonly id: string;
  readonly bestiaryId?: number;
  readonly cellCount: number;
  readonly cells: readonly BlockCellOffset[];
  readonly effectId: EffectId;
  readonly displayName?: string;
}
