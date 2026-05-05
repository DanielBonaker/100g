import type { Board } from "./boardTypes.ts";
import type { Block } from "./block.ts";

export type RunStatus = "running" | "ended";

export interface RunState {
  // Board geometry
  readonly board: Board;
  readonly activeColumn: number;
  readonly status: RunStatus;
  readonly committedCells: number;
  readonly nextCellId: number;

  // RNG state — serialized for save/restore
  readonly rngState: string;

  // Deck / queue
  readonly deck: readonly Block[];
  readonly drawQueue: readonly Block[];
  readonly active: Block | null;
  readonly hold: Block | null; // placeholder for #28 (hold-swap)
  readonly holdSwapLockedThisBlock: boolean; // placeholder for #28

  // Progress
  readonly clearedRowsThisRun: number;
  readonly clearedRowsThisRound: number; // placeholder for #24 (round system)
  readonly highestRoundReached: number; // placeholder for #24
  readonly round: number; // placeholder for #24

  // Economy
  readonly gold: number; // placeholder for #25/#26 (shop)

  // Garbage
  readonly garbageDropsThisRound: number; // placeholder for #27 (garbage)

  // Achievements
  readonly achievementsUnlockedThisRun: readonly string[]; // placeholder for #29

  // End state
  readonly endedReason: "spawn-collision" | "garbage-shift" | null;
}

export const makeRunState = (_rngSeed?: string): RunState => {
  throw new Error("not implemented");
};

export const isRunState = (_value: unknown): _value is RunState => {
  throw new Error("not implemented");
};
