import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/plans";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function planFromPriceId(priceId: string): PlanId {
  const map: Record<string, PlanId> = {
    [process.env.STRIPE_PRICE_PLUS  ?? "__plus"]:  "plus",
    [process.env.STRIPE_PRICE_PRO   ?? "__pro"]:   "pro",
    [process.env.STRIPE_PRICE_ELITE ?? "__elite"]: "elite",
  };
  return map[priceId] ?? "free";
}

async function updateSubscription(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subscription: Stripe.Subscription,
) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  const priceId   = subscription.items.data[0]?.price.id ?? "";
  const plan      = planFromPriceId(priceId);
  const status    = subscription.status;
  // current_period_end is a unix timestamp in the Stripe API
  const periodEnd = "current_period_end" in subscription
    ? new Date((subscription.current_period_end as number) * 1000).toISOString()
    : null;

  await supabase.from("subscriptions").upsert({
    user_id:                userId,
    plan:                   status === "active" || status === "trialing" ? plan : "free",
    status,
    stripe_subscription_id: subscription.id,
    stripe_price_id:        priceId,
    current_period_end:     periodEnd,
    cancel_at_period_end:   subscription.cancel_at_period_end,
    stripe_customer_id:     subscription.customer as string,
  }, { onConflict: "user_id" });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body      = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await updateSubscription(supabase, event.data.object as Stripe.Subscription);
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string);
        if (!sub.metadata?.user_id && session.metadata?.user_id) {
          await getStripe().subscriptions.update(sub.id, {
            metadata: { user_id: session.metadata.user_id, plan: session.metadata.plan ?? "" },
          });
          sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id };
        }
        await updateSubscription(supabase, sub);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
