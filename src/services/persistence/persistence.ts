/**
 * IndexedDB-backed key-value persistence service.
 *
 * Surface: save / load / delete — all IndexedDB plumbing, debounce coalescing,
 * schema versioning, and migration are hidden behind these three methods.
 *
 * Serialisation contract: values must be structuredClone-compatible (plain
 * objects, arrays, numbers, strings, booleans, Maps, Sets, Dates). Do NOT
 * pass functions or class instances with non-enumerable state. IndexedDB uses
 * the Structured Clone algorithm natively — JSON.stringify is not used.
 *
 * Debounce coalescing contract:
 * - When debounceMs > 0, writes for the same key are coalesced: the pending
 *   value is replaced and the timer is reset. All waiting promise resolvers
 *   are collected and fired together when the flush occurs.
 * - When debounceMs is undefined or <= 0, the write is immediate. If a pending
 *   debounced save exists for the same key, the pending value is REPLACED by
 *   the new value and ALL waiting resolvers are resolved together when the
 *   merged write commits. This ensures no pending entry is left with an
 *   orphaned timer and unresolved resolvers/rejecters.
 */
import type { Persistence, SaveOptions } from "./types.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { Persistence, SaveOptions } from "./types.ts";

/**
 * A migration runs after the DB is opened at the requested schemaVersion.
 * It receives a live Persistence instance so it can load / save / delete keys.
 * Migrations whose fromVersion matches the previous DB version are run in order.
 *
 * Migrations run once — the fromVersion is stored in a special meta key so they
 * are not repeated on subsequent opens at the same version.
 *
 * Note: because we use a flat KV object store, structural migrations (renaming
 * keys, transforming values) must be done at the application level via the
 * Persistence surface, not inside the IDB onupgradeneeded handler.
 */
export interface Migration {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (store: Persistence) => void | Promise<void>;
}

export interface PersistenceOptions {
  readonly dbName?: string;
  readonly storeName?: string;
  readonly schemaVersion?: number;
  readonly migrations?: readonly Migration[];
  /** Injected IDBFactory — defaults to globalThis.indexedDB. Used in tests. */
  readonly idb?: IDBFactory;
  /** Injected scheduler — defaults to setTimeout. Allows vi.useFakeTimers(). */
  readonly schedule?: (fn: () => void, ms: number) => unknown;
  /** Injected cancel — defaults to clearTimeout. */
  readonly cancelSchedule?: (handle: unknown) => void;
  /**
   * Test-only hooks. Kept under a `testing` namespace so they don't pollute
   * editor autocomplete for production callers.
   */
  readonly testing?: {
    /**
     * Called once each time a value is flushed to IDB. Use in tests to assert
     * debounce coalescing write counts.
     */
    readonly onWrite?: () => void;
  };
}

// ---------------------------------------------------------------------------
// Internal: open the database
// ---------------------------------------------------------------------------

// Co-located object store for service-internal metadata (schema version, etc.).
// Never use for app data.
const IDB_META_STORE = "__meta__";
const META_SCHEMA_KEY = "__schemaVersion__";

const openDb = (
  idb: IDBFactory,
  dbName: string,
  storeName: string,
  schemaVersion: number,
): Promise<IDBDatabase> =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(dbName, schemaVersion);

    req.onupgradeneeded = () => {
      const db = req.result;
      // Create main KV store if it doesn't exist
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
      // Create meta store for tracking applied migrations
      if (!db.objectStoreNames.contains(IDB_META_STORE)) {
        db.createObjectStore(IDB_META_STORE);
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Close this connection when a newer version tries to open — prevents
      // "blocked" events when tests (or production) open the same DB at a
      // higher version number.
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IDB open failed"));
    };
    req.onblocked = () => {
      reject(new Error(`IDB open blocked for database "${dbName}"`));
    };
  });

// ---------------------------------------------------------------------------
// Internal: single IDB get/put/delete
// ---------------------------------------------------------------------------

const idbGet = (
  db: IDBDatabase,
  storeName: string,
  key: string,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      resolve(req.result ?? null);
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IDB get failed"));
    };
  });

const idbPut = (
  db: IDBDatabase,
  storeName: string,
  key: string,
  value: unknown,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value, key);
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IDB put failed"));
    };
  });

const idbDelete = (
  db: IDBDatabase,
  storeName: string,
  key: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error("IDB delete failed"));
    };
  });

// ---------------------------------------------------------------------------
// Internal: pending debounced save state per key
// ---------------------------------------------------------------------------

interface PendingEntry {
  value: unknown;
  handle: unknown;
  /** All promises waiting for this key's next flush. */
  resolvers: (() => void)[];
  rejecters: ((e: unknown) => void)[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createPersistence = (opts?: PersistenceOptions): Persistence => {
  const dbName = opts?.dbName ?? "100g";
  const storeName = opts?.storeName ?? "kv";
  const schemaVersion = opts?.schemaVersion ?? 1;
  const migrations = opts?.migrations ?? [];
  const idb = opts?.idb ?? globalThis.indexedDB;
  const schedule = opts?.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancelSchedule =
    opts?.cancelSchedule ??
    ((h) => {
      clearTimeout(h as ReturnType<typeof setTimeout>);
    });
  const onWrite = opts?.testing?.onWrite;

  // Lazily resolved DB connection
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = (): Promise<IDBDatabase> => {
    dbPromise ??= openDb(idb, dbName, storeName, schemaVersion).then(
      async (db) => {
        // Determine the previously recorded schema version from meta.
        // prevVersion = 0 means "never opened before by this service".
        const rawPrev = await idbGet(db, IDB_META_STORE, META_SCHEMA_KEY);
        const prevVersion = typeof rawPrev === "number" ? rawPrev : 0;

        if (migrations.length > 0 && prevVersion < schemaVersion) {
          // Build a lightweight Persistence wrapper using the open db directly
          // (bypasses lazy-open to avoid recursion)
          const directStore: Persistence = {
            save: (key, value) => idbPut(db, storeName, key, value),
            load: <T>(key: string) =>
              idbGet(db, storeName, key).then((v) =>
                v === null ? null : (v as T),
              ),
            delete: (key) => idbDelete(db, storeName, key),
          };

          for (const migration of migrations) {
            if (
              migration.fromVersion >= prevVersion &&
              migration.fromVersion < schemaVersion &&
              migration.toVersion <= schemaVersion
            ) {
              await migration.migrate(directStore);
            }
          }
        }

        // NOTE: schemaVersion is recorded even if a migration step threw above.
        // Migrations are not transactional with respect to the version bump —
        // a failed migration will not re-run on next open. Acceptable for 100g's
        // pre-Game-001 stage; revisit if real persistent user data ships.
        await idbPut(db, IDB_META_STORE, META_SCHEMA_KEY, schemaVersion);

        return db;
      },
    );
    return dbPromise;
  };

  // Map from key → pending debounced entry
  const pending = new Map<string, PendingEntry>();

  /** Flush a specific key immediately — writes to IDB and resolves waiters. */
  const flush = async (key: string): Promise<void> => {
    const entry = pending.get(key);
    if (entry === undefined) return;

    // Sync delete-before-await ensures concurrent flush callers see the entry
    // as already taken. Map.delete is synchronous, so any second caller that
    // reaches `pending.get(key)` after this line will see `undefined` and
    // return early — no double-write can occur.
    cancelSchedule(entry.handle);
    pending.delete(key);

    const { value, resolvers, rejecters } = entry;
    try {
      const db = await getDb();
      await idbPut(db, storeName, key, value);
      onWrite?.();
      for (const resolve of resolvers) resolve();
    } catch (err) {
      for (const reject of rejecters) reject(err);
    }
  };

  const persistence: Persistence = {
    /**
     * Save a value. If opts.debounceMs is set, the write is coalesced:
     * subsequent calls for the same key within the window replace the pending
     * value and reset the timer. All in-flight save promises for a key resolve
     * together when the next flush completes.
     *
     * When debounceMs is undefined or <= 0, the write is immediate. If a
     * pending debounced save exists for the same key, the pending value is
     * REPLACED by the new value and ALL waiting resolvers are resolved together
     * when the merged write commits.
     */
    save(key: string, value: unknown, opts?: SaveOptions): Promise<void> {
      const debounceMs = opts?.debounceMs;

      if (debounceMs === undefined || debounceMs <= 0) {
        // Immediate write. If there is a pending debounced entry for this key,
        // absorb its resolvers/rejecters so they are settled alongside this
        // write and no pending entry is left stranded.
        const existingEntry = pending.get(key);
        if (existingEntry !== undefined) {
          // Cancel the pending timer and take ownership of the entry's waiters.
          cancelSchedule(existingEntry.handle);
          pending.delete(key);
          const priorResolvers = existingEntry.resolvers;
          const priorRejecters = existingEntry.rejecters;
          return getDb().then((db) =>
            idbPut(db, storeName, key, value).then(
              () => {
                onWrite?.();
                for (const resolve of priorResolvers) resolve();
              },
              (err: unknown) => {
                for (const reject of priorRejecters) reject(err);
                throw err;
              },
            ),
          );
        }
        return getDb().then((db) => {
          return idbPut(db, storeName, key, value).then(() => {
            onWrite?.();
          });
        });
      }

      // Debounced write
      return new Promise<void>((resolve, reject) => {
        const existing = pending.get(key);
        if (existing !== undefined) {
          // Cancel the old timer, update value, add this promise's callbacks
          cancelSchedule(existing.handle);
          existing.value = value;
          existing.resolvers.push(resolve);
          existing.rejecters.push(reject);
          // Reset timer
          existing.handle = schedule(() => {
            void flush(key);
          }, debounceMs);
        } else {
          // Create new pending entry
          const entry: PendingEntry = {
            value,
            handle: null,
            resolvers: [resolve],
            rejecters: [reject],
          };
          entry.handle = schedule(() => {
            void flush(key);
          }, debounceMs);
          pending.set(key, entry);
        }
      });
    },

    /**
     * Load a value. Flushes any pending debounced save for the key first so
     * the caller always sees the most recent value.
     */
    async load<T>(key: string): Promise<T | null> {
      // Flush pending write for this key before reading
      await flush(key);
      const db = await getDb();
      const value = await idbGet(db, storeName, key);
      return value === null ? null : (value as T);
    },

    /**
     * Delete a value and cancel any pending debounced save for the key.
     */
    async delete(key: string): Promise<void> {
      const entry = pending.get(key);
      if (entry !== undefined) {
        cancelSchedule(entry.handle);
        pending.delete(key);
        // Resolve waiting promises — the value was "saved" as deleted
        for (const resolve of entry.resolvers) resolve();
      }
      const db = await getDb();
      await idbDelete(db, storeName, key);
    },
  };

  return persistence;
};
