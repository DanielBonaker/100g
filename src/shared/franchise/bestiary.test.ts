import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BESTIARY,
  BESTIARY_SIZE,
  TIER_COUNTS,
  TIER_META,
  type CreatureShape,
  type FranchiseTier,
} from "./index.ts";

describe("BESTIARY data", () => {
  it("contains exactly 167 creatures", () => {
    expect(BESTIARY).toHaveLength(BESTIARY_SIZE);
    expect(BESTIARY_SIZE).toBe(167);
  });

  it("has unique ids 0..166", () => {
    const ids = BESTIARY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBe(0);
    expect(Math.max(...ids)).toBe(166);
  });

  it("each creature's cells.length matches its tier", () => {
    for (const c of BESTIARY) {
      expect(c.cells.length).toBe(c.tier);
    }
  });

  it("every cell coord is within the 3×3 grid (0..2)", () => {
    for (const c of BESTIARY) {
      for (const [r, col] of c.cells) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(2);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThanOrEqual(2);
      }
    }
  });

  it("every creature's cells are distinct (no duplicate positions)", () => {
    for (const c of BESTIARY) {
      const seen = new Set(
        c.cells.map(([r, col]) => `${r.toString()},${col.toString()}`),
      );
      expect(seen.size).toBe(c.cells.length);
    }
  });

  it("every creature is connected via king-adjacency on the 3×3 grid", () => {
    const isKingAdjacent = (
      a: readonly [number, number],
      b: readonly [number, number],
    ): boolean => {
      const [ar, ac] = a;
      const [br, bc] = b;
      const dr = Math.abs(ar - br);
      const dc = Math.abs(ac - bc);
      return dr <= 1 && dc <= 1 && dr + dc > 0;
    };

    for (const c of BESTIARY) {
      if (c.cells.length === 1) continue;
      const visited = new Set<number>([0]);
      const stack = [0];
      while (stack.length > 0) {
        const i = stack.pop();
        if (i === undefined) break;
        const here = c.cells[i];
        if (here === undefined) continue;
        for (let j = 0; j < c.cells.length; j++) {
          if (visited.has(j)) continue;
          const there = c.cells[j];
          if (there === undefined) continue;
          if (isKingAdjacent(here, there)) {
            visited.add(j);
            stack.push(j);
          }
        }
      }
      expect(visited.size).toBe(c.cells.length);
    }
  });

  it("matches the per-tier count distribution 1-3-12-32-49-42-21-6-1", () => {
    const counts = new Map<FranchiseTier, number>();
    for (const c of BESTIARY) {
      counts.set(c.tier, (counts.get(c.tier) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual(TIER_COUNTS);
    const total = Object.values(TIER_COUNTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(167);
  });

  it("every creature has a non-empty German name", () => {
    for (const c of BESTIARY) {
      expect(c.nameDe.length).toBeGreaterThan(0);
    }
  });

  it("the size-9 creature is named 'Vollkommen' (id 166)", () => {
    const absolut = BESTIARY.filter((c) => c.tier === 9);
    expect(absolut).toHaveLength(1);
    const v: CreatureShape | undefined = absolut[0];
    expect(v).toBeDefined();
    expect(v?.id).toBe(166);
    expect(v?.nameDe).toBe("Vollkommen");
    expect(v?.cells).toHaveLength(9);
  });

  it("the size-1 creature is named 'Keim' (id 0)", () => {
    const keim = BESTIARY.filter((c) => c.tier === 1);
    expect(keim).toHaveLength(1);
    expect(keim[0]?.id).toBe(0);
    expect(keim[0]?.nameDe).toBe("Keim");
  });
});

describe("TIER_META", () => {
  it("has metadata for all 9 tiers in order", () => {
    expect(TIER_META).toHaveLength(9);
    for (let i = 0; i < 9; i++) {
      expect(TIER_META[i]?.tier).toBe(i + 1);
    }
  });

  it("uses the canonical German tier labels", () => {
    const labels = TIER_META.map((m) => m.label);
    expect(labels).toEqual([
      "Keim",
      "Bund",
      "Funke",
      "Gestalt",
      "Wesen",
      "Titan",
      "Apex",
      "Archon",
      "Absolut",
    ]);
  });
});

describe("BESTIARY ↔ docs/franchise/bestiary.jsx sync", () => {
  it("matches the JSX viewer's data array exactly (id, tier, cells, name, mirror flag)", async () => {
    const jsxPath = resolve(
      fileURLToPath(import.meta.url),
      "../../../../docs/franchise/bestiary.jsx",
    );
    const src = readFileSync(jsxPath, "utf8");

    const startMarker = "const D = [";
    const startIdx = src.indexOf(startMarker);
    expect(startIdx).toBeGreaterThan(-1);

    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx + startMarker.length - 1; i < src.length; i++) {
      const ch = src[i];
      if (ch === "[") depth += 1;
      else if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }
    expect(endIdx).toBeGreaterThan(-1);

    const arrayLiteral = src.slice(startIdx + "const D = ".length, endIdx);
    const tempUrl = `data:text/javascript,export const D = ${encodeURIComponent(arrayLiteral)};`;
    const mod = (await import(/* @vite-ignore */ tempUrl)) as {
      D: readonly [
        number,
        number,
        readonly (readonly [number, number])[],
        string,
        boolean,
      ][];
    };
    const D = mod.D;

    expect(D).toHaveLength(BESTIARY.length);
    for (let i = 0; i < D.length; i++) {
      const tuple = D[i]!;
      const shape = BESTIARY[i]!;
      expect(shape.id).toBe(tuple[0]);
      expect(shape.tier).toBe(tuple[1]);
      expect(shape.cells.map(([r, c]) => [r, c])).toEqual(
        tuple[2].map(([r, c]) => [r, c]),
      );
      expect(shape.nameDe).toBe(tuple[3]);
      expect(shape.mirrorSymmetric).toBe(tuple[4]);
    }
  });
});
