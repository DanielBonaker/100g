export interface Passive {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly cost: number; // gold cost
  readonly tier: 1 | 2 | 3;
}

export const PASSIVES: readonly Passive[] = [
  {
    id: "skippers-bonus",
    title: "Skipper's Bonus",
    description: "Earn $8 when you skip the shop without buying.",
    cost: 5,
    tier: 1,
  },
  {
    id: "slow-pollution",
    title: "Slow Pollution",
    description: "Garbage rows arrive every 7 drops instead of 8.",
    cost: 10,
    tier: 2,
  },
  {
    id: "spare-pocket",
    title: "Spare Pocket",
    description: "Hold up to 2 blocks instead of 1.",
    cost: 10,
    tier: 2,
  },
  {
    id: "row-rebate",
    title: "Row Rebate",
    description: "Earn $1 per cleared row beyond 5 in a round.",
    cost: 5,
    tier: 1,
  },
  {
    id: "compound-interest",
    title: "Compound Interest",
    description: "Round interest cap raised to $8.",
    cost: 20,
    tier: 3,
  },
  {
    id: "deep-pockets",
    title: "Deep Pockets",
    description: "Max deck size raised to 24.",
    cost: 20,
    tier: 3,
  },
  {
    id: "starter-saver",
    title: "Starter Saver",
    description: "Removed blocks return $1 each.",
    cost: 5,
    tier: 1,
  },
  {
    id: "lucky-draw",
    title: "Lucky Draw",
    description: "Booster offers contain one rarer-effect block.",
    cost: 10,
    tier: 2,
  },
  {
    id: "iron-foundation",
    title: "Iron Foundation",
    description: "Bottom row never causes top-out via garbage shift.",
    cost: 20,
    tier: 3,
  },
];

export const findPassive = (id: string): Passive | null =>
  PASSIVES.find((p) => p.id === id) ?? null;
