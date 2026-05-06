import { describe, it, expect } from "vitest";
import {
  makeRunState,
  isRunState,
  SCHEMA_VERSION,
  STARTER_INSTANCE_ID,
} from "./runState.ts";

describe("makeRunState", () => {
  it("returns a valid RunState with schemaVersion=1", () => {
    const s = makeRunState();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.schemaVersion).toBe(1);
  });

  it("contains starter Keim (creatureId=0, instanceId=1)", () => {
    const s = makeRunState();
    expect(s.owned).toHaveLength(1);
    const keim = s.owned[0];
    expect(keim).toBeDefined();
    expect(keim!.creatureId).toBe(0);
    expect(keim!.instanceId).toBe(STARTER_INSTANCE_ID);
  });

  it("starter Keim starts with idle state", () => {
    const s = makeRunState();
    expect(s.owned[0]!.state).toBe("idle");
  });

  it("starts at tick 0 with nextInstanceId=2", () => {
    const s = makeRunState();
    expect(s.tick).toBe(0);
    expect(s.nextInstanceId).toBe(2);
  });

  it("accepts a custom rngSeed", () => {
    const s = makeRunState("my-seed");
    expect(s.rngState).toBe("my-seed");
  });

  it("uses default seed when no rngSeed provided", () => {
    const s = makeRunState();
    expect(typeof s.rngState).toBe("string");
    expect(s.rngState.length).toBeGreaterThan(0);
  });

  it("starter Keim position is in the play area (y=8..63)", () => {
    const s = makeRunState();
    const pos = s.owned[0]!.position;
    expect(pos.y).toBeGreaterThanOrEqual(8);
    expect(pos.y).toBeLessThanOrEqual(63);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(47);
  });
});

describe("isRunState", () => {
  it("returns true for a valid RunState", () => {
    const s = makeRunState();
    expect(isRunState(s)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRunState(null)).toBe(false);
  });

  it("returns false for missing schemaVersion", () => {
    const s = makeRunState();
    const { schemaVersion: _sv, ...rest } = s;
    expect(isRunState(rest)).toBe(false);
  });

  it("returns false for wrong schemaVersion type", () => {
    expect(isRunState({ ...makeRunState(), schemaVersion: "1" })).toBe(false);
  });

  it("returns false when owned contains a creature missing instanceId", () => {
    const s = makeRunState();
    const bad = {
      ...s,
      owned: [{ ...s.owned[0], instanceId: undefined }],
    };
    expect(isRunState(bad)).toBe(false);
  });

  it("returns false for invalid facing value", () => {
    const s = makeRunState();
    const bad = {
      ...s,
      owned: [{ ...s.owned[0], facing: 0 }],
    };
    expect(isRunState(bad)).toBe(false);
  });
});
