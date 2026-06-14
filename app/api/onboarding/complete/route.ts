import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  await supabase.from("onboarding_progress").upsert({
    user_id:    user.id,
    is_complete: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
