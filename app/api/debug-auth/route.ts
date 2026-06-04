import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headers, cookies } from "next/headers";

export async function GET() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const authorization = headerStore.get("authorization");

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const urlOk    = url.startsWith("https://") && url.includes(".supabase.co");
  const keyOk    = key.startsWith("eyJ") && key.length > 100;
  const srvKeyOk = srvKey.startsWith("eyJ") && srvKey.length > 100;

  // Check for Supabase auth cookies
  const allCookies   = cookieStore.getAll();
  const authCookies  = allCookies.filter((c) =>
    c.name.includes("auth-token") || c.name.startsWith("sb-")
  );

  let user         = null;
  let sessionError = null;
  let authMethod   = "none";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    user         = data?.user ? { id: data.user.id, email: data.user.email } : null;
    sessionError = error?.message ?? null;
    if (user) authMethod = authorization ? "bearer" : "cookie";
  } catch (e) {
    sessionError = String(e);
  }

  return NextResponse.json({
    env: {
      url_ok:        urlOk,
      url_prefix:    url.slice(0, 45),
      anon_key_ok:   keyOk,
      srv_key_ok:    srvKeyOk,
    },
    request: {
      has_bearer_header: !!authorization,
      bearer_prefix:     authorization?.slice(0, 25) ?? null,
      auth_cookies:      authCookies.map((c) => c.name),
    },
    auth: {
      user_found:    !!user,
      user_email:    user?.email ?? null,
      auth_method:   authMethod,
      session_error: sessionError,
    },
    hint: !user
      ? authorization
        ? "Bearer token sent but user not found — token may be expired or invalid"
        : authCookies.length > 0
          ? "Auth cookies present but getUser() failed — cookies may be expired"
          : "No auth header and no cookies — set-session likely failed. Try logging out and back in."
      : "✓ Authenticated",
  });
}
