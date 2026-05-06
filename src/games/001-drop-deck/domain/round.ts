import type { RunState } from "./runState.ts";

// ---------------------------------------------------------------------------
// Round-target curve: how many rows must be cleared to advance to the shop.
// Linear: round 1 → 5, round 2 → 8, ..., round N → 5 + (N-1)*3
// ---------------------------------------------------------------------------
export const targetForRound = (_round: number): number => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// Round lump-sum: base bonus paid into RunState.gold on round-clear.
// round 1 → $3, round 2 → $4, ..., round N → $2 + N
// ---------------------------------------------------------------------------
export const roundLumpSum = (_round: number): number => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// Round interest: bonus based on held gold, capped at $5.
// 1 gold per $5 of currentGold; max 5.
// ---------------------------------------------------------------------------
export const roundInterest = (_currentGold: number): number => {
  throw new Error("not implemented");
};

export interface RoundEndCheck {
  readonly state: RunState;
  readonly roundEnded: boolean;
}

// ---------------------------------------------------------------------------
// checkRoundEnd — pure helper called by commitActive after a strategy returns.
// If clearedRowsThisRound >= targetForRound(round), transitions state to
// "in-shop", pays lump-sum + interest into gold, advances highestRoundReached.
// ---------------------------------------------------------------------------
export const checkRoundEnd = (_state: RunState): RoundEndCheck => {
  throw new Error("not implemented");
};

// ---------------------------------------------------------------------------
// exitShop — advances round, resets per-round counters, reshuffles deck.
// Called when the player confirms leaving the shop.
// ---------------------------------------------------------------------------
export const exitShop = (_state: RunState): RunState => {
  throw new Error("not implemented");
};
