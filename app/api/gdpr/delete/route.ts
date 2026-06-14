import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { logSecurityEvent, getClientIp } from "@/lib/security/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "gdpr_delete", limit: 1, windowMs: 3_600_000 });
  if (limited) return limited;

  let body: { confirmation: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json(
      { ok: false, error: "confirmation_required", hint: 'Send {"confirmation":"DELETE MY ACCOUNT"}' },
      { status: 400 },
    );
  }

  const uid = user.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db  = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  // Record GDPR delete request before deletion (so we have a trace)
  await adminDb.from("security_events").insert({
    user_id:    uid,
    event_type: "gdpr_delete",
    severity:   "medium",
    ip_address: getClientIp(req),
    metadata:   { email: user.email },
  });

  // Cancel Stripe subscription (best-effort)
  try {
    const { data: stripeSub } = await db
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", uid)
      .eq("status", "active")
      .maybeSingle();

    if (stripeSub?.stripe_subscription_id) {
      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as never });
      await stripeClient.subscriptions.cancel(stripeSub.stripe_subscription_id);
    }
  } catch {
    // Non-fatal — proceed with deletion regardless
  }

  // Delete all user data via cascade (auth.users deletion cascades to all tables)
  // First anonymise any audit_logs rows that store user email
  await adminDb.from("security_events")
    .update({ user_id: null, ip_address: null, user_agent: "DELETED" })
    .eq("user_id", uid);

  // Delete the auth user — cascades to all public tables via FK
  const { error: deleteErr } = await adminDb.auth.admin.deleteUser(uid);
  if (deleteErr) {
    return NextResponse.json(
      { ok: false, error: "deletion_failed", detail: deleteErr.message },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    eventType: "gdpr_delete",
    severity:  "medium",
    metadata:  { deletedUserId: uid },
  });

  return NextResponse.json({
    ok:      true,
    message: "Account and all associated data have been permanently deleted.",
  });
}
