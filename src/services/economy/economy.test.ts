import { describe, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "../persistence/index.ts";
import { createEconomy } from "./index.ts";
import type { EconomyEvent } from "./index.ts";

const makePersistence = () =>
  createPersistence({ idb: new IDBFactory(), dbName: "economy-test" });

describe("createEconomy — getBalance", () => {
  it("initial balance is 0", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    expect(svc.getBalance()).toBe(0);
  });

  it("addYield updates balance", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 50);
    expect(svc.getBalance()).toBe(50);
  });

  it("multiple addYield calls accumulate", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 30);
    svc.addYield("game-a", 20);
    expect(svc.getBalance()).toBe(50);
  });
});

describe("createEconomy — cross-game accumulation", () => {
  it("yields from multiple games sum into a single balance", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 5);
    svc.addYield("game-b", 7);
    expect(svc.getBalance()).toBe(12);
  });
});

describe("createEconomy — validation", () => {
  it("addYield throws for negative amounts", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    expect(() => {
      svc.addYield("game-a", -1);
    }).toThrow();
  });

  it("addYield accepts 0 without throwing", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    expect(() => {
      svc.addYield("game-a", 0);
    }).not.toThrow();
    expect(svc.getBalance()).toBe(0);
  });
});

describe("createEconomy — subscribe", () => {
  it("subscriber receives event after addYield", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    const events: EconomyEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.addYield("game-a", 100);

    expect(events).toHaveLength(1);
    expect(events[0]!.gameId).toBe("game-a");
    expect(events[0]!.amount).toBe(100);
    expect(events[0]!.newBalance).toBe(100);
  });

  it("subscribe returns a disposer that stops future events", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    const events: EconomyEvent[] = [];
    const dispose = svc.subscribe((e) => events.push(e));

    svc.addYield("game-a", 50);
    dispose();
    svc.addYield("game-a", 50);

    expect(events).toHaveLength(1);
  });

  it("multiple subscribers are all notified", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    const received = vi.fn();
    svc.subscribe(received);
    svc.subscribe(received);

    svc.addYield("game-a", 10);

    expect(received).toHaveBeenCalledTimes(2);
  });
});

describe("createEconomy — spend", () => {
  it("spend deducts from balance when sufficient funds; returns true", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 50);
    const result = svc.spend("game-a", 20);
    expect(result).toBe(true);
    expect(svc.getBalance()).toBe(30);
  });

  it("spend returns false when balance < amount; no mutation", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 10);
    const result = svc.spend("game-a", 20);
    expect(result).toBe(false);
    expect(svc.getBalance()).toBe(10); // unchanged
  });

  it("spend returns false when balance === 0; no mutation", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    const result = svc.spend("game-a", 1);
    expect(result).toBe(false);
    expect(svc.getBalance()).toBe(0);
  });

  it("spend deducts exactly the price (no under/over)", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 120);
    svc.spend("game-a", 120);
    expect(svc.getBalance()).toBe(0);
  });

  it("spend with amount <= 0 throws RangeError", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 50);
    expect(() => svc.spend("game-a", 0)).toThrow(RangeError);
    expect(() => svc.spend("game-a", -1)).toThrow(RangeError);
  });

  it("spend notifies subscribers with negative amount and new balance", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 100);

    const events: EconomyEvent[] = [];
    svc.subscribe((e) => events.push(e));

    svc.spend("game-a", 30);

    expect(events).toHaveLength(1);
    expect(events[0]!.amount).toBe(-30);
    expect(events[0]!.newBalance).toBe(70);
    expect(events[0]!.gameId).toBe("game-a");
  });

  it("failed spend does NOT notify subscribers", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 5);

    const handler = vi.fn();
    svc.subscribe(handler);

    const result = svc.spend("game-a", 100);
    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("multiple sequential spends accumulate correctly", async () => {
    const svc = await createEconomy({ persistence: makePersistence() });
    svc.addYield("game-a", 50);
    svc.spend("game-a", 10);
    svc.spend("game-a", 10);
    svc.spend("game-a", 10);
    expect(svc.getBalance()).toBe(20);
  });
});

describe("createEconomy — persistence across sessions", () => {
  it("reloading with same persistence returns the previous balance", async () => {
    const persistence = makePersistence();

    const svc1 = await createEconomy({ persistence });
    svc1.addYield("game-a", 75);

    // Flush debounced write
    await persistence.load("economy");

    const svc2 = await createEconomy({ persistence });
    expect(svc2.getBalance()).toBe(75);
  });

  it("balance from two games persists and accumulates correctly after reload", async () => {
    const persistence = makePersistence();

    const svc1 = await createEconomy({ persistence });
    svc1.addYield("game-a", 40);
    svc1.addYield("game-b", 60);
    await persistence.load("economy"); // flush

    const svc2 = await createEconomy({ persistence });
    expect(svc2.getBalance()).toBe(100);
  });
});
