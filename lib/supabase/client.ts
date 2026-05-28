import { createBrowserClient } from "@supabase/ssr";
import { safeFetch } from "@/lib/fetch-safe";

/**
 * Supabase browser client with a safe fetch wrapper.
 * Prevents "non ISO-8859-1 code point" errors in Android WebView/Capacitor
 * by ensuring all request headers contain only ASCII-safe values.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: safeFetch as typeof fetch,
      },
    }
  );
}
