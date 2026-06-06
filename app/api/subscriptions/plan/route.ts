import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId, apiJson } from "@/lib/api/responses";
import type { PlanId } from "@/lib/plans";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end, stripe_subscription_id")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    // No subscription row yet → free plan
    return apiJson({ plan: "free" as PlanId, status: "active", current_period_end: null, cancel_at_period_end: false });
  }

  // Treat canceled/past_due as free
  const effectivePlan: PlanId =
    data.status === "active" || data.status === "trialing"
      ? (data.plan as PlanId)
      : "free";

  return apiJson({
    plan: effectivePlan,
    status: data.status,
    current_period_end: data.current_period_end,
    cancel_at_period_end: data.cancel_at_period_end,
    hasStripe: !!data.stripe_subscription_id,
  });
}
