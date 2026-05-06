import { describe, expect, it } from "vitest";

import {
  TIERS,
  getTier,
  isFranchiseTier,
  type FranchiseTier,
  type Tier,
} from "./types.ts";

describe("TIERS", () => {
  const canonical: Record<FranchiseTier, Tier> = {
    1: { label: "Keim", sub: "Ursprung", hex: "#888888" },
    2: { label: "Bund", sub: "Verbindung", hex: "#66AACC" },
    3: { label: "Funke", sub: "Erwachen", hex: "#44CC88" },
    4: { label: "Gestalt", sub: "Formung", hex: "#CCAA44" },
    5: { label: "Wesen", sub: "Bewusstsein", hex: "#CC6644" },
    6: { label: "Titan", sub: "Macht", hex: "#CC44AA" },
    7: { label: "Apex", sub: "Herrschaft", hex: "#8844FF" },
    8: { label: "Archon", sub: "Vollendung", hex: "#FFD700" },
    9: { label: "Absolut", sub: "Transzendenz", hex: "#FFFFFF" },
  };

  it("has exactly 9 entries", () => {
    expect(Object.keys(TIERS)).toHaveLength(9);
  });

  for (const _size of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const size = _size;
    it(`TIERS[${size.toString()}] matches canonical values`, () => {
      expect(TIERS[size]).toEqual(canonical[size]);
    });
  }

  // Type-level exhaustiveness: TIERS must be Record<FranchiseTier, Tier>
  // with all 9 keys. This assertion is evaluated by the TypeScript compiler.
  const _exhaustive: keyof typeof TIERS extends FranchiseTier
    ? FranchiseTier extends keyof typeof TIERS
      ? true
      : false
    : false = true;
  void _exhaustive;
});

describe("getTier", () => {
  it("returns the correct Tier for size 1", () => {
    expect(getTier(1)).toEqual({
      label: "Keim",
      sub: "Ursprung",
      hex: "#888888",
    });
  });

  it("returns the correct Tier for size 9", () => {
    expect(getTier(9)).toEqual({
      label: "Absolut",
      sub: "Transzendenz",
      hex: "#FFFFFF",
    });
  });

  it("throws for size 0 (out of range)", () => {
    expect(() => getTier(0)).toThrow(
      "getTier: out-of-range size 0 (must be 1..9)",
    );
  });

  it("throws for size 10 (out of range)", () => {
    expect(() => getTier(10)).toThrow(
      "getTier: out-of-range size 10 (must be 1..9)",
    );
  });

  it("throws for NaN", () => {
    expect(() => getTier(NaN)).toThrow(
      "getTier: out-of-range size NaN (must be 1..9)",
    );
  });
});

describe("isFranchiseTier", () => {
  it("returns true for integers 1..9", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(isFranchiseTier(n)).toBe(true);
    }
  });

  it("returns false for 0, 10, negative, float, NaN", () => {
    for (const n of [0, 10, -1, 1.5, NaN]) {
      expect(isFranchiseTier(n)).toBe(false);
    }
  });
});
