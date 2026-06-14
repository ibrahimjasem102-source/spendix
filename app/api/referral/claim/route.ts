import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

// Called after signup with ?ref=CODE to link the referral
export async function POST(req: Request) {
  const limited = rateLimit(req, { key: "referral_claim", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  let body: { userId: string; code: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 }); }

  if (!body.userId || !body.code) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Find the referral
  const { data: referral } = await db
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("code", body.code)
    .eq("status", "pending")
    .single();

  if (!referral) {
    return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 404 });
  }

  // Cannot refer yourself
  if (referral.referrer_id === body.userId) {
    return NextResponse.json({ ok: false, error: "self_referral" }, { status: 400 });
  }

  // Check new user hasn't already been referred
  const { data: alreadyClaimed } = await db
    .from("referrals")
    .select("id")
    .eq("referred_id", body.userId)
    .single();

  if (alreadyClaimed) {
    return NextResponse.json({ ok: false, error: "already_claimed" }, { status: 409 });
  }

  // Mark referral as completed
  const rewardUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .from("referrals")
    .update({
      referred_id:  body.userId,
      status:       "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", referral.id);

  // Reward referrer: upgrade to Plus for 1 month in billing subscriptions table
  const { data: existingSub } = await db
    .from("subscriptions")
    .select("plan")
    .eq("user_id", referral.referrer_id)
    .single();

  if (!existingSub || existingSub.plan === "free") {
    await db.from("subscriptions").upsert({
      user_id:            referral.referrer_id,
      plan:               "plus",
      status:             "active",
      current_period_end: rewardUntil,
      updated_at:         new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  // Mark as rewarded
  await db
    .from("referrals")
    .update({ status: "rewarded", reward_until: rewardUntil })
    .eq("id", referral.id);

  return NextResponse.json({ ok: true, rewarded: true, rewardUntil });
}
