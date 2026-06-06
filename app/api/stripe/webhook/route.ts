import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRIPE_PRICE_IDS } from "@/lib/stripe-prices";
import type { PlanId } from "@/lib/plans";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Build reverse map: price_id → plan name
function buildPriceMap(): Record<string, PlanId> {
  const map: Record<string, PlanId> = {};
  if (STRIPE_PRICE_IDS.plus)  map[STRIPE_PRICE_IDS.plus]  = "plus";
  if (STRIPE_PRICE_IDS.pro)   map[STRIPE_PRICE_IDS.pro]   = "pro";
  if (STRIPE_PRICE_IDS.elite) map[STRIPE_PRICE_IDS.elite] = "elite";
  return map;
}

function planFromPriceId(priceId: string): PlanId {
  return buildPriceMap()[priceId] ?? "free";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeSubAny = Record<string, any>;

async function upsertSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
) {
  const sub = subscription as unknown as StripeSubAny;
  const userId = sub.metadata?.user_id ?? sub.metadata?.client_reference_id;

  if (!userId) {
    console.warn("[webhook] Subscription has no user_id in metadata:", sub.id);
    return;
  }

  const priceId    = sub.items?.data?.[0]?.price?.id ?? "";
  const plan       = planFromPriceId(priceId);
  const status     = sub.status as string;
  const isActive   = status === "active" || status === "trialing";
  const periodEnd  = typeof sub.current_period_end === "number"
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const periodStart = typeof sub.current_period_start === "number"
    ? new Date(sub.current_period_start * 1000).toISOString()
    : null;

  const row = {
    user_id:                userId as string,
    plan:                   isActive ? plan : "free",
    status,
    stripe_subscription_id: sub.id as string,
    stripe_price_id:        priceId,
    stripe_customer_id:     sub.customer as string,
    current_period_start:   periodStart,
    current_period_end:     periodEnd,
    cancel_at_period_end:   sub.cancel_at_period_end as boolean,
    updated_at:             new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("subscriptions") as any).upsert(row, { onConflict: "user_id" });

  if (error) {
    console.error("[webhook] upsert error:", error.message);
  } else {
    console.log("[webhook] upserted subscription — user:", userId, "plan:", isActive ? plan : "free", "status:", status);
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // IMPORTANT: read raw body BEFORE any parsing
  const rawBody  = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[webhook] Invalid signature:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] Received event:", event.type);

  // Use admin client — Stripe has no user session/cookies
  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscription(supabase, event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubAny;
        const userId = sub.metadata?.user_id as string | undefined;
        if (userId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("subscriptions") as any).upsert({
            user_id:                userId,
            plan:                   "free",
            status:                 "canceled",
            stripe_subscription_id: sub.id as string,
            stripe_customer_id:     sub.customer as string,
            cancel_at_period_end:   false,
            updated_at:             new Date().toISOString(),
          }, { onConflict: "user_id" });
          console.log("[webhook] Subscription canceled — user:", userId);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;

        // Retrieve full subscription object
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);

        // Attach user_id to subscription metadata if not already there
        if (!sub.metadata?.user_id && userId) {
          await stripe.subscriptions.update(sub.id, {
            metadata: { user_id: userId, plan: session.metadata?.plan ?? "" },
          });
          (sub.metadata as Record<string, string>).user_id = userId;
        }

        await upsertSubscription(supabase, sub);
        break;
      }

      case "invoice.payment_succeeded": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(supabase, sub);
          console.log("[webhook] Payment succeeded — subscription:", subId);
        }
        break;
      }

      case "invoice.payment_failed": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertSubscription(supabase, sub);
          console.log("[webhook] Payment failed — subscription:", subId, "status:", sub.status);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[webhook] Handler error for", event.type, ":", (err as Error).message);
    // Still return 200 so Stripe doesn't retry — log the error internally
  }

  return NextResponse.json({ received: true });
}
