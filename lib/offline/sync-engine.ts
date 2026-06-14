"use client";

import { useEffect, useRef, useCallback } from "react";
import { useOnline } from "./use-online";
import { replayQueue, getPendingCount } from "./sync-queue";
import { isIndexedDBAvailable } from "./db";

interface SyncEngineOptions {
  onSyncStart?:    () => void;
  onSyncComplete?: (result: { succeeded: number; failed: number; remaining: number }) => void;
  onSyncError?:    (err: Error) => void;
  // Invalidate React Query cache after sync
  onInvalidate?:   () => void;
}

// Singleton — prevent multiple engines running simultaneously
let _syncInProgress = false;

export function useSyncEngine(options: SyncEngineOptions = {}) {
  const { isOnline, wasOffline } = useOnline();
  const optionsRef  = useRef(options);
  optionsRef.current = options;

  const sync = useCallback(async () => {
    if (_syncInProgress || !isIndexedDBAvailable()) return;

    const pending = await getPendingCount();
    if (pending === 0) return;

    _syncInProgress = true;
    optionsRef.current.onSyncStart?.();

    try {
      const result = await replayQueue();
      optionsRef.current.onSyncComplete?.(result);
      if (result.succeeded > 0) {
        optionsRef.current.onInvalidate?.();
      }
    } catch (err) {
      optionsRef.current.onSyncError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      _syncInProgress = false;
    }
  }, [isOnline]);

  // Trigger sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      void sync();
    }
  }, [wasOffline, isOnline, sync]);

  // Also sync on initial mount if online and there are pending ops
  useEffect(() => {
    if (isOnline) {
      void sync();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sync };
}
