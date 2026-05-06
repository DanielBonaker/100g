import type { Block } from "./block.ts";
import type { RunState } from "./runState.ts";
import type { BoosterTier } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { CATALOG } from "../catalog/blocks.ts";
import { PASSIVES } from "../catalog/passives.ts";
import { shuffle } from "./deck.ts";

export type { BoosterTier };

export const MAX_DECK_SIZE = 20;
export const PICKS_PER_BOOSTER = 3;

// ---------------------------------------------------------------------------
// Booster tier prices
// ---------------------------------------------------------------------------

const BOOSTER_PRICE: Record<BoosterTier, number> = {
  small: 2,
  medium: 5,
  large: 10,
};

// ---------------------------------------------------------------------------
// Bestiary tier ranges per booster tier
// ---------------------------------------------------------------------------

const BOOSTER_TIER_RANGE: Record<BoosterTier, readonly number[]> = {
  small: [1, 2, 3], // Keim / Bund / Funke
  medium: [4, 5], // Gestalt / Wesen
  large: [6, 7, 8, 9], // Titan / Apex / Archon / Absolut
};

// ---------------------------------------------------------------------------
// Effect rarity weights (placeholder — tunable during playtesting)
// ---------------------------------------------------------------------------

const EFFECT_WEIGHTS: Record<string, number> = {
  standard: 50,
  ghost: 15,
  melt: 12,
  impact: 12,
  rain: 11,
};

// ---------------------------------------------------------------------------
// generateBoosterOffer — pick PICKS_PER_BOOSTER blocks from the catalog,
// filtered to the tier range, weighted by effect rarity.
// ---------------------------------------------------------------------------

export const generateBoosterOffer = (
  tier: BoosterTier,
  rng: SeededRng,
): readonly Block[] => {
  const allowedTiers = new Set(BOOSTER_TIER_RANGE[tier]);
  const candidates = CATALOG.filter((b) => {
    const tierStr = b.id.split("-")[0];
    if (tierStr === undefined) return false;
    const t = parseInt(tierStr, 10);
    return Number.isFinite(t) && allowedTiers.has(t);
  });

  if (candidates.length === 0) return [];

  const picks: Block[] = [];
  for (let i = 0; i < PICKS_PER_BOOSTER; i++) {
    const totalWeight = candidates.reduce(
      (sum, b) => sum + (EFFECT_WEIGHTS[b.effectId] ?? 1),
      0,
    );
    let r = rng.next() * totalWeight;
    let chosen: Block | null = null;
    for (const b of candidates) {
      r -= EFFECT_WEIGHTS[b.effectId] ?? 1;
      if (r <= 0) {
        chosen = b;
        break;
      }
    }
    chosen ??= candidates[candidates.length - 1] ?? null;
    if (chosen !== null) picks.push(chosen);
  }
  return picks;
};

// ---------------------------------------------------------------------------
// purchaseBooster — spend gold, generate offer, store on state.
// Guard clauses (returns unchanged state) when:
//   - status !== "in-shop"
//   - an offer is already active
//   - insufficient gold
//   - deck at max size
// ---------------------------------------------------------------------------

export const purchaseBooster = (
  state: RunState,
  tier: BoosterTier,
  rng: SeededRng,
): RunState => {
  if (state.status !== "in-shop") return state;
  if (state.shopOffer !== null) return state;
  if (state.gold < BOOSTER_PRICE[tier]) return state;
  if (state.deck.length + state.drawQueue.length >= MAX_DECK_SIZE) return state;

  const options = generateBoosterOffer(tier, rng);
  return {
    ...state,
    gold: state.gold - BOOSTER_PRICE[tier],
    shopOffer: { tier, options },
    rngState: rng.state,
  };
};

// ---------------------------------------------------------------------------
// pickFromBooster — add the chosen block to deck, clear offer.
// Guard clauses:
//   - no active offer
//   - block not in offer
//   - defensive overflow check (clears offer without adding)
// ---------------------------------------------------------------------------

export const pickFromBooster = (state: RunState, block: Block): RunState => {
  if (state.shopOffer === null) return state;
  if (!state.shopOffer.options.some((b) => b.id === block.id)) return state;
  if (state.deck.length + state.drawQueue.length >= MAX_DECK_SIZE) {
    // Defensive: offer is cleared without growing the deck.
    return { ...state, shopOffer: null };
  }
  return {
    ...state,
    deck: [...state.deck, block],
    shopOffer: null,
    purchasedThisShopVisit: true,
  };
};

// ---------------------------------------------------------------------------
// Remove slot — pay REMOVE_COST to see 3 blocks to remove from deck.
// ---------------------------------------------------------------------------

export const REMOVE_COST = 3;
export const MIN_DECK_SIZE = 5;
export const PASSIVE_OFFER_RATE = 0.5;

const removeFirst = <T>(
  arr: readonly T[],
  pred: (item: T) => boolean,
): readonly T[] => {
  const idx = arr.findIndex(pred);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
};

export const generateRemoveOffer = (
  state: RunState,
  rng: SeededRng,
): readonly Block[] => {
  const allBlocks = [...state.deck, ...state.drawQueue];
  if (allBlocks.length === 0) return [];
  const shuffled = shuffle(allBlocks, rng);
  return shuffled.slice(0, Math.min(3, shuffled.length));
};

export const purchaseRemove = (state: RunState, rng: SeededRng): RunState => {
  if (state.status !== "in-shop") return state;
  if (state.removeOffer !== null) return state;
  if (state.gold < REMOVE_COST) return state;
  if (state.deck.length + state.drawQueue.length <= MIN_DECK_SIZE) return state;

  const options = generateRemoveOffer(state, rng);
  if (options.length === 0) return state;

  return {
    ...state,
    gold: state.gold - REMOVE_COST,
    removeOffer: { options },
    purchasedThisShopVisit: true,
    rngState: rng.state,
  };
};

export const pickRemove = (state: RunState, blockId: string): RunState => {
  if (state.removeOffer === null) return state;
  if (!state.removeOffer.options.some((b) => b.id === blockId)) return state;
  if (state.deck.length + state.drawQueue.length <= MIN_DECK_SIZE) {
    // Defensive — clear offer but don't remove
    return { ...state, removeOffer: null };
  }

  const newDeck = removeFirst(state.deck, (b) => b.id === blockId);
  const newDrawQueue =
    newDeck === state.deck
      ? removeFirst(state.drawQueue, (b) => b.id === blockId)
      : state.drawQueue;

  return {
    ...state,
    deck: newDeck,
    drawQueue: newDrawQueue,
    removeOffer: null,
  };
};

// ---------------------------------------------------------------------------
// Passive slot — randomly offer one unowned passive each shop visit.
// ---------------------------------------------------------------------------

export const generatePassiveOffer = (
  state: RunState,
  rng: SeededRng,
): { passive: string; cost: number } | null => {
  if (rng.next() >= PASSIVE_OFFER_RATE) return null;
  const owned = new Set(state.passives);
  const available = PASSIVES.filter((p) => !owned.has(p.id));
  if (available.length === 0) return null;
  const idx = Math.floor(rng.next() * available.length);
  const picked = available[idx];
  if (picked === undefined) return null;
  return { passive: picked.id, cost: picked.cost };
};

export const acceptPassive = (state: RunState): RunState => {
  if (state.passiveOffer === null) return state;
  if (state.gold < state.passiveOffer.cost) return state;
  if (state.passives.includes(state.passiveOffer.passive)) return state;

  return {
    ...state,
    gold: state.gold - state.passiveOffer.cost,
    passives: [...state.passives, state.passiveOffer.passive],
    passiveOffer: null,
    purchasedThisShopVisit: true,
  };
};

export const declinePassive = (state: RunState): RunState => {
  if (state.passiveOffer === null) return state;
  return { ...state, passiveOffer: null };
};
