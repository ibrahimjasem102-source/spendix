"use client";

import { setAuthToken, clearTokens, storeRefreshToken, getAuthToken, getRefreshToken } from "./token-store";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

type Listener = (state: SessionState) => void;

// ── Module-level singleton ─────────────────────────────────────────────────

let _state: SessionState = { isAuthenticated: false, isLoading: true, accessToken: null };
let _initialized = false;
const _listeners = new Set<Listener>();

function _notify(): void {
  const snap = { ..._state };
  _listeners.forEach((fn) => fn(snap));
}

function _syncCookies(accessToken: string, refreshToken: string | null | undefined): void {
  if (!refreshToken || typeof window === "undefined") return;
  fetch("/api/auth/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  }).catch(() => undefined);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getSessionState(): SessionState {
  return { ..._state };
}

export function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

/** Returns the current access token, falling back to localStorage */
export function getToken(): string | null {
  return _state.accessToken ?? getAuthToken();
}

/** Call after a successful login, signup, or OAuth flow */
export function signedIn(accessToken: string, refreshToken?: string): void {
  setAuthToken(accessToken);
  if (refreshToken) storeRefreshToken(refreshToken);
  _state = { isAuthenticated: true, isLoading: false, accessToken };
  _notify();
}

/** Call on logout */
export function signedOut(): void {
  clearTokens();
  _state = { isAuthenticated: false, isLoading: false, accessToken: null };
  _notify();
}

/** @deprecated — check getSessionState().isAuthenticated instead */
export function initSession(): boolean {
  return !!getAuthToken();
}

/**
 * One-time async session initialization — called by GuestProvider on mount.
 *
 * Tries Supabase's stored session first, falls back to the localStorage refresh
 * token (Capacitor WebView scenario), and marks unauthenticated if neither works.
 * Also registers an onAuthStateChange listener that handles token refresh and
 * sign-out events for the lifetime of the page.
 */
export async function init(): Promise<void> {
  if (typeof window === "undefined") return;
  if (_initialized) return;
  _initialized = true;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  // Register ongoing auth event listener BEFORE getSession so we don't miss
  // any TOKEN_REFRESHED / SIGNED_OUT that fires during initialization.
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
      const refresh = session.refresh_token ?? getRefreshToken() ?? undefined;
      signedIn(session.access_token, refresh);
      if (event === "TOKEN_REFRESHED") {
        _syncCookies(session.access_token, refresh ?? null);
      }
    } else if (event === "SIGNED_OUT") {
      signedOut();
    }
  });

  // Get current session (Supabase checks its internal cookie-backed storage)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const refresh = session.refresh_token ?? getRefreshToken() ?? undefined;
    signedIn(session.access_token, refresh);
    _syncCookies(session.access_token, refresh ?? null);
    return;
  }

  // Fallback: stored refresh token in localStorage (Capacitor WebView cleared cookies)
  const storedRefresh = getRefreshToken();
  if (storedRefresh) {
    const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefresh });
    if (data.session?.access_token) {
      const { access_token, refresh_token } = data.session;
      signedIn(access_token, refresh_token ?? undefined);
      await fetch("/api/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
      }).catch(() => undefined);
      return;
    }
  }

  // No session found — mark as unauthenticated and stop loading
  signedOut();
}

/**
 * Called by SessionRestorer on visibility change (app resume from background).
 * Re-checks the Supabase session to keep server cookies warm.
 */
export async function refreshOnResume(): Promise<void> {
  if (typeof window === "undefined") return;
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    const refresh = session.refresh_token ?? getRefreshToken() ?? undefined;
    signedIn(session.access_token, refresh);
    _syncCookies(session.access_token, refresh ?? null);
  }
}
