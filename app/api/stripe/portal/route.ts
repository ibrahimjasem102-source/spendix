import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const stripe = getStripe();
  const origin = request.headers.get("origin") ?? "https://spendix-app.vercel.app";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/plans`,
  });

  return NextResponse.json({ url: portalSession.url });
}
