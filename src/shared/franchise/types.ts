export type FranchiseTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Tier {
  readonly label: string;
  readonly sub: string;
  readonly hex: string;
}

export const TIERS: Readonly<Record<FranchiseTier, Tier>> = {
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

export const isFranchiseTier = (n: number): n is FranchiseTier =>
  Number.isInteger(n) && n >= 1 && n <= 9;

export const getTier = (size: number): Tier => {
  if (!isFranchiseTier(size)) {
    throw new Error(
      `getTier: out-of-range size ${size.toString()} (must be 1..9)`,
    );
  }
  return TIERS[size];
};

export type Cell = readonly [row: number, col: number];

export interface CreatureShape {
  readonly id: number;
  readonly tier: FranchiseTier;
  readonly cells: readonly Cell[];
  readonly nameDe: string;
  readonly mirrorSymmetric: boolean;
}

export const TIER_COUNTS: Readonly<Record<FranchiseTier, number>> = {
  1: 1,
  2: 3,
  3: 12,
  4: 32,
  5: 49,
  6: 42,
  7: 21,
  8: 6,
  9: 1,
};

export const BESTIARY_SIZE = 167;
