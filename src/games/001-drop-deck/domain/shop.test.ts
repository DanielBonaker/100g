import { describe, it, expect } from "vitest";
import {
  generateBoosterOffer,
  purchaseBooster,
  pickFromBooster,
  MAX_DECK_SIZE,
  PICKS_PER_BOOSTER,
} from "./shop.ts";
import { makeRunState } from "./runState.ts";
import { makeRng } from "./rng.ts";
import type { RunState } from "./runState.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MAX_DECK_SIZE === 20", () => {
    expect(MAX_DECK_SIZE).toBe(20);
  });

  it("PICKS_PER_BOOSTER === 3", () => {
    expect(PICKS_PER_BOOSTER).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// generateBoosterOffer — tier filtering
// ---------------------------------------------------------------------------

describe("generateBoosterOffer — small tier", () => {
  it("returns exactly 3 blocks", () => {
    const rng = makeRng("test-small-1");
    const offer = generateBoosterOffer("small", rng);
    expect(offer.length).toBe(3);
  });

  it("all returned blocks have tier 1, 2, or 3 (parsed from id prefix)", () => {
    const rng = makeRng("test-small-2");
    const offer = generateBoosterOffer("small", rng);
    for (const block of offer) {
      const tier = parseInt(block.id.split("-")[0]!, 10);
      expect([1, 2, 3]).toContain(tier);
    }
  });
});

describe("generateBoosterOffer — medium tier", () => {
  it("returns exactly 3 blocks", () => {
    const rng = makeRng("test-medium-1");
    const offer = generateBoosterOffer("medium", rng);
    expect(offer.length).toBe(3);
  });

  it("all returned blocks have tier 4 or 5", () => {
    const rng = makeRng("test-medium-2");
    const offer = generateBoosterOffer("medium", rng);
    for (const block of offer) {
      const tier = parseInt(block.id.split("-")[0]!, 10);
      expect([4, 5]).toContain(tier);
    }
  });
});

describe("generateBoosterOffer — large tier", () => {
  it("returns exactly 3 blocks", () => {
    const rng = makeRng("test-large-1");
    const offer = generateBoosterOffer("large", rng);
    expect(offer.length).toBe(3);
  });

  it("all returned blocks have tier 6, 7, 8, or 9", () => {
    const rng = makeRng("test-large-2");
    const offer = generateBoosterOffer("large", rng);
    for (const block of offer) {
      const tier = parseInt(block.id.split("-")[0]!, 10);
      expect([6, 7, 8, 9]).toContain(tier);
    }
  });
});

// ---------------------------------------------------------------------------
// generateBoosterOffer — statistical rarity weights
// ---------------------------------------------------------------------------

describe("generateBoosterOffer — rarity weight distribution (seeded)", () => {
  it("over 1000 small booster offers, effect distribution approximates weights (±8%)", () => {
    // Weights: standard=50, ghost=15, melt=12, impact=12, rain=11  (total=100)
    const totalWeight = 50 + 15 + 12 + 12 + 11;
    const expectedRates: Record<string, number> = {
      standard: 50 / totalWeight,
      ghost: 15 / totalWeight,
      melt: 12 / totalWeight,
      impact: 12 / totalWeight,
      rain: 11 / totalWeight,
    };

    const counts: Record<string, number> = {
      standard: 0,
      ghost: 0,
      melt: 0,
      impact: 0,
      rain: 0,
    };
    const RUNS = 1000;
    const TOLERANCE = 0.08;

    for (let i = 0; i < RUNS; i++) {
      const rng = makeRng(`stat-test-${String(i)}`);
      const offer = generateBoosterOffer("small", rng);
      for (const block of offer) {
        counts[block.effectId] = (counts[block.effectId] ?? 0) + 1;
      }
    }

    const total = RUNS * PICKS_PER_BOOSTER;
    for (const [effectId, expected] of Object.entries(expectedRates)) {
      const actual = (counts[effectId] ?? 0) / total;
      expect(actual).toBeGreaterThan(expected - TOLERANCE);
      expect(actual).toBeLessThan(expected + TOLERANCE);
    }
  });
});

// ---------------------------------------------------------------------------
// purchaseBooster — guard clauses
// ---------------------------------------------------------------------------

describe("purchaseBooster — guard clauses", () => {
  it("returns state unchanged when status is not in-shop", () => {
    const rng = makeRng("guard-1");
    const state = makeRunState("guard-1");
    expect(state.status).toBe("running");
    const result = purchaseBooster(state, "small", rng);
    expect(result).toBe(state);
  });

  it("returns state unchanged when gold < price for small ($2)", () => {
    const rng = makeRng("guard-2");
    const state: RunState = {
      ...makeRunState("guard-2"),
      status: "in-shop",
      gold: 1,
    };
    const result = purchaseBooster(state, "small", rng);
    expect(result).toBe(state);
  });

  it("returns state unchanged when gold < price for medium ($5)", () => {
    const rng = makeRng("guard-3");
    const state: RunState = {
      ...makeRunState("guard-3"),
      status: "in-shop",
      gold: 4,
    };
    const result = purchaseBooster(state, "medium", rng);
    expect(result).toBe(state);
  });

  it("returns state unchanged when gold < price for large ($10)", () => {
    const rng = makeRng("guard-4");
    const state: RunState = {
      ...makeRunState("guard-4"),
      status: "in-shop",
      gold: 9,
    };
    const result = purchaseBooster(state, "large", rng);
    expect(result).toBe(state);
  });

  it("returns state unchanged when deck is at max size", () => {
    const rng = makeRng("guard-5");
    const fullDeck = Array.from({ length: MAX_DECK_SIZE }, (_, i) => ({
      id: `test-block-${String(i)}`,
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    }));
    const state: RunState = {
      ...makeRunState("guard-5"),
      status: "in-shop",
      gold: 100,
      deck: fullDeck,
      drawQueue: [],
    };
    const result = purchaseBooster(state, "small", rng);
    expect(result).toBe(state);
  });

  it("returns state unchanged when an offer is already active", () => {
    const rng = makeRng("guard-6");
    const existingOffer = {
      tier: "small" as const,
      options: [
        {
          id: "1-test-standard",
          cellCount: 1,
          cells: [{ dx: 0, dy: 0 }],
          effectId: "standard" as const,
        },
      ],
    };
    const state: RunState = {
      ...makeRunState("guard-6"),
      status: "in-shop",
      gold: 100,
      shopOffer: existingOffer,
    };
    const result = purchaseBooster(state, "small", rng);
    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// purchaseBooster — successful purchase
// ---------------------------------------------------------------------------

describe("purchaseBooster — successful purchase", () => {
  it("deducts price from gold on purchase", () => {
    const rng = makeRng("buy-1");
    const state: RunState = {
      ...makeRunState("buy-1"),
      status: "in-shop",
      gold: 10,
    };
    const result = purchaseBooster(state, "small", rng);
    expect(result.gold).toBe(8); // 10 - 2
  });

  it("sets shopOffer with correct tier", () => {
    const rng = makeRng("buy-2");
    const state: RunState = {
      ...makeRunState("buy-2"),
      status: "in-shop",
      gold: 10,
    };
    const result = purchaseBooster(state, "medium", rng);
    expect(result.shopOffer).not.toBeNull();
    expect(result.shopOffer?.tier).toBe("medium");
  });

  it("shopOffer.options contains exactly PICKS_PER_BOOSTER blocks", () => {
    const rng = makeRng("buy-3");
    const state: RunState = {
      ...makeRunState("buy-3"),
      status: "in-shop",
      gold: 10,
    };
    const result = purchaseBooster(state, "small", rng);
    expect(result.shopOffer?.options.length).toBe(PICKS_PER_BOOSTER);
  });
});

// ---------------------------------------------------------------------------
// pickFromBooster
// ---------------------------------------------------------------------------

describe("pickFromBooster", () => {
  it("adds the picked block to deck and clears shopOffer", () => {
    const rng = makeRng("pick-1");
    const base: RunState = {
      ...makeRunState("pick-1"),
      status: "in-shop",
      gold: 10,
    };
    const withOffer = purchaseBooster(base, "small", rng);
    expect(withOffer.shopOffer).not.toBeNull();

    const blockToPick = withOffer.shopOffer!.options[0]!;
    const result = pickFromBooster(withOffer, blockToPick);

    expect(result.shopOffer).toBeNull();
    expect(result.deck).toContainEqual(blockToPick);
  });

  it("returns state unchanged when there is no active offer (shopOffer is null)", () => {
    const state: RunState = {
      ...makeRunState("pick-2"),
      status: "in-shop",
      shopOffer: null,
    };
    const block = {
      id: "1-test-standard",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const result = pickFromBooster(state, block);
    expect(result).toBe(state);
  });

  it("returns state unchanged when picked block is not in offer", () => {
    const rng = makeRng("pick-3");
    const base: RunState = {
      ...makeRunState("pick-3"),
      status: "in-shop",
      gold: 10,
    };
    const withOffer = purchaseBooster(base, "small", rng);
    const notInOffer = {
      id: "NOT-in-offer-999",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const result = pickFromBooster(withOffer, notInOffer);
    expect(result).toBe(withOffer);
  });

  it("clears shopOffer and does not add block when deck is already at max (defensive overflow guard)", () => {
    const fullDeck = Array.from({ length: MAX_DECK_SIZE }, (_, i) => ({
      id: `test-block-${String(i)}`,
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    }));
    const offerBlock = {
      id: "1-test-standard",
      cellCount: 1,
      cells: [{ dx: 0, dy: 0 }],
      effectId: "standard" as const,
    };
    const state: RunState = {
      ...makeRunState("pick-overflow"),
      status: "in-shop",
      gold: 0,
      deck: fullDeck,
      drawQueue: [],
      shopOffer: {
        tier: "small",
        options: [offerBlock],
      },
    };
    const result = pickFromBooster(state, offerBlock);
    // shopOffer is cleared (defensive)
    expect(result.shopOffer).toBeNull();
    // deck is NOT grown beyond max
    expect(result.deck.length).toBe(MAX_DECK_SIZE);
  });
});
