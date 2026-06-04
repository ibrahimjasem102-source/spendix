const SPENDIX_TOKEN_KEY = "spendix_access_token";

let _token: string | null = null;

// Auto-initialize synchronously from our own key (set on login/logout)
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(SPENDIX_TOKEN_KEY);
    if (stored) _token = stored;
  } catch {}
}

export function setAuthToken(token: string | null) {
  _token = token;
  // Persist to our own key so it survives page reloads
  try {
    if (token) localStorage.setItem(SPENDIX_TOKEN_KEY, token);
    else       localStorage.removeItem(SPENDIX_TOKEN_KEY);
  } catch {}
}

/** Decode JWT exp claim without cryptographic verification */
function jwtExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch { return null; }
}

export function isTokenExpired(token: string): boolean {
  const exp = jwtExpiresAt(token);
  if (!exp) return false; // can't tell → assume valid
  return Date.now() > exp - 30_000; // 30s buffer
}

export function getAuthToken(): string | null {
  if (_token) {
    // If cached token is expired, clear it so we force a refresh
    if (isTokenExpired(_token)) { _token = null; }
    else return _token;
  }
  // Try reading from our persisted key (survives page reloads)
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SPENDIX_TOKEN_KEY);
    if (stored && !isTokenExpired(stored)) { _token = stored; return stored; }
    if (stored && isTokenExpired(stored)) {
      // Remove expired token from storage
      localStorage.removeItem(SPENDIX_TOKEN_KEY);
    }
  } catch {}
  return null;
}
