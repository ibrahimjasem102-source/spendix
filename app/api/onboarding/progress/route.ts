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

  const data = body.data ?? {};

  // ── Execute the real side-effect for each step ───────────────────────────

  if (body.step === "currency" && data.currency) {
    await supabase.from("profile_settings").upsert({
      user_id:    user.id,
      currency:   data.currency,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  if (body.step === "account" && data.accountName?.trim()) {
    const balance = parseFloat(data.accountBalance ?? "0") || 0;
    await supabase.from("accounts").insert({
      user_id:      user.id,
      name:         data.accountName.trim(),
      account_type: "bank",
      balance,
      currency:     data.currency ?? "USD",
    });
  }

  if (body.step === "budget" && data.budgetAmount) {
    const amount = parseFloat(data.budgetAmount) || 0;
    if (amount > 0) {
      const now = new Date();
      // Get the first available category for this user to attach the budget to
      const { data: cats } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .limit(1)
        .maybeSingle();

      if (cats?.id) {
        await supabase.from("budgets").insert({
          user_id:       user.id,
          category_id:   cats.id,
          monthly_limit: amount,
          month:         now.getMonth() + 1,
          year:          now.getFullYear(),
        });
      }
    }
  }

  if (body.step === "goal" && data.goalName?.trim()) {
    const target = parseFloat(data.goalTarget ?? "0") || 0;
    if (target > 0) {
      await supabase.from("goals").insert({
        user_id:              user.id,
        title:                data.goalName.trim(),
        target_amount:        target,
        saved_amount:         0,
        monthly_contribution: 0,
        category:             "other",
        tracking_type:        "manual",
        start_date:           new Date().toISOString().slice(0, 10),
        due_date:             null,
        notes:                null,
        color:                null,
      });
    }
  }

  // ── Update onboarding progress record ────────────────────────────────────

  const { data: existing } = await supabase
    .from("onboarding_progress")
    .select("completed_steps, selected_currency")
    .eq("user_id", user.id)
    .single();

  const completedSteps = Array.from(new Set([...(existing?.completed_steps ?? []), body.step]));
  const currency = data.currency ?? existing?.selected_currency ?? null;

  await supabase.from("onboarding_progress").upsert({
    user_id:           user.id,
    completed_steps:   completedSteps,
    selected_currency: currency,
    updated_at:        new Date().toISOString(),
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
