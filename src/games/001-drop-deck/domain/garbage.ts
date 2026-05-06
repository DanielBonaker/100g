import type { RunState } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import type { Board, Cell } from "./boardTypes.ts";
import { BOARD_COLS } from "./boardTypes.ts";

export const GARBAGE_THRESHOLD_BASE = 8;
export const GARBAGE_THRESHOLD_SLOW = 7;
export const GARBAGE_FILL_COUNT = 6; // 6 of 8 columns filled per injection

export const thresholdFor = (state: RunState): number =>
  state.passives.includes("slow-pollution")
    ? GARBAGE_THRESHOLD_SLOW
    : GARBAGE_THRESHOLD_BASE;

// Increment garbage counter; if threshold crossed, inject a garbage row.
// Returns the (possibly modified) state and a top-out flag.
export const tick = (
  state: RunState,
  rng: SeededRng,
): { state: RunState; toppedOut: boolean } => {
  if (state.status !== "running") return { state, toppedOut: false };

  const newCount = state.garbageDropsThisRound + 1;
  const threshold = thresholdFor(state);

  if (newCount < threshold) {
    return {
      state: { ...state, garbageDropsThisRound: newCount },
      toppedOut: false,
    };
  }

  // Threshold reached: inject + reset counter.
  const injected = inject(state, rng);
  return {
    state: {
      ...injected.state,
      garbageDropsThisRound: 0,
      rngState: rng.state,
    },
    toppedOut: injected.toppedOut,
  };
};

export const inject = (
  state: RunState,
  rng: SeededRng,
): { state: RunState; toppedOut: boolean } => {
  // Top-out: if row 0 has any occupied cell, the injection pushes it off the board.
  if (state.board[0]?.some((cell) => cell !== null)) {
    return {
      state: { ...state, status: "ended", endedReason: "garbage-shift" },
      toppedOut: true,
    };
  }

  // Pick GARBAGE_FILL_COUNT columns via Fisher-Yates partial shuffle.
  const allCols = Array.from({ length: BOARD_COLS }, (_, i) => i);
  for (let i = 0; i < GARBAGE_FILL_COUNT; i++) {
    const j = i + Math.floor(rng.next() * (allCols.length - i));
    const tmp = allCols[i] ?? i;
    allCols[i] = allCols[j] ?? j;
    allCols[j] = tmp;
  }
  const filledCols = new Set(allCols.slice(0, GARBAGE_FILL_COUNT));

  // Build the new garbage row.
  const garbageRow: readonly Cell[] = Array.from(
    { length: BOARD_COLS },
    (_, c): Cell => (filledCols.has(c) ? { id: -1, kind: "garbage" } : null),
  );

  // Shift entire stack up: rows 1..N-1 become rows 0..N-2; garbage row is new bottom.
  const newBoard: Board = [
    ...state.board.slice(1), // rows 1..BOARD_ROWS-1 shift up
    garbageRow,
  ] as Board;

  return {
    state: { ...state, board: newBoard },
    toppedOut: false,
  };
};

export const reset = (state: RunState): RunState => ({
  ...state,
  garbageDropsThisRound: 0,
});
