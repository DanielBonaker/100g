import { describe, it, expect } from "vitest";
import { manifest } from "./manifest.ts";

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

  it("currencyYield returns 0", () => {
    // Cast to satisfy the generic RunState parameter — yield is always 0 in this slice.
    expect(
      manifest.currencyYield(
        {} as Parameters<typeof manifest.currencyYield>[0],
      ),
    ).toBe(0);
  });

  it("has a non-empty title", () => {
    expect(manifest.title.length).toBeGreaterThan(0);
  });
});
