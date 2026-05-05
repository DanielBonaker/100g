// @vitest-environment happy-dom
/**
 * Persistence service tests.
 * Uses fake-indexeddb to provide a real IDBFactory in happy-dom.
 *
 * Debounce tests use the schedule/cancelSchedule injection points rather than
 * vi.useFakeTimers(), which conflicts with fake-indexeddb's internal setImmediate
 * scheduling. The injected scheduler gives us deterministic control without
 * touching the global timer environment.
 */
import { describe, it, expect } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createPersistence } from "./persistence.ts";
import type { PersistenceOptions } from "./persistence.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fresh IDBFactory instance — isolated per test. */
const makeFakeIdb = (): IDBFactory => new IDBFactory();

/**
 * A controllable scheduler: returns an object that lets you manually fire the
 * pending callback at any time (simulating time advancing).
 */
interface FakeScheduler {
  /** Pass to createPersistence as schedule/cancelSchedule. */
  opts: Pick<PersistenceOptions, "schedule" | "cancelSchedule">;
  /**
   * Advance virtual time by `ms`. Fires any timer whose deadline has been reached.
   * Returns after all microtasks have settled.
   */
  advanceBy(ms: number): Promise<void>;
  /** Fire all pending timers immediately (shortcut for loading IDB state). */
  flushAll(): Promise<void>;
  /** Current virtual time. */
  now: number;
}

const makeFakeScheduler = (): FakeScheduler => {
  let now = 0;
  const timers = new Map<
    number,
    { deadline: number; fn: () => void; cancelled: boolean }
  >();
  let nextId = 1;

  const schedule = (fn: () => void, ms: number): number => {
    const id = nextId++;
    timers.set(id, { deadline: now + ms, fn, cancelled: false });
    return id;
  };

  const cancelSchedule = (handle: unknown): void => {
    const entry = timers.get(handle as number);
    if (entry !== undefined) entry.cancelled = true;
  };

  const advanceBy = async (ms: number): Promise<void> => {
    const target = now + ms;
    // Fire timers in deadline order, but only up to `target`
    let fired = true;
    while (fired) {
      fired = false;
      const ready: { id: number; deadline: number; fn: () => void }[] = [];
      for (const [id, entry] of timers) {
        if (!entry.cancelled && entry.deadline <= target) {
          ready.push({ id, deadline: entry.deadline, fn: entry.fn });
        }
      }
      ready.sort((a, b) => a.deadline - b.deadline);
      for (const { id, fn } of ready) {
        timers.delete(id);
        now = Math.max(now, target); // advance before firing
        fn();
        fired = true;
        // Yield to let promises (IDB microtasks) settle
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
    }
    now = target;
    // Extra yield to allow IDB callbacks to settle
    await Promise.resolve();
    await Promise.resolve();
  };

  const flushAll = async (): Promise<void> => {
    let fired = true;
    while (fired) {
      fired = false;
      for (const [id, entry] of timers) {
        if (!entry.cancelled) {
          timers.delete(id);
          entry.fn();
          fired = true;
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        }
      }
    }
    await Promise.resolve();
    await Promise.resolve();
  };

  return {
    opts: { schedule, cancelSchedule },
    advanceBy,
    flushAll,
    get now() {
      return now;
    },
  };
};

// ---------------------------------------------------------------------------
// 1. Round-trip: complex object survives save → load
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  it("saves a complex object and loads it back with deep equality", async () => {
    const idb = makeFakeIdb();
    const store = createPersistence({ idb });

    const value = {
      num: 42,
      str: "hello",
      arr: [1, 2, 3],
      nested: { a: true, b: null },
      date: new Date("2026-01-01T00:00:00Z"),
      map: new Map([["x", 1]] as [string, number][]),
    };

    await store.save("k", value);
    const loaded = await store.load<typeof value>("k");

    expect(loaded).not.toBeNull();
    expect(loaded).not.toBe(value); // separate reference
    expect(loaded!.num).toBe(42);
    expect(loaded!.str).toBe("hello");
    expect(loaded!.arr).toEqual([1, 2, 3]);
    expect(loaded!.nested).toEqual({ a: true, b: null });
    expect(loaded!.date).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(loaded!.map).toEqual(new Map([["x", 1]]));
  });

  it("load returns null for an unknown key", async () => {
    const idb = makeFakeIdb();
    const store = createPersistence({ idb });
    expect(await store.load("missing")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. RNG-state determinism proxy test: data survives simulated refresh
// ---------------------------------------------------------------------------

describe("RNG-state determinism", () => {
  it("preserves rngState across simulated refresh (new persistence instance, same idb)", async () => {
    const idb = makeFakeIdb();
    const storeA = createPersistence({ idb, dbName: "rng-test" });

    const rngPayload = {
      rngState: "seed:abc:counter:42",
      sequence: [0.1, 0.2, 0.3],
    };

    await storeA.save("rng-key", rngPayload);

    // Simulate refresh by opening a new instance against the same idb
    const storeB = createPersistence({ idb, dbName: "rng-test" });
    const loaded = await storeB.load<typeof rngPayload>("rng-key");

    expect(loaded).not.toBeNull();
    expect(loaded!.rngState).toBe("seed:abc:counter:42");
    expect(loaded!.sequence).toEqual([0.1, 0.2, 0.3]);
  });
});

// ---------------------------------------------------------------------------
// 3. Debounce coalesces multiple rapid saves to one write
// ---------------------------------------------------------------------------

describe("debounce — coalesces rapid saves", () => {
  it("three rapid saves coalesce into one write; load returns the last value", async () => {
    const idb = makeFakeIdb();
    let writeCount = 0;

    const sched = makeFakeScheduler();
    const store = createPersistence({
      idb,
      ...sched.opts,
      onWrite: () => {
        writeCount++;
      },
    });

    const p1 = store.save("k", "v1", { debounceMs: 50 });
    const p2 = store.save("k", "v2", { debounceMs: 50 });
    const p3 = store.save("k", "v3", { debounceMs: 50 });

    // Nothing written yet — debounce window not elapsed
    expect(writeCount).toBe(0);

    // Advance time past the debounce window
    await sched.advanceBy(60);

    await Promise.all([p1, p2, p3]);

    // Exactly one write should have happened
    expect(writeCount).toBe(1);

    // The stored value should be v3 (the last one)
    const val = await store.load<string>("k");
    expect(val).toBe("v3");
  });
});

// ---------------------------------------------------------------------------
// 4. Debounce window resets on new save within window
// ---------------------------------------------------------------------------

describe("debounce — timer resets on new save", () => {
  it("save at t=0, save at t=30 resets window to t=80, no flush at t=50", async () => {
    const idb = makeFakeIdb();
    let writeCount = 0;

    const sched = makeFakeScheduler();
    const store = createPersistence({
      idb,
      ...sched.opts,
      onWrite: () => {
        writeCount++;
      },
    });

    // t=0: first save
    const p1 = store.save("k", "a", { debounceMs: 50 });

    // t=30: a second save within the window — resets the timer
    await sched.advanceBy(30);
    const p2 = store.save("k", "b", { debounceMs: 50 });

    // t=50 total — original timer would have fired, but it was cancelled
    await sched.advanceBy(20);
    expect(writeCount).toBe(0);

    // t=80 — reset timer fires
    await sched.advanceBy(30);
    await Promise.all([p1, p2]);

    expect(writeCount).toBe(1);

    const val = await store.load<string>("k");
    expect(val).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// 5. Different keys debounce independently
// ---------------------------------------------------------------------------

describe("debounce — independent keys", () => {
  it("saves to keys 'a' and 'b' each flush their own value once", async () => {
    const idb = makeFakeIdb();
    let writeCount = 0;

    const sched = makeFakeScheduler();
    const store = createPersistence({
      idb,
      ...sched.opts,
      onWrite: () => {
        writeCount++;
      },
    });

    const pa = store.save("a", "val-a", { debounceMs: 50 });
    const pb = store.save("b", "val-b", { debounceMs: 50 });

    await sched.advanceBy(60);
    await Promise.all([pa, pb]);

    // Two distinct keys → two writes
    expect(writeCount).toBe(2);
    expect(await store.load<string>("a")).toBe("val-a");
    expect(await store.load<string>("b")).toBe("val-b");
  });
});

// ---------------------------------------------------------------------------
// 6. Load flushes pending debounced save
// ---------------------------------------------------------------------------

describe("debounce — load flushes pending write", () => {
  it("load immediately after debounced save returns the saved value without waiting", async () => {
    const idb = makeFakeIdb();

    const sched = makeFakeScheduler();
    const store = createPersistence({
      idb,
      ...sched.opts,
    });

    const savePromise = store.save("k", "early", { debounceMs: 100 });
    // load should trigger an immediate flush (no need to advance the scheduler)
    const val = await store.load<string>("k");

    expect(val).toBe("early");
    await savePromise;
  });
});

// ---------------------------------------------------------------------------
// 7. Migration: schema version bump with contrived migration
// ---------------------------------------------------------------------------

describe("migration runner", () => {
  it("runs a migration from v1 to v2 — renames key 'old' to 'new'", async () => {
    const idb = makeFakeIdb();

    // Seed data at v1 — close connection by not reusing the persistence object
    await createPersistence({
      idb,
      dbName: "migration-test",
      schemaVersion: 1,
    }).save("old", "original-value");

    // Upgrade to v2 with a migration that reads "old" and writes "new"
    const storeV2 = createPersistence({
      idb,
      dbName: "migration-test",
      schemaVersion: 2,
      migrations: [
        {
          fromVersion: 1,
          toVersion: 2,
          migrate: async (store) => {
            const val = await store.load<string>("old");
            if (val !== null) {
              await store.save("new", val);
              await store.delete("old");
            }
          },
        },
      ],
    });

    // "new" should exist, "old" should not
    expect(await storeV2.load("new")).toBe("original-value");
    expect(await storeV2.load("old")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Delete cancels pending debounced save
// ---------------------------------------------------------------------------

describe("delete — cancels pending debounced save", () => {
  it("delete after debounced save prevents the value from being written", async () => {
    const idb = makeFakeIdb();

    const sched = makeFakeScheduler();
    const store = createPersistence({
      idb,
      ...sched.opts,
    });

    store
      .save("k", "should-not-persist", { debounceMs: 100 })
      .catch(() => undefined);
    await store.delete("k");

    // Advance past the debounce window
    await sched.advanceBy(150);

    expect(await store.load<string>("k")).toBeNull();
  });
});
