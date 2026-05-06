import { describe, it, expect } from "vitest";
import {
  generateBoosterOffer,
  purchaseBooster,
  pickFromBooster,
  MAX_DECK_SIZE,
  PICKS_PER_BOOSTER,
  REMOVE_COST,
  MIN_DECK_SIZE,
  purchaseRemove,
  pickRemove,
  generatePassiveOffer,
  acceptPassive,
  declinePassive,
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

// ---------------------------------------------------------------------------
// purchaseRemove
// ---------------------------------------------------------------------------

const makeShopBlock = (n: number) => ({
  id: `1-test-block-${String(n)}-standard`,
  cellCount: 1,
  cells: [{ dx: 0, dy: 0 }],
  effectId: "standard" as const,
});

describe("purchaseRemove", () => {
  it("deducts REMOVE_COST ($3) and sets removeOffer", () => {
    const rng = makeRng("remove-1");
    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const state: RunState = {
      ...makeRunState("remove-1"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
    };
    const result = purchaseRemove(state, rng);
    expect(result.gold).toBe(10 - REMOVE_COST);
    expect(result.removeOffer).not.toBeNull();
  });

  it("blocked when gold < REMOVE_COST", () => {
    const rng = makeRng("remove-2");
    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const state: RunState = {
      ...makeRunState("remove-2"),
      status: "in-shop",
      gold: 2,
      deck,
      drawQueue: [],
    };
    const result = purchaseRemove(state, rng);
    expect(result).toBe(state);
  });

  it("blocked when deck+drawQueue <= MIN_DECK_SIZE", () => {
    const rng = makeRng("remove-3");
    const deck = Array.from({ length: MIN_DECK_SIZE }, (_, i) =>
      makeShopBlock(i),
    );
    const state: RunState = {
      ...makeRunState("remove-3"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
    };
    const result = purchaseRemove(state, rng);
    expect(result).toBe(state);
  });

  it("blocked when removeOffer already exists", () => {
    const rng = makeRng("remove-4");
    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const existingRemoveOffer = { options: [makeShopBlock(99)] };
    const state: RunState = {
      ...makeRunState("remove-4"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
      removeOffer: existingRemoveOffer,
    };
    const result = purchaseRemove(state, rng);
    expect(result).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// pickRemove
// ---------------------------------------------------------------------------

describe("pickRemove", () => {
  it("removes block from deck and clears offer", () => {
    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const blockToRemove = deck[2]!;
    const state: RunState = {
      ...makeRunState("pickremove-1"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
      removeOffer: { options: [blockToRemove] },
    };
    const result = pickRemove(state, blockToRemove.id);
    expect(result.removeOffer).toBeNull();
    expect(result.deck.some((b) => b.id === blockToRemove.id)).toBe(false);
    expect(result.deck.length).toBe(deck.length - 1);
  });

  it("rejects unknown block id — offer stays", () => {
    const deck = Array.from({ length: 8 }, (_, i) => makeShopBlock(i));
    const blockInOffer = deck[2]!;
    const state: RunState = {
      ...makeRunState("pickremove-2"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
      removeOffer: { options: [blockInOffer] },
    };
    const result = pickRemove(state, "NOT-IN-OFFER");
    expect(result).toBe(state);
  });

  it("defensive: clears offer without removing when deck at min size", () => {
    const deck = Array.from({ length: MIN_DECK_SIZE }, (_, i) =>
      makeShopBlock(i),
    );
    const blockToRemove = deck[0]!;
    const state: RunState = {
      ...makeRunState("pickremove-3"),
      status: "in-shop",
      gold: 10,
      deck,
      drawQueue: [],
      removeOffer: { options: [blockToRemove] },
    };
    const result = pickRemove(state, blockToRemove.id);
    expect(result.removeOffer).toBeNull();
    expect(result.deck.length).toBe(MIN_DECK_SIZE);
  });
});

// ---------------------------------------------------------------------------
// generatePassiveOffer
// ---------------------------------------------------------------------------

describe("generatePassiveOffer", () => {
  it("returns null ~50% of time (200 samples, ±10%)", () => {
    const base: RunState = {
      ...makeRunState("passive-stat"),
      status: "in-shop",
      passives: [],
    };
    let nullCount = 0;
    const SAMPLES = 200;
    for (let i = 0; i < SAMPLES; i++) {
      const rng = makeRng(`passive-stat-${String(i)}`);
      const offer = generatePassiveOffer(base, rng);
      if (offer === null) nullCount++;
    }
    const nullRate = nullCount / SAMPLES;
    expect(nullRate).toBeGreaterThan(0.4);
    expect(nullRate).toBeLessThan(0.6);
  });

  it("returns a passive not yet owned", () => {
    const base: RunState = {
      ...makeRunState("passive-notowned"),
      status: "in-shop",
      passives: [],
    };
    // Try a few seeds until we get a non-null offer
    let offer = null;
    for (let i = 0; i < 50; i++) {
      const rng = makeRng(`passive-notowned-${String(i)}`);
      offer = generatePassiveOffer(base, rng);
      if (offer !== null) break;
    }
    expect(offer).not.toBeNull();
    expect(base.passives).not.toContain(offer.passive);
  });

  it("returns null when all passives owned", () => {
    const allIds = [
      "skippers-bonus",
      "slow-pollution",
      "spare-pocket",
      "row-rebate",
      "compound-interest",
      "deep-pockets",
      "starter-saver",
      "lucky-draw",
      "iron-foundation",
    ];
    const base: RunState = {
      ...makeRunState("passive-allowned"),
      status: "in-shop",
      passives: allIds,
    };
    const rng = makeRng("passive-allowned");
    const offer = generatePassiveOffer(base, rng);
    expect(offer).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// acceptPassive / declinePassive
// ---------------------------------------------------------------------------

describe("acceptPassive", () => {
  it("deducts cost and adds passive to passives list", () => {
    const state: RunState = {
      ...makeRunState("accept-1"),
      status: "in-shop",
      gold: 15,
      passives: [],
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    const result = acceptPassive(state);
    expect(result.gold).toBe(10);
    expect(result.passives).toContain("skippers-bonus");
    expect(result.passiveOffer).toBeNull();
  });

  it("rejects if gold < cost", () => {
    const state: RunState = {
      ...makeRunState("accept-2"),
      status: "in-shop",
      gold: 3,
      passives: [],
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    const result = acceptPassive(state);
    expect(result).toBe(state);
  });

  it("rejects duplicate passive (defensive)", () => {
    const state: RunState = {
      ...makeRunState("accept-3"),
      status: "in-shop",
      gold: 20,
      passives: ["skippers-bonus"],
      passiveOffer: { passive: "skippers-bonus", cost: 5 },
    };
    const result = acceptPassive(state);
    expect(result).toBe(state);
  });
});

describe("declinePassive", () => {
  it("clears the passive offer", () => {
    const state: RunState = {
      ...makeRunState("decline-1"),
      status: "in-shop",
      gold: 10,
      passives: [],
      passiveOffer: { passive: "row-rebate", cost: 5 },
    };
    const result = declinePassive(state);
    expect(result.passiveOffer).toBeNull();
  });

  it("no-op when no offer", () => {
    const state: RunState = {
      ...makeRunState("decline-2"),
      status: "in-shop",
      gold: 10,
      passives: [],
      passiveOffer: null,
    };
    const result = declinePassive(state);
    expect(result).toBe(state);
  });
});
