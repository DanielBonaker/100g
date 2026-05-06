import type { SeededRng } from "../../../engine/Game.ts";
import type { Block } from "./block.ts";
import type { RunState } from "./runState.ts";

export interface DeckOptions {
  readonly minSize?: number;
  readonly maxSize?: number;
}

const STARTER_DECK_SIZE = 8;

/** Build the initial starter deck of standard 1×1 blocks. */
export const buildStarterDeck = (_rng: SeededRng): readonly Block[] => {
  const deck: Block[] = [];
  for (let i = 0; i < STARTER_DECK_SIZE; i++) {
    deck.push({
      id: `std-1x1-${String(i + 1)}`,
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard",
    });
  }
  return deck;
};

/** Fisher-Yates shuffle — pure (returns new array), deterministic per seed. */
export const shuffle = <T>(
  items: readonly T[],
  rng: SeededRng,
): readonly T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = tmp as T;
  }
  return arr;
};

/**
 * Draw the next block from drawQueue. If drawQueue is empty, reshuffle the
 * deck into a new drawQueue first. Returns null only when both are empty.
 */
export const draw = (
  state: RunState,
  rng: SeededRng,
): { state: RunState; drew: Block | null } => {
  let { drawQueue, deck } = state;

  // If queue is empty, reshuffle deck into a new queue
  if (drawQueue.length === 0) {
    if (deck.length === 0) {
      return { state, drew: null };
    }
    drawQueue = shuffle(deck, rng);
    deck = [];
  }

  const drew = drawQueue[0] ?? null;
  if (drew === null) return { state, drew: null };

  return {
    state: {
      ...state,
      drawQueue: drawQueue.slice(1),
      deck,
    },
    drew,
  };
};

/**
 * Enforce min/max deck size.
 * - If deck length > maxSize: truncate from the end.
 * - Below minSize: deck is too small but we don't pad here
 *   (caller adds blocks via booster packs in later slices).
 */
export const enforceMinMax = (
  deck: readonly Block[],
  max: number,
): readonly Block[] => {
  if (deck.length > max) return deck.slice(0, max);
  return deck;
};
