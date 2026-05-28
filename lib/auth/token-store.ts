let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken(): string | null {
  if (_token) return _token;

  // Fallback: read directly from localStorage (where @supabase/ssr stores the session)
  if (typeof window === "undefined") return null;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string };
    const token = parsed.access_token ?? null;
    if (token) _token = token; // cache it
    return token;
  } catch {
    return null;
  }
}
