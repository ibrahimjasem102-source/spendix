import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeFetch } from "@/lib/fetch-safe";

// Module-level singleton — all components share one Supabase client instance
// so that onAuthStateChange listeners, token refreshes, and cookie writes are
// coordinated rather than happening independently across multiple instances.
let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_client) return _client;

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: safeFetch as typeof fetch,
      },
    }
  );

  return _client;
}
