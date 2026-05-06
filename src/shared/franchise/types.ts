export type FranchiseTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Tier {
  readonly label: string;
  readonly sub: string;
  readonly hex: string;
}

// Stub — replaced in GREEN commit
export const TIERS: Readonly<Record<FranchiseTier, Tier>> = {} as Readonly<
  Record<FranchiseTier, Tier>
>;

export const isFranchiseTier = (n: number): n is FranchiseTier =>
  Number.isInteger(n) && n >= 1 && n <= 9;

export const getTier = (size: number): Tier => {
  throw new Error(`getTier: stub — not implemented (size ${size.toString()})`);
};

export type Cell = readonly [row: number, col: number];

export interface CreatureShape {
  readonly id: number;
  readonly tier: FranchiseTier;
  readonly cells: readonly Cell[];
  readonly nameDe: string;
  readonly mirrorSymmetric: boolean;
}

export interface FranchiseTierMeta {
  readonly tier: FranchiseTier;
  readonly label: string;
  readonly subtitle: string;
}

export const TIER_META: readonly FranchiseTierMeta[] = [
  { tier: 1, label: "Keim", subtitle: "Ursprung" },
  { tier: 2, label: "Bund", subtitle: "Verbindung" },
  { tier: 3, label: "Funke", subtitle: "Erwachen" },
  { tier: 4, label: "Gestalt", subtitle: "Formung" },
  { tier: 5, label: "Wesen", subtitle: "Bewusstsein" },
  { tier: 6, label: "Titan", subtitle: "Macht" },
  { tier: 7, label: "Apex", subtitle: "Herrschaft" },
  { tier: 8, label: "Archon", subtitle: "Vollendung" },
  { tier: 9, label: "Absolut", subtitle: "Transzendenz" },
];

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
