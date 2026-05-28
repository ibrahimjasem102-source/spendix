import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bootstrapAuthenticatedUser } from "@/lib/auth/bootstrap";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=oauth_callback`, request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback]", error);
    return NextResponse.redirect(new URL(`/login?error=oauth_callback`, request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await bootstrapAuthenticatedUser(supabase, user).catch((err) => {
      console.error("[auth/callback/bootstrap]", err);
    });
  }

  return NextResponse.redirect(new URL(`/auth/finalize?next=${encodeURIComponent(next)}`, request.url));
}
