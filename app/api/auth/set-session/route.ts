import { createClient } from "@/lib/supabase/server";
import { apiJson } from "@/lib/api/responses";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
  };

  const { access_token, refresh_token } = body;

  if (!access_token || !refresh_token) {
    return apiJson({ ok: false, error: "Missing tokens" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error("[set-session] setSession failed:", error.message);
      return apiJson({ ok: false, error: error.message }, { status: 401 });
    }

    // Verify the session was actually stored
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token") || c.name.includes("sb-"));

    return apiJson({
      ok:          true,
      user_id:     data.session?.user?.id ?? null,
      cookie_set:  hasAuthCookie,
    });
  } catch (err) {
    console.error("[set-session] unexpected error:", err);
    return apiJson({ ok: false, error: String(err) }, { status: 500 });
  }
}
