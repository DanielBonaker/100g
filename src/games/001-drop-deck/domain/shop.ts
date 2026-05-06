import type { Block } from "./block.ts";
import type { RunState } from "./runState.ts";
import type { BoosterTier } from "./runState.ts";
import type { SeededRng } from "../../../engine/Game.ts";
import { CATALOG } from "../catalog/blocks.ts";

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
  };
};
