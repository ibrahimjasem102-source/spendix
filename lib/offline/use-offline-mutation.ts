"use client";

import { useCallback, useRef } from "react";
import { useIsOnline } from "./use-online";
import { enqueue } from "./sync-queue";
import type { SyncOperation } from "./db";

interface OfflineMutationOptions<TData> {
  url:     string;
  method:  SyncOperation["method"];
  headers?: Record<string, string>;
  // Called with the server response when online, or with optimistic data when offline
  onSuccess?: (data: TData, wasOffline: boolean) => void;
  onError?:   (err: Error) => void;
  // Return optimistic data to use while offline
  getOptimisticData?: (body: unknown) => TData;
}

interface MutationState {
  loading: boolean;
  error:   Error | null;
  queued:  boolean;
}

// Wraps a fetch call with offline fallback:
// - When online: normal fetch
// - When offline: enqueue to sync queue + return optimistic data
export function useOfflineMutation<TData = unknown>(options: OfflineMutationOptions<TData>) {
  const isOnline = useIsOnline();
  const stateRef = useRef<MutationState>({ loading: false, error: null, queued: false });

  const mutate = useCallback(async (body: unknown): Promise<TData | null> => {
    stateRef.current = { loading: true, error: null, queued: false };

    const bodyString = body != null ? JSON.stringify(body) : null;

    if (!isOnline) {
      // Queue the operation for later
      const optimisticId = crypto.randomUUID();
      await enqueue({
        url:          options.url,
        method:       options.method,
        body:         bodyString,
        headers:      options.headers ?? {},
        optimisticId,
      });

      const optimistic = options.getOptimisticData?.(body) ?? null;
      stateRef.current = { loading: false, error: null, queued: true };

      if (optimistic !== null) {
        options.onSuccess?.(optimistic, true);
      }

      return optimistic;
    }

    // Online: perform normally
    try {
      const res = await fetch(options.url, {
        method:  options.method,
        headers: { "Content-Type": "application/json", ...options.headers },
        body:    bodyString,
      });

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        stateRef.current = { loading: false, error: err, queued: false };
        options.onError?.(err);
        return null;
      }

      const data = (await res.json()) as TData;
      stateRef.current = { loading: false, error: null, queued: false };
      options.onSuccess?.(data, false);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // If fetch failed (network gone mid-request), queue it
      await enqueue({
        url:     options.url,
        method:  options.method,
        body:    bodyString,
        headers: options.headers ?? {},
      });

      const optimistic = options.getOptimisticData?.(body) ?? null;
      stateRef.current = { loading: false, error, queued: true };
      options.onError?.(error);
      return optimistic;
    }
  }, [isOnline, options]);

  return { mutate, state: stateRef.current };
}
