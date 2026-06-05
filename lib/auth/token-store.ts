/**
 * Token store — reads the access token directly from Supabase's own storage.
 * No custom keys. No duplication. Single source of truth = Supabase.
 */

const REFRESH_KEY = "spendix_refresh_token";

let _token: string | null = null;

// Module-level sync init: read from Supabase's own localStorage key
if (typeof window !== "undefined") {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const ref = new URL(url).hostname.split(".")[0];
      const key = `sb-${ref}-auth-token`;
      const raw = localStorage.getItem(key);
      if (raw && raw !== "chunked") {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (parsed?.access_token) _token = parsed.access_token;
      } else if (raw === "chunked") {
        let joined = "";
        for (let i = 0; ; i++) {
          const chunk = localStorage.getItem(`${key}.${i}`);
          if (!chunk) break;
          joined += chunk;
        }
        if (joined) {
          const parsed = JSON.parse(joined) as { access_token?: string };
          if (parsed?.access_token) _token = parsed.access_token;
        }
      }
    }
  } catch {}
}

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  if (_token) return _token;
  if (typeof window === "undefined") return null;
  // Re-read from Supabase storage (always fresh)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const ref = new URL(url).hostname.split(".")[0];
    const key = `sb-${ref}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (raw === "chunked") {
      let joined = "";
      for (let i = 0; ; i++) {
        const chunk = localStorage.getItem(`${key}.${i}`);
        if (!chunk) break;
        joined += chunk;
      }
      const parsed = JSON.parse(joined) as { access_token?: string };
      if (parsed?.access_token) { _token = parsed.access_token; return _token; }
      return null;
    }
    const parsed = JSON.parse(raw) as { access_token?: string };
    if (parsed?.access_token) { _token = parsed.access_token; return _token; }
  } catch {}
  return null;
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return false;
    return Date.now() > payload.exp * 1000 - 30_000;
  } catch { return false; }
}

export function storeRefreshToken(token: string) {
  try { localStorage.setItem(REFRESH_KEY, token); } catch {}
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function clearTokens() {
  _token = null;
  try { localStorage.removeItem(REFRESH_KEY); } catch {}
}
