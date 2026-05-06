import type { SeededRng } from "../../../engine/Game.ts";
import type { OwnedCreature, BehaviorState } from "./runState.ts";

export interface PlayBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

// Clamp integer coords to play bounds
const clampX = (x: number, bounds: PlayBounds): number =>
  Math.max(bounds.minX, Math.min(bounds.maxX, Math.round(x)));

const clampY = (y: number, bounds: PlayBounds): number =>
  Math.max(bounds.minY, Math.min(bounds.maxY, Math.round(y)));

// Seeded RNG scoped to a single creature — uses creature seed xor'd with globalTick
function makeCreatureRng(rng: SeededRng, seed: number): SeededRng {
  // Fork from the provided RNG but bias it with the creature seed
  // We just use a deterministic sequence based on the seed + tick
  let state = seed;
  return {
    next(): number {
      // LCG-like deterministic float from seed
      state = (state * 1664525 + 1013904223) & 0xffffffff;
      return (state >>> 0) / 0x100000000;
    },
    int(min: number, max: number): number {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(this.next() * (hi - lo + 1));
    },
    fork(): SeededRng {
      return makeCreatureRng(rng, state);
    },
    get state(): string {
      return String(state);
    },
  };
}

function pickRandomTarget(
  rng: SeededRng,
  bounds: PlayBounds,
): { x: number; y: number } {
  return {
    x: rng.int(bounds.minX, bounds.maxX),
    y: rng.int(bounds.minY, bounds.maxY),
  };
}

function nextStateFromIdle(
  creature: OwnedCreature,
  globalTick: number,
  bounds: PlayBounds,
  rng: SeededRng,
): OwnedCreature {
  const roll = rng.next();
  if (roll < 0.6) {
    // walk — 60%
    const target = pickRandomTarget(rng, bounds);
    const duration = rng.int(30, 120);
    return {
      ...creature,
      state: "walk",
      stateUntil: globalTick + duration,
      walkTargetX: target.x,
      walkTargetY: target.y,
      facing: target.x >= creature.position.x ? 1 : -1,
    };
  } else if (roll < 0.8) {
    // nap — 20%
    const duration = rng.int(60, 180);
    return {
      ...creature,
      state: "nap",
      stateUntil: globalTick + duration,
    };
  } else {
    // idle again — 20%
    const duration = rng.int(30, 90);
    return {
      ...creature,
      state: "idle",
      stateUntil: globalTick + duration,
    };
  }
}

function nextStateFromWalk(
  creature: OwnedCreature,
  globalTick: number,
  bounds: PlayBounds,
  rng: SeededRng,
): OwnedCreature {
  const roll = rng.next();
  if (roll < 0.5) {
    // idle — 50%
    const duration = rng.int(30, 90);
    return {
      ...creature,
      state: "idle",
      stateUntil: globalTick + duration,
    };
  } else if (roll < 0.9) {
    // walk again — 40%
    const target = pickRandomTarget(rng, bounds);
    const duration = rng.int(30, 120);
    return {
      ...creature,
      state: "walk",
      stateUntil: globalTick + duration,
      walkTargetX: target.x,
      walkTargetY: target.y,
      facing: target.x >= creature.position.x ? 1 : -1,
    };
  } else {
    // nap — 10%
    const duration = rng.int(60, 180);
    return {
      ...creature,
      state: "nap",
      stateUntil: globalTick + duration,
    };
  }
}

function nextStateFromNap(
  creature: OwnedCreature,
  globalTick: number,
  rng: SeededRng,
): OwnedCreature {
  // Always transitions to idle
  const duration = rng.int(30, 90);
  return {
    ...creature,
    state: "idle",
    stateUntil: globalTick + duration,
  };
}

function nextStateFromHop(
  creature: OwnedCreature,
  globalTick: number,
  rng: SeededRng,
): OwnedCreature {
  // Always transitions to idle after hop
  const duration = rng.int(30, 90);
  return {
    ...creature,
    state: "idle",
    stateUntil: globalTick + duration,
  };
}

function nextStateFromPlay(
  creature: OwnedCreature,
  globalTick: number,
  rng: SeededRng,
): OwnedCreature {
  // Always transitions to idle after play
  const duration = rng.int(30, 90);
  return {
    ...creature,
    state: "idle",
    stateUntil: globalTick + duration,
  };
}

// Move creature one pixel toward its walk target
function stepTowardTarget(
  creature: OwnedCreature,
  bounds: PlayBounds,
): OwnedCreature {
  const { x, y } = creature.position;
  const tx = clampX(creature.walkTargetX, bounds);
  const ty = clampY(creature.walkTargetY, bounds);

  const dx = tx - x;
  const dy = ty - y;

  if (dx === 0 && dy === 0) return creature;

  // Move 1 pixel per tick in the dominant direction (integer-pixel granularity)
  const stepX = dx !== 0 ? Math.sign(dx) : 0;
  const stepY = dy !== 0 ? Math.sign(dy) : 0;

  const newX = clampX(x + stepX, bounds);
  const newY = clampY(y + stepY, bounds);

  const newFacing: -1 | 1 = stepX > 0 ? 1 : stepX < 0 ? -1 : creature.facing;

  return {
    ...creature,
    position: { x: newX, y: newY },
    facing: newFacing,
  };
}

/**
 * Tick the creature's behavior state machine by one step.
 * Pure function — no side effects, no DOM, no Pixi.
 */
export const tick = (
  creature: OwnedCreature,
  globalTick: number,
  playBounds: PlayBounds,
  rng: SeededRng,
): OwnedCreature => {
  // Use a per-creature deterministic RNG derived from creature.seed + globalTick
  const creatureRng = makeCreatureRng(rng, creature.seed ^ globalTick);

  const currentState: BehaviorState = creature.state;

  // If the current state has expired, transition to the next state
  if (globalTick >= creature.stateUntil) {
    switch (currentState) {
      case "idle":
        return nextStateFromIdle(creature, globalTick, playBounds, creatureRng);
      case "walk":
        return nextStateFromWalk(creature, globalTick, playBounds, creatureRng);
      case "nap":
        return nextStateFromNap(creature, globalTick, creatureRng);
      case "hop":
        return nextStateFromHop(creature, globalTick, creatureRng);
      case "play":
        return nextStateFromPlay(creature, globalTick, creatureRng);
    }
  }

  // State still active — perform per-state per-tick action
  switch (currentState) {
    case "walk":
      return stepTowardTarget(creature, playBounds);
    case "idle":
    case "nap":
    case "hop":
    case "play":
      // No movement in these states
      return creature;
  }
};

// All 5 states exported as a const tuple for test assertions
export const ALL_BEHAVIOR_STATES: readonly BehaviorState[] = [
  "idle",
  "walk",
  "hop",
  "play",
  "nap",
] as const;
