import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

function generateCode(userId: string): string {
  const prefix = userId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "referral_invite", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  // Check if user already has a referral code
  const { data: existing } = await supabase
    .from("referrals")
    .select("code, status, completed_at")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: true });

  // Get or create the pending invite code
  let code = existing?.find(r => r.status === "pending")?.code;

  if (!code) {
    code = generateCode(user.id);
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await supabase.from("referrals").insert({
        referrer_id: user.id,
        code,
        status: "pending",
      });
      if (!error) break;
      // Collision — try again
      code = generateCode(user.id);
      attempts++;
    }
  }

  const completed = existing?.filter(r => r.status === "rewarded") ?? [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://spendix-app.vercel.app";
  const inviteUrl = `${appUrl}/signup?ref=${code}`;

  return NextResponse.json({
    ok: true,
    code,
    inviteUrl,
    totalReferrals: existing?.length ?? 0,
    completedReferrals: completed.length,
  });
}
