import { describe, it, expect } from "vitest";
import { hitTestCreatures } from "./controller.ts";
import type { OwnedCreature } from "../domain/runState.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCreature = (
  instanceId: number,
  creatureId: number,
  x: number,
  y: number,
): OwnedCreature => ({
  instanceId,
  creatureId,
  position: { x, y },
  state: "idle",
  stateUntil: 30,
  facing: 1,
  seed: 12345,
  walkTargetX: x,
  walkTargetY: y,
});

// ---------------------------------------------------------------------------
// hitTestCreatures
// ---------------------------------------------------------------------------

describe("hitTestCreatures", () => {
  it("returns null when no creatures exist", () => {
    const result = hitTestCreatures(100, 100, 7, []);
    expect(result).toBeNull();
  });

  it("returns null when tap is outside any creature's hit-radius", () => {
    // Creature at native (10, 20), zoom=7 → screen (70, 140) centre of pixel
    // Tap at screen (0, 0) — far away
    const creature = makeCreature(1, 0, 10, 20);
    const result = hitTestCreatures(0, 0, 7, [creature]);
    expect(result).toBeNull();
  });

  it("returns the creature when tap lands on its native pixel (zoom=7)", () => {
    const creature = makeCreature(1, 0, 10, 20);
    // Tap at native (10, 20) → screen (70, 140) at zoom=7
    const screenX = 10 * 7;
    const screenY = 20 * 7;
    const result = hitTestCreatures(screenX, screenY, 7, [creature]);
    expect(result).not.toBeNull();
    expect(result!.instanceId).toBe(1);
    expect(result!.creatureId).toBe(0);
  });

  it("returns the creature when tap is within HIT_RADIUS_NATIVE at zoom=7", () => {
    const creature = makeCreature(1, 0, 10, 20);
    // Tap 3 native pixels away — well within HIT_RADIUS_NATIVE=4
    const screenX = (10 + 3) * 7;
    const screenY = 20 * 7;
    const result = hitTestCreatures(screenX, screenY, 7, [creature]);
    expect(result).not.toBeNull();
  });

  it("hit-radius ensures ≥ 44 screen px at 7× zoom", () => {
    // HIT_RADIUS_NATIVE = 4 native px → diameter = 9 native px → 9*7 = 63 screen px ≥ 44
    const creature = makeCreature(1, 0, 20, 20);
    // Tap exactly HIT_RADIUS_NATIVE native px away
    const screenX = (20 + 4) * 7; // 4 native px offset
    const screenY = 20 * 7;
    const result = hitTestCreatures(screenX, screenY, 7, [creature]);
    expect(result).not.toBeNull();
  });

  it("returns null when tap is beyond HIT_RADIUS_NATIVE", () => {
    const creature = makeCreature(1, 0, 10, 20);
    // Tap 5 native px away — beyond HIT_RADIUS_NATIVE=4
    const screenX = (10 + 5) * 7;
    const screenY = 20 * 7;
    const result = hitTestCreatures(screenX, screenY, 7, [creature]);
    expect(result).toBeNull();
  });

  it("multiple creatures — returns the last-added (highest index) when both in range", () => {
    const c1 = makeCreature(1, 0, 10, 20);
    const c2 = makeCreature(2, 1, 10, 20); // same position
    // Tap exactly on position
    const result = hitTestCreatures(10 * 7, 20 * 7, 7, [c1, c2]);
    expect(result).not.toBeNull();
    // c2 is last in array — it's the "topmost" (rendered last = on top)
    expect(result!.instanceId).toBe(2);
  });

  it("multiple creatures — returns the one the tap is closer to", () => {
    const c1 = makeCreature(1, 0, 5, 20);
    const c2 = makeCreature(2, 1, 30, 20);
    // Tap near c1
    const result = hitTestCreatures(5 * 7, 20 * 7, 7, [c1, c2]);
    expect(result!.instanceId).toBe(1);
  });

  it("works at zoom=10", () => {
    const creature = makeCreature(1, 0, 15, 15);
    const screenX = 15 * 10;
    const screenY = 15 * 10;
    const result = hitTestCreatures(screenX, screenY, 10, [creature]);
    expect(result).not.toBeNull();
    expect(result!.instanceId).toBe(1);
  });
});
