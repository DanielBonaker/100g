import type { Board } from "./boardTypes.ts";
import { emptyBoard, BOARD_COLS, BOARD_ROWS } from "./boardTypes.ts";
import type { Block } from "./block.ts";
import { makeRng } from "./rng.ts";
import { buildStarterDeck, shuffle } from "./deck.ts";

export type RunStatus = "running" | "in-shop" | "ended";

export interface RunState {
  // Board geometry
  readonly board: Board;
  readonly activeColumn: number;
  readonly status: RunStatus;
  readonly committedBlocks: number;
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

export const makeRunState = (rngSeed?: string): RunState => {
  const rng = makeRng(rngSeed ?? String(Date.now()));
  const deck = buildStarterDeck(rng);
  const shuffled = shuffle(deck, rng);
  // Draw the first block as active; the rest go into drawQueue
  const active = shuffled[0] ?? null;
  const drawQueue: readonly Block[] =
    active !== null ? shuffled.slice(1) : shuffled;

  return {
    board: emptyBoard(),
    activeColumn: 4,
    status: "running",
    committedBlocks: 0,
    nextCellId: 1,
    rngState: rng.state,
    // Deck is empty by default; the game seeds via buildStarterDeck on init. Once the starter deck cycles, reshuffle from drawQueue (see #25 for shop-driven deck additions).
    deck: [],
    drawQueue,
    active,
    hold: null,
    holdSwapLockedThisBlock: false,
    clearedRowsThisRun: 0,
    clearedRowsThisRound: 0,
    highestRoundReached: 0,
    round: 1,
    gold: 0,
    garbageDropsThisRound: 0,
    achievementsUnlockedThisRun: [],
    endedReason: null,
  };
};

// ---------------------------------------------------------------------------
// isRunState — runtime type guard.
// NOTE: Saved states from before this slice are missing the new fields.
// The validator rejects them so the game falls back to makeRunState() and
// clears the stale entry. Players will lose an in-progress run on first
// launch after this slice ships — acceptable for a pre-launch project.
// ---------------------------------------------------------------------------
export const isRunState = (value: unknown): value is RunState => {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  // board: array of BOARD_ROWS rows, each row an array of BOARD_COLS cells
  if (!Array.isArray(v.board)) return false;
  const board = v.board as unknown[];
  if (board.length !== BOARD_ROWS) return false;
  for (const row of board) {
    if (!Array.isArray(row)) return false;
    const cells = row as unknown[];
    if (cells.length !== BOARD_COLS) return false;
    for (const cell of cells) {
      if (cell !== null) {
        if (typeof cell !== "object") return false;
        const c = cell as { id?: unknown };
        if (typeof c.id !== "number") return false;
      }
    }
  }

  // scalar fields
  if (typeof v.activeColumn !== "number") return false;
  if (v.activeColumn < 0 || v.activeColumn >= BOARD_COLS) return false;
  if (v.status !== "running" && v.status !== "in-shop" && v.status !== "ended")
    return false;
  if (typeof v.committedBlocks !== "number" || v.committedBlocks < 0)
    return false;
  if (typeof v.nextCellId !== "number" || v.nextCellId < 1) return false;

  // new fields introduced in this slice — old saves won't have them
  if (typeof v.rngState !== "string") return false;
  if (!Array.isArray(v.deck)) return false;
  if (!Array.isArray(v.drawQueue)) return false;
  if (!Array.isArray(v.achievementsUnlockedThisRun)) return false;
  if (typeof v.clearedRowsThisRun !== "number") return false;
  if (typeof v.clearedRowsThisRound !== "number") return false;
  if (typeof v.highestRoundReached !== "number") return false;
  if (typeof v.round !== "number") return false;
  if (typeof v.gold !== "number") return false;
  if (typeof v.garbageDropsThisRound !== "number") return false;
  if (typeof v.holdSwapLockedThisBlock !== "boolean") return false;
  if (
    v.endedReason !== null &&
    v.endedReason !== "spawn-collision" &&
    v.endedReason !== "garbage-shift"
  ) {
    return false;
  }

  return true;
};
