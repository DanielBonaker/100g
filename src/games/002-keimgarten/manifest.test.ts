import { describe, it, expect } from "vitest";
import { manifest } from "./manifest.ts";
import { makeRunState } from "./domain/runState.ts";

describe("Keimgarten manifest", () => {
  it("has correct game id", () => {
    expect(manifest.id).toBe("002-keimgarten");
  });

  it("has exactly 3 achievements", () => {
    expect(manifest.achievements).toHaveLength(3);
  });

  it("achievement ids are unique", () => {
    const ids = manifest.achievements.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("has the required achievement ids", () => {
    const ids = manifest.achievements.map((a) => a.id);
    expect(ids).toContain("first-fusion");
    expect(ids).toContain("first-archon");
    expect(ids).toContain("vollkommen");
  });

  it("first-fusion achievement has German title", () => {
    const ach = manifest.achievements.find((a) => a.id === "first-fusion");
    expect(ach?.title).toBe("Erste Verschmelzung");
  });

  it("first-archon achievement has German title", () => {
    const ach = manifest.achievements.find((a) => a.id === "first-archon");
    expect(ach?.title).toBe("Archon erwacht");
  });

  it("vollkommen achievement has German title", () => {
    const ach = manifest.achievements.find((a) => a.id === "vollkommen");
    expect(ach?.title).toBe("Vollkommen");
  });

  it("currencyYield is deterministic and non-negative for a fresh RunState", () => {
    // Fresh state: uniqueOwnedIds=[0] (starter Keim, tier 1) → compute = 0 + 1*2 = 2
    const state = makeRunState();
    const result = manifest.currencyYield(state);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBe(manifest.currencyYield(state)); // deterministic
    expect(result).toBe(2); // formula: floor(1/10) + 1*2 = 0 + 2 = 2
  });

  it("has a non-empty title", () => {
    expect(manifest.title.length).toBeGreaterThan(0);
  });
});
