import { BESTIARY } from "../../../shared/franchise/bestiary.ts";
import type { Block, EffectId } from "../domain/block.ts";

const EFFECT_IDS: readonly EffectId[] = [
  "standard",
  "ghost",
  "melt",
  "impact",
  "rain",
];

// Curated subset of bestiary creatures.
// Tier layout (bestiary ids):
//   tier 1 (Keim)    — id 0        (1 entry)
//   tier 2 (Bund)    — ids 1-3     (3 entries)
//   tier 3 (Funke)   — ids 4-15    (12 entries)
//   tier 4 (Gestalt) — ids 16-47   (32 entries)
//   tier 5 (Wesen)   — ids 48-96   (49 entries)
//   tier 6 (Titan)   — ids 97-138  (42 entries)
//   tier 7 (Apex)    — ids 139-159 (21 entries)
//   tier 8 (Archon)  — ids 160-165 (6 entries)
//   tier 9 (Absolut) — id 166      (1 entry)
const CURATED_BESTIARY_IDS: readonly number[] = [
  // Small (tier 1-3): 8 creatures — 1 Keim + 3 Bund + 4 Funke
  0, // tier 1: Keim
  1,
  2,
  3, // tier 2: Zwilling, Säule, Schrägling
  4,
  5,
  6,
  7, // tier 3: Strich, Haken, Stufe, Brücke

  // Medium (tier 4-5): 12 creatures — 6 Gestalt + 6 Wesen
  16,
  17,
  18,
  19,
  20,
  21, // tier 4
  48,
  49,
  50,
  51,
  52,
  53, // tier 5

  // Large (tier 6-9): 8 creatures — 4 Titan + 2 Apex + 1 Archon + 1 Absolut
  97,
  98,
  99,
  100, // tier 6
  139,
  140, // tier 7
  160, // tier 8
  166, // tier 9
];

// Helper: convert Cell [row, col] → BlockCellOffset { dx, dy }
const cellToOffset = (
  cell: readonly [number, number],
): { dx: number; dy: number } => {
  const [row, col] = cell;
  return { dx: col, dy: row };
};

// Helper: slugify German name (lowercase, replace umlauts and spaces)
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildCatalog = (): readonly Block[] => {
  const result: Block[] = [];
  for (const bestiaryId of CURATED_BESTIARY_IDS) {
    const creature = BESTIARY[bestiaryId];
    if (creature === undefined) continue;
    const tier = creature.tier;
    const slug = slugify(creature.nameDe);
    const cellOffsets = creature.cells.map(cellToOffset);
    for (const effectId of EFFECT_IDS) {
      result.push({
        id: `${String(tier)}-${slug}-${effectId}`,
        bestiaryId,
        cellCount: creature.cells.length,
        cells: cellOffsets,
        effectId,
        displayName: creature.nameDe,
      });
    }
  }
  return result;
};

export const CATALOG: readonly Block[] = buildCatalog();
