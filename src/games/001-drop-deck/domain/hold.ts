// hold.ts — hold-swap logic for the block-fall game.
//
// Hold shape decision: two distinct nullable fields (`hold` and `hold2`) rather
// than an array. This avoids noUncheckedIndexedAccess pressure on every access
// and makes the RunState shape legible in TypeScript. `hold` = slot 0 (always
// available); `hold2` = slot 1 (only meaningful when "spare-pocket" is owned).

import type { RunState } from "./runState.ts";
import { draw } from "./deck.ts";
import { makeRng } from "./rng.ts";

export const HOLD_CAPACITY_BASE = 1;
export const HOLD_CAPACITY_SPARE_POCKET = 2;

/** Returns 1 normally, 2 when the player owns the "spare-pocket" passive. */
export const holdCapacity = (state: RunState): number =>
  state.passives.includes("spare-pocket")
    ? HOLD_CAPACITY_SPARE_POCKET
    : HOLD_CAPACITY_BASE;

// ---------------------------------------------------------------------------
// swapHold — swap the active block with hold slot `slot` (default 0).
//
// Semantics:
//  - If the hold slot is empty: stows the active block there, draws the next
//    block from the deck queue as the new active.
//  - If the hold slot is non-empty: exchanges active ↔ held block (drawQueue
//    is unchanged — no draw required).
//
// Returns the same state reference (no-op) when:
//  - status !== "running"
//  - holdSwapLockedThisBlock is true
//  - active is null
//  - slot < 0 or slot >= holdCapacity(state)
//
// Sets holdSwapLockedThisBlock = true on every successful swap/stow to prevent
// a double-swap before the current block commits.
// ---------------------------------------------------------------------------
export const swapHold = (state: RunState, slot = 0): RunState => {
  // Guard: only swap while running
  if (state.status !== "running") return state;
  // Guard: lock prevents double-swap in the same active-block lifetime
  if (state.holdSwapLockedThisBlock) return state;
  // Guard: nothing to stow
  if (state.active === null) return state;
  // Guard: slot must be in range
  if (slot < 0 || slot >= holdCapacity(state)) return state;

  if (slot === 0) {
    if (state.hold === null) {
      // Stow: active → hold, draw new active from queue.
      // We use a throw-away RNG seeded from current rngState so the draw is
      // deterministic relative to the saved RNG position. The RNG state is then
      // updated in the returned state so future draws continue correctly.
      const rng = makeRng(state.rngState);
      const drawn = draw(state, rng);
      return {
        ...drawn.state,
        hold: state.active,
        active: drawn.drew,
        holdSwapLockedThisBlock: true,
        rngState: rng.state,
      };
    } else {
      // Swap: active ↔ hold[0]
      const prev = state.hold;
      return {
        ...state,
        active: prev,
        hold: state.active,
        holdSwapLockedThisBlock: true,
      };
    }
  } else {
    // slot === 1 (only reachable when spare-pocket is active, guarded above)
    if (state.hold2 === null) {
      // Stow: active → hold2, draw new active
      const rng = makeRng(state.rngState);
      const drawn = draw(state, rng);
      return {
        ...drawn.state,
        hold2: state.active,
        active: drawn.drew,
        holdSwapLockedThisBlock: true,
        rngState: rng.state,
      };
    } else {
      // Swap: active ↔ hold2
      const prev = state.hold2;
      return {
        ...state,
        active: prev,
        hold2: state.active,
        holdSwapLockedThisBlock: true,
      };
    }
  }
};
