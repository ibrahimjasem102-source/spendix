import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function GET() {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization");

  let user = null;
  let sessionError = null;
  let urlOk = false;
  let keyOk = false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  urlOk = url.startsWith("https://") && url.includes(".supabase.co");
  keyOk = key.startsWith("eyJ") && key.length > 100;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    user = data?.user ? { id: data.user.id, email: data.user.email } : null;
    sessionError = error?.message ?? null;
  } catch (e) {
    sessionError = String(e);
  }

  return NextResponse.json({
    url_set: urlOk,
    url_value: url.slice(0, 40) + "...",
    key_set: keyOk,
    key_prefix: key.slice(0, 20) + "...",
    has_auth_header: !!authorization,
    user_found: !!user,
    user_email: user?.email ?? null,
    session_error: sessionError,
  });
}
