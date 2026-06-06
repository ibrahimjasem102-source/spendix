import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { stripe } from "@/lib/stripe";
import { STRIPE_PRICE_IDS } from "@/lib/stripe-prices";
import type { PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

function planFromPriceId(priceId: string): PlanId {
  if (priceId === STRIPE_PRICE_IDS.plus)  return "plus";
  if (priceId === STRIPE_PRICE_IDS.pro)   return "pro";
  if (priceId === STRIPE_PRICE_IDS.elite) return "elite";
  return "free";
}

/**
 * POST /api/stripe/sync
 * Re-fetches the user's subscription from Stripe and updates Supabase.
 * Useful after a payment when the webhook may be delayed.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_subscription_id) {
    // No subscription on record — return free plan
    return NextResponse.json({ ok: true, plan: "free", status: "active" });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id) as any;
    const priceId   = stripeSub.items?.data?.[0]?.price?.id ?? "";
    const plan      = planFromPriceId(priceId);
    const isActive  = stripeSub.status === "active" || stripeSub.status === "trialing";
    const periodEnd = typeof stripeSub.current_period_end === "number"
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : null;
    const periodStart = typeof stripeSub.current_period_start === "number"
      ? new Date(stripeSub.current_period_start * 1000).toISOString()
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("subscriptions") as any).upsert({
      user_id:              user.id,
      plan:                 isActive ? plan : "free",
      status:               stripeSub.status,
      stripe_price_id:      priceId,
      current_period_start: periodStart,
      current_period_end:   periodEnd,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      updated_at:           new Date().toISOString(),
    }, { onConflict: "user_id" });

    console.log("[sync] Refreshed subscription for user:", user.id, "plan:", isActive ? plan : "free");

    return NextResponse.json({
      ok: true,
      plan: isActive ? plan : "free",
      status: stripeSub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: stripeSub.cancel_at_period_end,
    });
  } catch (err) {
    console.error("[sync] Stripe fetch error:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "Failed to sync subscription" }, { status: 500 });
  }
}
