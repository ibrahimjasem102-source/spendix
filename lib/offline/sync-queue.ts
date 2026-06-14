"use client";

import { dbPut, dbDelete, dbGetAll, dbCount, isIndexedDBAvailable, STORES, type SyncOperation } from "./db";

const MAX_RETRIES = 3;

// ── Enqueue a pending operation ────────────────────────────────

export async function enqueue(op: Omit<SyncOperation, "id" | "timestamp" | "retries" | "maxRetries">): Promise<string> {
  const id: string = crypto.randomUUID();
  const operation: SyncOperation = {
    ...op,
    id,
    timestamp:  Date.now(),
    retries:    0,
    maxRetries: MAX_RETRIES,
  };

  if (isIndexedDBAvailable()) {
    await dbPut(STORES.SYNC_QUEUE, operation);
  }

  return id;
}

// ── Get all pending operations (sorted by timestamp) ──────────

export async function getPendingOps(): Promise<SyncOperation[]> {
  if (!isIndexedDBAvailable()) return [];
  const all = await dbGetAll<SyncOperation>(STORES.SYNC_QUEUE);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

// ── Count of pending unsynced operations ──────────────────────

export async function getPendingCount(): Promise<number> {
  if (!isIndexedDBAvailable()) return 0;
  return dbCount(STORES.SYNC_QUEUE);
}

// ── Remove a completed operation ──────────────────────────────

export async function dequeue(id: string): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  await dbDelete(STORES.SYNC_QUEUE, id);
}

// ── Mark an operation as failed (increment retries) ───────────

export async function markFailed(op: SyncOperation): Promise<void> {
  if (!isIndexedDBAvailable()) return;
  if (op.retries + 1 >= op.maxRetries) {
    // Exhausted retries — remove and emit error
    await dequeue(op.id);
    return;
  }
  await dbPut(STORES.SYNC_QUEUE, { ...op, retries: op.retries + 1 });
}

// ── Replay all pending operations against the server ──────────

interface ReplayResult {
  succeeded: number;
  failed:    number;
  remaining: number;
}

export async function replayQueue(
  onProgress?: (done: number, total: number) => void,
): Promise<ReplayResult> {
  const ops   = await getPendingOps();
  let succeeded = 0, failed = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    onProgress?.(i, ops.length);

    try {
      const res = await fetch(op.url, {
        method:  op.method,
        headers: { "Content-Type": "application/json", ...op.headers },
        body:    op.body,
      });

      if (res.ok || res.status === 409 /* conflict — treat as resolved */) {
        await dequeue(op.id);
        succeeded++;
      } else if (res.status >= 400 && res.status < 500) {
        // Client error — not retryable, remove
        await dequeue(op.id);
        failed++;
      } else {
        await markFailed(op);
        failed++;
      }
    } catch {
      // Network error — keep in queue, will retry
      await markFailed(op);
      failed++;
    }
  }

  const remaining = await getPendingCount();
  return { succeeded, failed, remaining };
}
