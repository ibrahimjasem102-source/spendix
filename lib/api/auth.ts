import { createClient } from "@/lib/supabase/server";
import { unauthorized } from "@/lib/api/responses";

export async function requireUser(requestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  // TEMP DIAGNOSTIC
  if (process.env.NODE_ENV === "production") {
    console.log("[requireUser] user:", user?.id ?? "NULL", "error:", error?.message ?? "none");
  }

  if (!user) {
    return { supabase, user: null, response: unauthorized(requestId) };
  }

  return { supabase, user, response: null };
}
