import type {
  Achievements,
  AchievementEvent,
  AchievementsOptions,
} from "./index.ts";

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

type PersistedShape = Record<
  string /* gameId */,
  readonly string[] /* achievement ids */
>;

const DEFAULT_STORAGE_KEY = "achievements";

// ---------------------------------------------------------------------------
// Factory — eager hydration
// ---------------------------------------------------------------------------

export const createAchievements = async (
  opts: AchievementsOptions,
): Promise<Achievements> => {
  const { persistence } = opts;
  const storageKey = opts.storageKey ?? DEFAULT_STORAGE_KEY;
  const now = opts.now ?? (() => Date.now());

  // Load persisted state once at construction time
  const loaded = await persistence.load<PersistedShape>(storageKey);
  // Shallow-copy into a mutable Record with mutable arrays
  const state: Record<string, string[]> = {};
  if (loaded !== null) {
    for (const [gameId, ids] of Object.entries(loaded)) {
      state[gameId] = [...ids];
    }
  }

  const subscribers: ((event: AchievementEvent) => void)[] = [];

  const persist = (): void => {
    // Build a clean plain object to persist (readonly arrays serialise fine)
    const snapshot: PersistedShape = {};
    for (const [gameId, ids] of Object.entries(state)) {
      snapshot[gameId] = [...ids];
    }
    void persistence.save(storageKey, snapshot, { debounceMs: 100 });
  };

  const svc: Achievements = {
    unlock(gameId: string, achievementId: string): void {
      const existing = state[gameId];
      if (existing?.includes(achievementId)) {
        // Already unlocked — idempotent no-op
        return;
      }
      if (existing === undefined) {
        state[gameId] = [achievementId];
      } else {
        existing.push(achievementId);
      }

      const event: AchievementEvent = {
        gameId,
        achievementId,
        unlockedAt: now(),
      };
      for (const handler of [...subscribers]) {
        handler(event);
      }

      persist();
    },

    getUnlocked(gameId: string): readonly string[] {
      return state[gameId] ?? [];
    },

    isUnlocked(gameId: string, achievementId: string): boolean {
      return state[gameId]?.includes(achievementId) ?? false;
    },

    subscribe(handler: (event: AchievementEvent) => void): () => void {
      subscribers.push(handler);
      return () => {
        const idx = subscribers.indexOf(handler);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },
  };

  return svc;
};
