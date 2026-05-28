import { createClient } from "@/lib/supabase/server";
import { unauthorized } from "@/lib/api/responses";

export async function requireUser(requestId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, response: unauthorized(requestId) };
  }

  return { supabase, user, response: null };
}
