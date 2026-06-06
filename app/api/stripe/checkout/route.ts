import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { getStripe } from "@/lib/stripe";
import { STRIPE_PRICES, type PlanId } from "@/lib/plans";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const { plan } = (await request.json()) as { plan: PlanId };
  const priceId = STRIPE_PRICES[plan];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan or price not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = request.headers.get("origin") ?? "https://spendix-app.vercel.app";

  // Get or create Stripe customer
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  let customerId = sub?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    // Store customer ID
    await supabase.from("subscriptions").upsert({
      user_id: user.id,
      plan: "free",
      status: "active",
      stripe_customer_id: customerId,
    }, { onConflict: "user_id" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/plans?success=1`,
    cancel_url:  `${origin}/plans?canceled=1`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
