import { describe, expect, it } from "vitest";

import { createWorld } from "./index.ts";
import type { Component, World } from "./index.ts";

const aTag: unique symbol = Symbol("a");
const bTag: unique symbol = Symbol("b");
const cTag: unique symbol = Symbol("c");

interface A {
  v: number;
}
interface B {
  v: number;
}
interface C {
  v: number;
}

const cmpA = (data: A): Component<A> => ({ tag: aTag, data });
const cmpB = (data: B): Component<B> => ({ tag: bTag, data });
const cmpC = (data: C): Component<C> => ({ tag: cTag, data });

const seedWorld = (count: number): World => {
  const world = createWorld();
  for (let i = 0; i < count; i++) {
    const id = world.spawn();
    world.attach(id, cmpA({ v: i }));
    world.attach(id, cmpB({ v: i + 1 }));
    world.attach(id, cmpC({ v: i + 2 }));
  }
  return world;
};

describe("createWorld — bench", () => {
  it("1000 entities x 3 components x 60 ticks stays under 5ms/tick avg", () => {
    const world = seedWorld(1000);

    let acc = 0;
    const ticks = 60;

    for (let i = 0; i < 5; i++) {
      for (const [, a, b, c] of world.query<
        readonly [Component<A>, Component<B>, Component<C>]
      >(aTag, bTag, cTag)) {
        a.data.v += 1;
        acc += b.data.v + c.data.v;
      }
    }

    const start = performance.now();
    for (let tick = 0; tick < ticks; tick++) {
      for (const [, a, b, c] of world.query<
        readonly [Component<A>, Component<B>, Component<C>]
      >(aTag, bTag, cTag)) {
        a.data.v += 1;
        acc += b.data.v + c.data.v;
      }
    }
    const elapsed = performance.now() - start;
    const perTick = elapsed / ticks;

    expect(acc).toBeGreaterThan(0);
    expect(perTick).toBeLessThan(5);
  });
});
