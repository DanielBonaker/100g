import { describe, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "../persistence/index.ts";
import { createAchievements } from "./index.ts";
import type { AchievementEvent } from "./index.ts";

const makePersistence = () =>
  createPersistence({ idb: new IDBFactory(), dbName: "achievements-test" });

describe("createAchievements — idempotent unlock", () => {
  it("unlock is a no-op on second call for same (gameId, achievementId)", async () => {
    const svc = await createAchievements({
      persistence: makePersistence(),
      now: () => 1000,
    });

    const events: AchievementEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.unlock("game-a", "ach-1");
    svc.unlock("game-a", "ach-1"); // duplicate — no event

    expect(events).toHaveLength(1);
    expect(events[0]!.achievementId).toBe("ach-1");
  });

  it("isUnlocked returns true after unlock", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    svc.unlock("game-a", "ach-1");
    expect(svc.isUnlocked("game-a", "ach-1")).toBe(true);
  });

  it("isUnlocked returns false for unknown achievement", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    expect(svc.isUnlocked("game-a", "ach-nope")).toBe(false);
  });
});

describe("createAchievements — getUnlocked", () => {
  it("getUnlocked(gameId) returns only that game's achievements", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    svc.unlock("game-a", "ach-1");
    svc.unlock("game-a", "ach-2");
    svc.unlock("game-b", "ach-x");

    const aUnlocked = svc.getUnlocked("game-a");
    expect(aUnlocked).toContain("ach-1");
    expect(aUnlocked).toContain("ach-2");
    expect(aUnlocked).not.toContain("ach-x");
  });

  it("getUnlocked returns empty array for game with no achievements", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    expect(svc.getUnlocked("game-never")).toHaveLength(0);
  });
});

describe("createAchievements — cross-game isolation", () => {
  it("unlock for gameA does not appear in getUnlocked(gameB)", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    svc.unlock("game-a", "shared-name");
    expect(svc.getUnlocked("game-b")).not.toContain("shared-name");
  });
});

describe("createAchievements — subscribe", () => {
  it("subscriber receives event on new unlock", async () => {
    const fixedNow = 42_000;
    const svc = await createAchievements({
      persistence: makePersistence(),
      now: () => fixedNow,
    });

    const events: AchievementEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.unlock("game-a", "ach-1");

    expect(events).toHaveLength(1);
    expect(events[0]!.gameId).toBe("game-a");
    expect(events[0]!.achievementId).toBe("ach-1");
    expect(events[0]!.unlockedAt).toBe(fixedNow);
  });

  it("subscriber does NOT receive event for duplicate unlock", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    const events: AchievementEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.unlock("game-a", "ach-1");
    svc.unlock("game-a", "ach-1");

    expect(events).toHaveLength(1);
  });

  it("subscribe returns a disposer that stops future events", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    const events: AchievementEvent[] = [];
    const dispose = svc.subscribe((e) => events.push(e));

    svc.unlock("game-a", "ach-1");
    dispose();
    svc.unlock("game-a", "ach-2");

    expect(events).toHaveLength(1);
  });
});

describe("createAchievements — persistence across sessions", () => {
  it("reloading with same persistence returns previously unlocked achievements", async () => {
    const persistence = makePersistence();

    const svc1 = await createAchievements({ persistence });
    svc1.unlock("game-a", "ach-1");

    // Force flush debounced write by loading the same key
    await persistence.load("achievements");

    // Simulate a new session
    const svc2 = await createAchievements({ persistence });
    expect(svc2.isUnlocked("game-a", "ach-1")).toBe(true);
    expect(svc2.getUnlocked("game-a")).toContain("ach-1");
  });

  it("subscribe callback count: duplicate on reload still fires no event", async () => {
    const persistence = makePersistence();

    const svc1 = await createAchievements({ persistence });
    svc1.unlock("game-a", "ach-1");
    await persistence.load("achievements"); // flush

    const svc2 = await createAchievements({ persistence });
    const events: AchievementEvent[] = [];
    svc2.subscribe((e) => events.push(e));

    // Already persisted — should be idempotent
    svc2.unlock("game-a", "ach-1");

    expect(events).toHaveLength(0);
  });
});

describe("createAchievements — multiple subscribers", () => {
  it("all subscribers are notified", async () => {
    const svc = await createAchievements({ persistence: makePersistence() });
    const received = vi.fn();
    svc.subscribe(received);
    svc.subscribe(received);

    svc.unlock("game-a", "ach-1");

    expect(received).toHaveBeenCalledTimes(2);
  });
});
