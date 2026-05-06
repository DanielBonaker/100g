import { describe, it, expect } from "vitest";
import {
  targetForRound,
  roundLumpSum,
  roundInterest,
  checkRoundEnd,
  exitShop,
} from "./round.ts";
import { makeRunState } from "./runState.ts";

// ---------------------------------------------------------------------------
// targetForRound
// ---------------------------------------------------------------------------

describe("targetForRound", () => {
  it("round 1 → 5 rows", () => {
    expect(targetForRound(1)).toBe(5);
  });

  it("round 2 → 8 rows", () => {
    expect(targetForRound(2)).toBe(8);
  });

  it("round 10 → 32 rows", () => {
    expect(targetForRound(10)).toBe(32);
  });

  it("round 0 (clamped) → same as round 1 (5 rows)", () => {
    // max(1, round) means round 0 is treated as 1
    expect(targetForRound(0)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// roundLumpSum
// ---------------------------------------------------------------------------

describe("roundLumpSum", () => {
  it("round 1 → $3", () => {
    expect(roundLumpSum(1)).toBe(3);
  });

  it("round 5 → $7", () => {
    expect(roundLumpSum(5)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// roundInterest
// ---------------------------------------------------------------------------

describe("roundInterest", () => {
  it("0 gold → 0 interest", () => {
    expect(roundInterest(0)).toBe(0);
  });

  it("20 gold → 4 interest", () => {
    expect(roundInterest(20)).toBe(4);
  });

  it("50 gold → 5 interest (capped)", () => {
    expect(roundInterest(50)).toBe(5);
  });

  it("100 gold → 5 interest (cap enforced)", () => {
    expect(roundInterest(100)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// checkRoundEnd
// ---------------------------------------------------------------------------

describe("checkRoundEnd", () => {
  it('no-op when status is "ended"', () => {
    const state = { ...makeRunState(), status: "ended" as const };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(false);
    expect(result.state).toBe(state);
  });

  it('no-op when status is "in-shop"', () => {
    const state = {
      ...makeRunState(),
      status: "in-shop" as const,
      clearedRowsThisRound: 999,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(false);
    expect(result.state).toBe(state);
  });

  it("no-op when clearedRowsThisRound < targetForRound(round)", () => {
    // round 1 target is 5; clear only 4 rows
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 4,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(false);
    expect(result.state).toBe(state);
  });

  it('transitions to "in-shop" when clearedRowsThisRound === targetForRound(round)', () => {
    // round 1 target is 5; hit exactly 5
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 5,
      gold: 0,
      highestRoundReached: 0,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    expect(result.state.status).toBe("in-shop");
  });

  it("pays lump-sum + interest into gold on round-clear", () => {
    // round 1: lump = 3, gold = 0 → interest = 0; total = 3
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 5,
      gold: 0,
      highestRoundReached: 0,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    // lump(1) = 3, interest(0) = 0 → gold = 3
    expect(result.state.gold).toBe(3);
  });

  it("interest is capped at $5", () => {
    // round 1, gold = 100 → interest = min(5, floor(100/5)) = 5
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 5,
      gold: 100,
      highestRoundReached: 0,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    // lump(1) = 3, interest(100) = 5 → gold = 100 + 3 + 5 = 108
    expect(result.state.gold).toBe(108);
  });

  it("advances highestRoundReached when current round exceeds prior high", () => {
    const state = {
      ...makeRunState(),
      round: 3,
      clearedRowsThisRound: 11, // target for round 3
      gold: 0,
      highestRoundReached: 2,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    expect(result.state.highestRoundReached).toBe(3);
  });

  it("does not decrease highestRoundReached if it is already higher", () => {
    // e.g. player hit round 5 before, now completing round 3 again (fresh run)
    const state = {
      ...makeRunState(),
      round: 3,
      clearedRowsThisRound: 11,
      gold: 0,
      highestRoundReached: 5,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    expect(result.state.highestRoundReached).toBe(5);
  });

  it("does not reset clearedRowsThisRound on transition (reset happens on shop exit)", () => {
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 5,
      gold: 0,
      highestRoundReached: 0,
    };
    const result = checkRoundEnd(state);
    expect(result.roundEnded).toBe(true);
    // clearedRowsThisRound is preserved until exitShop resets it
    expect(result.state.clearedRowsThisRound).toBe(5);
  });

  it("calling twice with the same state is effectively idempotent (second call is no-op, status already in-shop)", () => {
    const state = {
      ...makeRunState(),
      round: 1,
      clearedRowsThisRound: 5,
      gold: 0,
      highestRoundReached: 0,
    };
    const first = checkRoundEnd(state);
    // Now call again with the returned state (which is "in-shop")
    const second = checkRoundEnd(first.state);
    expect(second.roundEnded).toBe(false);
    expect(second.state).toBe(first.state);
  });
});

// ---------------------------------------------------------------------------
// exitShop
// ---------------------------------------------------------------------------

describe("exitShop", () => {
  it('no-op when status is not "in-shop"', () => {
    const state = makeRunState();
    expect(state.status).toBe("running");
    const result = exitShop(state);
    expect(result).toBe(state);
  });

  it('transitions status back to "running"', () => {
    const inShop = {
      ...makeRunState("seed-exit"),
      status: "in-shop" as const,
      round: 2,
      clearedRowsThisRound: 8,
      garbageDropsThisRound: 3,
    };
    const result = exitShop(inShop);
    expect(result.status).toBe("running");
  });

  it("advances round by 1", () => {
    const inShop = {
      ...makeRunState("seed-exit"),
      status: "in-shop" as const,
      round: 2,
      clearedRowsThisRound: 8,
      garbageDropsThisRound: 0,
    };
    const result = exitShop(inShop);
    expect(result.round).toBe(3);
  });

  it("resets clearedRowsThisRound to 0", () => {
    const inShop = {
      ...makeRunState("seed-exit"),
      status: "in-shop" as const,
      round: 1,
      clearedRowsThisRound: 5,
      garbageDropsThisRound: 0,
    };
    const result = exitShop(inShop);
    expect(result.clearedRowsThisRound).toBe(0);
  });

  it("resets garbageDropsThisRound to 0", () => {
    const inShop = {
      ...makeRunState("seed-exit"),
      status: "in-shop" as const,
      round: 1,
      clearedRowsThisRound: 5,
      garbageDropsThisRound: 4,
    };
    const result = exitShop(inShop);
    expect(result.garbageDropsThisRound).toBe(0);
  });

  it("reshuffles the deck (drawQueue is reset to empty)", () => {
    const base = makeRunState("seed-shuffle");
    const inShop = {
      ...base,
      status: "in-shop" as const,
      round: 1,
      clearedRowsThisRound: 5,
      garbageDropsThisRound: 0,
    };
    const result = exitShop(inShop);
    // drawQueue is reset to [] so the next draw triggers a fresh reshuffle
    expect(result.drawQueue).toEqual([]);
  });

  it("updates rngState (rng advances during shuffle)", () => {
    const inShop = {
      ...makeRunState("seed-rng-advance"),
      status: "in-shop" as const,
      round: 1,
      clearedRowsThisRound: 5,
      garbageDropsThisRound: 0,
    };
    const result = exitShop(inShop);
    // rngState must change because shuffle consumes rng outputs
    expect(result.rngState).not.toBe(inShop.rngState);
  });
});
