import { createClient } from "@/lib/supabase/server";
import { apiJson } from "@/lib/api/responses";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
  };

  const { access_token, refresh_token } = body;

  if (!access_token || !refresh_token) {
    return apiJson({ ok: false }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) return apiJson({ ok: false }, { status: 401 });
    return apiJson({ ok: true, user_id: data.session?.user?.id ?? null });
  } catch {
    return apiJson({ ok: false }, { status: 500 });
  }
}
