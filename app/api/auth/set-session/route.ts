import { createClient } from "@/lib/supabase/server";
import { apiJson } from "@/lib/api/responses";

export async function POST(request: Request) {
  const { access_token, refresh_token } = await request.json();

  if (!access_token || !refresh_token) {
    return apiJson({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return apiJson({ ok: false }, { status: 401 });
  }

  return apiJson({ ok: true });
}
