import { describe, it, expect } from "vitest";
import { manifest } from "./manifest.ts";

describe("Hello World manifest", () => {
  it("has the correct id", () => {
    expect(manifest.id).toBe("000-hello-world");
  });

  it("has the correct title", () => {
    expect(manifest.title).toBe("Hello World");
  });

  it("has exactly 3 achievements", () => {
    expect(manifest.achievements).toHaveLength(3);
  });

  it("has the correct achievement ids per spec", () => {
    const ids = manifest.achievements.map((a) => a.id);
    expect(ids).toContain("hw-tap-5");
    expect(ids).toContain("hw-tap-25");
    expect(ids).toContain("hw-tap-100");
  });

  it("all achievement ids are non-empty strings", () => {
    for (const ach of manifest.achievements) {
      expect(typeof ach.id).toBe("string");
      expect(ach.id.length).toBeGreaterThan(0);
    }
  });
});

describe("Hello World manifest — currencyYield", () => {
  it("returns 0 regardless of run state", () => {
    expect(manifest.currencyYield({ totalTaps: 0, sessionTaps: 0 })).toBe(0);
    expect(manifest.currencyYield({ totalTaps: 999, sessionTaps: 999 })).toBe(
      0,
    );
  });
});
