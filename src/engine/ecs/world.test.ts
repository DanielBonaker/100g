import { describe, expect, it } from "vitest";

import { createWorld } from "./index.ts";
import type { Component, System, World } from "./index.ts";

const positionTag: unique symbol = Symbol("position");
const velocityTag: unique symbol = Symbol("velocity");
const healthTag: unique symbol = Symbol("health");

interface Position {
  x: number;
  y: number;
}
interface Velocity {
  vx: number;
  vy: number;
}
interface Health {
  hp: number;
}

const position = (data: Position): Component<Position> => ({
  tag: positionTag,
  data,
});
const velocity = (data: Velocity): Component<Velocity> => ({
  tag: velocityTag,
  data,
});
const health = (data: Health): Component<Health> => ({ tag: healthTag, data });

describe("createWorld — spawn", () => {
  it("returns increasing unique entity ids", () => {
    const world = createWorld();
    const a = world.spawn();
    const b = world.spawn();
    const c = world.spawn();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});

describe("createWorld — attach + query", () => {
  it("finds an entity by single component tag", () => {
    const world = createWorld();
    const id = world.spawn();
    world.attach(id, position({ x: 1, y: 2 }));
    const results = [
      ...world.query<readonly [Component<Position>]>(positionTag),
    ];
    expect(results).toHaveLength(1);
    const first = results[0]!;
    expect(first[0]).toBe(id);
    expect(first[1].data).toEqual({ x: 1, y: 2 });
  });

  it("returns components in tuple order matching tag order", () => {
    const world = createWorld();
    const id = world.spawn();
    world.attach(id, position({ x: 3, y: 4 }));
    world.attach(id, velocity({ vx: 5, vy: 6 }));

    const ab = [
      ...world.query<readonly [Component<Position>, Component<Velocity>]>(
        positionTag,
        velocityTag,
      ),
    ];
    expect(ab).toHaveLength(1);
    expect(ab[0]![1].data).toEqual({ x: 3, y: 4 });
    expect(ab[0]![2].data).toEqual({ vx: 5, vy: 6 });

    const ba = [
      ...world.query<readonly [Component<Velocity>, Component<Position>]>(
        velocityTag,
        positionTag,
      ),
    ];
    expect(ba).toHaveLength(1);
    expect(ba[0]![1].data).toEqual({ vx: 5, vy: 6 });
    expect(ba[0]![2].data).toEqual({ x: 3, y: 4 });
  });

  it("only returns entities that have ALL requested tags", () => {
    const world = createWorld();
    const onlyPos = world.spawn();
    world.attach(onlyPos, position({ x: 0, y: 0 }));

    const both = world.spawn();
    world.attach(both, position({ x: 7, y: 8 }));
    world.attach(both, velocity({ vx: 1, vy: 1 }));

    const results = [
      ...world.query<readonly [Component<Position>, Component<Velocity>]>(
        positionTag,
        velocityTag,
      ),
    ];
    expect(results).toHaveLength(1);
    expect(results[0]![0]).toBe(both);
  });

  it("query with zero tags yields no entities", () => {
    const world = createWorld();
    world.spawn();
    const results = [...world.query<readonly []>()];
    expect(results).toHaveLength(0);
  });

  it("re-attaching a component with the same tag replaces the prior one (last write wins)", () => {
    const world = createWorld();
    const id = world.spawn();
    world.attach(id, position({ x: 1, y: 2 }));
    world.attach(id, position({ x: 9, y: 9 }));
    const results = [
      ...world.query<readonly [Component<Position>]>(positionTag),
    ];
    expect(results).toHaveLength(1);
    expect(results[0]![1].data).toEqual({ x: 9, y: 9 });
  });

  it("excludes entities missing any tag in a 3-tag query", () => {
    const world = createWorld();
    const a = world.spawn();
    world.attach(a, position({ x: 1, y: 1 }));
    world.attach(a, velocity({ vx: 1, vy: 1 }));
    world.attach(a, health({ hp: 10 }));

    const b = world.spawn();
    world.attach(b, position({ x: 2, y: 2 }));
    world.attach(b, velocity({ vx: 2, vy: 2 }));

    const results = [
      ...world.query<
        readonly [Component<Position>, Component<Velocity>, Component<Health>]
      >(positionTag, velocityTag, healthTag),
    ];
    expect(results).toHaveLength(1);
    expect(results[0]![0]).toBe(a);
  });
});

describe("createWorld — edge cases", () => {
  it("attach to an id that was never spawned silently no-ops", () => {
    const world = createWorld();
    world.attach(99999, position({ x: 0, y: 0 }));
    const results = [
      ...world.query<readonly [Component<Position>]>(positionTag),
    ];
    expect(results).toHaveLength(0);
  });

  it("remove of an already-removed id is a no-op", () => {
    const world = createWorld();
    const id = world.spawn();
    world.remove(id);
    expect(() => {
      world.remove(id);
    }).not.toThrow();
    const results = [
      ...world.query<readonly [Component<Position>]>(positionTag),
    ];
    expect(results).toHaveLength(0);
  });

  it("remove of a never-spawned id is a no-op and does not affect id allocation", () => {
    const world = createWorld();
    expect(() => {
      world.remove(99999);
    }).not.toThrow();
    expect(world.spawn()).toBe(1);
  });
});

describe("createWorld — remove", () => {
  it("removes an entity from all queries", () => {
    const world = createWorld();
    const id = world.spawn();
    world.attach(id, position({ x: 1, y: 2 }));
    world.attach(id, velocity({ vx: 0, vy: 0 }));
    world.remove(id);

    const byPos = [...world.query<readonly [Component<Position>]>(positionTag)];
    const byVel = [...world.query<readonly [Component<Velocity>]>(velocityTag)];
    expect(byPos).toHaveLength(0);
    expect(byVel).toHaveLength(0);
  });

  it("silently ignores attach to a removed entity (no resurrection)", () => {
    const world = createWorld();
    const id = world.spawn();
    world.attach(id, position({ x: 1, y: 2 }));
    world.remove(id);

    world.attach(id, health({ hp: 100 }));

    const byPos = [...world.query<readonly [Component<Position>]>(positionTag)];
    const byHealth = [...world.query<readonly [Component<Health>]>(healthTag)];
    expect(byPos).toHaveLength(0);
    expect(byHealth).toHaveLength(0);
  });

  it("is safe to remove during iteration of a query", () => {
    const world = createWorld();
    const ids = [world.spawn(), world.spawn(), world.spawn()];
    for (const id of ids) {
      world.attach(id, position({ x: 0, y: 0 }));
    }

    const visited: number[] = [];
    for (const [id] of world.query<readonly [Component<Position>]>(
      positionTag,
    )) {
      visited.push(id);
      world.remove(id);
    }

    expect(visited.sort((a, b) => a - b)).toEqual(ids.sort((a, b) => a - b));
    const remaining = [
      ...world.query<readonly [Component<Position>]>(positionTag),
    ];
    expect(remaining).toHaveLength(0);
  });
});

interface Counter {
  n: number;
}
interface History {
  values: number[];
}

const counterTag: unique symbol = Symbol("counter");
const historyTag: unique symbol = Symbol("history");

const counter = (data: Counter): Component<Counter> => ({
  tag: counterTag,
  data,
});
const historyOf = (data: History): Component<History> => ({
  tag: historyTag,
  data,
});

const incrementCounter: System = {
  update(world: World): void {
    for (const [, c] of world.query<readonly [Component<Counter>]>(
      counterTag,
    )) {
      c.data.n += 1;
    }
  },
};

const recordHistory: System = {
  update(world: World): void {
    for (const [, c, h] of world.query<
      readonly [Component<Counter>, Component<History>]
    >(counterTag, historyTag)) {
      h.data.values.push(c.data.n);
    }
  },
};

interface Snapshot {
  id: number;
  n: number;
  values: number[];
}

const snapshot = (world: World, ids: readonly number[]): Snapshot[] => {
  const out: Snapshot[] = [];
  for (const id of ids) {
    for (const [eid, c, h] of world.query<
      readonly [Component<Counter>, Component<History>]
    >(counterTag, historyTag)) {
      if (eid !== id) continue;
      out.push({ id: eid, n: c.data.n, values: [...h.data.values] });
    }
  }
  return out;
};

const buildScenario = (): { world: World; ids: number[] } => {
  const world = createWorld();
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) {
    const id = world.spawn();
    ids.push(id);
    world.attach(id, counter({ n: i }));
    world.attach(id, historyOf({ values: [] }));
  }
  return { world, ids };
};

describe("createWorld — system update determinism", () => {
  it("produces identical state across runs given same systems and ticks", () => {
    const runOnce = (): Snapshot[] => {
      const { world, ids } = buildScenario();
      const systems: System[] = [incrementCounter, recordHistory];
      for (let tick = 0; tick < 5; tick++) {
        for (const s of systems) s.update(world, 1 / 60);
      }
      return snapshot(world, ids);
    };

    const a = runOnce();
    const b = runOnce();
    expect(a).toEqual(b);
    expect(a[0]).toEqual({ id: a[0]!.id, n: 5, values: [1, 2, 3, 4, 5] });
    expect(a[1]).toEqual({ id: a[1]!.id, n: 6, values: [2, 3, 4, 5, 6] });
    expect(a[2]).toEqual({ id: a[2]!.id, n: 7, values: [3, 4, 5, 6, 7] });
  });
});
