import type { Component, EntityId, World } from "./types.ts";

export const createWorld = (): World => {
  const entities = new Map<EntityId, Map<symbol, Component<unknown>>>();
  let nextId: EntityId = 1;

  const spawn = (): EntityId => {
    const id = nextId;
    nextId += 1;
    entities.set(id, new Map());
    return id;
  };

  const attach = <T>(id: EntityId, c: Component<T>): void => {
    const components = entities.get(id);
    if (components === undefined) return;
    components.set(c.tag, c);
  };

  const remove = (id: EntityId): void => {
    entities.delete(id);
  };

  function* query<Ts extends readonly Component<unknown>[]>(
    ...tags: { [K in keyof Ts]: Ts[K]["tag"] }
  ): Iterable<readonly [EntityId, ...Ts]> {
    if (tags.length === 0) return;

    const matches: (readonly [EntityId, ...Ts])[] = [];
    for (const [id, components] of entities) {
      const tuple: unknown[] = [id];
      let ok = true;
      for (const tag of tags) {
        const c = components.get(tag);
        if (c === undefined) {
          ok = false;
          break;
        }
        tuple.push(c);
      }
      if (ok) {
        matches.push(tuple as unknown as readonly [EntityId, ...Ts]);
      }
    }

    for (const m of matches) {
      if (entities.has(m[0])) {
        yield m;
      }
    }
  }

  return { spawn, attach, query, remove };
};
