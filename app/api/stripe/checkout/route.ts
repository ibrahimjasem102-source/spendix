import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { stripe } from "@/lib/stripe";
import { getStripePriceId, type BillingInterval } from "@/lib/stripe-prices";
import type { PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Simple per-user rate limit: max 5 checkout attempts per minute (serverless-safe via request scoping)
const _checkoutAttempts = new Map<string, { n: number; t: number }>();

function checkoutAllowed(userId: string): boolean {
  const now = Date.now();
  const entry = _checkoutAttempts.get(userId);
  if (!entry || entry.t <= now) {
    _checkoutAttempts.set(userId, { n: 1, t: now + 60_000 });
    return true;
  }
  entry.n += 1;
  return entry.n <= 5;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  // Rate limit per user
  if (!checkoutAllowed(user.id)) {
    return NextResponse.json(
      { ok: false, error: "Too many checkout attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  // Parse and validate plan + interval
  let plan: PlanId;
  let interval: BillingInterval = "monthly";
  try {
    const body = await request.json();
    plan     = body?.plan;
    interval = body?.interval === "yearly" ? "yearly" : "monthly";
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!plan || !["plus", "pro", "elite"].includes(plan)) {
    return NextResponse.json(
      { ok: false, error: "Invalid plan. Must be one of: plus, pro, elite" },
      { status: 400 }
    );
  }

  // Validate and get Price ID (throws if missing or invalid)
  let priceId: string;
  try {
    priceId = getStripePriceId(plan as Exclude<PlanId, "free">, interval);
  } catch (err) {
    console.error("[checkout] Price ID error:", (err as Error).message);
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured correctly. Contact support." },
      { status: 500 }
    );
  }

  // Check if already on this plan
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("plan, status, stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (existingSub?.plan === plan && existingSub?.status === "active") {
    return NextResponse.json(
      { ok: false, error: "You are already subscribed to this plan." },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://spendix-app.vercel.app";

  // Get or create Stripe customer
  let customerId = existingSub?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    await supabase.from("subscriptions").upsert(
      { user_id: user.id, plan: "free", status: "active", stripe_customer_id: customerId },
      { onConflict: "user_id" }
    );
  }

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/plans?success=1`,
    cancel_url:  `${origin}/plans?canceled=1`,
    client_reference_id: user.id,
    customer_email: !customerId ? (user.email ?? undefined) : undefined,
    metadata: { user_id: user.id, plan, interval },
    subscription_data: { metadata: { user_id: user.id, plan, interval } },
    allow_promotion_codes: true,
  });

  console.log("[checkout] Created session for user:", user.id, "plan:", plan);
  return NextResponse.json({ ok: true, url: session.url });
}
