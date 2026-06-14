import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const VALID_EVENTS = new Set([
  "signup","login","onboarding_started","onboarding_step_completed","onboarding_completed",
  "subscription_upgrade_clicked","subscription_upgrade_completed","subscription_canceled",
  "referral_invite_sent","referral_claimed","feature_gated","ai_assistant_used",
  "report_generated","export_used","support_ticket_submitted","budget_created",
  "goal_created","transaction_added","account_connected",
]);

export async function POST(req: Request) {
  const limited = rateLimit(req, { key: "product_events", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  let body: { events: { name: string; properties?: Record<string, unknown>; timestamp: number; sessionId: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  // Try to get user — optional
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* ignore */ }

  const events = body.events
    .slice(0, 20)
    .filter(e => typeof e.name === "string" && e.name.length <= 64)
    .map(e => ({
      user_id:    userId,
      event_name: VALID_EVENTS.has(e.name) ? e.name : "custom_" + e.name.slice(0, 50),
      properties: e.properties ?? null,
      session_id: e.sessionId?.slice(0, 64),
      created_at: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
    }));

  if (events.length > 0) {
    try {
      const supabase = await createClient();
      await supabase.from("product_events").insert(events);
    } catch { /* analytics failure is non-fatal */ }
  }

  return NextResponse.json({ ok: true, saved: events.length });
}
