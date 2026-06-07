/**
 * Single source of truth for the auth token.
 * Uses spendix_access_token as the primary localStorage key.
 */

export const TOKEN_KEY   = "spendix_access_token";
export const REFRESH_KEY = "spendix_refresh_token";

let _token: string | null = null;

if (typeof window !== "undefined") {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) _token = t;
  } catch {}
}

export function setAuthToken(token: string | null) {
  _token = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getAuthToken(): string | null {
  if (_token) return _token;
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      _token = stored;
      return stored;
    }
  } catch {}
  return null;
}

export function storeRefreshToken(token: string) {
  try { localStorage.setItem(REFRESH_KEY, token); } catch {}
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function clearTokens() {
  _token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return false;
    return Date.now() > payload.exp * 1000 - 30_000;
  } catch { return false; }
}
