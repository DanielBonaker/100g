export type EntityId = number;

export interface Component<T> {
  readonly tag: symbol;
  readonly data: T;
}

export interface World {
  spawn(): EntityId;
  attach<T>(id: EntityId, c: Component<T>): void;
  query<Ts extends readonly Component<unknown>[]>(
    ...tags: { [K in keyof Ts]: Ts[K]["tag"] }
  ): Iterable<readonly [EntityId, ...Ts]>;
  remove(id: EntityId): void;
}

export interface System {
  update(world: World, dt: number): void;
}
