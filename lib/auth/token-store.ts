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

export function getAuthToken(): string | null {
  if (_token) return _token;
  // Try reading from our persisted key (survives page reloads)
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SPENDIX_TOKEN_KEY);
    if (stored) { _token = stored; return stored; }
  } catch {}
  return null;
}
