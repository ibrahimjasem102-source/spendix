"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { safeFetch } from "@/lib/fetch-safe";

// ── Core fetch ─────────────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const tid = window.setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await safeFetch(url, { ...init, cache: "no-store", signal: ctrl.signal });
    const payload = await res.json().catch(() => null);
    if (!res.ok)
      throw new HttpError(payload?.error ?? payload?.errorKey ?? `HTTP ${res.status}`, res.status);
    return payload as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      throw new Error("Request timed out");
    throw err;
  } finally {
    window.clearTimeout(tid);
  }
}

// ── JSON request shortcuts ─────────────────────────────────────────────────

const j = (body: unknown) => ({
  headers: { "Content-Type": "application/json" } as Record<string, string>,
  body: JSON.stringify(body),
});

export const postJson  = <T>(url: string, body: unknown) => fetchJson<T>(url, { method: "POST",  ...j(body) });
export const putJson   = <T>(url: string, body: unknown) => fetchJson<T>(url, { method: "PUT",   ...j(body) });
export const patchJson = <T>(url: string, body: unknown) => fetchJson<T>(url, { method: "PATCH", ...j(body) });

export async function deleteItem(url: string): Promise<void> {
  const r = await safeFetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

// ── CRUD factory ─────────────────────────────────────────────────────────────
// Returns three React hooks (useCreate, useUpdate, useDelete) for any entity
// that follows the standard REST CRUD pattern. Call makeCrud() at module level,
// then export the returned hooks — they obey React hook rules when consumed.

export interface CrudConfig<T, TCreate, TUpdate = Partial<TCreate>> {
  keys: { all: QueryKey; list: () => QueryKey };
  endpoint: string;
  responseKey: string;
  updateMethod?: "PUT" | "PATCH";
  onCreateSuccess?: (item: T, qc: QueryClient) => void;
  onUpdateSuccess?: (item: T, vars: { id: string; data: TUpdate }, qc: QueryClient) => void;
  onDeleteSuccess?: (id: string, qc: QueryClient) => void;
}

export function makeCrud<T extends { id: string }, TCreate, TUpdate = Partial<TCreate>>(
  cfg: CrudConfig<T, TCreate, TUpdate>,
) {
  const { keys, endpoint, responseKey } = cfg;
  const method = cfg.updateMethod ?? "PUT";
  const settle = (qc: QueryClient) =>
    void qc.invalidateQueries({ queryKey: keys.all, refetchType: "all" });

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: TCreate) =>
        postJson<Record<string, T>>(endpoint, body).then((r) => r[responseKey] as T),
      onSuccess: (item) => cfg.onCreateSuccess?.(item, qc),
      onSettled: () => settle(qc),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdate }) =>
        (method === "PATCH" ? patchJson : putJson)<Record<string, T>>(
          `${endpoint}/${id}`, data,
        ).then((r) => r[responseKey] as T),
      onSuccess: (item, vars) => cfg.onUpdateSuccess?.(item, vars, qc),
      onSettled: () => settle(qc),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    type Ctx = { previous?: T[] };
    return useMutation<string, Error, string, Ctx>({
      mutationFn: async (id: string) => { await deleteItem(`${endpoint}/${id}`); return id; },
      onMutate: async (id): Promise<Ctx> => {
        await qc.cancelQueries({ queryKey: keys.list() });
        const previous = qc.getQueryData<T[]>(keys.list());
        qc.setQueryData<T[]>(keys.list(), (old = []) => old.filter((it) => it.id !== id));
        return { previous };
      },
      onError: (_e, _id, ctx) => {
        if (ctx?.previous) qc.setQueryData(keys.list(), ctx.previous);
      },
      onSuccess: (id) => cfg.onDeleteSuccess?.(id, qc),
      onSettled: () => settle(qc),
    });
  }

  return { useCreate, useUpdate, useDelete };
}
