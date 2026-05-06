export const SCHEMA_VERSION = 1;

export type BehaviorState = "idle" | "walk" | "hop" | "play" | "nap";

export interface OwnedCreature {
  readonly instanceId: number;
  readonly creatureId: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly state: BehaviorState;
  readonly stateUntil: number;
  readonly facing: -1 | 1;
  readonly seed: number;
  // walk target — only relevant when state === "walk"
  readonly walkTargetX: number;
  readonly walkTargetY: number;
}

export interface RunState {
  readonly schemaVersion: number;
  readonly owned: readonly OwnedCreature[];
  readonly tick: number;
  readonly nextInstanceId: number;
  readonly rngState: string;
  /** Tap affection counts keyed by creatureId (not instanceId). */
  readonly totalTapsByCreatureId: Readonly<Record<number, number>>;
  /** Distinct creatureIds ever owned — persists across unown events. Sorted ascending. */
  readonly uniqueOwnedIds: readonly number[];
  /** Total cross-game currency already paid out for this save; used to compute delta on teardown. */
  readonly lastYieldPaid: number;
}

export const STARTER_INSTANCE_ID = 1;

export const makeRunState = (rngSeed?: string): RunState => ({
  schemaVersion: SCHEMA_VERSION,
  owned: [
    {
      instanceId: STARTER_INSTANCE_ID,
      creatureId: 0,
      position: { x: 24, y: 36 },
      state: "idle",
      stateUntil: 30,
      facing: 1,
      seed: 12345,
      walkTargetX: 24,
      walkTargetY: 36,
    },
  ],
  tick: 0,
  nextInstanceId: 2,
  rngState: rngSeed ?? "keim-default-seed",
  totalTapsByCreatureId: {},
  uniqueOwnedIds: [0],
  lastYieldPaid: 0,
});

interface MaybeRunState {
  schemaVersion?: unknown;
  owned?: unknown;
  tick?: unknown;
  nextInstanceId?: unknown;
  rngState?: unknown;
  totalTapsByCreatureId?: unknown;
  uniqueOwnedIds?: unknown;
  lastYieldPaid?: unknown;
}

interface MaybeOwnedCreature {
  instanceId?: unknown;
  creatureId?: unknown;
  position?: unknown;
  state?: unknown;
  stateUntil?: unknown;
  facing?: unknown;
  seed?: unknown;
}

interface MaybePosition {
  x?: unknown;
  y?: unknown;
}

const isRecordNumberNumber = (
  value: unknown,
): value is Record<number, number> => {
  if (typeof value !== "object" || value === null) return false;
  for (const val of Object.values(value as Record<string, unknown>)) {
    if (typeof val !== "number") return false;
  }
  return true;
};

export const isRunState = (value: unknown): value is RunState => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as MaybeRunState;
  if (typeof v.schemaVersion !== "number") return false;
  if (!Array.isArray(v.owned)) return false;
  if (typeof v.tick !== "number") return false;
  if (typeof v.nextInstanceId !== "number") return false;
  if (typeof v.rngState !== "string") return false;
  // totalTapsByCreatureId is optional in saved data (migration: absent = {})
  if (
    v.totalTapsByCreatureId !== undefined &&
    !isRecordNumberNumber(v.totalTapsByCreatureId)
  ) {
    return false;
  }
  // uniqueOwnedIds is optional in saved data (migration: absent = computed from owned)
  if (v.uniqueOwnedIds !== undefined) {
    if (!Array.isArray(v.uniqueOwnedIds)) return false;
    for (const item of v.uniqueOwnedIds as unknown[]) {
      if (typeof item !== "number") return false;
    }
  }
  // lastYieldPaid is optional in saved data (migration: absent = 0)
  if (v.lastYieldPaid !== undefined && typeof v.lastYieldPaid !== "number") {
    return false;
  }
  for (const item of v.owned as unknown[]) {
    if (typeof item !== "object" || item === null) return false;
    const c = item as MaybeOwnedCreature;
    if (typeof c.instanceId !== "number") return false;
    if (typeof c.creatureId !== "number") return false;
    if (typeof c.position !== "object" || c.position === null) return false;
    const pos = c.position as MaybePosition;
    if (typeof pos.x !== "number" || typeof pos.y !== "number") return false;
    if (typeof c.state !== "string") return false;
    if (typeof c.stateUntil !== "number") return false;
    if (c.facing !== -1 && c.facing !== 1) return false;
    if (typeof c.seed !== "number") return false;
  }
  return true;
};

/**
 * Build a fully-normalised RunState from a value that passed `isRunState`.
 * Fills in fields added in later schema iterations (backward-compat migration).
 * Accepts `unknown` so the caller can pass the raw loaded value without
 * TypeScript complaining about a missing required field.
 */
export const normalizeRunState = (value: unknown): RunState => {
  const v = value as MaybeRunState & RunState;

  // Backfill uniqueOwnedIds from owned array when field is absent (migration)
  const uniqueOwnedIds: readonly number[] =
    Array.isArray(v.uniqueOwnedIds) &&
    (v.uniqueOwnedIds as unknown[]).every((x) => typeof x === "number")
      ? (v.uniqueOwnedIds as readonly number[])
      : [...new Set(v.owned.map((c) => c.creatureId))].sort((a, b) => a - b);

  return {
    ...(value as RunState),
    totalTapsByCreatureId: isRecordNumberNumber(v.totalTapsByCreatureId)
      ? v.totalTapsByCreatureId
      : {},
    uniqueOwnedIds,
    lastYieldPaid: typeof v.lastYieldPaid === "number" ? v.lastYieldPaid : 0,
  };
};
