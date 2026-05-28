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
    const baseKey = `sb-${projectRef}-auth-token`;
    const raw = localStorage.getItem(baseKey);
    if (!raw) return null;

    let parsed: { access_token?: string };

    // @supabase/supabase-js v2.49+ may chunk large tokens across multiple keys
    if (raw === "chunked") {
      let assembled = "";
      for (let i = 0; ; i++) {
        const chunk = localStorage.getItem(`${baseKey}.${i}`);
        if (chunk === null) break;
        assembled += chunk;
      }
      if (!assembled) return null;
      parsed = JSON.parse(assembled) as { access_token?: string };
    } else {
      parsed = JSON.parse(raw) as { access_token?: string };
    }

    const token = parsed.access_token ?? null;
    if (token) _token = token; // cache it
    return token;
  } catch {
    return null;
  }
}
