// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CATALOG } from "./blocks.ts";
import { BESTIARY } from "../../../shared/franchise/index.ts";

describe("CATALOG", () => {
  it("has between 140 and 150 entries (28-30 creatures × 5 effects)", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(140);
    expect(CATALOG.length).toBeLessThanOrEqual(150);
  });

  it("every entry's bestiaryId references a valid bestiary entry", () => {
    for (const block of CATALOG) {
      expect(block.bestiaryId).toBeDefined();
      const entry = BESTIARY[block.bestiaryId!];
      expect(entry).toBeDefined();
    }
  });

  it("every entry's cellCount matches the bestiary entry's cell count", () => {
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (!entry)
        throw new Error(
          `missing bestiary entry for id ${String(block.bestiaryId)}`,
        );
      expect(block.cellCount).toBe(entry.cells.length);
    }
  });

  it("every entry's cells array length matches cellCount", () => {
    for (const block of CATALOG) {
      expect(block.cells.length).toBe(block.cellCount);
    }
  });

  it("every entry's cellCount matches the tier (tier=1 → 1 cell, ..., tier=9 → 9 cells)", () => {
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (!entry)
        throw new Error(
          `missing bestiary entry for id ${String(block.bestiaryId)}`,
        );
      expect(entry.cells.length).toBe(entry.tier);
    }
  });

  it("every entry has a unique id", () => {
    const ids = CATALOG.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("ids follow the <tier>-<slug>-<effectId> format", () => {
    const VALID_EFFECTS = new Set([
      "standard",
      "ghost",
      "melt",
      "impact",
      "rain",
    ]);
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (!entry)
        throw new Error(
          `missing bestiary entry for id ${String(block.bestiaryId)}`,
        );
      const tier = entry.tier;
      // id must start with "<tier>-"
      expect(block.id).toMatch(new RegExp(`^${String(tier)}-`));
      // id must end with "-<effectId>"
      const effectSuffix = VALID_EFFECTS.has(block.effectId)
        ? block.effectId
        : null;
      expect(effectSuffix).not.toBeNull();
      expect(block.id).toMatch(new RegExp(`-${block.effectId}$`));
    }
  });

  it("displayName matches bestiary German name verbatim", () => {
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (!entry)
        throw new Error(
          `missing bestiary entry for id ${String(block.bestiaryId)}`,
        );
      expect((block as { displayName?: string }).displayName).toBe(
        entry.nameDe,
      );
    }
  });

  it("contains entries from tiers 1 through 9 (all tiers represented)", () => {
    const tiersPresent = new Set<number>();
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (entry) tiersPresent.add(entry.tier);
    }
    for (let tier = 1; tier <= 9; tier++) {
      expect(tiersPresent.has(tier)).toBe(true);
    }
  });

  it("has all 5 effect variants per creature", () => {
    const EXPECTED_EFFECTS = ["standard", "ghost", "melt", "impact", "rain"];
    // Group by bestiaryId
    const byCreature = new Map<number, Set<string>>();
    for (const block of CATALOG) {
      const bId = block.bestiaryId!;
      if (!byCreature.has(bId)) byCreature.set(bId, new Set());
      byCreature.get(bId)!.add(block.effectId);
    }
    for (const [, effects] of byCreature) {
      for (const effect of EXPECTED_EFFECTS) {
        expect(effects.has(effect)).toBe(true);
      }
    }
  });

  it("tier distribution: ~8 Small (1-3), ~12 Medium (4-5), ~8 Large (6-9)", () => {
    const creaturesByTier = new Map<number, Set<number>>();
    for (const block of CATALOG) {
      const entry = BESTIARY[block.bestiaryId!];
      if (!entry) continue;
      const tier = entry.tier;
      if (!creaturesByTier.has(tier)) creaturesByTier.set(tier, new Set());
      creaturesByTier.get(tier)!.add(entry.id);
    }

    const countCreaturesInTierRange = (lo: number, hi: number): number => {
      let count = 0;
      for (let t = lo; t <= hi; t++) {
        count += creaturesByTier.get(t)?.size ?? 0;
      }
      return count;
    };

    const small = countCreaturesInTierRange(1, 3);
    const medium = countCreaturesInTierRange(4, 5);
    const large = countCreaturesInTierRange(6, 9);

    expect(small).toBeGreaterThanOrEqual(6);
    expect(small).toBeLessThanOrEqual(10);
    expect(medium).toBeGreaterThanOrEqual(10);
    expect(medium).toBeLessThanOrEqual(14);
    expect(large).toBeGreaterThanOrEqual(6);
    expect(large).toBeLessThanOrEqual(10);
  });
});
