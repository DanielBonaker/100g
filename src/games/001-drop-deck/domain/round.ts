import type { RunState } from "./runState.ts";
import { makeRngFromState } from "./rng.ts";
import { shuffle } from "./deck.ts";

// ---------------------------------------------------------------------------
// Round-target curve: how many rows must be cleared to advance to the shop.
// Formula: 5 + (max(1, round) - 1) * 3
//   round 1 → 5, round 2 → 8, round 3 → 11, ..., round 10 → 32
// Values can be tuned during playtesting; the linear structure is intentional.
// ---------------------------------------------------------------------------
export const targetForRound = (round: number): number =>
  5 + (Math.max(1, round) - 1) * 3;

// ---------------------------------------------------------------------------
// Round lump-sum: base bonus paid into RunState.gold on round-clear.
// Formula: 2 + round  →  round 1 = $3, round 5 = $7, etc.
// ---------------------------------------------------------------------------
export const roundLumpSum = (round: number): number => 2 + round;

// ---------------------------------------------------------------------------
// Round interest: bonus based on held gold, capped at $5.
// 1 gold per $5 of currentGold; max 5.
// Rewards holding onto gold across rounds without being runaway-scaling.
// ---------------------------------------------------------------------------
export const roundInterest = (currentGold: number): number =>
  Math.min(5, Math.floor(currentGold / 5));

export interface RoundEndCheck {
  readonly state: RunState;
  readonly roundEnded: boolean;
}

// ---------------------------------------------------------------------------
// checkRoundEnd — pure helper called by commitActive after a strategy returns.
// If clearedRowsThisRound >= targetForRound(round), transitions state to
// "in-shop", pays lump-sum + interest into RunState.gold (in-game currency
// only — NOT cross-game economy), and advances highestRoundReached.
// clearedRowsThisRound is NOT reset here; that happens in exitShop.
// ---------------------------------------------------------------------------
export const checkRoundEnd = (state: RunState): RoundEndCheck => {
  if (state.status !== "running") return { state, roundEnded: false };
  if (state.clearedRowsThisRound < targetForRound(state.round)) {
    return { state, roundEnded: false };
  }

  const lump = roundLumpSum(state.round);
  const interest = roundInterest(state.gold);
  const newGold = state.gold + lump + interest;
  const newHighest = Math.max(state.highestRoundReached, state.round);

  const nextState: RunState = {
    ...state,
    status: "in-shop",
    gold: newGold,
    highestRoundReached: newHighest,
  };

  return { state: nextState, roundEnded: true };
};

// ---------------------------------------------------------------------------
// exitShop — advances round, resets per-round counters, reshuffles deck.
// The drawQueue is cleared so the next draw triggers a fresh reshuffle from
// state.deck (which may have been augmented by shop purchases in later slices).
// ---------------------------------------------------------------------------
export const exitShop = (state: RunState): RunState => {
  if (state.status !== "in-shop") return state;

  const rng = makeRngFromState(state.rngState);

  // Combine deck + remaining drawQueue as the pool to reshuffle.
  // The draw system uses deck as the source for reshuffles; we place the
  // combined pool back into deck and clear drawQueue so the first draw
  // after shop-exit triggers a fresh reshuffle via deck.ts#draw.
  const combinedPool = [...state.deck, ...state.drawQueue];
  const reshuffled = shuffle(combinedPool, rng);

  return {
    ...state,
    status: "running",
    round: state.round + 1,
    clearedRowsThisRound: 0,
    garbageDropsThisRound: 0,
    deck: reshuffled,
    drawQueue: [],
    rngState: rng.state,
  };
};
