import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

const VALID_STEPS = ["welcome", "currency", "account", "budget", "goal"] as const;

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  let body: { step: string; data?: Record<string, string> };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!VALID_STEPS.includes(body.step as typeof VALID_STEPS[number])) {
    return NextResponse.json({ ok: false, error: "invalid_step" }, { status: 400 });
  }

  // Upsert the onboarding progress row
  const { data: existing } = await supabase
    .from("onboarding_progress")
    .select("completed_steps, selected_currency")
    .eq("user_id", user.id)
    .single();

  const completedSteps = Array.from(new Set([...(existing?.completed_steps ?? []), body.step]));
  const currency = body.data?.currency ?? existing?.selected_currency ?? null;

  await supabase.from("onboarding_progress").upsert({
    user_id:          user.id,
    completed_steps:  completedSteps,
    selected_currency: currency,
    updated_at:       new Date().toISOString(),
  }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true, completedSteps });
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const { data } = await supabase
    .from("onboarding_progress")
    .select("completed_steps, selected_currency, is_complete")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    completed_steps:   data?.completed_steps ?? [],
    selected_currency: data?.selected_currency ?? "USD",
    is_complete:       data?.is_complete ?? false,
  });
}
