import { getAuthToken, setAuthToken } from "@/lib/auth/token-store";

function sanitizeValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x00-\xff]/g, "");
}

function sanitizeHeaders(headers: HeadersInit | undefined): HeadersInit | undefined {
  if (!headers) return headers;

  if (headers instanceof Headers) {
    const safe = new Headers();
    headers.forEach((value, key) => safe.set(key, sanitizeValue(value)));
    return safe;
  }

  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [key, sanitizeValue(value)] as [string, string]);
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, string>)) {
    result[key] = sanitizeValue(String(value));
  }
  return result;
}

function isSameOrigin(input: RequestInfo | URL): boolean {
  const url =
    typeof input === "string" ? input :
    input instanceof URL ? input.href :
    (input as Request).url;
  if (url.startsWith("/")) return true;
  if (typeof window === "undefined") return false;
  return url.startsWith(window.location.origin);
}

async function resolveToken(): Promise<string | null> {
  // 1. Try in-memory / localStorage (fast, synchronous via token-store)
  const cached = getAuthToken();
  if (cached) return cached;

  // 2. Ask Supabase client directly — handles expired token refresh too
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (token) setAuthToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isSameOrigin(input)) {
    const token = await resolveToken();
    const authHeader: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    init = {
      credentials: "include",
      ...init,
      headers: {
        ...authHeader,
        ...(init?.headers as Record<string, string> | undefined),
      },
    };
  }
  if (init?.headers) {
    init = { ...init, headers: sanitizeHeaders(init.headers) };
  }
  return fetch(input, init);
}
