import { describe, it, expect } from "vitest";
import {
  thresholdFor,
  tick,
  inject,
  reset,
  GARBAGE_THRESHOLD_BASE,
  GARBAGE_THRESHOLD_SLOW,
  GARBAGE_FILL_COUNT,
} from "./garbage.ts";
import { makeRunState } from "./runState.ts";
import { makeRng } from "./rng.ts";
import { BOARD_COLS, BOARD_ROWS } from "./boardTypes.ts";
import type { RunState } from "./runState.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a RunState with a specific garbageDropsThisRound and passives. */
const stateWith = (overrides: Partial<RunState>): RunState => ({
  ...makeRunState("test-seed"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// thresholdFor
// ---------------------------------------------------------------------------

describe("thresholdFor", () => {
  it("returns GARBAGE_THRESHOLD_BASE (8) by default", () => {
    const state = stateWith({});
    expect(thresholdFor(state)).toBe(GARBAGE_THRESHOLD_BASE);
    expect(thresholdFor(state)).toBe(8);
  });

  it("returns GARBAGE_THRESHOLD_SLOW (7) when slow-pollution passive is active", () => {
    const state = stateWith({ passives: ["slow-pollution"] });
    expect(thresholdFor(state)).toBe(GARBAGE_THRESHOLD_SLOW);
    expect(thresholdFor(state)).toBe(7);
  });

  it("returns base threshold when passives array has other entries but not slow-pollution", () => {
    const state = stateWith({ passives: ["skippers-bonus"] });
    expect(thresholdFor(state)).toBe(GARBAGE_THRESHOLD_BASE);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("zeros garbageDropsThisRound", () => {
    const state = stateWith({ garbageDropsThisRound: 5 });
    const result = reset(state);
    expect(result.garbageDropsThisRound).toBe(0);
  });

  it("does not mutate other fields", () => {
    const state = stateWith({ garbageDropsThisRound: 3, gold: 42 });
    const result = reset(state);
    expect(result.gold).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// tick — counter increments, does not inject below threshold
// ---------------------------------------------------------------------------

describe("tick — below threshold", () => {
  it("increments garbageDropsThisRound by 1", () => {
    const rng = makeRng("test");
    const state = stateWith({ garbageDropsThisRound: 0 });
    const { state: next, toppedOut } = tick(state, rng);
    expect(next.garbageDropsThisRound).toBe(1);
    expect(toppedOut).toBe(false);
  });

  it("does not change the board below threshold", () => {
    const rng = makeRng("test");
    const state = stateWith({ garbageDropsThisRound: 6 });
    const { state: next } = tick(state, rng);
    // 7 < 8, so no injection
    expect(next.garbageDropsThisRound).toBe(7);
    expect(next.board).toStrictEqual(state.board);
  });

  it("is a no-op when status is not running", () => {
    const rng = makeRng("test");
    const state = stateWith({ garbageDropsThisRound: 0, status: "ended" });
    const { state: next, toppedOut } = tick(state, rng);
    expect(next).toBe(state);
    expect(toppedOut).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tick — at threshold: injects + resets counter
// ---------------------------------------------------------------------------

describe("tick — at threshold (inject + reset)", () => {
  it("injects a row and resets counter when count reaches 8", () => {
    const rng = makeRng("inject-test");
    // counter is at 7, next tick brings it to 8 == threshold
    const state = stateWith({ garbageDropsThisRound: 7 });
    const { state: next, toppedOut } = tick(state, rng);
    expect(toppedOut).toBe(false);
    expect(next.garbageDropsThisRound).toBe(0);
    // Bottom row should now contain a garbage row
    const bottomRow = next.board[BOARD_ROWS - 1]!;
    const filledCount = bottomRow.filter((c) => c !== null).length;
    expect(filledCount).toBe(GARBAGE_FILL_COUNT);
  });

  it("injects at threshold 7 when slow-pollution is active", () => {
    const rng = makeRng("slow-pollution-test");
    // counter is at 6, next tick brings it to 7 == slow threshold
    const state = stateWith({
      garbageDropsThisRound: 6,
      passives: ["slow-pollution"],
    });
    const { state: next, toppedOut } = tick(state, rng);
    expect(toppedOut).toBe(false);
    expect(next.garbageDropsThisRound).toBe(0);
    const bottomRow = next.board[BOARD_ROWS - 1]!;
    const filledCount = bottomRow.filter((c) => c !== null).length;
    expect(filledCount).toBe(GARBAGE_FILL_COUNT);
  });
});

// ---------------------------------------------------------------------------
// inject
// ---------------------------------------------------------------------------

describe("inject", () => {
  it("produces exactly GARBAGE_FILL_COUNT (6) filled cells in the injected row", () => {
    const rng = makeRng("inject-1");
    const state = stateWith({});
    const { state: next, toppedOut } = inject(state, rng);
    expect(toppedOut).toBe(false);
    const bottomRow = next.board[BOARD_ROWS - 1]!;
    const filledCount = bottomRow.filter((c) => c !== null).length;
    expect(filledCount).toBe(GARBAGE_FILL_COUNT);
  });

  it("injected cells have kind === 'garbage'", () => {
    const rng = makeRng("inject-kind");
    const state = stateWith({});
    const { state: next } = inject(state, rng);
    const bottomRow = next.board[BOARD_ROWS - 1]!;
    const filledCells = bottomRow.filter((c) => c !== null);
    expect(filledCells.length).toBeGreaterThan(0);
    for (const cell of filledCells) {
      expect(cell).not.toBeNull();
      // TypeScript: cell is non-null here
      expect(cell.kind).toBe("garbage");
    }
  });

  it("fills exactly 6 out of 8 columns per injection (multiple seeds)", () => {
    const seeds = ["seed-a", "seed-b", "seed-c", "seed-d", "seed-e"];
    for (const seed of seeds) {
      const rng = makeRng(seed);
      const state = stateWith({});
      const { state: next } = inject(state, rng);
      const bottomRow = next.board[BOARD_ROWS - 1]!;
      const filledCount = bottomRow.filter((c) => c !== null).length;
      expect(filledCount).toBe(GARBAGE_FILL_COUNT);
    }
  });

  it("shifts the entire stack up by one row", () => {
    // Place a cell at a known row then inject; it should shift up by 1
    const rng = makeRng("shift-test");
    let state = stateWith({});

    // Manually put a cell at row 10, col 0 via board manipulation
    const newBoard = state.board.map((row, r) =>
      r === 10
        ? row.map((cell, c) =>
            c === 0 ? { id: 999, kind: "block" as const } : cell,
          )
        : row,
    );
    state = { ...state, board: newBoard };

    const { state: next } = inject(state, rng);

    // Cell should have moved from row 10 to row 9
    expect(next.board[9]?.[0]).toStrictEqual({ id: 999, kind: "block" });
    expect(next.board[10]?.[0]).toBeNull();
  });

  it("triggers top-out when row 0 has any occupied cell", () => {
    const rng = makeRng("topout-test");
    let state = stateWith({});

    // Put a cell in row 0, col 0
    const newBoard = state.board.map((row, r) =>
      r === 0
        ? row.map((cell, c) =>
            c === 0 ? { id: 1, kind: "block" as const } : cell,
          )
        : row,
    );
    state = { ...state, board: newBoard };

    const { state: next, toppedOut } = inject(state, rng);
    expect(toppedOut).toBe(true);
    expect(next.status).toBe("ended");
    expect(next.endedReason).toBe("garbage-shift");
  });

  it("does not trigger top-out when row 0 is empty", () => {
    const rng = makeRng("no-topout");
    const state = stateWith({});
    const { toppedOut } = inject(state, rng);
    expect(toppedOut).toBe(false);
  });

  it("total board rows remain BOARD_ROWS after inject", () => {
    const rng = makeRng("rows-count");
    const state = stateWith({});
    const { state: next } = inject(state, rng);
    expect(next.board).toHaveLength(BOARD_ROWS);
    for (const row of next.board) {
      expect(row).toHaveLength(BOARD_COLS);
    }
  });
});
