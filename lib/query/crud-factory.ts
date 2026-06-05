"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { safeFetch } from "@/lib/fetch-safe";
import { setAuthToken } from "@/lib/auth/token-store";
import { notifyMutationError } from "@/lib/query/mutation-toast";

// ── Core fetch ─────────────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

// Refresh session and retry once on 401
async function refreshSessionToken(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    // Try 1: let Supabase use its internal refresh token
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      setAuthToken(data.session.access_token);
      return data.session.access_token;
    }

    // Try 2: use our stored refresh token explicitly
    const storedRefresh = typeof window !== "undefined"
      ? localStorage.getItem("spendix_refresh_token")
      : null;
    if (storedRefresh) {
      const { data: d2 } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
      if (d2.session?.access_token) {
        setAuthToken(d2.session.access_token);
        if (d2.session.refresh_token) localStorage.setItem("spendix_refresh_token", d2.session.refresh_token);
        return d2.session.access_token;
      }
    }

    // Try 3: getSession (auto-refresh fallback)
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      setAuthToken(sessionData.session.access_token);
      return sessionData.session.access_token;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const tid  = window.setTimeout(() => ctrl.abort(), 15_000);

  async function attempt(retrying = false): Promise<T> {
    const res     = await safeFetch(url, { ...init, cache: "no-store", signal: ctrl.signal });
    const payload = await res.json().catch(() => null) as Record<string, unknown> | null;

    if (res.status === 401 && !retrying) {
      // Token might be expired — refresh and retry once
      const newToken = await refreshSessionToken();
      if (newToken) return attempt(true);
      // Refresh also failed → session is truly invalid
      const { signedOut } = await import("@/lib/auth/session-manager");
      signedOut(); // clears token → isGuest=true → stops further API calls
      setTimeout(() => { window.location.replace("/login"); }, 2500);
    }

    if (!res.ok) {
      const err = new HttpError(
        (payload?.error ?? payload?.errorKey ?? `HTTP ${res.status}`) as string,
        res.status,
      );
      // Only show toast for mutations (POST/PUT/PATCH/DELETE), not background GET queries
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "GET") notifyMutationError(err);
      throw err;
    }
    return payload as T;
  }

  try {
    return await attempt();
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
  await fetchJson<unknown>(url, { method: "DELETE" });
}

// ── CRUD factory ──────────────────────────────────────────────────────────

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
