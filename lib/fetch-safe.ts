import { getAuthToken } from "@/lib/auth/token-store";

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

export function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isSameOrigin(input)) {
    const token = getAuthToken();
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
