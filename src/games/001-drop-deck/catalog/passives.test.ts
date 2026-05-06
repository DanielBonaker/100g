import { describe, it, expect } from "vitest";
import { PASSIVES, findPassive } from "./passives.ts";

describe("PASSIVES catalog", () => {
  it("contains exactly 9 entries", () => {
    expect(PASSIVES.length).toBe(9);
  });

  it("all ids are unique", () => {
    const ids = PASSIVES.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all entries have a non-empty title", () => {
    for (const p of PASSIVES) {
      expect(p.title.length).toBeGreaterThan(0);
    }
  });

  it("all entries have a non-empty description", () => {
    for (const p of PASSIVES) {
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("all entries have cost > 0", () => {
    for (const p of PASSIVES) {
      expect(p.cost).toBeGreaterThan(0);
    }
  });

  it("all entries have tier in {1, 2, 3}", () => {
    for (const p of PASSIVES) {
      expect([1, 2, 3]).toContain(p.tier);
    }
  });
});

describe("findPassive", () => {
  it("returns the passive for a known id", () => {
    const result = findPassive("skippers-bonus");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("skippers-bonus");
  });

  it("returns null for an unknown id", () => {
    const result = findPassive("unknown-passive");
    expect(result).toBeNull();
  });

  it("returns compound-interest passive correctly", () => {
    const result = findPassive("compound-interest");
    expect(result?.tier).toBe(3);
    expect(result?.cost).toBe(20);
  });
});
