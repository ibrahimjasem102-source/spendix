"use client";

// Lightweight IndexedDB wrapper — no external dependencies

const DB_NAME    = "spendix_v1";
const DB_VERSION = 1;

export const STORES = {
  SYNC_QUEUE:    "sync_queue",
  TRANSACTIONS:  "cache_transactions",
  ACCOUNTS:      "cache_accounts",
  DEBTS:         "cache_debts",
  GOALS:         "cache_goals",
  CONTACTS:      "cache_contacts",
  SUBSCRIPTIONS: "cache_subscriptions",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export interface SyncOperation {
  id:          string;
  url:         string;
  method:      "POST" | "PATCH" | "PUT" | "DELETE";
  body:        string | null;
  headers:     Record<string, string>;
  timestamp:   number;
  retries:     number;
  maxRetries:  number;
  optimisticId?: string;
}

export interface CachedRecord {
  id:        string;
  data:      unknown;
  updatedAt: number;
  synced:    boolean;
}

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror  = () => reject(req.error);
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Sync queue
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Cache stores
      const cacheStores = [
        STORES.TRANSACTIONS,
        STORES.ACCOUNTS,
        STORES.DEBTS,
        STORES.GOALS,
        STORES.CONTACTS,
        STORES.SUBSCRIPTIONS,
      ] as const;

      for (const name of cacheStores) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: "id" });
          s.createIndex("updatedAt", "updatedAt", { unique: false });
          s.createIndex("synced",    "synced",    { unique: false });
        }
      }
    };
  });
}

// ── Generic helpers ────────────────────────────────────────────

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T | undefined);
  });
}

export async function dbPut(store: StoreName, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value);
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T[]);
  });
}

export async function dbClear(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function dbCount(store: StoreName): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).count();
    req.onerror  = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

// ── Cache helpers ──────────────────────────────────────────────

export async function cacheRecord(store: StoreName, id: string, data: unknown): Promise<void> {
  await dbPut(store, { id, data, updatedAt: Date.now(), synced: true } satisfies CachedRecord);
}

export async function cacheRecords(store: StoreName, records: { id: string; data: unknown }[]): Promise<void> {
  const db   = await openDB();
  const now  = Date.now();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const r of records) {
      os.put({ id: r.id, data: r.data, updatedAt: now, synced: true } satisfies CachedRecord);
    }
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getCachedRecord<T>(store: StoreName, id: string): Promise<T | null> {
  const r = await dbGet<CachedRecord>(store, id);
  return r ? (r.data as T) : null;
}

export async function getAllCached<T>(store: StoreName): Promise<T[]> {
  const records = await dbGetAll<CachedRecord>(store);
  return records.map(r => r.data as T);
}

// Safety: return false when IndexedDB is unavailable (SSR, private browsing with restrictions)
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
