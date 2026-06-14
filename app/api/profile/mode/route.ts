import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import type { AppMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

const VALID_MODES: AppMode[] = ["personal", "business", "freelancer", "family"];

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const { data } = await supabase
    .from("profile_settings")
    .select("app_mode")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ mode: data?.app_mode ?? "personal" });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: { mode: AppMode };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ ok: false, error: "invalid_mode" }, { status: 400 });
  }

  await supabase.from("profile_settings").upsert({
    user_id:  user.id,
    app_mode: body.mode,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true, mode: body.mode });
}
