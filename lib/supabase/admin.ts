import "server-only";
import { createClient } from "@supabase/supabase-js";

// Singleton — reuse across requests in the same serverless instance
let _admin: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return _admin;
}
