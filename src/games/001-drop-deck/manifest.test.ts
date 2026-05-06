import { describe, it, expect } from "vitest";
import { manifest } from "./manifest.ts";
import { makeRunState } from "./domain/board.ts";

describe("Drop Deck manifest", () => {
  it("has the correct id", () => {
    expect(manifest.id).toBe("001-drop-deck");
  });

  it("has the correct title", () => {
    expect(manifest.title).toBe("Drop Deck");
  });

  it("has exactly 3 achievements", () => {
    expect(manifest.achievements).toHaveLength(3);
  });

  it("all achievement ids are non-empty strings", () => {
    for (const ach of manifest.achievements) {
      expect(typeof ach.id).toBe("string");
      expect(ach.id.length).toBeGreaterThan(0);
    }
  });

  it("currencyYield is a function returning a non-negative number", () => {
    const state = makeRunState();
    const result = manifest.currencyYield(state);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("currencyYield returns a non-negative number for a state with commits", () => {
    const state = { ...makeRunState(), committedBlocks: 50 };
    const result = manifest.currencyYield(state);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
