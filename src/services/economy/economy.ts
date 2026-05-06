import type { Economy, EconomyEvent, EconomyOptions } from "./index.ts";

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface PersistedShape {
  readonly balance: number;
  readonly perGameYield: Record<string, number>; // total yielded per game — for stats
}

const DEFAULT_STORAGE_KEY = "economy";

const DEFAULT_STATE: PersistedShape = {
  balance: 0,
  perGameYield: {},
};

// ---------------------------------------------------------------------------
// Factory — eager hydration
// ---------------------------------------------------------------------------

export const createEconomy = async (opts: EconomyOptions): Promise<Economy> => {
  const { persistence } = opts;
  const storageKey = opts.storageKey ?? DEFAULT_STORAGE_KEY;

  // Load persisted state once at construction time
  const loaded = await persistence.load<PersistedShape>(storageKey);
  let balance = loaded?.balance ?? DEFAULT_STATE.balance;
  const perGameYield: Record<string, number> = loaded?.perGameYield
    ? { ...loaded.perGameYield }
    : {};

  const subscribers: ((event: EconomyEvent) => void)[] = [];

  const persist = (): void => {
    void persistence.save(
      storageKey,
      { balance, perGameYield: { ...perGameYield } },
      { debounceMs: 100 },
    );
  };

  const svc: Economy = {
    getBalance(): number {
      return balance;
    },

    addYield(gameId: string, amount: number): void {
      if (amount < 0) {
        throw new RangeError(
          `addYield amount must be >= 0, got ${amount.toString()}`,
        );
      }

      balance += amount;
      perGameYield[gameId] = (perGameYield[gameId] ?? 0) + amount;

      const event: EconomyEvent = {
        gameId,
        amount,
        newBalance: balance,
      };
      for (const handler of [...subscribers]) {
        handler(event);
      }

      persist();
    },

    spend(gameId: string, amount: number): boolean {
      if (amount <= 0) {
        throw new RangeError(
          `spend amount must be > 0, got ${amount.toString()}`,
        );
      }
      if (balance < amount) {
        return false;
      }

      balance -= amount;

      const event: EconomyEvent = {
        gameId,
        amount: -amount,
        newBalance: balance,
      };
      for (const handler of [...subscribers]) {
        handler(event);
      }

      persist();
      return true;
    },

    subscribe(handler: (event: EconomyEvent) => void): () => void {
      subscribers.push(handler);
      return () => {
        const idx = subscribers.indexOf(handler);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },
  };

  return svc;
};
