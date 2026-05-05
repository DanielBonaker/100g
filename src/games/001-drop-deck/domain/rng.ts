import type { SeededRng } from "../../../engine/Game.ts";

// ---------------------------------------------------------------------------
// Mulberry32 seeded RNG — ≤30 lines, deterministic, fork-safe.
// Seed is stringified as the uint32 state value.
// ---------------------------------------------------------------------------

const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
};

export const makeRng = (seed: string | number = Date.now()): SeededRng => {
  let s = typeof seed === "number" ? seed >>> 0 : hash(seed);

  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    fork(): SeededRng {
      // Derive a child seed deterministically from current state
      return makeRng((s ^ 0xdeadbeef) >>> 0);
    },
    get state(): string {
      return String(s >>> 0);
    },
  };
};

export const makeRngFromState = (stateStr: string): SeededRng =>
  makeRng(parseInt(stateStr, 10));
